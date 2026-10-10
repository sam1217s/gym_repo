import * as servicioAcceso from '../servicios/acceso.servicio.js';
import * as servicioHuellas from '../servicios/huellas.servicio.js';
import * as servicioPuestos from '../servicios/puestosAcceso.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

// --- Desde el PC de la puerta (`peticion.puesto`, lo deja autenticarPuesto) ---

export const verPuesto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioAcceso.describirPuesto(peticion.puesto)),
);

export const sincronizarHuellas = manejadorAsync(async (_peticion, respuesta) =>
  responderOk(respuesta, await servicioHuellas.listarPlantillasParaPuesto()),
);

export const listarEntradasDePuesto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioAcceso.listarEntradasDePuesto(peticion.puesto)),
);

export const verificarAcceso = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioAcceso.verificarAcceso(peticion.body, peticion.puesto)),
);

// --- Huellas desde la ficha del miembro (personal del gimnasio) ---

export const listarHuellas = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioHuellas.listarHuellas(peticion.params.id, peticion.filtroSede)),
);

export const listarMiembrosConHuella = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioHuellas.listarMiembrosConHuella(peticion.filtroSede)),
);

export const registrarHuella = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(
    respuesta,
    await servicioHuellas.registrarHuella(peticion.params.id, peticion.body, {
      filtroSede: peticion.filtroSede,
      actor: peticion.usuario,
    }),
  ),
);

export const eliminarHuella = manejadorAsync(async (peticion, respuesta) =>
  responderOk(
    respuesta,
    await servicioHuellas.eliminarHuella(peticion.params.id, peticion.params.huellaId, peticion.filtroSede),
  ),
);

// --- Historial de entradas (personal del gimnasio) ---

export const listarAccesos = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioAcceso.listarAccesos(peticion.filtroSede, peticion.query)),
);

// --- Puestos de entrada (dueño) ---

export const listarPuestos = manejadorAsync(async (_peticion, respuesta) =>
  responderOk(respuesta, await servicioPuestos.listarPuestos()),
);

export const crearPuesto = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioPuestos.crearPuesto(peticion.body, peticion.usuario.tenant)),
);

export const regenerarTokenPuesto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPuestos.regenerarToken(peticion.params.id, peticion.usuario.tenant)),
);

export const desactivarPuesto = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPuestos.desactivarPuesto(peticion.params.id)),
);
