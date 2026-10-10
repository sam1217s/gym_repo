import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Configuracion del agente. Dos fuentes:
 *
 * - El ENTORNO (`.env` en desarrollo): servidor, puerto, origenes. Los valores por
 *   defecto son los de PRODUCCION, para que el agente instalado funcione sin `.env`.
 * - El ARCHIVO `config.json` en la carpeta de datos: lo que se guarda al VINCULAR el
 *   equipo desde la pantalla /acceso (el token del puesto). Su token gana sobre el
 *   entorno, porque es lo ultimo que decidio el dueño para ESTE PC. Tambien admite
 *   `servidorApi` y `origenes`, para apuntar un equipo instalado a otro servidor
 *   (pruebas) sin reinstalar.
 *
 * La carpeta de datos va en ProgramData (no junto al programa): Program Files no
 * se puede escribir, y asi el token sobrevive a reinstalar o actualizar.
 */

export const carpetaDatos =
  process.env.CARPETA_DATOS ?? join(process.env.ProgramData ?? 'C:\\ProgramData', 'GymBarichara', 'Puerta');
const archivo = join(carpetaDatos, 'config.json');

function leerArchivo() {
  try {
    // Sin BOM: PowerShell 5 lo antepone al escribir UTF-8 y JSON.parse no lo acepta.
    return JSON.parse(readFileSync(archivo, 'utf8').replace(/^﻿/, ''));
  } catch {
    return {};
  }
}

const guardado = leerArchivo();
const lista = (texto) =>
  texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);

export const config = {
  servidorApi: (process.env.SERVIDOR_API ?? guardado.servidorApi ?? 'https://gymbarichara.com/api').replace(/\/$/, ''),
  token: (guardado.token ?? process.env.TOKEN_PUESTO ?? '').trim(),
  puerto: Number(process.env.PUERTO_LOCAL ?? 7788),
  origenes: lista(process.env.ORIGENES_PERMITIDOS ?? guardado.origenes ?? 'https://gymbarichara.com,https://www.gymbarichara.com'),
  segundosSincronizacion: Number(process.env.SEGUNDOS_SINCRONIZACION ?? 60),
};

/** Guarda el token del puesto (escritura atomica: nunca queda un archivo a medias). */
export function guardarToken(token) {
  mkdirSync(carpetaDatos, { recursive: true });
  const temporal = `${archivo}.tmp`;
  writeFileSync(temporal, JSON.stringify({ ...leerArchivo(), token, vinculadoEn: new Date().toISOString() }, null, 2));
  renameSync(temporal, archivo);
  config.token = token;
}
