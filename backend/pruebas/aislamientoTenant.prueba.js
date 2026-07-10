import { beforeEach, describe, expect, it } from 'vitest';

import {
  ejecutarConTenant,
  ejecutarSinTenant,
} from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * La prueba que sostiene todo el producto.
 *
 * Si algo de esto se pone en rojo, un gimnasio esta viendo los datos de otro.
 * Ninguna funcionalidad nueva se construye encima hasta que vuelva a verde.
 *
 * Se prueba en negativo (A no ve lo de B) y en positivo (un super_admin, dentro
 * de `ejecutarSinTenant`, si ve los dos).
 */

const SIN_CONTEXTO = /sin contexto de tenant/i;

let gimnasioA;
let gimnasioB;

/** Crea dos gimnasios con datos identicos, para que solo el tenant los distinga. */
async function sembrarDosGimnasios() {
  const { tenantA, tenantB } = await ejecutarSinTenant(async () => {
    const PlanPlataforma = obtenerModelo('PlanPlataforma');
    const Tenant = obtenerModelo('Tenant');

    const planPlataforma = await PlanPlataforma.create({
      nombre: 'Basico',
      precioMensual: 100_000,
      limites: { maxSedes: 3, maxMiembros: 500, maxUsuarios: 5 },
    });

    const [a, b] = await Promise.all([
      Tenant.create({ nombre: 'Gimnasio A', nit: '900111', slug: 'gimnasio-a', planPlataforma: planPlataforma._id }),
      Tenant.create({ nombre: 'Gimnasio B', nit: '900222', slug: 'gimnasio-b', planPlataforma: planPlataforma._id }),
    ]);

    return { tenantA: a, tenantB: b };
  });

  return {
    gimnasioA: await sembrarGimnasio(tenantA._id, 'A', 60_000),
    gimnasioB: await sembrarGimnasio(tenantB._id, 'B', 90_000),
  };
}

async function sembrarGimnasio(tenantId, etiqueta, montoPago) {
  const usuario = await ejecutarSinTenant(async () =>
    obtenerModelo('Usuario').create({
      tenant: tenantId,
      nombres: 'Duena',
      apellidos: etiqueta,
      email: `duena@gimnasio-${etiqueta.toLowerCase()}.co`,
      contrasenaHash: 'hash-irrelevante-para-esta-prueba',
      rol: 'tenant_owner',
    }),
  );

  return ejecutarConTenant(tenantId, async () => {
    const sede = await obtenerModelo('Sede').create({
      nombre: `Sede Principal ${etiqueta}`,
      direccion: `Calle ${etiqueta}`,
    });

    const planMembresia = await obtenerModelo('PlanMembresia').create({
      nombre: 'Mensual',
      precio: montoPago,
      duracionMeses: 1,
    });

    // Mismo documento en ambos gimnasios: el indice unico es `{ tenant, documento }`,
    // no `{ documento }`, asi que esto debe poder convivir.
    const miembro = await obtenerModelo('Miembro').create({
      sede: sede._id,
      nombres: 'Ana',
      apellidos: etiqueta,
      documento: '1020304050',
      telefono: '573001234567',
    });

    const pago = await obtenerModelo('Pago').create({
      sede: sede._id,
      miembro: miembro._id,
      planMembresia: planMembresia._id,
      monto: montoPago,
      metodoPago: 'efectivo',
      fechaPago: new Date(),
      periodoInicio: new Date(),
      periodoFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      registradoPor: usuario._id,
    });

    return { tenantId, sede, planMembresia, miembro, pago, usuario, montoPago };
  });
}

beforeEach(async () => {
  await limpiarColecciones();
  ({ gimnasioA, gimnasioB } = await sembrarDosGimnasios());
});

// ---------------------------------------------------------------------------
describe('un tenant no puede leer datos de otro', () => {
  it('find() solo devuelve documentos del tenant en contexto', async () => {
    const miembrosDeA = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Miembro').find(),
    );

    expect(miembrosDeA).toHaveLength(1);
    expect(miembrosDeA[0].apellidos).toBe('A');
    expect(miembrosDeA[0].tenant.toString()).toBe(gimnasioA.tenantId.toString());
  });

  it('findById() de un documento ajeno devuelve null, no el documento', async () => {
    const encontrado = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Miembro').findById(gimnasioB.miembro._id),
    );

    expect(encontrado).toBeNull();
  });

  it('countDocuments() no cuenta los documentos del otro tenant', async () => {
    const total = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Pago').countDocuments(),
    );

    expect(total).toBe(1);
  });

  it('un filtro con el tenant del vecino se sobreescribe con el del contexto', async () => {
    const miembros = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Miembro').find({ tenant: gimnasioB.tenantId }),
    );

    // El cliente pidio los de B estando en A: recibe los de A, nunca los de B.
    expect(miembros).toHaveLength(1);
    expect(miembros[0]._id.toString()).toBe(gimnasioA.miembro._id.toString());
  });

  it('aggregate() sin $match propio solo agrega el tenant en contexto', async () => {
    const [resumen] = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Pago').aggregate([
        { $group: { _id: null, total: { $sum: '$monto' }, cantidad: { $sum: 1 } } },
      ]),
    );

    expect(resumen.cantidad).toBe(1);
    expect(resumen.total).toBe(gimnasioA.montoPago); // 60.000, no 150.000
  });
});

// ---------------------------------------------------------------------------
describe('un tenant no puede escribir sobre datos de otro', () => {
  it('updateMany({}) no toca los documentos del otro tenant', async () => {
    await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Miembro').updateMany({}, { $set: { activo: false } }),
    );

    const miembroB = await ejecutarConTenant(gimnasioB.tenantId, () =>
      obtenerModelo('Miembro').findById(gimnasioB.miembro._id),
    );

    expect(miembroB.activo).toBe(true);
  });

  it('deleteMany({}) no borra los documentos del otro tenant', async () => {
    await ejecutarConTenant(gimnasioA.tenantId, () => obtenerModelo('Miembro').deleteMany({}));

    const sobrevivientesB = await ejecutarConTenant(gimnasioB.tenantId, () =>
      obtenerModelo('Miembro').countDocuments(),
    );

    expect(sobrevivientesB).toBe(1);
  });

  it('save() ignora el tenant que venga en los datos y usa el del contexto', async () => {
    const guardado = await ejecutarConTenant(gimnasioA.tenantId, async () => {
      const Miembro = obtenerModelo('Miembro');

      // Un atacante intenta crear un miembro dentro del gimnasio B.
      const intruso = new Miembro({
        tenant: gimnasioB.tenantId,
        sede: gimnasioA.sede._id,
        nombres: 'Intruso',
        apellidos: 'Malicioso',
        documento: '9999999',
        telefono: '573009999999',
      });

      return intruso.save();
    });

    expect(guardado.tenant.toString()).toBe(gimnasioA.tenantId.toString());
  });

  it('insertMany() asigna el tenant del contexto a todos los documentos', async () => {
    const insertados = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Sede').insertMany([
        { nombre: 'Sede Norte', direccion: 'Cra 1' },
        { nombre: 'Sede Sur', direccion: 'Cra 2', tenant: gimnasioB.tenantId },
      ]),
    );

    for (const sede of insertados) {
      expect(sede.tenant.toString()).toBe(gimnasioA.tenantId.toString());
    }
  });

  it('el tenant de un documento es inmutable: no se puede mover de gimnasio', async () => {
    await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Miembro').updateOne(
        { _id: gimnasioA.miembro._id },
        { $set: { tenant: gimnasioB.tenantId, nombres: 'Renombrada' } },
      ),
    );

    const miembro = await ejecutarConTenant(gimnasioA.tenantId, () =>
      obtenerModelo('Miembro').findById(gimnasioA.miembro._id),
    );

    expect(miembro.nombres).toBe('Renombrada'); // el resto del update si se aplico
    expect(miembro.tenant.toString()).toBe(gimnasioA.tenantId.toString());
  });
});

// ---------------------------------------------------------------------------
describe('sin contexto de tenant la operacion falla, nunca trae todo', () => {
  it('find() lanza', async () => {
    await expect(obtenerModelo('Miembro').find()).rejects.toThrow(SIN_CONTEXTO);
  });

  it('findById() lanza', async () => {
    await expect(obtenerModelo('Miembro').findById(gimnasioA.miembro._id)).rejects.toThrow(
      SIN_CONTEXTO,
    );
  });

  it('countDocuments() lanza', async () => {
    await expect(obtenerModelo('Pago').countDocuments()).rejects.toThrow(SIN_CONTEXTO);
  });

  it('updateMany() lanza', async () => {
    await expect(obtenerModelo('Miembro').updateMany({}, { $set: { activo: false } })).rejects.toThrow(
      SIN_CONTEXTO,
    );
  });

  it('deleteMany() lanza', async () => {
    await expect(obtenerModelo('Miembro').deleteMany({})).rejects.toThrow(SIN_CONTEXTO);
  });

  it('aggregate() lanza', async () => {
    await expect(obtenerModelo('Pago').aggregate([{ $count: 'total' }])).rejects.toThrow(
      SIN_CONTEXTO,
    );
  });

  it('save() lanza', async () => {
    const Sede = obtenerModelo('Sede');
    const sede = new Sede({ nombre: 'Fantasma', direccion: 'Ninguna' });

    await expect(sede.save()).rejects.toThrow(SIN_CONTEXTO);
  });

  it('estimatedDocumentCount() esta prohibido porque ignora el filtro de tenant', async () => {
    await expect(
      ejecutarConTenant(gimnasioA.tenantId, () => obtenerModelo('Miembro').estimatedDocumentCount()),
    ).rejects.toThrow(/prohibido/i);
  });
});

// ---------------------------------------------------------------------------
describe('la escotilla explicita: un super_admin si ve todos los tenants', () => {
  it('ejecutarSinTenant() devuelve los documentos de ambos gimnasios', async () => {
    const miembros = await ejecutarSinTenant(() => obtenerModelo('Miembro').find().sort({ apellidos: 1 }));

    expect(miembros).toHaveLength(2);
    expect(miembros.map((miembro) => miembro.apellidos)).toEqual(['A', 'B']);
  });

  it('ejecutarSinTenant() agrega los pagos de todos los gimnasios', async () => {
    const [resumen] = await ejecutarSinTenant(() =>
      obtenerModelo('Pago').aggregate([{ $group: { _id: null, total: { $sum: '$monto' } } }]),
    );

    expect(resumen.total).toBe(gimnasioA.montoPago + gimnasioB.montoPago); // 150.000
  });

  it('ejecutarSinTenant() cuenta los documentos de todos los gimnasios', async () => {
    const total = await ejecutarSinTenant(() => obtenerModelo('Sede').countDocuments());

    expect(total).toBe(2);
  });

  it('ejecutarSinTenant() exige que el tenant venga explicito al crear', async () => {
    const Sede = obtenerModelo('Sede');

    await expect(
      ejecutarSinTenant(() => Sede.create({ nombre: 'Sin dueno', direccion: 'Calle 0' })),
    ).rejects.toThrow(/tenant/i);
  });

  it('el aislamiento vuelve a activarse al salir de ejecutarSinTenant()', async () => {
    await ejecutarSinTenant(() => obtenerModelo('Miembro').find());

    const miembrosDeB = await ejecutarConTenant(gimnasioB.tenantId, () =>
      obtenerModelo('Miembro').find(),
    );

    expect(miembrosDeB).toHaveLength(1);
    expect(miembrosDeB[0].apellidos).toBe('B');
  });
});
