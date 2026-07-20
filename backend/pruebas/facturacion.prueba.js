import { createHash } from 'node:crypto';
import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DIAS_GRACIA_PAGO,
  ESTADOS_FACTURA,
  ESTADOS_TENANT,
  ESTADOS_TRANSACCION_WOMPI,
  EVENTO_WOMPI_TRANSACCION,
  ROLES,
} from '../src/config/constantes.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { construirEnlaceCheckout, verificarChecksumEvento } from '../src/pasarelas/wompi.pasarela.js';
import { crearServidor } from '../src/servidor.js';
import { ejecutarCobranza } from '../src/tareas/facturacion.tarea.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { inicioDeMes, sumarDias } from '../src/utilidades/fechas.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Facturacion de plataforma y pasarela Wompi.
 *
 * Lo que se protege aqui es dinero: que un webhook falsificado no marque una
 * factura como pagada, que un reintento no cobre dos veces, que un monto
 * manipulado no pase, y que un gimnasio cancelado no reviva pagando.
 */

const CONTRASENA = 'ClaveInicial1';
const PRECIO_MENSUAL = 80_000;
const PRECIO_EN_CENTAVOS = PRECIO_MENSUAL * 100;

const app = crearServidor();

async function montarGimnasio({ slug = 'gimnasio-factura', estado = ESTADOS_TENANT.TRIAL } = {}) {
  return ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: PRECIO_MENSUAL,
      limites: { maxSedes: 2, maxMiembros: 3, maxUsuarios: 2 },
    });

    const tenant = await obtenerModelo('Tenant').create({
      nombre: 'Gimnasio Factura',
      nit: '900111',
      slug,
      estado,
      planPlataforma: plan._id,
    });

    const duena = await obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: `owner@${slug}.co`,
      contrasenaHash: await cifrarContrasena(CONTRASENA),
      rol: ROLES.TENANT_OWNER,
      debeCambiarContrasena: false,
    });

    return { tenant, plan, duena };
  });
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

function leerFactura(referencia) {
  return ejecutarSinTenant(() => obtenerModelo('FacturaPlataforma').findOne({ referencia }));
}

function leerTenant(id) {
  return ejecutarSinTenant(() => obtenerModelo('Tenant').findById(id));
}

/**
 * Firma un evento tal como lo hace Wompi: concatena los valores de
 * `signature.properties` (rutas con puntos dentro de `data`), luego el
 * timestamp, luego el secreto de eventos, y aplica SHA256.
 */
function firmarEvento({ referencia, estado = ESTADOS_TRANSACCION_WOMPI.APROBADA, centavos = PRECIO_EN_CENTAVOS, id = 'trx-1' }) {
  const evento = {
    event: EVENTO_WOMPI_TRANSACCION,
    data: {
      transaction: {
        id,
        reference: referencia,
        status: estado,
        amount_in_cents: centavos,
        payment_method_type: 'CARD',
      },
    },
    timestamp: 1_530_291_411,
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
  };

  const valores = `${id}${estado}${centavos}`;
  const cadena = `${valores}${evento.timestamp}${entorno.WOMPI_SECRETO_EVENTOS}`;
  evento.signature.checksum = createHash('sha256').update(cadena, 'utf8').digest('hex');

  return evento;
}

const enviarWebhook = (evento) => peticion(app).post('/api/webhooks/wompi').send(evento);

beforeEach(limpiarColecciones);

describe('firma de integridad del checkout', () => {
  it('firma con SHA256(referencia + centavos + moneda + secreto) y arma la URL', () => {
    const url = new URL(construirEnlaceCheckout({ referencia: 'GS-2026-07-abc', monto: 80_000 }));

    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/');
    expect(url.searchParams.get('amount-in-cents')).toBe('8000000');
    expect(url.searchParams.get('currency')).toBe('COP');
    expect(url.searchParams.get('reference')).toBe('GS-2026-07-abc');

    const esperada = createHash('sha256')
      .update(`GS-2026-07-abc8000000COP${entorno.WOMPI_SECRETO_INTEGRIDAD}`, 'utf8')
      .digest('hex');
    expect(url.searchParams.get('signature:integrity')).toBe(esperada);
  });

  it('el secreto de integridad nunca viaja en la URL', () => {
    const url = construirEnlaceCheckout({ referencia: 'GS-2026-07-abc', monto: 80_000 });
    expect(url).not.toContain(entorno.WOMPI_SECRETO_INTEGRIDAD);
  });
});

describe('verificacion del checksum del evento', () => {
  it('acepta un evento bien firmado', () => {
    expect(verificarChecksumEvento(firmarEvento({ referencia: 'r1' }))).toBe(true);
  });

  it('rechaza un checksum manipulado', () => {
    const evento = firmarEvento({ referencia: 'r1' });
    evento.signature.checksum = 'a'.repeat(64);
    expect(verificarChecksumEvento(evento)).toBe(false);
  });

  it('rechaza si cambian el monto despues de firmar', () => {
    const evento = firmarEvento({ referencia: 'r1' });
    evento.data.transaction.amount_in_cents = 1;
    expect(verificarChecksumEvento(evento)).toBe(false);
  });

  it('rechaza si cambian el timestamp despues de firmar', () => {
    const evento = firmarEvento({ referencia: 'r1' });
    evento.timestamp = 1;
    expect(verificarChecksumEvento(evento)).toBe(false);
  });

  it('rechaza un evento sin firma', () => {
    expect(verificarChecksumEvento({ event: EVENTO_WOMPI_TRANSACCION, data: {} })).toBe(false);
    expect(verificarChecksumEvento({})).toBe(false);
  });

  /** Las `properties` se leen del evento; no se pueden quemar en el codigo. */
  it('respeta el orden y el contenido de signature.properties que venga', () => {
    const evento = firmarEvento({ referencia: 'r1' });
    evento.signature.properties = ['transaction.status', 'transaction.id', 'transaction.amount_in_cents'];
    // Con otro orden, la misma firma ya no cuadra.
    expect(verificarChecksumEvento(evento)).toBe(false);
  });

  it('rechaza si una propiedad firmada no existe en el evento', () => {
    const evento = firmarEvento({ referencia: 'r1' });
    evento.signature.properties = ['transaction.id', 'transaction.inventada'];
    expect(verificarChecksumEvento(evento)).toBe(false);
  });
});

describe('cobranza: generar facturas', () => {
  it('crea una factura del mes por cada gimnasio operativo, con su periodo y referencia', async () => {
    const { tenant } = await montarGimnasio();

    const resumen = await ejecutarCobranza();
    expect(resumen.facturasCreadas).toBe(1);

    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const factura = await leerFactura(`GS-${new Date().getFullYear()}-${mes}-${tenant._id}`);

    expect(factura.estado).toBe(ESTADOS_FACTURA.PENDIENTE);
    expect(factura.monto).toBe(PRECIO_MENSUAL);
    expect(factura.periodoInicio.getTime()).toBe(inicioDeMes().getTime());
  });

  /**
   * El plazo cuenta desde la EMISION. Si contara desde el dia 1 del mes, un
   * gimnasio facturado por primera vez despues del dia 5 nacería vencido y el
   * mismo cron lo suspenderia en el acto.
   */
  it('da el plazo de gracia desde el dia en que emite la factura', async () => {
    await montarGimnasio({ estado: ESTADOS_TENANT.ACTIVO });

    const resumen = await ejecutarCobranza();
    expect(resumen.gimnasiosSuspendidos).toBe(0);

    const factura = await ejecutarSinTenant(() => obtenerModelo('FacturaPlataforma').findOne());
    const esperado = sumarDias(new Date(), DIAS_GRACIA_PAGO);
    expect(factura.fechaVencimiento.toDateString()).toBe(esperado.toDateString());
  });

  it('es idempotente: correrla dos veces no duplica la factura', async () => {
    await montarGimnasio();

    await ejecutarCobranza();
    const segunda = await ejecutarCobranza();

    expect(segunda.facturasCreadas).toBe(0);

    const facturas = await ejecutarSinTenant(() => obtenerModelo('FacturaPlataforma').find());
    expect(facturas).toHaveLength(1);
  });

  it('no factura a un gimnasio cancelado', async () => {
    await montarGimnasio({ estado: ESTADOS_TENANT.CANCELADO });

    const resumen = await ejecutarCobranza();
    expect(resumen.facturasCreadas).toBe(0);
  });
});

describe('cobranza: suspension por impago', () => {
  async function vencerLaFactura(tenantId) {
    return ejecutarSinTenant(() =>
      obtenerModelo('FacturaPlataforma').updateOne(
        { tenant: tenantId },
        { fechaVencimiento: sumarDias(new Date(), -1) },
      ),
    );
  }

  it('suspende al gimnasio cuya factura vencio sin pagar', async () => {
    const { tenant } = await montarGimnasio({ estado: ESTADOS_TENANT.ACTIVO });
    await ejecutarCobranza();
    await vencerLaFactura(tenant._id);

    const resumen = await ejecutarCobranza();
    expect(resumen.gimnasiosSuspendidos).toBe(1);

    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.SUSPENDIDO);
  });

  it('no suspende si la factura todavia no vence', async () => {
    const { tenant } = await montarGimnasio({ estado: ESTADOS_TENANT.ACTIVO });

    const resumen = await ejecutarCobranza();
    expect(resumen.gimnasiosSuspendidos).toBe(0);
    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.ACTIVO);
  });

  it('no vuelve a suspender al que ya esta suspendido', async () => {
    const { tenant } = await montarGimnasio({ estado: ESTADOS_TENANT.ACTIVO });
    await ejecutarCobranza();
    await vencerLaFactura(tenant._id);
    await ejecutarCobranza();

    const tercera = await ejecutarCobranza();
    expect(tercera.gimnasiosSuspendidos).toBe(0);
  });
});

describe('webhook de Wompi', () => {
  async function facturaDe(tenantId) {
    await ejecutarCobranza();
    return ejecutarSinTenant(() => obtenerModelo('FacturaPlataforma').findOne({ tenant: tenantId }));
  }

  it('rechaza un evento con firma invalida: nadie se paga la factura solo', async () => {
    const { tenant } = await montarGimnasio();
    const factura = await facturaDe(tenant._id);

    const evento = firmarEvento({ referencia: factura.referencia });
    evento.signature.checksum = 'b'.repeat(64);

    await enviarWebhook(evento).expect(401);

    expect((await leerFactura(factura.referencia)).estado).toBe(ESTADOS_FACTURA.PENDIENTE);
  });

  it('una transaccion aprobada paga la factura y activa el gimnasio en trial', async () => {
    const { tenant } = await montarGimnasio({ estado: ESTADOS_TENANT.TRIAL });
    const factura = await facturaDe(tenant._id);

    const respuesta = await enviarWebhook(firmarEvento({ referencia: factura.referencia })).expect(200);
    expect(respuesta.body.data.resultado).toBe('pagada');

    const pagada = await leerFactura(factura.referencia);
    expect(pagada.estado).toBe(ESTADOS_FACTURA.PAGADA);
    expect(pagada.transaccionId).toBe('trx-1');
    expect(pagada.metodoPago).toBe('CARD');
    expect(pagada.pagadaEn).toBeInstanceOf(Date);

    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.ACTIVO);
  });

  it('pagar reactiva a un gimnasio suspendido', async () => {
    const { tenant } = await montarGimnasio({ estado: ESTADOS_TENANT.ACTIVO });
    const factura = await facturaDe(tenant._id);

    await ejecutarSinTenant(() =>
      obtenerModelo('Tenant').updateOne({ _id: tenant._id }, { estado: ESTADOS_TENANT.SUSPENDIDO }),
    );

    await enviarWebhook(firmarEvento({ referencia: factura.referencia })).expect(200);
    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.ACTIVO);
  });

  /** Cancelar es terminal: pagar una factura vieja no puede ser la puerta trasera. */
  it('pagar NO revive a un gimnasio cancelado', async () => {
    const { tenant } = await montarGimnasio({ estado: ESTADOS_TENANT.ACTIVO });
    const factura = await facturaDe(tenant._id);

    await ejecutarSinTenant(() =>
      obtenerModelo('Tenant').updateOne({ _id: tenant._id }, { estado: ESTADOS_TENANT.CANCELADO }),
    );

    const respuesta = await enviarWebhook(firmarEvento({ referencia: factura.referencia })).expect(200);

    expect(respuesta.body.data.tenantActivado).toBe(false);
    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.CANCELADO);
    // La factura si se cobra: el dinero entro.
    expect((await leerFactura(factura.referencia)).estado).toBe(ESTADOS_FACTURA.PAGADA);
  });

  it('es idempotente: un reintento de Wompi no vuelve a aplicar el pago', async () => {
    const { tenant } = await montarGimnasio();
    const factura = await facturaDe(tenant._id);
    const evento = firmarEvento({ referencia: factura.referencia });

    await enviarWebhook(evento).expect(200);
    const segunda = await enviarWebhook(evento).expect(200);

    expect(segunda.body.data.ignorado).toBe('ya_pagada');
  });

  it('un monto que no coincide con la factura NO la da por pagada', async () => {
    const { tenant } = await montarGimnasio();
    const factura = await facturaDe(tenant._id);

    const respuesta = await enviarWebhook(
      firmarEvento({ referencia: factura.referencia, centavos: 100 }),
    ).expect(200);

    expect(respuesta.body.data.resultado).toBe('monto_no_coincide');

    const fallida = await leerFactura(factura.referencia);
    expect(fallida.estado).toBe(ESTADOS_FACTURA.FALLIDA);
    expect(fallida.detalleFallo).toMatch(/Monto no coincide/);
    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.TRIAL);
  });

  it('una transaccion rechazada marca la factura como fallida', async () => {
    const { tenant } = await montarGimnasio();
    const factura = await facturaDe(tenant._id);

    await enviarWebhook(
      firmarEvento({ referencia: factura.referencia, estado: ESTADOS_TRANSACCION_WOMPI.RECHAZADA }),
    ).expect(200);

    expect((await leerFactura(factura.referencia)).estado).toBe(ESTADOS_FACTURA.FALLIDA);
    expect((await leerTenant(tenant._id)).estado).toBe(ESTADOS_TENANT.TRIAL);
  });

  it('una transaccion pendiente no cambia nada', async () => {
    const { tenant } = await montarGimnasio();
    const factura = await facturaDe(tenant._id);

    const respuesta = await enviarWebhook(
      firmarEvento({ referencia: factura.referencia, estado: ESTADOS_TRANSACCION_WOMPI.PENDIENTE }),
    ).expect(200);

    expect(respuesta.body.data.ignorado).toBe('transaccion_pendiente');
    expect((await leerFactura(factura.referencia)).estado).toBe(ESTADOS_FACTURA.PENDIENTE);
  });

  it('una referencia desconocida se ignora sin error (o Wompi reintentaria en bucle)', async () => {
    const respuesta = await enviarWebhook(firmarEvento({ referencia: 'no-existe' })).expect(200);
    expect(respuesta.body.data.ignorado).toBe('referencia_desconocida');
  });
});

describe('GET /api/facturacion', () => {
  it('la duena ve sus facturas y la pendiente por pagar', async () => {
    const { tenant } = await montarGimnasio();
    await ejecutarCobranza();

    const duena = await entrarComo(`owner@gimnasio-factura.co`);
    const respuesta = await duena.get('/api/facturacion').expect(200);

    expect(respuesta.body.data.facturas).toHaveLength(1);
    expect(respuesta.body.data.facturaPendiente.monto).toBe(PRECIO_MENSUAL);
    expect(respuesta.body.data.estadoGimnasio).toBe(ESTADOS_TENANT.TRIAL);
    expect(String(respuesta.body.data.facturas[0].tenant)).toBe(String(tenant._id));
  });

  it('devuelve el enlace de pago de su factura', async () => {
    const { tenant } = await montarGimnasio();
    await ejecutarCobranza();
    const factura = await ejecutarSinTenant(() =>
      obtenerModelo('FacturaPlataforma').findOne({ tenant: tenant._id }),
    );

    const duena = await entrarComo('owner@gimnasio-factura.co');
    const respuesta = await duena.post(`/api/facturacion/${factura._id}/enlace-pago`).expect(200);

    expect(respuesta.body.data.url).toContain('checkout.wompi.co');
    expect(respuesta.body.data.url).toContain(factura.referencia);
  });

  it('no entrega el enlace de una factura ya pagada', async () => {
    const { tenant } = await montarGimnasio();
    await ejecutarCobranza();
    const factura = await ejecutarSinTenant(() =>
      obtenerModelo('FacturaPlataforma').findOne({ tenant: tenant._id }),
    );

    await enviarWebhook(firmarEvento({ referencia: factura.referencia })).expect(200);

    const duena = await entrarComo('owner@gimnasio-factura.co');
    await duena.post(`/api/facturacion/${factura._id}/enlace-pago`).expect(409);
  });

  it('una duena no puede pedir el enlace de la factura de otro gimnasio', async () => {
    await montarGimnasio({ slug: 'gimnasio-a' });
    const otro = await montarGimnasio({ slug: 'gimnasio-b' });
    await ejecutarCobranza();

    const facturaAjena = await ejecutarSinTenant(() =>
      obtenerModelo('FacturaPlataforma').findOne({ tenant: otro.tenant._id }),
    );

    const duenaA = await entrarComo('owner@gimnasio-a.co');
    await duenaA.post(`/api/facturacion/${facturaAjena._id}/enlace-pago`).expect(404);

    const respuesta = await duenaA.get('/api/facturacion').expect(200);
    expect(respuesta.body.data.facturas).toHaveLength(1);
  });
});
