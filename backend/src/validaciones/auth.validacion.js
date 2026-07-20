import { z } from 'zod';

import { cedulaOpcional, slugValido } from './comunes.validacion.js';

const LONGITUD_MINIMA_CONTRASENA = 8;

export const contrasenaSegura = z
  .string()
  .min(LONGITUD_MINIMA_CONTRASENA, `Minimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`)
  .regex(/[a-z]/, 'Debe incluir al menos una minuscula')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayuscula')
  .regex(/\d/, 'Debe incluir al menos un numero');

export const esquemaIniciarSesion = {
  body: z.object({
    // Se entra por correo O por cedula: `identificador` es cualquiera de los dos.
    // No se valida formato de email aqui a proposito (una cedula no lo cumpliria);
    // el servicio decide si es correo o cedula segun contenga '@'.
    identificador: z.string().trim().min(1, 'Ingresa tu correo o cedula'),
    contrasena: z.string().min(1, 'La contrasena es obligatoria'),

    // Solo hace falta cuando el mismo correo/cedula existe en mas de un gimnasio,
    // porque son unicos por tenant, no globalmente.
    slugGimnasio: z.string().trim().optional(),
  }),
};

/**
 * Registro publico de un gimnasio. Igual que el onboarding del super_admin pero:
 *   - sin `planPlataforma` (la suscripcion es unica, la fija el servidor);
 *   - el dueno elige SU propia clave (`contrasena`), no una inicial que cambiar.
 */
export const esquemaRegistrarGimnasio = {
  body: z.object({
    gimnasio: z.object({
      nombre: z.string().trim().min(1, 'El nombre del gimnasio es obligatorio'),
      nit: z.string().trim().min(1, 'El NIT es obligatorio'),
      slug: slugValido,
    }),
    dueno: z.object({
      nombres: z.string().trim().min(1, 'Los nombres son obligatorios'),
      apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios'),
      email: z.string().email('Email invalido').toLowerCase().trim(),
      cedula: cedulaOpcional,
      contrasena: contrasenaSegura,
    }),
    sede: z.object({
      nombre: z.string().trim().min(1, 'El nombre de la sede es obligatorio'),
      direccion: z.string().trim().min(1, 'La direccion es obligatoria'),
      telefono: z.string().trim().optional(),
    }),
  }),
};

export const esquemaVerificarEmail = {
  query: z.object({ token: z.string().min(1, 'Falta el token') }),
};

export const esquemaCambiarContrasena = {
  body: z
    .object({
      contrasenaActual: z.string().min(1, 'La contrasena actual es obligatoria'),
      contrasenaNueva: contrasenaSegura,
    })
    .refine((datos) => datos.contrasenaActual !== datos.contrasenaNueva, {
      message: 'La contrasena nueva debe ser distinta de la actual',
      path: ['contrasenaNueva'],
    }),
};
