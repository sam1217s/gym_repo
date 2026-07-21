import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_MAQUINA, ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Reportes de maquinas. Lo critico: cuando un ENCARGADO de sede marca una
 * maquina en mantenimiento/dañada se genera un reporte para el dueño; el dueño
 * lo ve y, al abrir su panel, deja de contarsele como no leido (aunque siga sin
 * arreglarse). Si el dueño mismo cambia el estado, no se genera reporte.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

async function montarGimnasio() {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });
    return obtenerModelo('Tenant').create({
      nombre: 'GymRep',
      nit: '900444',
      slug: 'gymrep',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });
  });

  const sedes = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    return { norte };
  });

  const hash = await cifrarContrasena(CONTRASENA);
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gymrep.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'norte@gymrep.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
  });

  return { tenant, sedes };
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

beforeEach(limpiarColecciones);

describe('Reportes de maquinas', () => {
  it('un encargado que marca una maquina dañada genera un reporte para el dueño', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymrep.co');
    const maquina = await recepcion
      .post('/api/maquinas')
      .send({ nombre: 'Caminadora 1', sede: String(sedes.norte._id) })
      .expect(201);

    await recepcion
      .patch(`/api/maquinas/${maquina.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.DANADA, nota: 'Banda rota' })
      .expect(200);

    const dueno = await entrarComo('owner@gymrep.co');
    const respuesta = await dueno.get('/api/reportes-maquina').expect(200);

    expect(respuesta.body.data.noLeidos).toBe(1);
    expect(respuesta.body.data.reportes).toHaveLength(1);
    expect(respuesta.body.data.reportes[0]).toMatchObject({
      nombreMaquina: 'Caminadora 1',
      estado: ESTADOS_MAQUINA.DANADA,
      nota: 'Banda rota',
      reportadoPorNombre: 'Carlos Norte',
      leido: false,
    });
  });

  it('si el propio dueño cambia el estado, NO se genera reporte', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymrep.co');
    const maquina = await dueno
      .post('/api/maquinas')
      .send({ nombre: 'Polea', sede: String(sedes.norte._id) })
      .expect(201);

    await dueno
      .patch(`/api/maquinas/${maquina.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.MANTENIMIENTO })
      .expect(200);

    const respuesta = await dueno.get('/api/reportes-maquina').expect(200);
    expect(respuesta.body.data.reportes).toHaveLength(0);
  });

  it('editar la nota de una maquina ya dañada no genera un reporte nuevo', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymrep.co');
    const maquina = await recepcion
      .post('/api/maquinas')
      .send({ nombre: 'Banca', sede: String(sedes.norte._id), estado: ESTADOS_MAQUINA.DANADA })
      .expect(201); // ya nace reportada: 1 reporte

    await recepcion
      .patch(`/api/maquinas/${maquina.body.data._id}`)
      .send({ nota: 'Sigue rota, falta repuesto' }) // mismo estado: sin reporte nuevo
      .expect(200);

    const dueno = await entrarComo('owner@gymrep.co');
    const respuesta = await dueno.get('/api/reportes-maquina').expect(200);
    expect(respuesta.body.data.reportes).toHaveLength(1);
  });

  it('marcar leidos deja el conteo de no leidos en cero, sin borrar los reportes', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymrep.co');
    const maquina = await recepcion
      .post('/api/maquinas')
      .send({ nombre: 'Bici', sede: String(sedes.norte._id) })
      .expect(201);
    await recepcion
      .patch(`/api/maquinas/${maquina.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.DANADA })
      .expect(200);

    const dueno = await entrarComo('owner@gymrep.co');
    await dueno.post('/api/reportes-maquina/marcar-leidos').expect(200);

    const noLeidos = await dueno.get('/api/reportes-maquina/no-leidos').expect(200);
    expect(noLeidos.body.data.noLeidos).toBe(0);

    // El reporte sigue ahi para consultarlo.
    const lista = await dueno.get('/api/reportes-maquina').expect(200);
    expect(lista.body.data.reportes).toHaveLength(1);
    expect(lista.body.data.reportes[0].leido).toBe(true);
  });

  it('el reporte muestra el estado ACTUAL: si el dueño la arregla, queda operativa', async () => {
    const { sedes } = await montarGimnasio();
    const recepcion = await entrarComo('norte@gymrep.co');
    const maquina = await recepcion
      .post('/api/maquinas')
      .send({ nombre: 'Remo', sede: String(sedes.norte._id) })
      .expect(201);
    await recepcion
      .patch(`/api/maquinas/${maquina.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.DANADA })
      .expect(200);

    const dueno = await entrarComo('owner@gymrep.co');
    const pendiente = await dueno.get('/api/reportes-maquina').expect(200);
    expect(pendiente.body.data.reportes[0].estadoActual).toBe(ESTADOS_MAQUINA.DANADA);

    // El dueño la arregla desde su panel: el reporte conserva su foto pero el
    // estado actual ya es otro.
    await dueno
      .patch(`/api/maquinas/${maquina.body.data._id}`)
      .send({ estado: ESTADOS_MAQUINA.OPERATIVA })
      .expect(200);

    const resuelto = await dueno.get('/api/reportes-maquina').expect(200);
    expect(resuelto.body.data.reportes[0]).toMatchObject({
      estado: ESTADOS_MAQUINA.DANADA, // la foto de cuando se reporto
      estadoActual: ESTADOS_MAQUINA.OPERATIVA, // como esta hoy
    });
    // Y arreglarla desde el panel del dueño no genera un reporte nuevo.
    expect(resuelto.body.data.reportes).toHaveLength(1);
  });

  it('un encargado de sede no puede ver el panel de reportes (403)', async () => {
    await montarGimnasio();
    const recepcion = await entrarComo('norte@gymrep.co');
    await recepcion.get('/api/reportes-maquina').expect(403);
  });
});
