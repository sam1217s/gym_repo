import { WebSocketServer } from 'ws';

import { carpetaDatos, config, guardarToken } from './configuracion.js';
import { Lector } from './lector.js';

/**
 * Agente de la puerta. Corre en el PC de cada sede, con el lector ZK9500.
 *
 *   lector ──> identifica (1:N local) ──> POST /acceso/verificar ──> pantallas (WebSocket)
 *
 * - El 1:N lo hace el SDK contra las huellas que se bajan del servidor; el
 *   servidor NUNCA compara huellas, y es el unico que decide si se entra.
 * - El token del puesto vive aqui, nunca en el navegador: la pantalla de la
 *   puerta no necesita sesion, solo escucha al agente. Llega al VINCULAR el equipo
 *   desde /acceso (el dueño inicia sesion ahi una vez y el panel le pasa el token
 *   por el WebSocket local); se guarda en `config.json` y se valida antes.
 * - Modo enrolamiento: una pantalla del personal (la ficha del miembro) pide 3
 *   capturas; el agente devuelve la plantilla fusionada y ES LA PANTALLA la que
 *   la sube con la sesion de quien registra. Mientras se enrola, la puerta no
 *   identifica.
 */

const MS_ENTRE_LECTURAS = 150;
const CAPTURAS_ENROLAMIENTO = 3;
const MS_REINTENTO_LECTOR = 5000;

const log = (...partes) => console.log(new Date().toLocaleTimeString('es-CO'), ...partes);

// --- Estado ------------------------------------------------------------------

const lector = new Lector();
const estado = {
  lector: false,
  servidor: false,
  vinculado: Boolean(config.token), // hay token (aunque aun no se haya validado)
  tokenRechazado: false, // el servidor dijo 401: puesto desactivado o token viejo
  puesto: null, // { nombre, sedeNombre } si hay token valido
  pausado: false, // el personal apago el lector desde la ventana (no identifica a nadie)
  huellas: 0,
  ultimaSincronizacion: null,
};
/** fid del SDK -> id del miembro. El fid es local: se reasigna en cada sincronizacion. */
let miembroPorFid = new Map();
let enrolamiento = null; // { cliente, capturas: Buffer[] }
let esperandoRetiro = false; // no repetir mientras el dedo siga puesto
let ocupado = false;
/** Entradas de HOY por esta puerta, tal como las devuelve el servidor (para la ventana). */
let entradas = { accesos: [], resumen: { total: 0, permitidos: 0, negados: 0 } };

// --- Servidor GymBarichara ---------------------------------------------------

async function llamarApi(metodo, ruta, cuerpo, token = config.token) {
  const respuesta = await fetch(`${config.servidorApi}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const json = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !json?.ok) {
    const error = new Error(json?.error?.mensaje ?? `HTTP ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return json.data;
}

async function sincronizar() {
  // Sin vincular no hay huellas que bajar, pero la pantalla igual debe saber si
  // el servidor esta arriba (para dejar vincular el equipo).
  if (!config.token) {
    try {
      const respuesta = await fetch(`${config.servidorApi}/salud`, { signal: AbortSignal.timeout(8000) });
      estado.servidor = respuesta.ok;
    } catch {
      estado.servidor = false;
    }
    return difundir({ tipo: 'estado', ...estado });
  }
  try {
    const [puesto, huellas] = await Promise.all([llamarApi('GET', '/acceso/puesto'), llamarApi('GET', '/acceso/huellas')]);
    estado.puesto = { nombre: puesto.nombre, sedeNombre: puesto.sedeNombre };
    estado.servidor = true;
    estado.tokenRechazado = false;

    if (lector.abierto) {
      const mapa = new Map();
      const cargables = huellas.map((huella, indice) => {
        const fid = indice + 1;
        mapa.set(fid, huella.miembro);
        return { fid, plantilla: Buffer.from(huella.plantilla, 'base64') };
      });
      estado.huellas = lector.cargar(cargables);
      miembroPorFid = mapa;
    }
    estado.ultimaSincronizacion = new Date().toISOString();
    actualizarEntradas();
  } catch (error) {
    // Un 401 SI es respuesta del servidor: esta arriba, pero no reconoce el puesto.
    estado.servidor = error.estado === 401;
    if (error.estado === 401) {
      estado.puesto = null;
      estado.tokenRechazado = true;
    }
    log('No se pudo sincronizar:', error.message);
  }
  difundir({ tipo: 'estado', ...estado });
}

/** Pide al servidor quien paso hoy por esta puerta y se lo manda a las ventanas. */
async function actualizarEntradas() {
  if (!config.token) return;
  try {
    entradas = await llamarApi('GET', '/acceso/entradas');
    difundir({ tipo: 'entradas', ...entradas });
  } catch (error) {
    log('No se pudieron leer las entradas:', error.message);
  }
}

/**
 * Sincroniza en bucle: cada `SEGUNDOS_SINCRONIZACION` si todo va bien, y cada
 * pocos segundos mientras el servidor no responda (p. ej. si el PC arranco antes
 * que el backend), para que la puerta quede operativa en cuanto el servidor suba.
 */
const MS_REINTENTO_SERVIDOR = 10_000;
async function bucleSincronizacion() {
  await sincronizar();
  const demora = estado.servidor ? config.segundosSincronizacion * 1000 : MS_REINTENTO_SERVIDOR;
  setTimeout(bucleSincronizacion, demora);
}

// --- Pantallas (WebSocket local) ---------------------------------------------

const servidorWs = new WebSocketServer({
  host: '127.0.0.1',
  port: config.puerto,
  // Solo las paginas de GymBarichara: cualquier otra web abierta en el PC podria
  // intentar conectarse a localhost.
  verifyClient: ({ origin }) => config.origenes.includes(origin),
});

function enviar(cliente, mensaje) {
  if (cliente.readyState === cliente.OPEN) cliente.send(JSON.stringify(mensaje));
}

function difundir(mensaje) {
  for (const cliente of servidorWs.clients) enviar(cliente, mensaje);
}

servidorWs.on('connection', (cliente) => {
  enviar(cliente, { tipo: 'estado', ...estado });
  enviar(cliente, { tipo: 'entradas', ...entradas });

  cliente.on('message', (datos) => {
    let mensaje;
    try {
      mensaje = JSON.parse(String(datos));
    } catch {
      return;
    }

    if (mensaje.tipo === 'enrolar') {
      if (!lector.abierto) return enviar(cliente, { tipo: 'error', mensaje: 'El lector de huella no esta conectado' });
      enrolamiento = { cliente, capturas: [] };
      esperandoRetiro = true;
      enviar(cliente, { tipo: 'enrolamiento', paso: 1, total: CAPTURAS_ENROLAMIENTO });
    } else if (mensaje.tipo === 'cancelar' && enrolamiento?.cliente === cliente) {
      enrolamiento = null;
    } else if (mensaje.tipo === 'sincronizar') {
      sincronizar();
    } else if (mensaje.tipo === 'vincular') {
      vincular(cliente, mensaje.token);
    } else if (mensaje.tipo === 'pausar' || mensaje.tipo === 'reanudar') {
      estado.pausado = mensaje.tipo === 'pausar';
      log(estado.pausado ? 'Lector APAGADO desde la ventana' : 'Lector ENCENDIDO desde la ventana');
      if (!estado.pausado) lector.senal('blanca', { ms: 600, pitidos: 1 });
      difundir({ tipo: 'estado', ...estado });
    } else if (mensaje.tipo === 'reconectar') {
      reconectarLector();
    }
  });

  cliente.on('close', () => {
    if (enrolamiento?.cliente === cliente) enrolamiento = null;
  });
});

/**
 * Vincula ESTE PC a un puesto: la pantalla /acceso (con la sesion del dueño)
 * crea el puesto y manda aqui su token. Antes de guardarlo se prueba contra el
 * servidor, para no quedarse con un token que no sirve.
 */
async function vincular(cliente, token) {
  if (typeof token !== 'string' || token.split('.').length !== 3) {
    return enviar(cliente, { tipo: 'vinculacion_error', mensaje: 'El token no es valido' });
  }
  try {
    const puesto = await llamarApi('GET', '/acceso/puesto', null, token.trim());
    guardarToken(token.trim());
    estado.vinculado = true;
    log(`Equipo vinculado: ${puesto.nombre} (${puesto.sedeNombre})`);
    await sincronizar();
    enviar(cliente, { tipo: 'vinculado', puesto: { nombre: puesto.nombre, sedeNombre: puesto.sedeNombre } });
  } catch (error) {
    log('No se pudo vincular:', error.message);
    enviar(cliente, { tipo: 'vinculacion_error', mensaje: `No se pudo vincular: ${error.message}` });
  }
}

servidorWs.on('listening', () => log(`Pantallas: ws://127.0.0.1:${config.puerto}`));
servidorWs.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    log(`El puerto ${config.puerto} ya esta en uso: probablemente hay OTRO agente abierto. Cierralo primero.`);
  } else {
    log('Error del servidor local:', error.message);
  }
  lector.cerrar();
  process.exit(1);
});

// --- Lector ------------------------------------------------------------------

function procesarEnrolamiento(plantilla) {
  const { cliente, capturas } = enrolamiento;

  // Antes de nada: ¿ya es la huella de alguien? Registrarla dos veces haria que
  // la puerta reconozca a uno por otro.
  if (capturas.length === 0) {
    const repetida = lector.identificar(plantilla);
    if (repetida) {
      enrolamiento = null;
      return enviar(cliente, { tipo: 'enrolamiento_duplicada', miembro: miembroPorFid.get(repetida.fid) ?? null });
    }
  }

  if (capturas.length > 0 && lector.comparar(capturas.at(-1), plantilla) <= 0) {
    lector.senal('roja', { ms: 600, pitidos: 2 });
    return enviar(cliente, { tipo: 'enrolamiento_repetir', paso: capturas.length + 1, total: CAPTURAS_ENROLAMIENTO });
  }

  capturas.push(plantilla);
  lector.senal('verde', { ms: 400, pitidos: 1 });
  if (capturas.length < CAPTURAS_ENROLAMIENTO) {
    return enviar(cliente, { tipo: 'enrolamiento', paso: capturas.length + 1, total: CAPTURAS_ENROLAMIENTO });
  }

  enrolamiento = null;
  try {
    enviar(cliente, { tipo: 'enrolamiento_listo', plantilla: lector.fusionar(capturas).toString('base64') });
  } catch (error) {
    enviar(cliente, { tipo: 'error', mensaje: error.message });
  }
}

async function procesarAcceso(plantilla) {
  if (!config.token || !estado.puesto) {
    lector.senal('roja', { ms: 1500, pitidos: 3 });
    return difundir({ tipo: 'sin_puesto' });
  }

  const encontrada = lector.identificar(plantilla);
  const miembro = encontrada ? miembroPorFid.get(encontrada.fid) : null;
  if (!miembro) {
    log('Huella no reconocida');
    lector.senal('roja', { ms: 900, pitidos: 2 });
    return difundir({ tipo: 'no_reconocida' });
  }

  try {
    const resultado = await llamarApi('POST', '/acceso/verificar', { miembro, metodo: 'huella' });
    estado.servidor = true;
    log(`${resultado.permitido ? 'PERMITIDO' : 'NEGADO'} ${resultado.miembro?.nombreCompleto ?? miembro} (${resultado.motivo})`);
    difundir({ tipo: 'acceso', resultado });
    actualizarEntradas();
    // La respuesta en el propio lector: es lo unico que ve quien entra si no hay
    // pantalla. Verde + 1 pitido = adelante; roja + 3 pitidos = no puede entrar.
    if (resultado.permitido) lector.senal('verde', { ms: 1500, pitidos: 1 });
    else lector.senal('roja', { ms: 2000, pitidos: 3 });
    // Etapa chapa: aqui se accionara el rele, SOLO si resultado.permitido.
  } catch (error) {
    estado.servidor = false;
    log('No se pudo verificar:', error.message);
    lector.senal('roja', { ms: 2000, pitidos: 4 });
    difundir({ tipo: 'error', mensaje: 'Sin conexion con el servidor. Intenta de nuevo o acercate a recepcion' });
  }
}

async function leer() {
  if (ocupado || !lector.abierto) return;
  // Apagado desde la ventana: no identifica (pero si deja registrar huellas).
  if (estado.pausado && !enrolamiento) return;
  const plantilla = lector.capturar();

  // Un dedo que se queda puesto devuelve capturas seguidas: se atiende una vez y
  // se espera a que lo retire.
  if (!plantilla) {
    esperandoRetiro = false;
    return;
  }
  if (esperandoRetiro) return;
  esperandoRetiro = true;

  ocupado = true;
  try {
    if (enrolamiento) procesarEnrolamiento(plantilla);
    else await procesarAcceso(plantilla);
  } finally {
    ocupado = false;
  }
}

let reintentoLector = null;
function abrirLector() {
  // "Reconectar" puede llegar mientras hay un reintento programado: uno solo a la vez.
  clearTimeout(reintentoLector);
  try {
    lector.abrir();
    estado.lector = true;
    log('Lector de huella listo');
    lector.senal('blanca', { ms: 600, pitidos: 1 });
    // Si el lector se conecto despues del arranque, carga ya las huellas en su memoria.
    if (estado.servidor) sincronizar();
  } catch (error) {
    estado.lector = false;
    log(`${error.message}. Reintento en ${MS_REINTENTO_LECTOR / 1000} s`);
    reintentoLector = setTimeout(abrirLector, MS_REINTENTO_LECTOR);
  }
  difundir({ tipo: 'estado', ...estado });
}

/** "Reconectar" de la ventana: cierra el lector y lo vuelve a abrir desde cero. */
function reconectarLector() {
  log('Reconectando el lector');
  try {
    lector.cerrar();
  } catch {
    // Si ya estaba caido, cerrar puede fallar: da igual, se abre de nuevo.
  }
  estado.lector = false;
  difundir({ tipo: 'estado', ...estado });
  abrirLector();
  sincronizar();
}

// --- Arranque ----------------------------------------------------------------

log(`Servidor: ${config.servidorApi} · datos en ${carpetaDatos}`);
if (!config.token) log('Equipo sin vincular: abre /acceso en este PC para vincularlo a una puerta');

abrirLector();
setInterval(leer, MS_ENTRE_LECTURAS);
bucleSincronizacion();

function apagar() {
  log('Cerrando agente');
  lector.cerrar();
  process.exit(0);
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
