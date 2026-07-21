import { beforeEach, describe, expect, it } from 'vitest';

import {
  ESTADOS_NOTIFICACION,
  ESTADOS_TENANT,
  ESTADOS_VENCIMIENTO,
  METODOS_PAGO,
  MILISEGUNDOS_POR_DIA,
  PROVEEDORES_WHATSAPP,
  ROLES,
} from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearProveedor } from '../src/proveedores/indice.js';
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

async function montarGimnasio({
  slug = 'gimnasio-avisos',
  estado = ESTADOS_TENANT.ACTIVO,
  whatsappEnElPlan = true,
  proveedor = PROVEEDORES_WHATSAPP.N8N,
  credenciales = { urlWebhook: 'https://ejemplo.invalido/hook' },
} = {}) {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
      features: { whatsapp: whatsappEnElPlan, reportes: true },
    });

    return obtenerModelo('Tenant').create({
      nombre: 'Gimnasio Avisos',
      nit: '900111',
      slug,
      estado,
      planPlataforma: plan._id,
      config: { whatsapp: { proveedor, credenciales } },
    });
  });

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
        notificado: pago.notificado ?? false,
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
    await crearMiembroConPagos(gimnasio, { documento: 'vencido', pagos: [{ diasHastaVencer: -5 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'al-dia', pagos: [{ diasHastaVencer: 25 }] });
    await crearMiembroConPagos(gimnasio, { documento: 'sin-pagos', pagos: [] });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(2);
    const textos = falso.enviados.map((aviso) => aviso.mensaje).join(' | ');
    expect(textos).toMatch(/vence en 2 dias/);
    expect(textos).toMatch(/vencio el/);

    // Ademas del texto, cada aviso lleva las 3 variables de la plantilla
    // (nombre, gimnasio, fecha) para el proveedor Cloud API.
    for (const aviso of falso.enviados) {
      expect(aviso.variables).toHaveLength(3);
      expect(aviso.variables[1]).toBe('Gimnasio Avisos');
    }
  });

  it('un miembro que RENOVO no recibe aviso, aunque su pago viejo siga sin notificar', async () => {
    const gimnasio = await montarGimnasio();

    // Pago viejo ya vencido (notificado: false) + renovacion vigente.
    // El vencimiento se deriva del ULTIMO pago: este miembro esta al dia.
    const renovado = await crearMiembroConPagos(gimnasio, {
      documento: 'renovado',
      pagos: [{ diasHastaVencer: -20, notificado: false }, { diasHastaVencer: 25 }],
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

  it('no reavisa un periodo ya notificado', async () => {
    const gimnasio = await montarGimnasio();
    await crearMiembroConPagos(gimnasio, {
      documento: 'ya-avisado',
      pagos: [{ diasHastaVencer: 2, notificado: true }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);
  });
});

describe('registro del envio', () => {
  it('marca el ULTIMO pago como notificado y deja el viejo intacto', async () => {
    const gimnasio = await montarGimnasio();
    const miembro = await crearMiembroConPagos(gimnasio, {
      documento: 'dos-pagos',
      // Los dos vencidos: el viejo es historia, el ultimo es el que se avisa.
      pagos: [{ diasHastaVencer: -40 }, { diasHastaVencer: -2 }],
    });

    const falso = proveedorFalso();
    await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(1);

    const [viejo, ultimo] = await listarPagosDe(gimnasio.tenant._id, miembro._id);
    expect(viejo.notificado).toBe(false);
    expect(ultimo.notificado).toBe(true);

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
    expect(pago.notificado).toBe(false);

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
  it('un plan de plataforma sin la feature whatsapp no envia nada', async () => {
    const gimnasio = await montarGimnasio({ whatsappEnElPlan: false });
    await crearMiembroConPagos(gimnasio, { documento: 'x', pagos: [{ diasHastaVencer: 1 }] });

    const falso = proveedorFalso();
    const resumen = await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(falso.enviados).toHaveLength(0);
    expect(resumen[0].omitido).toBe('plan_sin_whatsapp');
  });

  it('el proveedor "ninguno" no envia nada (con la fabrica real, sin red)', async () => {
    const gimnasio = await montarGimnasio({
      proveedor: PROVEEDORES_WHATSAPP.NINGUNO,
      credenciales: {},
    });
    await crearMiembroConPagos(gimnasio, { documento: 'x', pagos: [{ diasHastaVencer: 1 }] });

    const resumen = await ejecutarAvisosDeVencimiento();

    expect(resumen[0].omitido).toBe('proveedor_ninguno');
    expect(await contarNotificaciones(gimnasio.tenant._id)).toHaveLength(0);
  });

  it('un gimnasio suspendido o cancelado no entra; uno en trial si', async () => {
    const suspendido = await montarGimnasio({ slug: 'suspendido', estado: ESTADOS_TENANT.SUSPENDIDO });
    const cancelado = await montarGimnasio({ slug: 'cancelado', estado: ESTADOS_TENANT.CANCELADO });
    const trial = await montarGimnasio({ slug: 'trial', estado: ESTADOS_TENANT.TRIAL });

    for (const gimnasio of [suspendido, cancelado, trial]) {
      await crearMiembroConPagos(gimnasio, { documento: 'x', pagos: [{ diasHastaVencer: 1 }] });
    }

    const falso = proveedorFalso();
    const resumen = await ejecutarAvisosDeVencimiento({ crearProveedor: falso.crearProveedor });

    expect(resumen.map((fila) => fila.tenant)).toEqual(['trial']);
    expect(falso.enviados).toHaveLength(1);
  });

  it('un gimnasio mal configurado no tumba a los demas', async () => {
    // `baileys` no esta implementado: su fabrica lanza.
    const roto = await montarGimnasio({ slug: 'roto', proveedor: PROVEEDORES_WHATSAPP.BAILEYS });
    const sano = await montarGimnasio({ slug: 'sano' });

    await crearMiembroConPagos(roto, { documento: 'x', pagos: [{ diasHastaVencer: 1 }] });
    await crearMiembroConPagos(sano, { documento: 'y', pagos: [{ diasHastaVencer: 1 }] });

    // El de `baileys` usa la fabrica real (lanza); el sano, la falsa.
    const falso = proveedorFalso();
    const resumen = await ejecutarAvisosDeVencimiento({
      crearProveedor: (config) =>
        config?.proveedor === PROVEEDORES_WHATSAPP.BAILEYS
          ? crearProveedor(config)
          : falso.crearProveedor(),
    });

    const porTenant = Object.fromEntries(resumen.map((fila) => [fila.tenant, fila]));
    expect(porTenant.roto.error).toMatch(/no esta implementado/);
    expect(porTenant.sano.enviados).toBe(1);
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

describe('construirMensaje', () => {
  const tenant = { nombre: 'GymFuerza', config: { zonaHoraria: 'America/Bogota' } };
  const miembro = { nombres: 'Ana' };
  const ahora = new Date('2026-07-09T12:00:00-05:00');

  it('avisa los dias que faltan cuando esta por vencer', () => {
    const mensaje = construirMensaje({
      miembro,
      ultimoPago: { periodoFin: new Date('2026-07-11T12:00:00-05:00') },
      estado: ESTADOS_VENCIMIENTO.POR_VENCER,
      tenant,
      ahora,
    });

    expect(mensaje).toContain('Ana');
    expect(mensaje).toContain('GymFuerza');
    expect(mensaje).toMatch(/vence en 2 dias/);
  });

  it('usa el singular con un solo dia', () => {
    const mensaje = construirMensaje({
      miembro,
      ultimoPago: { periodoFin: new Date('2026-07-10T12:00:00-05:00') },
      estado: ESTADOS_VENCIMIENTO.POR_VENCER,
      tenant,
      ahora,
    });

    expect(mensaje).toMatch(/vence en 1 dia,/);
  });

  /**
   * Se cuentan dias de CALENDARIO, no instantes: faltan 6 horas, pero es hoy.
   * Restando milisegundos y redondeando hacia arriba diria "vence en 1 dia".
   */
  it('dice "vence hoy" el mismo dia, aunque falten horas', () => {
    const mensaje = construirMensaje({
      miembro,
      ultimoPago: { periodoFin: new Date('2026-07-09T18:00:00-05:00') },
      estado: ESTADOS_VENCIMIENTO.POR_VENCER,
      tenant,
      ahora,
    });

    expect(mensaje).toMatch(/vence hoy/);
  });

  /** Casi 48 horas de diferencia, pero solo un dia de calendario. */
  it('cuenta dias civiles, no bloques de 24 horas', () => {
    const mensaje = construirMensaje({
      miembro,
      ultimoPago: { periodoFin: new Date('2026-07-10T23:00:00-05:00') },
      estado: ESTADOS_VENCIMIENTO.POR_VENCER,
      tenant,
      ahora: new Date('2026-07-09T01:00:00-05:00'),
    });

    expect(mensaje).toMatch(/vence en 1 dia,/);
  });

  it('habla en pasado cuando ya vencio', () => {
    const mensaje = construirMensaje({
      miembro,
      ultimoPago: { periodoFin: new Date('2026-07-01T12:00:00-05:00') },
      estado: ESTADOS_VENCIMIENTO.VENCIDO,
      tenant,
      ahora,
    });

    expect(mensaje).toMatch(/vencio el 1 de julio/);
    expect(mensaje).toMatch(/Renuevala/);
  });
});

describe('fabrica de proveedores', () => {
  it('"ninguno" devuelve un proveedor deshabilitado', () => {
    const proveedor = crearProveedor({ proveedor: PROVEEDORES_WHATSAPP.NINGUNO });
    expect(proveedor.habilitado).toBe(false);
  });

  it('sin configuracion, por defecto no envia', () => {
    expect(crearProveedor().habilitado).toBe(false);
    expect(crearProveedor({}).habilitado).toBe(false);
  });

  it('exige las credenciales de cada proveedor', () => {
    expect(() => crearProveedor({ proveedor: PROVEEDORES_WHATSAPP.N8N, credenciales: {} })).toThrow(
      /urlWebhook/,
    );
    expect(() =>
      crearProveedor({ proveedor: PROVEEDORES_WHATSAPP.CLOUD_API, credenciales: { token: 'x' } }),
    ).toThrow(/idTelefono/);
  });

  it('baileys lanza: no esta implementado', () => {
    expect(() => crearProveedor({ proveedor: PROVEEDORES_WHATSAPP.BAILEYS })).toThrow(
      /no esta implementado/,
    );
  });

  it('un proveedor desconocido lanza', () => {
    expect(() => crearProveedor({ proveedor: 'telegrama' })).toThrow(/desconocido/);
  });
});
