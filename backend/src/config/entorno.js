import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Contrato de las variables de entorno. Se valida una sola vez, al importar
 * este modulo, para que un `.env` incompleto haga fallar el arranque en vez de
 * producir un error confuso a las tres horas de estar corriendo.
 */
const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1, 'MONGO_URI es obligatoria'),
  JWT_SECRETO_ACCESO: z.string().min(LONGITUD_MINIMA_SECRETO),
  JWT_SECRETO_REFRESCO: z.string().min(LONGITUD_MINIMA_SECRETO),
  ORIGEN_FRONTEND: z.string().url().default('http://localhost:9000'),
  SEMILLA_SUPERADMIN_EMAIL: z.string().email().default('admin@gymsaas.co'),
  SEMILLA_SUPERADMIN_CONTRASENA: z.string().min(8).default('CambiaEstaClave123'),
});

function cargarEntorno() {
  const resultado = esquemaEntorno.safeParse(process.env);

  if (!resultado.success) {
    const detalles = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');
    throw new Error(`Variables de entorno invalidas:\n${detalles}`);
  }

  if (resultado.data.JWT_SECRETO_ACCESO === resultado.data.JWT_SECRETO_REFRESCO) {
    throw new Error('JWT_SECRETO_ACCESO y JWT_SECRETO_REFRESCO deben ser distintos');
  }

  return resultado.data;
}

export const entorno = cargarEntorno();

export const esProduccion = entorno.NODE_ENV === 'production';
export const esPrueba = entorno.NODE_ENV === 'test';
