import peticion from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { ROLES } from '../src/config/constantes.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { crearServidor } from '../src/servidor.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Ventas de productos por sede. Lo critico: vender descuenta el stock y guarda
 * el total con el precio del momento; no se puede vender mas de lo que hay; y un
 * sede_admin solo vende/ve lo de SU sede.
 */

const CONTRASENA = 'ClaveInicial1';
const app = crearServidor();

async function montarGimnasio() {
  const tenant = await ejecutarSinTenant(async () => {
    return obtenerModelo('Tenant').create({
      nombre: 'GymVenta',
      nit: '900333',
      slug: 'gymventa',
    });
  });

  const sedes = await ejecutarConTenant(tenant._id, async () => {
    const Sede = obtenerModelo('Sede');
    const norte = await Sede.create({ nombre: 'Norte', direccion: 'Calle 100' });
    const sur = await Sede.create({ nombre: 'Sur', direccion: 'Carrera 30' });
    return { norte, sur };
  });

  const hash = await cifrarContrasena(CONTRASENA);
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    await Usuario.create({
      tenant: tenant._id, nombres: 'Laura', apellidos: 'Duena',
      email: 'owner@gymventa.co', contrasenaHash: hash, rol: ROLES.TENANT_OWNER, debeCambiarContrasena: false,
    });
    await Usuario.create({
      tenant: tenant._id, sede: sedes.norte._id, nombres: 'Carlos', apellidos: 'Norte',
      email: 'norte@gymventa.co', contrasenaHash: hash, rol: ROLES.SEDE_ADMIN, debeCambiarContrasena: false,
    });
  });

  return { tenant, sedes };
}

async function entrarComo(email) {
  const agente = peticion.agent(app);
  await agente.post('/api/auth/iniciar-sesion').send({ identificador: email, contrasena: CONTRASENA }).expect(200);
  return agente;
}

async function crearProducto(agente, datos) {
  const respuesta = await agente.post('/api/inventario').send(datos).expect(201);
  return respuesta.body.data;
}

beforeEach(limpiarColecciones);

describe('Ventas de productos por sede', () => {
  it('vender descuenta el stock y guarda el total con el precio del momento', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymventa.co');
    const agua = await crearProducto(dueno, {
      nombre: 'Agua', sede: String(sedes.norte._id), cantidad: 40, precio: 3_000,
    });

    const respuesta = await dueno
      .post('/api/ventas')
      .send({ producto: agua._id, cantidad: 5 })
      .expect(201);

    expect(respuesta.body.data.venta).toMatchObject({
      cantidad: 5, precioUnitario: 3_000, total: 15_000, nombreProducto: 'Agua',
    });
    expect(respuesta.body.data.producto.cantidad).toBe(35); // 40 - 5
  });

  it('no deja vender mas de lo que hay y no toca el stock', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymventa.co');
    const agua = await crearProducto(dueno, {
      nombre: 'Agua', sede: String(sedes.norte._id), cantidad: 2, precio: 3_000,
    });

    const respuesta = await dueno.post('/api/ventas').send({ producto: agua._id, cantidad: 5 }).expect(400);
    expect(respuesta.body.error.mensaje).toMatch(/existencias suficientes/i);

    // El stock quedo intacto.
    const inv = await dueno.get('/api/inventario').expect(200);
    expect(inv.body.data.find((p) => p._id === agua._id).cantidad).toBe(2);
  });

  it('el resumen del dia suma el total y las unidades vendidas', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymventa.co');
    const agua = await crearProducto(dueno, {
      nombre: 'Agua', sede: String(sedes.norte._id), cantidad: 40, precio: 3_000,
    });
    await dueno.post('/api/ventas').send({ producto: agua._id, cantidad: 5 }).expect(201);
    await dueno.post('/api/ventas').send({ producto: agua._id, cantidad: 3 }).expect(201);

    const respuesta = await dueno.get('/api/ventas').expect(200);
    expect(respuesta.body.data.resumen).toMatchObject({ total: 24_000, unidades: 8, operaciones: 2 });
    expect(respuesta.body.data.ventas).toHaveLength(2);
  });

  it('un sede_admin no puede vender un producto de otra sede (404)', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymventa.co');
    const productoSur = await crearProducto(dueno, {
      nombre: 'Agua-sur', sede: String(sedes.sur._id), cantidad: 10, precio: 3_000,
    });

    const recepcion = await entrarComo('norte@gymventa.co');
    await recepcion.post('/api/ventas').send({ producto: productoSur._id, cantidad: 1 }).expect(404);
  });

  it('un sede_admin solo ve las ventas de SU sede', async () => {
    const { sedes } = await montarGimnasio();
    const dueno = await entrarComo('owner@gymventa.co');
    const norte = await crearProducto(dueno, {
      nombre: 'Agua-norte', sede: String(sedes.norte._id), cantidad: 10, precio: 3_000,
    });
    const sur = await crearProducto(dueno, {
      nombre: 'Agua-sur', sede: String(sedes.sur._id), cantidad: 10, precio: 3_000,
    });
    await dueno.post('/api/ventas').send({ producto: norte._id, cantidad: 1 }).expect(201);
    await dueno.post('/api/ventas').send({ producto: sur._id, cantidad: 2 }).expect(201);

    // El dueno ve las dos.
    const todas = await dueno.get('/api/ventas').expect(200);
    expect(todas.body.data.ventas).toHaveLength(2);

    // El sede_admin de la norte solo ve la suya.
    const recepcion = await entrarComo('norte@gymventa.co');
    const suyas = await recepcion.get('/api/ventas').expect(200);
    expect(suyas.body.data.ventas).toHaveLength(1);
    expect(suyas.body.data.ventas[0].nombreProducto).toBe('Agua-norte');
  });
});
