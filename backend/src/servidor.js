import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { entorno } from './config/entorno.js';
import { manejadorErrores } from './middlewares/manejadorErrores.js';
import { noEncontrado } from './middlewares/noEncontrado.js';
import rutas from './rutas/indice.js';

const LIMITE_CUERPO_JSON = '100kb';

/**
 * Construye la app de Express sin arrancarla. Separar esto de `index.js` es lo
 * que permite que las pruebas la levanten en memoria sin abrir un puerto.
 */
export function crearServidor() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  /**
   * CORS con credenciales. `origin` tiene que ser un origen explicito: el
   * navegador rechaza `Access-Control-Allow-Origin: *` cuando la peticion lleva
   * cookies. En desarrollo esto ni siquiera entra en juego, porque el proxy del
   * dev-server de Quasar hace que todo salga desde el mismo origen.
   */
  app.use(cors({ origin: entorno.ORIGEN_FRONTEND, credentials: true }));

  app.use(express.json({ limit: LIMITE_CUERPO_JSON }));
  app.use(cookieParser());

  app.use('/api', rutas);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
