import { z } from 'zod';
import { LISTA_CATEGORIAS_GASTO } from '../config/constantes.js';
import { diaCivil, idMongo } from './comunes.validacion.js';

/** Gastos (egresos) y deudas del gimnasio. */

const categoria = z.enum(LISTA_CATEGORIAS_GASTO);

/**
 * Rango de fechas del resumen y del listado. Son dias civiles (medianoche
 * local, no UTC: ver `diaCivil`). Sin rango, el servicio asume el MES actual.
 */
const rango = z.object({
  desde: diaCivil.optional(),
  hasta: diaCivil.optional(),
});

export const esquemaListarGastos = {
  query: rango.extend({
    sede: idMongo.optional(),
    categoria: categoria.optional(),
  }),
};

export const esquemaResumenFinanzas = { query: rango };

export const esquemaCrearGasto = {
  body: z.object({
    categoria,
    concepto: z.string().trim().min(1, 'El concepto es obligatorio'),
    monto: z.number().min(0),
    fecha: diaCivil.optional(),
    // Sin sede = gasto general del gimnasio (solo el dueño puede). A un
    // sede_admin el servicio le fuerza la suya.
    sede: idMongo.nullish(),
    notas: z.string().trim().max(500).optional(),
  }),
};

export const esquemaActualizarGasto = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      categoria,
      concepto: z.string().trim().min(1),
      monto: z.number().min(0),
      fecha: diaCivil,
      notas: z.string().trim().max(500),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};

// --- Deudas ------------------------------------------------------------------

export const esquemaCrearDeuda = {
  body: z.object({
    descripcion: z.string().trim().min(1, 'La descripcion es obligatoria'),
    acreedor: z.string().trim().max(120).optional(),
    montoTotal: z.number().min(0),
    fechaInicio: diaCivil.optional(),
    // Normalmente `null` (deuda del gimnasio); se puede atribuir a una sede.
    sede: idMongo.nullish(),
    notas: z.string().trim().max(500).optional(),
  }),
};

export const esquemaActualizarDeuda = {
  params: z.object({ id: idMongo }),
  body: z
    .object({
      descripcion: z.string().trim().min(1),
      acreedor: z.string().trim().max(120),
      montoTotal: z.number().min(0),
      notas: z.string().trim().max(500),
      activa: z.boolean(),
    })
    .partial()
    .refine((datos) => Object.keys(datos).length > 0, { message: 'No hay nada que actualizar' }),
};

/** Abono a una deuda: crea un gasto ligado a ella. */
export const esquemaAbonarDeuda = {
  params: z.object({ id: idMongo }),
  body: z.object({
    monto: z.number().positive('El abono debe ser mayor que cero'),
    fecha: diaCivil.optional(),
    notas: z.string().trim().max(500).optional(),
  }),
};
