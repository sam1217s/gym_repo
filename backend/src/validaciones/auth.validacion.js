import { z } from 'zod';

const LONGITUD_MINIMA_CONTRASENA = 8;

export const contrasenaSegura = z
  .string()
  .min(LONGITUD_MINIMA_CONTRASENA, `Minimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`)
  .regex(/[a-z]/, 'Debe incluir al menos una minuscula')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayuscula')
  .regex(/\d/, 'Debe incluir al menos un numero');

export const esquemaIniciarSesion = {
  body: z.object({
    email: z.string().email('Email invalido').toLowerCase().trim(),
    contrasena: z.string().min(1, 'La contrasena es obligatoria'),

    // Solo hace falta cuando el mismo email existe en mas de un gimnasio,
    // porque el email es unico por tenant, no globalmente.
    slugGimnasio: z.string().trim().optional(),
  }),
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
