import { createHash } from 'node:crypto';

import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, METODOS_PAGO } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import {
  aplicarEventoPagoMiembro,
  construirCheckoutDesdeToken,
} from '../src/servicios/pagosMiembro.servicio.js';
import { firmarTokenPagoMiembro } from '../src/utilidades/token.js';
import { limpiarColecciones } from './configuracion.js';

const app = crearServidor();

/**
 * Pago en linea de un miembro al Wompi DEL GIMNASIO. Nada toca la red: el
 * checkout se arma como URL (se inspecciona), y el webhook se firma a mano con
 * el secreto del gimnasio para verificar que solo un evento legitimo renueva.
 */

const WOMPI = {
  llavePublica: 'pub_test_llave',
  secretoIntegridad: 'test_integrity_xyz',
  secretoEventos: 'test_events_abc',
};
const PRECIO = 60_000;

/** Un gimnasio con Wompi configurado, un miembro y un primer pago (efectivo). */
async function montar({ conWompi = true, email } = {}) {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });
    return obtenerModelo('Tenant').create({
      nombre: 'GlowUp',
      nit: '900999',
      slug: `glow-${Math.random().toString(36).slice(2, 8)}`,
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
      config: conWompi ? { wompi: WOMPI } : {},
    });
  });

  const contexto = await ejecutarConTenant(tenant._id, async () => {
    const sede = await obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 100' });
    const planMembresia = await obtenerModelo('PlanMembresia').create({
      nombre: 'Mensual',
      precio: PRECIO,
      duracionMeses: 1,
    });
    const miembro = await obtenerModelo('Miembro').create({
      sede: sede._id,
      nombres: 'Carlos',
      apellidos: 'Ruiz',
      documento: '111',
      telefono: '573001112233',
      email,
    });
    // Pago inicial ya vencido: el ultimo plan del miembro sale de aqui.
    await obtenerModelo('Pago').create({
      sede: sede._id,
      miembro: miembro._id,
      planMembresia: planMembresia._id,
      monto: PRECIO,
      metodoPago: METODOS_PAGO.EFECTIVO,
      periodoInicio: new Date('2026-01-01'),
      periodoFin: new Date('2026-02-01'),
      registradoPor: null,
    });
    return { sede, planMembresia, miembro };
  });

  return { tenant, ...contexto };
}

/** Firma un evento de Wompi como lo haria la pasarela real, con un secreto dado. */
function firmarEvento({ transaction, secreto, timestamp = 1_700_000_000 }) {
  const propiedades = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const valores = propiedades.map((ruta) => {
    const clave = ruta.split('.')[1];
    return transaction[clave];
  });
  const checksum = createHash('sha256')
    .update(`${valores.join('')}${timestamp}${secreto}`, 'utf8')
    .digest('hex');

  return {
    event: 'transaction.updated',
    data: { transaction },
    timestamp,
    signature: { properties: propiedades, checksum },
  };
}

function transaccionAprobada(referencia, sobrescribir = {}) {
  return {
    id: `wt-${Math.random().toString(36).slice(2)}`,
    status: 'APPROVED',
    amount_in_cents: PRECIO * 100,
    reference: referencia,
    ...sobrescribir,
  };
}

/** Extrae la `reference` que quedaria en la URL del checkout. */
function referenciaDe(urlCheckout) {
  return new URL(urlCheckout).searchParams.get('reference');
}

async function contarPagos(tenantId, filtro = {}) {
  return ejecutarConTenant(tenantId, () => obtenerModelo('Pago').countDocuments(filtro));
}

beforeEach(limpiarColecciones);

describe('construirCheckoutDesdeToken (enlace Pagar ahora)', () => {
  it('arma el checkout firmado con las llaves del gimnasio y prellena al miembro', async () => {
    const { tenant, miembro } = await montar({ email: 'carlos@correo.co' });
    const token = firmarTokenPagoMiembro({ miembroId: miembro._id, tenantId: tenant._id });

    const url = await construirCheckoutDesdeToken(token);
    const params = new URL(url).searchParams;

    expect(params.get('public-key')).toBe(WOMPI.llavePublica);
    expect(params.get('amount-in-cents')).toBe(String(PRECIO * 100));
    expect(params.get('reference')).toMatch(new RegExp(`^MB-${tenant._id}-${miembro._id}-`));
    expect(params.get('signature:integrity')).toBeTruthy();
    expect(params.get('customer-data:full-name')).toBe('Carlos Ruiz');
    expect(params.get('customer-data:phone-number')).toBe('573001112233');
    expect(params.get('customer-data:email')).toBe('carlos@correo.co');
  });

  it('rechaza un token invalido', async () => {
    await expect(construirCheckoutDesdeToken('no-es-un-token')).rejects.toThrow(/no es valido/i);
  });

  it('rechaza si el gimnasio no configuro Wompi', async () => {
    const { tenant, miembro } = await montar({ conWompi: false });
    const token = firmarTokenPagoMiembro({ miembroId: miembro._id, tenantId: tenant._id });

    await expect(construirCheckoutDesdeToken(token)).rejects.toThrow(/pago en linea/i);
  });
});

describe('aplicarEventoPagoMiembro (webhook)', () => {
  async function enlaceYReferencia(datos) {
    const montado = await montar(datos);
    const token = firmarTokenPagoMiembro({
      miembroId: montado.miembro._id,
      tenantId: montado.tenant._id,
    });
    const referencia = referenciaDe(await construirCheckoutDesdeToken(token));
    return { ...montado, referencia };
  }

  it('un evento aprobado y bien firmado crea el Pago y renueva la mensualidad', async () => {
    const { tenant, miembro, referencia } = await enlaceYReferencia();
    const transaction = transaccionAprobada(referencia);
    const evento = firmarEvento({ transaction, secreto: WOMPI.secretoEventos });

    const resultado = await aplicarEventoPagoMiembro(evento);
    expect(resultado.resultado).toBe('pagado');

    const pago = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('Pago').findOne({ transaccionWompi: transaction.id }),
    );
    expect(pago).not.toBeNull();
    expect(pago.metodoPago).toBe(METODOS_PAGO.WOMPI);
    expect(pago.monto).toBe(PRECIO);
    expect(pago.registradoPor).toBeNull();
    expect(pago.miembro.toString()).toBe(miembro._id.toString());
  });

  it('es idempotente: el mismo evento dos veces crea UN solo pago', async () => {
    const { tenant, referencia } = await enlaceYReferencia();
    const evento = firmarEvento({ transaction: transaccionAprobada(referencia), secreto: WOMPI.secretoEventos });

    await aplicarEventoPagoMiembro(evento);
    const segundo = await aplicarEventoPagoMiembro(evento);
    expect(segundo.ignorado).toBe('ya_registrado');

    // El inicial (efectivo) + el de Wompi = 2. No 3.
    expect(await contarPagos(tenant._id)).toBe(2);
  });

  it('rechaza un evento con firma invalida (secreto equivocado)', async () => {
    const { referencia } = await enlaceYReferencia();
    const evento = firmarEvento({ transaction: transaccionAprobada(referencia), secreto: 'secreto-de-impostor' });

    await expect(aplicarEventoPagoMiembro(evento)).rejects.toThrow(/firma/i);
  });

  it('un evento no aprobado no crea pago', async () => {
    const { tenant, referencia } = await enlaceYReferencia();
    const transaction = transaccionAprobada(referencia, { status: 'DECLINED' });
    const evento = firmarEvento({ transaction, secreto: WOMPI.secretoEventos });

    const resultado = await aplicarEventoPagoMiembro(evento);
    expect(resultado.ignorado).toBe('transaccion_no_aprobada');
    expect(await contarPagos(tenant._id)).toBe(1); // solo el inicial
  });

  it('si el monto no coincide con el plan, no crea pago', async () => {
    const { tenant, referencia } = await enlaceYReferencia();
    const transaction = transaccionAprobada(referencia, { amount_in_cents: 1 });
    const evento = firmarEvento({ transaction, secreto: WOMPI.secretoEventos });

    const resultado = await aplicarEventoPagoMiembro(evento);
    expect(resultado.ignorado).toBe('monto_no_coincide');
    expect(await contarPagos(tenant._id)).toBe(1);
  });

  it('ignora un evento cuya referencia no es de un pago de miembro', async () => {
    const evento = firmarEvento({
      transaction: transaccionAprobada('FACTURA-PLATAFORMA-123'),
      secreto: WOMPI.secretoEventos,
    });
    const resultado = await aplicarEventoPagoMiembro(evento);
    expect(resultado.ignorado).toBe('referencia_ajena');
  });
});

describe('rutas HTTP (cableado real)', () => {
  it('GET /api/pagar/:token redirige (302) al checkout de Wompi', async () => {
    const { tenant, miembro } = await montar();
    const token = firmarTokenPagoMiembro({ miembroId: miembro._id, tenantId: tenant._id });

    const respuesta = await peticion(app).get(`/api/pagar/${token}`).expect(302);
    expect(respuesta.headers.location).toContain('checkout.wompi.co');
    expect(respuesta.headers.location).toContain(`public-key=${WOMPI.llavePublica}`);
  });

  it('GET /api/pagar/:token con token malo muestra una pagina, no un JSON', async () => {
    const respuesta = await peticion(app).get('/api/pagar/token-invalido').expect(400);
    expect(respuesta.headers['content-type']).toMatch(/html/);
  });

  it('POST /api/webhooks/wompi-miembro con firma valida responde 200 y crea el pago', async () => {
    const { tenant, miembro } = await montar();
    const token = firmarTokenPagoMiembro({ miembroId: miembro._id, tenantId: tenant._id });
    const referencia = referenciaDe(await construirCheckoutDesdeToken(token));
    const evento = firmarEvento({ transaction: transaccionAprobada(referencia), secreto: WOMPI.secretoEventos });

    const respuesta = await peticion(app).post('/api/webhooks/wompi-miembro').send(evento).expect(200);
    expect(respuesta.body.data.resultado).toBe('pagado');
    expect(await contarPagos(tenant._id, { metodoPago: METODOS_PAGO.WOMPI })).toBe(1);
  });

  it('POST /api/webhooks/wompi-miembro con firma invalida responde 401', async () => {
    const { tenant, miembro } = await montar();
    const token = firmarTokenPagoMiembro({ miembroId: miembro._id, tenantId: tenant._id });
    const referencia = referenciaDe(await construirCheckoutDesdeToken(token));
    const evento = firmarEvento({ transaction: transaccionAprobada(referencia), secreto: 'impostor' });

    await peticion(app).post('/api/webhooks/wompi-miembro').send(evento).expect(401);
  });
});
