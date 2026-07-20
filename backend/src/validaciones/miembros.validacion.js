import { z } from 'zod';
import { emailOpcional, idMongo, telefonoWhatsApp } from './comunes.validacion.js';

export const esquemaListarMiembros = {
  query: z.object({
    sede: idMongo.optional(),
    activo: z.enum(['true', 'false']).optional(),
  }),
};

export const esquemaCrearMiembro = {
  body: z.object({
    nombres: z.string().trim().min(1, 'Los nombres son obligatorios'),
    apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios'),
    documento: z.string().trim().min(1, 'El documento es obligatorio'),
    telefono: telefonoWhatsApp,
    // Opcional: solo para prellenar el pago en linea y el recibo.
    email: emailOpcional,
    // Para un sede_admin es opcional: el servicio la fuerza a la suya.
    sede: idMongo.optional(),
  }),
};

export const esquemaActualizarMiembro = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      nombres: z.string().trim().min(1),
      apellidos: z.string().trim().min(1),
      documento: z.string().trim().min(1),
      telefono: telefonoWhatsApp,
      email: emailOpcional,
      sede: idMongo,
      activo: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};
