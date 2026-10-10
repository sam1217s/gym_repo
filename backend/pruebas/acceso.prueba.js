import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { MOTIVOS_ACCESO, RESULTADOS_ACCESO, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { evaluarAcceso } from '../src/servicios/acceso.servicio.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { sumarDias } from '../src/utilidades/fechas.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Control de acceso en la puerta. Lo critico:
 * - la regla: al dia entra, vencido hasta 3 dias entra en gracia, desde el 4 no;
 * - el puesto se autentica por token y no puede salirse de su gimnasio;
 * - la huella se guarda cifrada, exige autorizacion y sirve en CUALQUIER sede;
 * - dar de baja al miembro borra sus huellas.
 */

const CONTRASENA = 'ClaveInicial1';
// Plantilla de mentira (el backend no compara huellas: solo la guarda y la devuelve).
const PLANTILLA = Buffer.from('plantilla-de-huella-zk9500-'.repeat(30)).toString('base64');
const app = crearServidor();

/** Mediodia de hoy + `dias`: lejos de la medianoche, el dia civil no se corre. */
const diaRelativo = (dias) => {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  return sumarDias(hoy, dias);
};

async function montarGimnasio(slug = 'gymacc') {
  const tenant = await ejecutarSinTenant(() =>
    obtenerModelo('Tenant').create({ nombre: `Gym ${slug}`, nit: '900333', slug }),
  );

  const datos = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });
    const plan = await obtenerModelo('PlanMembresia').create({
      sede: norte._id, nombre: 'Mensual', precio: 60_000, duracionMeses: 1,
    });
    const Miembro = obtenerModelo('Miembro');
    const ana = await Miembro.create({
      sede: norte._id, nombres: 'Ana', apellidos: 'Norte', documento: `${slug}-1`, telefono: '573001112233',
    });
    const beto = await Miembro.create({
      sede: sur._id, nombres: 'Beto', apellidos: 'Sur', documento: `${slug}-2`, telefono: '573004445566',
    });
    return { sedes: { norte, sur }, plan, ana, beto };
  });

  const hash = await cifrarContrasena(CONTRASENA);
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena', email: `owner@${slug}.co`,
      contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: datos.sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: `norte@${slug}.co`, contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
  });

  return { tenant, ...datos };
}

/** Un pago cuyo periodo vence `diasHastaVencer` dias desde hoy (negativo = ya vencio). */
function pagar(tenant, miembro, plan, diasHastaVencer) {
  return ejecutarConTenant(tenant._id, () =>
    obtenerModelo('Pago').create({
      sede: miembro.sede, miembro: miembro._id, planMembresia: plan._id, monto: 60_000,
      metodoPago: 'efectivo', periodoInicio: diaRelativo(diasHastaVencer - 30), periodoFin: diaRelativo(diasHastaVencer),
    }),
  );
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

async function crearPuesto(dueno, sede, nombre = 'Puerta') {
  const respuesta = await dueno.post('/api/puestos-acceso').send({ nombre, sede: String(sede._id) }).expect(201);
  return respuesta.body.data;
}

const comoPuesto = (token) => ({
  get: (ruta) => peticion(app).get(ruta).set('Authorization', `Bearer ${token}`),
  post: (ruta) => peticion(app).post(ruta).set('Authorization', `Bearer ${token}`),
});

const enrolar = (agente, miembro, extra = {}) =>
  agente
    .post(`/api/miembros/${miembro._id}/huellas`)
    .send({ plantilla: PLANTILLA, dedo: 'indice_derecho', autorizacionDatosBiometricos: true, ...extra });

beforeEach(limpiarColecciones);

describe('Regla de acceso (gracia de 3 dias)', () => {
  it('sin pagos no entra', () => {
    expect(evaluarAcceso(null)).toMatchObject({ permitido: false, motivo: MOTIVOS_ACCESO.SIN_PAGOS });
  });

  it('al dia entra', () => {
    expect(evaluarAcceso({ periodoFin: diaRelativo(20) })).toMatchObject({
      permitido: true, motivo: MOTIVOS_ACCESO.AL_DIA, diasRestantes: 20,
    });
  });

  it('si vence hoy entra (por vencer, 0 dias)', () => {
    expect(evaluarAcceso({ periodoFin: diaRelativo(0) })).toMatchObject({
      permitido: true, motivo: MOTIVOS_ACCESO.POR_VENCER, diasRestantes: 0,
    });
  });

  it('vencido hace 3 dias todavia entra en gracia', () => {
    expect(evaluarAcceso({ periodoFin: diaRelativo(-3) })).toMatchObject({
      permitido: true, motivo: MOTIVOS_ACCESO.EN_GRACIA, diasVencido: 3,
    });
  });

  it('vencido hace 4 dias ya no entra', () => {
    expect(evaluarAcceso({ periodoFin: diaRelativo(-4) })).toMatchObject({
      permitido: false, motivo: MOTIVOS_ACCESO.VENCIDO, diasVencido: 4,
    });
  });
});

describe('Puestos de entrada', () => {
  it('el dueno crea un puesto y su token autentica al PC de la puerta', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');

    const { puesto, token } = await crearPuesto(dueno, sedes.norte, 'Puerta Norte');
    expect(puesto.tokenHash).toBeUndefined();

    const respuesta = await comoPuesto(token).get('/api/acceso/puesto').expect(200);
    expect(respuesta.body.data).toMatchObject({ nombre: 'Puerta Norte', sede: String(sedes.norte._id) });
  });

  it('rechaza un token alterado, uno sin formato y la falta de token', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');
    const { token } = await crearPuesto(dueno, sedes.norte);

    await comoPuesto(`${token}x`).get('/api/acceso/puesto').expect(401);
    await comoPuesto('basura').get('/api/acceso/puesto').expect(401);
    await peticion(app).get('/api/acceso/puesto').expect(401);
  });

  it('desactivar el puesto o regenerar el token invalida el anterior', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');
    const { puesto, token } = await crearPuesto(dueno, sedes.norte);

    const regenerado = await dueno.post(`/api/puestos-acceso/${puesto._id}/token`).expect(200);
    await comoPuesto(token).get('/api/acceso/puesto').expect(401);
    await comoPuesto(regenerado.body.data.token).get('/api/acceso/puesto').expect(200);

    await dueno.delete(`/api/puestos-acceso/${puesto._id}`).expect(200);
    await comoPuesto(regenerado.body.data.token).get('/api/acceso/puesto').expect(401);
  });

  it('un sede_admin no administra puestos', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymacc.co');
    await recepcion.post('/api/puestos-acceso').send({ nombre: 'X', sede: String(sedes.norte._id) }).expect(403);
  });
});

describe('Huellas de los miembros', () => {
  it('exige la autorizacion de datos biometricos', async () => {
    const { ana } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');

    await enrolar(dueno, ana, { autorizacionDatosBiometricos: false }).expect(400);
    await dueno.post(`/api/miembros/${ana._id}/huellas`).send({ plantilla: PLANTILLA }).expect(400);
  });

  it('guarda la plantilla CIFRADA, no la devuelve al enrolar y el puesto la recibe intacta', async () => {
    const { tenant, sedes, ana } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');

    const creada = await enrolar(dueno, ana).expect(201);
    expect(creada.body.data.plantillaCifrada).toBeUndefined();
    expect(creada.body.data.autorizacion.fecha).toBeTruthy();

    const guardada = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('HuellaMiembro').findById(creada.body.data._id).select('+plantillaCifrada'),
    );
    expect(guardada.plantillaCifrada).not.toContain(PLANTILLA.slice(0, 20));

    const { token } = await crearPuesto(dueno, sedes.norte);
    const sincronizadas = await comoPuesto(token).get('/api/acceso/huellas').expect(200);
    expect(sincronizadas.body.data).toEqual([
      { id: creada.body.data._id, miembro: String(ana._id), plantilla: PLANTILLA },
    ]);
  });

  it('permite como maximo 2 huellas por miembro', async () => {
    const { ana } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');

    await enrolar(dueno, ana).expect(201);
    await enrolar(dueno, ana, { dedo: 'indice_izquierdo' }).expect(201);
    await enrolar(dueno, ana, { dedo: 'pulgar_derecho' }).expect(409);
  });

  it('un sede_admin no enrola ni ve las huellas de un miembro de otra sede', async () => {
    const { beto } = await montarGimnasio();
    const recepcionNorte = await entrarComo('norte@gymacc.co');

    await enrolar(recepcionNorte, beto).expect(404);
    await recepcionNorte.get(`/api/miembros/${beto._id}/huellas`).expect(404);
  });

  it('lista que miembros ya tienen huella, y el sede_admin solo los de SU sede', async () => {
    const { ana, beto } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymacc.co');
    await enrolar(dueno, ana).expect(201);
    await enrolar(dueno, beto).expect(201);

    const todos = await dueno.get('/api/miembros/con-huella').expect(200);
    expect(todos.body.data.sort()).toEqual([String(ana._id), String(beto._id)].sort());

    const recepcionNorte = await entrarComo('norte@gymacc.co');
    const suyos = await recepcionNorte.get('/api/miembros/con-huella').expect(200);
    expect(suyos.body.data).toEqual([String(ana._id)]);
  });

  it('dar de baja al miembro borra sus huellas y la puerta ya no lo deja pasar', async () => {
    const { tenant, sedes, plan, ana } = await montarGimnasio();
    await pagar(tenant, ana, plan, 20);
    const dueno = await entrarComo('owner@gymacc.co');
    await enrolar(dueno, ana).expect(201);

    await dueno.patch(`/api/miembros/${ana._id}`).send({ activo: false }).expect(200);

    const quedan = await ejecutarConTenant(tenant._id, () =>
      obtenerModelo('HuellaMiembro').countDocuments({ miembro: ana._id }),
    );
    expect(quedan).toBe(0);

    const { token } = await crearPuesto(dueno, sedes.norte);
    const respuesta = await comoPuesto(token).post('/api/acceso/verificar').send({ miembro: String(ana._id) }).expect(200);
    expect(respuesta.body.data).toMatchObject({ permitido: false, motivo: MOTIVOS_ACCESO.INACTIVO });
  });
});

describe('Verificacion en la puerta', () => {
  it('un miembro al dia de la sede Norte entra por la puerta de la sede Sur', async () => {
    const { tenant, sedes, plan, ana } = await montarGimnasio();
    await pagar(tenant, ana, plan, 20);
    const dueno = await entrarComo('owner@gymacc.co');
    const { puesto, token } = await crearPuesto(dueno, sedes.sur, 'Puerta Sur');

    const respuesta = await comoPuesto(token).post('/api/acceso/verificar').send({ miembro: String(ana._id) }).expect(200);
    expect(respuesta.body.data).toMatchObject({
      permitido: true, motivo: MOTIVOS_ACCESO.AL_DIA, miembro: { nombres: 'Ana' },
    });

    const registro = await ejecutarConTenant(tenant._id, () => obtenerModelo('AccesoPuerta').findOne());
    expect(registro).toMatchObject({ resultado: RESULTADOS_ACCESO.PERMITIDO, nombreMiembro: 'Ana Norte' });
    expect(String(registro.sede)).toBe(String(sedes.sur._id));
    expect(String(registro.puesto)).toBe(String(puesto._id));
  });

  it('a un miembro vencido hace 5 dias le niega la entrada y lo registra', async () => {
    const { tenant, sedes, plan, ana } = await montarGimnasio();
    await pagar(tenant, ana, plan, -5);
    const dueno = await entrarComo('owner@gymacc.co');
    const { token } = await crearPuesto(dueno, sedes.norte);

    const respuesta = await comoPuesto(token).post('/api/acceso/verificar').send({ miembro: String(ana._id) }).expect(200);
    expect(respuesta.body.data).toMatchObject({ permitido: false, motivo: MOTIVOS_ACCESO.VENCIDO, diasVencido: 5 });

    const registro = await ejecutarConTenant(tenant._id, () => obtenerModelo('AccesoPuerta').findOne());
    expect(registro).toMatchObject({ resultado: RESULTADOS_ACCESO.NEGADO, diasVencido: 5 });
  });

  it('decide por el ULTIMO pago: quien renovo entra aunque tenga un pago viejo vencido', async () => {
    const { tenant, sedes, plan, ana } = await montarGimnasio();
    await pagar(tenant, ana, plan, -40);
    await pagar(tenant, ana, plan, 10);
    const dueno = await entrarComo('owner@gymacc.co');
    const { token } = await crearPuesto(dueno, sedes.norte);

    const respuesta = await comoPuesto(token).post('/api/acceso/verificar').send({ miembro: String(ana._id) }).expect(200);
    expect(respuesta.body.data).toMatchObject({ permitido: true, motivo: MOTIVOS_ACCESO.AL_DIA });
  });

  it('el puesto de OTRO gimnasio no ve ni deja pasar a los miembros de este', async () => {
    const a = await montarGimnasio('gyma');
    await pagar(a.tenant, a.ana, a.plan, 20);
    const duenoA = await entrarComo('owner@gyma.co');
    await enrolar(duenoA, a.ana).expect(201);

    const b = await montarGimnasio('gymb');
    const duenoB = await entrarComo('owner@gymb.co');
    const { token } = await crearPuesto(duenoB, b.sedes.norte);

    const sincronizadas = await comoPuesto(token).get('/api/acceso/huellas').expect(200);
    expect(sincronizadas.body.data.map((h) => h.miembro)).not.toContain(String(a.ana._id));

    const respuesta = await comoPuesto(token).post('/api/acceso/verificar').send({ miembro: String(a.ana._id) }).expect(200);
    expect(respuesta.body.data).toMatchObject({ permitido: false, motivo: MOTIVOS_ACCESO.INACTIVO });
  });
});

describe('Historial de entradas', () => {
  it('el sede_admin ve solo las entradas por la puerta de SU sede; el dueno, todas', async () => {
    const { tenant, sedes, plan, ana, beto } = await montarGimnasio();
    await pagar(tenant, ana, plan, 20);
    await pagar(tenant, beto, plan, -10);
    const dueno = await entrarComo('owner@gymacc.co');
    const norte = await crearPuesto(dueno, sedes.norte);
    const sur = await crearPuesto(dueno, sedes.sur);

    await comoPuesto(norte.token).post('/api/acceso/verificar').send({ miembro: String(ana._id) }).expect(200);
    await comoPuesto(sur.token).post('/api/acceso/verificar').send({ miembro: String(beto._id) }).expect(200);

    const todo = await dueno.get('/api/accesos').expect(200);
    expect(todo.body.data.resumen).toEqual({ total: 2, permitidos: 1, negados: 1 });

    const recepcion = await entrarComo('norte@gymacc.co');
    const suyo = await recepcion.get('/api/accesos').expect(200);
    expect(suyo.body.data.accesos).toHaveLength(1);
    expect(suyo.body.data.accesos[0].nombreMiembro).toBe('Ana Norte');
  });

  it('el PC de la puerta ve las entradas de hoy de SU sede, con lo justo para la lista', async () => {
    const { tenant, sedes, plan, ana, beto } = await montarGimnasio();
    await pagar(tenant, ana, plan, 20);
    await pagar(tenant, beto, plan, -10);
    const dueno = await entrarComo('owner@gymacc.co');
    const norte = await crearPuesto(dueno, sedes.norte);
    const sur = await crearPuesto(dueno, sedes.sur);

    await comoPuesto(norte.token).post('/api/acceso/verificar').send({ miembro: String(ana._id) }).expect(200);
    await comoPuesto(sur.token).post('/api/acceso/verificar').send({ miembro: String(beto._id) }).expect(200);

    const respuesta = await comoPuesto(norte.token).get('/api/acceso/entradas').expect(200);
    expect(respuesta.body.data.resumen).toEqual({ total: 1, permitidos: 1, negados: 0 });
    expect(Object.keys(respuesta.body.data.accesos[0]).sort()).toEqual(
      ['_id', 'createdAt', 'diasVencido', 'motivo', 'nombreMiembro', 'resultado'].sort(),
    );
    expect(respuesta.body.data.accesos[0].nombreMiembro).toBe('Ana Norte');

    await peticion(app).get('/api/acceso/entradas').expect(401);
  });
});
