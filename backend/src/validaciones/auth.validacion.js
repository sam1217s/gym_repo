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
    // Se entra por correo O por cedula: `identificador` es cualquiera de los dos.
    // No se valida formato de email aqui a proposito (una cedula no lo cumpliria);
    // el servicio decide si es correo o cedula segun contenga '@'.
    identificador: z.string().trim().min(1, 'Ingresa tu correo o cedula'),
    contrasena: z.string().min(1, 'La contrasena es obligatoria'),

    // Reservado por si el dato existiera en varios gimnasios; con uno solo, inerte.
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
