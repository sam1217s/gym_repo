import { z } from 'zod';
import { contrasenaSegura } from './auth.validacion.js';
import { cedulaOpcional, idMongo, telefonoOpcional } from './comunes.validacion.js';

/**
 * Un tenant_owner solo puede crear y administrar `sede_admin`. El rol no viaja
 * en el cuerpo: lo fija el servicio. Crear otro `tenant_owner` o tocarse a si
 * mismo queda fuera de este CRUD a proposito.
 */

export const esquemaCrearUsuario = {
  body: z.object({
    nombres: z.string().trim().min(1, 'Los nombres son obligatorios'),
    apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios'),
    email: z.string().email('Email invalido').toLowerCase().trim(),
    // Cedula y telefono son OBLIGATORIOS al crear: de ahi depende el login del
    // administrador (la cedula es su clave por defecto; el telefono, el OTP).
    cedula: z.string().trim().regex(/^\d{4,15}$/, 'La cedula debe ser numerica (4 a 15 digitos)'),
    telefono: z
      .string()
      .trim()
      .regex(/^\+?\d{7,15}$/, 'Telefono en formato internacional, ej: +573001234567'),
    contrasenaInicial: contrasenaSegura,
    sede: idMongo,
  }),
};

export const esquemaActualizarUsuario = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      nombres: z.string().trim().min(1),
      apellidos: z.string().trim().min(1),
      // La cedula se puede agregar o corregir despues del alta (es la que se usa
      // por defecto al restablecer la contrasena).
      cedula: cedulaOpcional,
      telefono: telefonoOpcional,
      sede: idMongo,
      activo: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};

/**
 * Restablecer la contrasena de un integrante. `contrasena` es OPCIONAL: si no
 * viene, el servicio usa el numero de cedula del integrante como clave nueva.
 */
export const esquemaRestablecerContrasena = {
  params: z.object({ id: idMongo }),
  body: z.object({
    contrasena: contrasenaSegura.optional(),
  }),
};
