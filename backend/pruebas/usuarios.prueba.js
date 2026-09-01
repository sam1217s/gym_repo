import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESTADOS_TENANT, ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Equipo (staff): lo administra SOLO el dueno. Aqui se prueba el restablecimiento
 * de contrasena de un integrante, que por defecto usa su numero de cedula.
 */

const CONTRASENA = 'ClaveInicial1';
const CEDULA_ADMIN = '1088291234';
const app = crearServidor();

async function montar() {
  const tenant = await ejecutarSinTenant(async () => {
    const plan = await obtenerModelo('PlanPlataforma').create({
      nombre: `Plan ${Math.random()}`,
      precioMensual: 100_000,
      limites: { maxSedes: 5, maxMiembros: 500, maxUsuarios: 10 },
    });
    return obtenerModelo('Tenant').create({
      nombre: 'Gym Equipo',
      nit: '900555',
      slug: 'gym-equipo',
      estado: ESTADOS_TENANT.ACTIVO,
      planPlataforma: plan._id,
    });
  });

  const sede = await ejecutarConTenant(tenant._id, () =>
    obtenerModelo('Sede').create({ nombre: 'Norte', direccion: 'Calle 100' }),
  );

  const hash = await cifrarContrasena(CONTRASENA);
  const { conCedula, sinCedula } = await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gym-equipo.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    const conCedula = await Usuario.create({
      tenant: tenant._id, sede: sede._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'carlos@gym-equipo.co', cedula: CEDULA_ADMIN, contrasenaHash: hash,
      rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
    const sinCedula = await Usuario.create({
      tenant: tenant._id, sede: sede._id, nombres: 'Diana', apellidos: 'Sur',
      email: 'diana@gym-equipo.co', contrasenaHash: hash,
      rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
    return { conCedula, sinCedula };
  });

  return { tenant, sede, conCedula, sinCedula };
}

async function entrarComo(identificador, contrasena = CONTRASENA) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador, contrasena }).expect(200);
  return agente;
}

beforeEach(limpiarColecciones);

describe('POST /api/usuarios/:id/restablecer-contrasena', () => {
  it('por defecto deja la clave igual a la cedula y exige cambiarla al entrar', async () => {
    const { conCedula } = await montar();
    const dueno = await entrarComo('owner@gym-equipo.co');

    const res = await dueno.post(`/api/usuarios/${conCedula._id}/restablecer-contrasena`).send({}).expect(200);
    expect(res.body.data.usoCedula).toBe(true);

    // El admin ya puede entrar con su cedula como usuario Y como contrasena.
    await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ identificador: CEDULA_ADMIN, contrasena: CEDULA_ADMIN })
      .expect(200);

    // Y quedo marcado para cambiarla en el primer acceso.
    const enBase = await ejecutarSinTenant(() =>
      obtenerModelo('Usuario').findById(conCedula._id).select('+contrasenaHash'),
    );
    expect(enBase.debeCambiarContrasena).toBe(true);

    // La contrasena vieja ya no sirve.
    await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ identificador: 'carlos@gym-equipo.co', contrasena: CONTRASENA })
      .expect(401);
  });

  it('acepta una contrasena explicita cuando se envia', async () => {
    const { conCedula } = await montar();
    const dueno = await entrarComo('owner@gym-equipo.co');

    const res = await dueno
      .post(`/api/usuarios/${conCedula._id}/restablecer-contrasena`)
      .send({ contrasena: 'NuevaClave9' })
      .expect(200);
    expect(res.body.data.usoCedula).toBe(false);

    await peticion(app)
      .post('/api/auth/iniciar-sesion')
      .send({ identificador: 'carlos@gym-equipo.co', contrasena: 'NuevaClave9' })
      .expect(200);
  });

  it('sin cedula y sin contrasena responde 400 explicando', async () => {
    const { sinCedula } = await montar();
    const dueno = await entrarComo('owner@gym-equipo.co');

    const res = await dueno.post(`/api/usuarios/${sinCedula._id}/restablecer-contrasena`).send({}).expect(400);
    expect(res.body.error.mensaje).toMatch(/cedula/i);
  });

  it('un sede_admin no puede restablecer contrasenas (solo el dueno)', async () => {
    const { conCedula } = await montar();
    const admin = await entrarComo('carlos@gym-equipo.co');

    await admin.post(`/api/usuarios/${conCedula._id}/restablecer-contrasena`).send({}).expect(403);
  });
});
