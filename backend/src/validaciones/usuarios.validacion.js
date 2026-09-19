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
    cedula: cedulaOpcional,
    // Con telefono, el integrante puede entrar por codigo OTP ademas de contrasena.
    telefono: telefonoOpcional,
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
