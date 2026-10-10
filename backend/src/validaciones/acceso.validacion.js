import { z } from 'zod';
import { DEDOS, LISTA_METODOS_ACCESO, LISTA_RESULTADOS_ACCESO, METODOS_ACCESO } from '../config/constantes.js';
import { diaCivil, idMongo } from './comunes.validacion.js';

/** Control de acceso en la puerta: huellas, puestos y entradas. */

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
// Una plantilla de 4 KB en base64 son ~5.5 K caracteres.
const LARGO_MAX_PLANTILLA_BASE64 = 6000;

export const esquemaListarHuellas = {
  params: z.object({ id: idMongo }),
};

export const esquemaRegistrarHuella = {
  params: z.object({ id: idMongo }),
  body: z.object({
    plantilla: z.string().max(LARGO_MAX_PLANTILLA_BASE64).regex(BASE64, 'La plantilla de huella no es valida'),
    dedo: z.enum(DEDOS).optional(),
    // Ley 1581: sin autorizacion EXPRESA del miembro no se enrola.
    autorizacionDatosBiometricos: z.literal(true, {
      errorMap: () => ({ message: 'El miembro debe autorizar el tratamiento de sus datos biometricos' }),
    }),
  }),
};

export const esquemaEliminarHuella = {
  params: z.object({ id: idMongo, huellaId: idMongo }),
};

export const esquemaVerificarAcceso = {
  body: z.object({
    miembro: idMongo,
    metodo: z.enum(LISTA_METODOS_ACCESO).default(METODOS_ACCESO.HUELLA),
  }),
};

export const esquemaCrearPuesto = {
  body: z.object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
    sede: idMongo,
  }),
};

export const esquemaIdPuesto = {
  params: z.object({ id: idMongo }),
};

export const esquemaListarAccesos = {
  query: z.object({
    sede: idMongo.optional(),
    fecha: diaCivil.optional(),
    resultado: z.enum(LISTA_RESULTADOS_ACCESO).optional(),
  }),
};
