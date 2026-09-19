import { z } from 'zod';

import { LISTA_CANALES_OTP } from '../config/constantes.js';

const LONGITUD_MINIMA_CONTRASENA = 8;

// Telefono en internacional; se acepta con o sin '+' y se normaliza en el servicio.
const telefono = z
  .string()
  .trim()
  .min(7, 'Telefono invalido')
  .regex(/^\+?\d{7,15}$/, 'Telefono invalido');

export const esquemaEnviarOtp = {
  body: z.object({
    telefono,
    canal: z.enum(LISTA_CANALES_OTP),
  }),
};

export const esquemaVerificarOtp = {
  body: z.object({
    telefono,
    codigo: z.string().trim().regex(/^\d{4,8}$/, 'El codigo debe tener entre 4 y 8 digitos'),
  }),
};

/** Cada usuario fija su propio telefono (para poder entrar por OTP). */
export const esquemaMiTelefono = {
  body: z.object({ telefono }),
};

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
