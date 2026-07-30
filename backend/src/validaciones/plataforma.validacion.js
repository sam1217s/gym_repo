import { z } from 'zod';
import { LISTA_ESTADOS_TENANT } from '../config/constantes.js';
import { contrasenaSegura } from './auth.validacion.js';
import { cedulaOpcional, idMongo, slugValido } from './comunes.validacion.js';

/**
 * Validacion de entrada de las rutas de plataforma (solo super_admin).
 * Esquemas Zod, no confundir con los esquemas de Mongoose de `modelos/`.
 */

export const esquemaIdParam = {
  params: z.object({ id: idMongo }),
};

// --- Planes de plataforma ---------------------------------------------------

const limitesPlan = z.object({
  maxSedes: z.number().int().min(1),
  maxMiembros: z.number().int().min(1),
  maxUsuarios: z.number().int().min(1),
});

const featuresPlan = z.object({
  whatsapp: z.boolean().default(false),
  reportes: z.boolean().default(false),
});

export const esquemaCrearPlan = {
  body: z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
    precioMensual: z.number().min(0),
    limites: limitesPlan,
    features: featuresPlan.default({}),
  }),
};

export const esquemaActualizarPlan = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      nombre: z.string().trim().min(1),
      precioMensual: z.number().min(0),
      limites: limitesPlan.partial(),
      features: featuresPlan.partial(),
      activo: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, {
      message: 'No hay nada que actualizar',
    }),
};

// --- Tenants -----------------------------------------------------------------

export const esquemaListarTenants = {
  query: z.object({
    estado: z.enum(LISTA_ESTADOS_TENANT).optional(),
  }),
};

/** Datos editables del dueno del gimnasio. */
const duenoEditable = z
  .object({
    nombres: z.string().trim().min(1),
    apellidos: z.string().trim().min(1),
    email: z.string().email('Email invalido').toLowerCase().trim(),
  })
  .partial();

/** Edicion de los datos basicos de un gimnasio y su dueno (no el estado ni los secretos). */
export const esquemaActualizarTenant = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      nombre: z.string().trim().min(1),
      nit: z.string().trim().min(1),
      slug: slugValido,
      planPlataforma: idMongo,
      dueno: duenoEditable,
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, {
      message: 'No hay nada que actualizar',
    }),
};

/**
 * Onboarding: las tres piezas que nacen juntas. El orden de las claves refleja
 * el orden real de creacion (tenant -> dueno -> primera sede).
 */
export const esquemaCrearGimnasio = {
  body: z.object({
    gimnasio: z.object({
      nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
      nit: z.string().trim().min(1, 'El NIT es obligatorio'),
      slug: slugValido,
      planPlataforma: idMongo,
    }),
    dueno: z.object({
      nombres: z.string().trim().min(1, 'Los nombres son obligatorios'),
      apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios'),
      email: z.string().email('Email invalido').toLowerCase().trim(),
      cedula: cedulaOpcional,
      // El dueno entra con esta clave y el sistema le exige cambiarla al primer acceso.
      contrasenaInicial: contrasenaSegura,
    }),
    sede: z.object({
      nombre: z.string().trim().min(1, 'El nombre de la sede es obligatorio'),
      direccion: z.string().trim().min(1, 'La direccion es obligatoria'),
      telefono: z.string().trim().optional(),
    }),
  }),
};
