#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * graphify: grafo de dependencias en vivo del monorepo.
 *
 * Sin dependencias externas: solo `fs` y `path`. Se usa desde los hooks de
 * Claude Code y a mano:
 *
 *   node graph.js mapa        todos los archivos y sus dependencias directas
 *   node graph.js cerebro     vista arquitectural: capas, hubs y modulos
 *   node graph.js detective   estadisticas, ciclos y violaciones de capa
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------

const RAICES = [
  { ruta: path.join(__dirname, '..', 'backend', 'src'), prefijo: 'BE' },
  { ruta: path.join(__dirname, '..', 'frontend', 'src'), prefijo: 'FE' },
];

const EXTENSIONES = ['.js', '.vue', '.ts', '.tsx'];
const DIRECTORIOS_IGNORADOS = new Set(['node_modules', 'dist', '.quasar', '.git']);

/** Capas del backend, en el orden en que deben fluir las dependencias. */
const CAPAS_BACKEND = ['rutas', 'controladores', 'servicios', 'modelos', 'middlewares'];

/** Capas del frontend, segun la estructura oficial de Quasar. */
const CAPAS_FRONTEND = ['pages', 'layouts', 'components', 'composables', 'stores', 'servicios'];

/**
 * Capas usadas para detectar dependencias contra el flujo. `middlewares` queda
 * fuera a proposito: es transversal, y que un middleware importe un modelo o un
 * servicio es correcto, no una violacion.
 */
const ORDEN_ESTRICTO = {
  BE: ['rutas', 'controladores', 'servicios', 'modelos'],
  FE: CAPAS_FRONTEND,
};

/** Modulos de dominio de GymSaaS, detectados por palabras clave en la ruta. */
const CLAVES_DOMINIO = [
  'tenant',
  'plataforma',
  'sede',
  'usuario',
  'auth',
  'miembro',
  'plan',
  'membresia',
  'pago',
  'factura',
  'notificacion',
  'whatsapp',
  'reporte',
  'dashboard',
];

const TOPE_HUBS = 12;
const TOPE_RANKING = 10;
const ANCHO_BARRA = 24;

// ---------------------------------------------------------------------------
// Colores ANSI
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  negrita: '\x1b[1m',
  tenue: '\x1b[2m',
  rojo: '\x1b[31m',
  verde: '\x1b[32m',
  amarillo: '\x1b[33m',
  azul: '\x1b[34m',
  magenta: '\x1b[35m',
  cian: '\x1b[36m',
};

const pintar = (color, texto) => `${color}${texto}${c.reset}`;

// ---------------------------------------------------------------------------
// 1. Recoleccion de archivos
// ---------------------------------------------------------------------------

/** Recorre las raices y devuelve un mapa `id -> { rutaAbsoluta, prefijo, relativa }`. */
export function collectFiles(raices = RAICES) {
  const archivos = new Map();

  for (const { ruta, prefijo } of raices) {
    if (!fs.existsSync(ruta)) continue;
    recorrer(ruta, ruta, prefijo, archivos);
  }

  return archivos;
}

function recorrer(directorio, raiz, prefijo, archivos) {
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    if (DIRECTORIOS_IGNORADOS.has(entrada.name)) continue;

    const rutaCompleta = path.join(directorio, entrada.name);

    if (entrada.isDirectory()) {
      recorrer(rutaCompleta, raiz, prefijo, archivos);
      continue;
    }

    if (!EXTENSIONES.includes(path.extname(entrada.name))) continue;

    const relativa = path.relative(raiz, rutaCompleta).split(path.sep).join('/');
    archivos.set(`${prefijo}:${relativa}`, { rutaAbsoluta: rutaCompleta, prefijo, relativa });
  }
}

// ---------------------------------------------------------------------------
// 2. Extraccion de imports
// ---------------------------------------------------------------------------

const PATRONES_IMPORT = [
  /import\s+[\s\S]*?from\s*['"]([^'"]+)['"]/g, // import x from '...'
  /import\s*['"]([^'"]+)['"]/g, //               import '...'
  /export\s+[\s\S]*?from\s*['"]([^'"]+)['"]/g, // export * from '...'
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, //     import('...')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, //    require('...')
];

/**
 * Devuelve los especificadores relativos que importa un archivo.
 * Los paquetes npm se ignoran: aqui solo interesa el codigo propio.
 */
/**
 * Alias del frontend, definidos por Quasar y por `jsconfig.json`. Sin esto el
 * grafo del frontend saldria casi vacio, porque alli practicamente nadie importa
 * con rutas relativas. La clave es el prefijo del import; el valor, la ruta
 * equivalente dentro de `frontend/src`.
 */
const ALIAS_FRONTEND = {
  'src/': '',
  'boot/': 'boot/',
  'components/': 'components/',
  'composables/': 'composables/',
  'layouts/': 'layouts/',
  'pages/': 'pages/',
  'stores/': 'stores/',
  'assets/': 'assets/',
};

export function extractImports(rutaArchivo) {
  let contenido = fs.readFileSync(rutaArchivo, 'utf8');

  // En un `.vue` los imports viven en el bloque <script>.
  if (path.extname(rutaArchivo) === '.vue') {
    const bloques = [...contenido.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
    contenido = bloques.map((bloque) => bloque[1]).join('\n');
  }

  const especificadores = new Set();

  for (const patron of PATRONES_IMPORT) {
    for (const coincidencia of contenido.matchAll(patron)) {
      const especificador = coincidencia[1];
      if (esInterno(especificador)) especificadores.add(especificador);
    }
  }

  return [...especificadores];
}

const esRelativo = (especificador) => especificador.startsWith('./') || especificador.startsWith('../');

const aliasDe = (especificador) =>
  Object.keys(ALIAS_FRONTEND).find((prefijo) => especificador.startsWith(prefijo)) ?? null;

/** Interno = codigo propio. Los paquetes npm y `#q-app/*` quedan fuera. */
function esInterno(especificador) {
  return esRelativo(especificador) || aliasDe(especificador) !== null;
}

/**
 * Resuelve un especificador a un id del grafo, probando las extensiones y el
 * `index`/`indice` implicito, igual que hace Node.
 */
function resolverId(idOrigen, especificador, archivos) {
  const { prefijo, relativa } = archivos.get(idOrigen);
  const alias = aliasDe(especificador);

  // Los alias son absolutos desde `src/`; los relativos, desde la carpeta actual.
  const base =
    alias && prefijo === 'FE'
      ? ALIAS_FRONTEND[alias] + especificador.slice(alias.length)
      : path.posix.join(path.posix.dirname(relativa), especificador);

  const candidatos = [
    base,
    ...EXTENSIONES.map((extension) => `${base}${extension}`),
    ...EXTENSIONES.map((extension) => `${base}/index${extension}`),
    ...EXTENSIONES.map((extension) => `${base}/indice${extension}`),
  ];

  for (const candidato of candidatos) {
    const id = `${prefijo}:${path.posix.normalize(candidato)}`;
    if (archivos.has(id)) return id;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 3. Construccion del grafo
// ---------------------------------------------------------------------------

/** Grafo directo (quien importa a quien) y reverso (quien es importado por quien). */
export function buildGraph(archivos) {
  const directo = new Map();
  const reverso = new Map();

  for (const id of archivos.keys()) {
    directo.set(id, []);
    reverso.set(id, []);
  }

  for (const [id, { rutaAbsoluta }] of archivos) {
    for (const especificador of extractImports(rutaAbsoluta)) {
      const destino = resolverId(id, especificador, archivos);
      if (!destino || destino === id) continue;

      directo.get(id).push(destino);
      reverso.get(destino).push(id);
    }
  }

  return { directo, reverso };
}

// ---------------------------------------------------------------------------
// Utilidades de clasificacion
// ---------------------------------------------------------------------------

const idSinPrefijo = (id) => id.slice(id.indexOf(':') + 1);
const ladoDe = (id) => id.slice(0, id.indexOf(':'));

/** Primer segmento de la ruta: la carpeta que actua como capa. */
function capaDe(id) {
  const relativa = idSinPrefijo(id);
  const segmentos = relativa.split('/');
  return segmentos.length > 1 ? segmentos[0] : '(raiz)';
}

function dominiosDe(id) {
  const relativa = idSinPrefijo(id).toLowerCase();
  return CLAVES_DOMINIO.filter((clave) => relativa.includes(clave));
}

function agrupar(ids, obtenerClave) {
  const grupos = new Map();
  for (const id of ids) {
    const clave = obtenerClave(id);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(id);
  }
  return grupos;
}

function barra(valor, maximo) {
  const largo = maximo === 0 ? 0 : Math.round((valor / maximo) * ANCHO_BARRA);
  return '█'.repeat(largo) + pintar(c.tenue, '·'.repeat(ANCHO_BARRA - largo));
}

// ---------------------------------------------------------------------------
// Modo: mapa
// ---------------------------------------------------------------------------

function modoMapa(archivos, { directo }) {
  console.log(pintar(c.negrita + c.cian, '\n=== MAPA DE DEPENDENCIAS ===\n'));

  for (const [lado, etiqueta] of [
    ['BE', 'BACKEND'],
    ['FE', 'FRONTEND'],
  ]) {
    const ids = [...archivos.keys()].filter((id) => ladoDe(id) === lado).sort();
    if (ids.length === 0) continue;

    console.log(pintar(c.negrita + c.magenta, `\n${etiqueta} (${ids.length} archivos)`));

    for (const [capa, idsCapa] of [...agrupar(ids, capaDe)].sort()) {
      console.log(pintar(c.amarillo, `\n  ${capa}/`));

      for (const id of idsCapa.sort()) {
        const dependencias = directo.get(id);
        console.log(`    ${pintar(c.verde, idSinPrefijo(id))}`);

        if (dependencias.length === 0) {
          console.log(pintar(c.tenue, '      (sin dependencias internas)'));
          continue;
        }
        for (const dependencia of dependencias.sort()) {
          console.log(pintar(c.tenue, `      -> ${dependencia}`));
        }
      }
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Modo: cerebro
// ---------------------------------------------------------------------------

function modoCerebro(archivos, { directo, reverso }) {
  console.log(pintar(c.negrita + c.cian, '\n=== CEREBRO ARQUITECTURAL ==='));

  imprimirFlujoCapas('BACKEND  (rutas -> controladores -> servicios -> modelos)', 'BE', CAPAS_BACKEND, archivos, directo, reverso);
  imprimirFlujoCapas('FRONTEND (pages -> layouts -> components -> composables -> stores -> servicios)', 'FE', CAPAS_FRONTEND, archivos, directo, reverso);

  imprimirHubs(archivos, reverso);
  imprimirDominios(archivos);

  console.log('');
}

function imprimirFlujoCapas(titulo, lado, capasOrdenadas, archivos, directo, reverso) {
  const ids = [...archivos.keys()].filter((id) => ladoDe(id) === lado);
  if (ids.length === 0) return;

  console.log(pintar(c.negrita + c.magenta, `\n${titulo}`));

  const porCapa = agrupar(ids, capaDe);
  const conocidas = capasOrdenadas.filter((capa) => porCapa.has(capa));
  const otras = [...porCapa.keys()].filter((capa) => !capasOrdenadas.includes(capa)).sort();

  for (const capa of [...conocidas, ...otras]) {
    const idsCapa = porCapa.get(capa);
    const salientes = idsCapa.reduce((total, id) => total + directo.get(id).length, 0);
    const entrantes = idsCapa.reduce((total, id) => total + reverso.get(id).length, 0);
    const esConocida = capasOrdenadas.includes(capa);

    const nombre = (capa + '/').padEnd(16);
    console.log(
      `  ${pintar(esConocida ? c.verde : c.tenue, nombre)}` +
        `${String(idsCapa.length).padStart(3)} archivos   ` +
        pintar(c.tenue, `deps out: ${String(salientes).padStart(3)}   in: ${String(entrantes).padStart(3)}`),
    );
  }
}

function imprimirHubs(archivos, reverso) {
  const ranking = [...archivos.keys()]
    .map((id) => ({ id, entradas: reverso.get(id).length }))
    .filter((entrada) => entrada.entradas > 0)
    .sort((a, b) => b.entradas - a.entradas)
    .slice(0, TOPE_HUBS);

  if (ranking.length === 0) return;

  console.log(pintar(c.negrita + c.magenta, `\nHUBS (los mas importados)`));
  const maximo = ranking[0].entradas;

  for (const { id, entradas } of ranking) {
    console.log(`  ${barra(entradas, maximo)} ${String(entradas).padStart(2)}  ${pintar(c.verde, id)}`);
  }
}

function imprimirDominios(archivos) {
  console.log(pintar(c.negrita + c.magenta, '\nMODULOS DE DOMINIO'));

  const porDominio = new Map();
  const sinDominio = [];

  for (const id of archivos.keys()) {
    const dominios = dominiosDe(id);
    if (dominios.length === 0) {
      sinDominio.push(id);
      continue;
    }
    for (const dominio of dominios) {
      if (!porDominio.has(dominio)) porDominio.set(dominio, []);
      porDominio.get(dominio).push(id);
    }
  }

  const ordenados = [...porDominio.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [dominio, ids] of ordenados) {
    const backend = ids.filter((id) => ladoDe(id) === 'BE').length;
    const frontend = ids.length - backend;
    console.log(
      `  ${pintar(c.amarillo, dominio.padEnd(14))}${String(ids.length).padStart(3)} archivos  ` +
        pintar(c.tenue, `(BE ${backend} / FE ${frontend})`),
    );
  }

  if (sinDominio.length > 0) {
    console.log(pintar(c.tenue, `  ${'(transversal)'.padEnd(14)}${String(sinDominio.length).padStart(3)} archivos`));
  }
}

// ---------------------------------------------------------------------------
// Modo: detective
// ---------------------------------------------------------------------------

function modoDetective(archivos, { directo, reverso }) {
  console.log(pintar(c.negrita + c.cian, '\n=== DETECTIVE ===\n'));

  const ids = [...archivos.keys()];
  const totalAristas = ids.reduce((total, id) => total + directo.get(id).length, 0);

  console.log(pintar(c.negrita, 'ESTADISTICAS'));
  console.log(`  Archivos:        ${ids.length}`);
  console.log(`  Dependencias:    ${totalAristas}`);
  console.log(`  Media por archivo: ${(totalAristas / (ids.length || 1)).toFixed(2)}`);

  imprimirRanking('TOP IMPORTADORES (dependen de mas cosas)', ids, (id) => directo.get(id).length);
  imprimirRanking('TOP IMPORTADOS (mas dependen de ellos)', ids, (id) => reverso.get(id).length);

  const huerfanos = ids.filter((id) => directo.get(id).length === 0 && reverso.get(id).length === 0);
  const entradas = ids.filter((id) => reverso.get(id).length === 0 && directo.get(id).length > 0);
  const hojas = ids.filter((id) => directo.get(id).length === 0 && reverso.get(id).length > 0);

  imprimirLista('HUERFANOS (nadie los importa y no importan nada)', huerfanos, c.rojo);
  imprimirLista('PUNTOS DE ENTRADA (nadie los importa)', entradas, c.cian);
  imprimirLista('HOJAS (no importan nada propio)', hojas, c.tenue);

  imprimirCiclos(ids, directo);
  imprimirCrossLayer(ids, directo);

  console.log('');
}

function imprimirRanking(titulo, ids, medir) {
  const ranking = ids
    .map((id) => ({ id, valor: medir(id) }))
    .filter((entrada) => entrada.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, TOPE_RANKING);

  console.log(pintar(c.negrita, `\n${titulo}`));
  if (ranking.length === 0) return console.log(pintar(c.tenue, '  (ninguno)'));

  for (const { id, valor } of ranking) {
    console.log(`  ${String(valor).padStart(3)}  ${id}`);
  }
}

function imprimirLista(titulo, ids, color) {
  console.log(pintar(c.negrita, `\n${titulo}`) + pintar(c.tenue, ` [${ids.length}]`));
  if (ids.length === 0) return console.log(pintar(c.tenue, '  (ninguno)'));

  for (const id of ids.sort()) console.log(`  ${pintar(color, id)}`);
}

/** Busca ciclos de dependencia con una DFS que recuerda el camino recorrido. */
function imprimirCiclos(ids, directo) {
  const ciclos = [];
  const estado = new Map(); // 0 = sin visitar, 1 = en el camino actual, 2 = cerrado

  function visitar(id, camino) {
    estado.set(id, 1);
    camino.push(id);

    for (const vecino of directo.get(id)) {
      if (estado.get(vecino) === 1) {
        ciclos.push([...camino.slice(camino.indexOf(vecino)), vecino]);
      } else if (!estado.has(vecino) || estado.get(vecino) === 0) {
        visitar(vecino, camino);
      }
    }

    camino.pop();
    estado.set(id, 2);
  }

  for (const id of ids) {
    if (!estado.has(id)) visitar(id, []);
  }

  console.log(pintar(c.negrita, '\nCICLOS DE DEPENDENCIA') + pintar(c.tenue, ` [${ciclos.length}]`));
  if (ciclos.length === 0) return console.log(pintar(c.verde, '  Ninguno.'));

  for (const ciclo of ciclos) console.log(`  ${pintar(c.rojo, ciclo.join(' -> '))}`);
}

/**
 * Dependencias que van en contra del flujo de capas: por ejemplo un modelo que
 * importa un controlador. Cada capa solo deberia depender de las que van despues.
 */
function imprimirCrossLayer(ids, directo) {
  const violaciones = [];

  for (const id of ids) {
    const lado = ladoDe(id);
    const orden = ORDEN_ESTRICTO[lado] ?? [];

    const capaOrigen = orden.indexOf(capaDe(id));
    if (capaOrigen === -1) continue;

    for (const destino of directo.get(id)) {
      if (ladoDe(destino) !== lado) continue;

      const capaDestino = orden.indexOf(capaDe(destino));
      if (capaDestino === -1) continue;

      if (capaDestino < capaOrigen) violaciones.push(`${id} -> ${destino}`);
    }
  }

  console.log(pintar(c.negrita, '\nDEPENDENCIAS CONTRA EL FLUJO DE CAPAS') + pintar(c.tenue, ` [${violaciones.length}]`));
  if (violaciones.length === 0) return console.log(pintar(c.verde, '  Ninguna.'));

  for (const violacion of violaciones) console.log(`  ${pintar(c.rojo, violacion)}`);
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

const MODOS = { mapa: modoMapa, cerebro: modoCerebro, detective: modoDetective };

function principal() {
  const modo = process.argv[2] ?? 'cerebro';
  const ejecutar = MODOS[modo];

  if (!ejecutar) {
    console.error(`Modo desconocido: "${modo}". Usa: ${Object.keys(MODOS).join(' | ')}`);
    process.exit(1);
  }

  const archivos = collectFiles();
  ejecutar(archivos, buildGraph(archivos));
}

principal();
