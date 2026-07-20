import { z } from 'zod';
import { contrasenaSegura } from './auth.validacion.js';
import { cedulaOpcional, idMongo } from './comunes.validacion.js';

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
      sede: idMongo,
      activo: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};
