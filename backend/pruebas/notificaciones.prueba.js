import { beforeEach, describe, expect, it } from 'vitest';

import {
  ESTADOS_NOTIFICACION,
  METODOS_PAGO,
  MILISEGUNDOS_POR_DIA,
  ROLES,
} from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { construirMensaje } from '../src/servicios/notificaciones.servicio.js';
import { ejecutarAvisosDeVencimiento } from '../src/tareas/vencimientos.tarea.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Cron de avisos de vencimiento, con un proveedor falso: ninguna prueba toca
 * la red.
 *
 * Lo que de verdad se protege aqui es que el aviso salga del ULTIMO pago del
 * miembro. Un `Pago.find({ periodoFin <= umbral, notificado: false })` pasaria
 * casi todas las demas pruebas y aun asi le diria a un miembro que renovo que
 * su mensualidad vencio.
 */

/** Registra lo que se intento enviar y, si se le pide, falla. */
function proveedorFalso({ falla = false } = {}) {
  const enviados = [];

  return {
    enviados,
    crearProveedor: () => ({
      nombre: 'falso',
      habilitado: true,
      async enviar(aviso) {
        enviados.push(aviso);
        if (falla) throw new Error('canal caido');
      },
    }),
  };
}

function enDias(dias) {
  return new Date(Date.now() + dias * MILISEGUNDOS_POR_DIA);
}

async function montarGimnasio({ slug = 'gimnasio-avisos' } = {}) {
  const tenant = await ejecutarSinTenant(() =>
    obtenerModelo('Tenant').create({ nombre: 'Gimnasio Avisos', nit: '900111', slug }),
  );

  const contexto = await ejecutarConTenant(tenant._id, async () => {
    const sede = await obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 100' });
    const planMembresia = await obtenerModelo('PlanMembresia').create({
      sede: sede._id,
      nombre: 'Mensual',
      precio: 60_000,
      duracionMeses: 1,
    });
    return { sede, planMembresia };
  });

  const usuario = await ejecutarSinTenant(() =>
    obtenerModelo('Usuario').create({
      tenant: tenant._id,
      nombres: 'Laura',
      apellidos: 'Duena',
      email: `owner@${slug}.co`,
      contrasenaHash: 'x'.repeat(60),
      rol: ROLES.TENANT_OWNER,
    }),
  );

  return { tenant, ...contexto, usuario };
}

/** Crea un miembro y, opcionalmente, sus pagos (cada uno con su vencimiento). */
async function crearMiembroConPagos(gimnasio, { documento, telefono = '573001234567', activo = true, pagos = [] }) {
  return ejecutarConTenant(gimnasio.tenant._id, async () => {
    const miembro = await obtenerModelo('Miembro').create({
      sede: gimnasio.sede._id,
      nombres: 'Ana',
      apellidos: documento,
      documento,
      telefono,
      activo,
    });

    for (const pago of pagos) {
      const periodoFin = enDias(pago.diasHastaVencer);
      await obtenerModelo('Pago').create({
        sede: gimnasio.sede._id,
        miembro: miembro._id,
        planMembresia: gimnasio.planMembresia._id,
        monto: 60_000,
        metodoPago: METODOS_PAGO.EFECTIVO,
        fechaPago: new Date(periodoFin.getTime() - 30 * MILISEGUNDOS_POR_DIA),
        periodoInicio: new Date(periodoFin.getTime() - 30 * MILISEGUNDOS_POR_DIA),
        periodoFin,
        registradoPor: gimnasio.usuario._id,
        avisosEnviados: pago.avisosEnviados ?? [],
      });
    }

    return miembro;
  });
}

function contarNotificaciones(tenantId, filtro = {}) {
  return ejecutarConTenant(tenantId, () => obtenerModelo('Notificacion').find(filtro));
}

function listarPagosDe(tenantId, miembroId) {
  return ejecutarConTenant(tenantId, () =>
    obtenerModelo('Pago').find({ miembro: miembroId }).sort({ periodoFin: 1 }),
  );
}

beforeEach(limpiarColecciones);

describe('a quien se avisa', () => {
  it('avisa a los que vencen pronto y a los ya vencidos, y a nadie mas', async () => {
    const gimnasio = await montarGimnasio();

    await crearMiembroConPagos(gimnasio, { documento: 'por-vencer', pagos: [{ diasHastaVencer: 2 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'vencido', pagos: [{ diasHastaVencer: -1 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'al-dia', pagos: [{ diasHastaVencer: 25 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'sin-pagos', pagos: [] });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(2);
    // El texto es el de la plantilla avisa_vence2 (mismo cuerpo por-vencer/vencido).
    const textos = falso.enviados.map((aviso) => aviso.mensaje).join(' | ');
    expect(textos).toMatch(/te recordamos que el pago/);
    expect(textos).toMatch(/Valor a pagar/);

    // Ademas del texto, cada aviso lleva las 4 variables de la plantilla
    // (nombre, gimnasio, fecha, VALOR) para el proveedor Cloud API.
    for (const aviso of falso.enviados) {
      expect(aviso.variables).toHaveLength(4);
      expect(aviso.variables[1]).toBe('Gimnasio Avisos');
      // El valor sale del precio ACTUAL del plan (60.000 en el gimnasio de prueba),
      // SOLO el numero: el "$" es texto fijo en la plantilla.
      expect(aviso.variables[3]).toBe('60.000');
    }
  });

  it('un miembro que RENOVO no recibe aviso, aunque su pago viejo siga sin notificar', async () => {
    const gimnasio = await montarGimnasio();

    // Pago viejo ya vencido (notificado: false) + renovacion vigente.
    // El vencimiento se deriva del ULTIMO pago: este miembro esta al dia.
    const renovado = await crearMiembroConPagos(gimnasio, {
      documento: 'renovado',
      pagos: [{ diasHastaVencer: -20 }, { diasHastaVencer: 25 }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);

    const notificaciones = await contarNotificaciones(gimnasio.tenant._id, { miembro: renovado._id });
    expect(notificaciones).toHaveLength(0);
  });

  it('no avisa a un miembro desactivado', async () => {
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, {
      documento: 'inactivo',
      activo: false,
      pagos: [{ diasHastaVencer: 1 }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);
  });

  it('no reavisa un recordatorio ("por vencer") si ya se envio', async () => {
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, {
      documento: 'ya-avisado',
      pagos: [{ diasHastaVencer: 2, avisosEnviados: [2] }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);
  });
});

describe('varios recordatorios por ciclo (offsets 2, 1, -1)', () => {
  it('avisa faltando 2 y 1 dia; faltando 3 aun no (no es un offset)', async () => {
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, { documento: 'faltan-3', pagos: [{ diasHastaVencer: 3 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'faltan-2', pagos: [{ diasHastaVencer: 2 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'faltan-1', pagos: [{ diasHastaVencer: 1 }] });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    // Los de 2 y 1 dia; el de 3 no entra (3 no esta en la lista de offsets).
    expect(falso.enviados).toHaveLength(2);
  });

  it('avisa a 1 dia vencido; a 2, 3, 4 y 5 no (no son offsets)', async () => {
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, { documento: 'venc-1', pagos: [{ diasHastaVencer: -1 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'venc-2', pagos: [{ diasHastaVencer: -2 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'venc-3', pagos: [{ diasHastaVencer: -3 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'venc-4', pagos: [{ diasHastaVencer: -4 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'venc-5', pagos: [{ diasHastaVencer: -5 }] });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    // Solo -1; de -2 a -5 no estan en la lista.
    expect(falso.enviados).toHaveLength(1);
    expect(falso.enviados.every((a) => /te recordamos que el pago/.test(a.mensaje))).toBe(true);
  });

  it('no reenvia un recordatorio ya enviado (mismo offset)', async () => {
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, {
      documento: 'ya-venc-1',
      pagos: [{ diasHastaVencer: -1, avisosEnviados: [-1] }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);
  });
});

describe('registro del envio', () => {
  it('anota el offset en el ULTIMO pago y deja el viejo intacto', async () => {
    const gimnasio = await montarGimnasio();
    const miembro = await crearMiembroConPagos(gimnasio, {
      documento: 'dos-pagos',
      // Los dos vencidos: el viejo es historia, el ultimo (1 dia) es el que se avisa.
      pagos: [{ diasHastaVencer: -40 }, { diasHastaVencer: -1 }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(1);

    const [viejo, ultimo] = await listarPagosDe(gimnasio.tenant._id, miembro._id);
    expect(viejo.avisosEnviados).toHaveLength(0);
    expect(ultimo.avisosEnviados).toContain(-1);

    const notificaciones = await contarNotificaciones(gimnasio.tenant._id);
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0].estado).toBe(ESTADOS_NOTIFICACION.ENVIADO);
  });

  it('si el envio falla, registra "fallido" y NO marca el pago (se reintenta)', async () => {
    const gimnasio = await montarGimnasio();
    const miembro = await crearMiembroConPagos(gimnasio, {
      documento: 'falla',
      pagos: [{ diasHastaVencer: 1 }],
    });

    const falso = proveedorFalso({ falla: true });
    const resumen = await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(resumen[0]).toMatchObject({ enviados: 0, fallidos: 1 });

    const [pago] = await listarPagosDe(gimnasio.tenant._id, miembro._id);
    expect(pago.avisosEnviados).toHaveLength(0);

    const notificaciones = await contarNotificaciones(gimnasio.tenant._id);
    expect(notificaciones[0].estado).toBe(ESTADOS_NOTIFICACION.FALLIDO);
    expect(notificaciones[0].mensaje).toMatch(/canal caido/);
  });

  it('un miembro sin telefono se registra como fallido, no revienta la corrida', async () => {
    const gimnasio = await montarGimnasio();

    // El esquema exige telefono, asi que se vacia despues de crearlo.
    const miembro = await crearMiembroConPagos(gimnasio, {
      documento: 'sin-tel',
      pagos: [{ diasHastaVencer: 1 }],
    });
    await ejecutarConTenant(gimnasio.tenant._id, () =>
      obtenerModelo('Miembro').updateOne({ _id: miembro._id }, { $unset: { telefono: '' } }),
    );

    const falso = proveedorFalso();
    const resumen = await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);
    expect(resumen[0]).toMatchObject({ fallidos: 1 });
  });
});

describe('quien queda fuera de la corrida', () => {
  it('sin canal configurado (Twilio en el entorno vacio) no envia nada', async () => {
    // La fabrica REAL lee las credenciales del entorno; en pruebas estan vacias,
    // asi que el proveedor queda deshabilitado y no se manda nada.
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, { documento: 'x', pagos: [{ diasHastaVencer: 1 }] });

    const resumen = await ejecutarAvisosDeVencimiento();

    expect(resumen[0].omitido).toBe('proveedor_ninguno');
    expect(await contarNotificaciones(gimnasio.tenant._id)).toHaveLength(0);
  });
});

describe('aislamiento entre gimnasios', () => {
  it('cada gimnasio avisa solo a sus miembros y escribe solo su bitacora', async () => {
    const a = await montarGimnasio({ slug: 'gym-a' });
    const b = await montarGimnasio({ slug: 'gym-b' });

    await crearMiembroConPagos(a, { documento: 'a1', pagos: [{ diasHastaVencer: 1 }] });
    await crearMiembroConPagos(b, { documento: 'b1', pagos: [{ diasHastaVencer: 1 }] });
    await crearMiembroConPagos(b, { documento: 'b2', pagos: [{ diasHastaVencer: -1 }] });

    const falso = proveedorFalso();
    const resumen = await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    const porTenant = Object.fromEntries(resumen.map((fila) => [fila.tenant, fila]));
    expect(porTenant['gym-a'].enviados).toBe(1);
    expect(porTenant['gym-b'].enviados).toBe(2);

    expect(await contarNotificaciones(a.tenant._id)).toHaveLength(1);
    expect(await contarNotificaciones(b.tenant._id)).toHaveLength(2);
  });
});

describe('construirMensaje (texto identico a la plantilla avisa_vence2)', () => {
  const tenant = { nombre: 'GymFuerza', config: { zonaHoraria: 'America/Bogota' } };
  const miembro = { nombres: 'Ana' };
  const ultimoPago = { periodoFin: new Date('2026-07-11T12:00:00-05:00'), monto: 55_000 };

  it('lleva nombre, gimnasio, fecha de vencimiento y valor del plan', () => {
    const mensaje = construirMensaje({ miembro, ultimoPago, tenant, precioPlan: 60_000 });

    expect(mensaje).toContain('Ana');
    expect(mensaje).toContain('GymFuerza');
    expect(mensaje).toMatch(/vence el 11 de julio/);
    expect(mensaje).toMatch(/Valor a pagar: \$ 60\.000/);
  });

  it('incluye los datos de pago (Bre-B, Nequi, Bancolombia, titular)', () => {
    const mensaje = construirMensaje({ miembro, ultimoPago, tenant, precioPlan: 60_000 });

    expect(mensaje).toContain('Bre-B');
    expect(mensaje).toContain('Nequi');
    expect(mensaje).toContain('Bancolombia');
    expect(mensaje).toContain('Titular');
  });

  it('si no hay precio de plan fresco, usa el monto del pago', () => {
    const mensaje = construirMensaje({ miembro, ultimoPago, tenant });
    expect(mensaje).toMatch(/Valor a pagar: \$ 55\.000/);
  });
});

