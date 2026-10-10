import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { ejecutarConTenant } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { exigirSede } from './sedes.servicio.js';

/**
 * Puestos de entrada (el PC de la puerta de cada sede). Los administra el dueño.
 *
 * El puesto se autentica con `<tenantId>.<puestoId>.<secreto>`. El tenant viaja
 * en el token para poder abrir el contexto con `ejecutarConTenant` y buscar el
 * puesto CON el filtro del plugin, sin pasar por `ejecutarSinTenant`. Lo que
 * autentica es el secreto: se compara su SHA-256 en tiempo constante. Parsear el
 * token (dato no confiable) solo dice donde buscar.
 */

const BYTES_SECRETO = 32;
const PATRON_ID = /^[a-f\d]{24}$/i;

const hashSecreto = (secreto) => createHash('sha256').update(secreto).digest('hex');

function emitirToken(tenantId, puestoId) {
  const secreto = randomBytes(BYTES_SECRETO).toString('base64url');
  return { token: `${tenantId}.${puestoId}.${secreto}`, tokenHash: hashSecreto(secreto) };
}

export function listarPuestos() {
  const PuestoAcceso = obtenerModelo('PuestoAcceso');
  return PuestoAcceso.find().sort({ createdAt: 1 }).populate('sede', 'nombre');
}

/** Crea el puesto y devuelve su token. Es la UNICA vez que se ve completo. */
export async function crearPuesto({ nombre, sede }, tenantId) {
  await exigirSede(sede);
  const PuestoAcceso = obtenerModelo('PuestoAcceso');

  const puesto = new PuestoAcceso({ nombre, sede });
  const { token, tokenHash } = emitirToken(tenantId, puesto._id);
  puesto.tokenHash = tokenHash;
  await puesto.save();

  return { puesto: limpiar(puesto), token };
}

/** Token nuevo (el anterior deja de servir al instante). Reactiva el puesto. */
export async function regenerarToken(puestoId, tenantId) {
  const PuestoAcceso = obtenerModelo('PuestoAcceso');
  const puesto = await PuestoAcceso.findById(puestoId);
  if (!puesto) throw ErrorApi.noEncontrado('El puesto no existe');

  const { token, tokenHash } = emitirToken(tenantId, puesto._id);
  puesto.tokenHash = tokenHash;
  puesto.activo = true;
  await puesto.save();

  return { puesto: limpiar(puesto), token };
}

/** Desactiva el puesto: su token deja de servir. No se borra (el historial lo referencia). */
export async function desactivarPuesto(puestoId) {
  const PuestoAcceso = obtenerModelo('PuestoAcceso');
  const puesto = await PuestoAcceso.findByIdAndUpdate(puestoId, { activo: false }, { new: true });
  if (!puesto) throw ErrorApi.noEncontrado('El puesto no existe');
  return puesto;
}

function limpiar(puesto) {
  const objeto = puesto.toObject();
  delete objeto.tokenHash;
  return objeto;
}

/**
 * Resuelve el token de un puesto a `{ puesto, tenantId }`, o lanza 401. Corre
 * FUERA de toda peticion autenticada (lo llama el middleware del puesto), por eso
 * abre el contexto el mismo.
 */
export async function autenticarTokenPuesto(token) {
  const noValido = () => ErrorApi.noAutenticado('Token de puesto invalido');

  const [tenantId, puestoId, secreto] = String(token ?? '').split('.');
  if (!PATRON_ID.test(tenantId ?? '') || !PATRON_ID.test(puestoId ?? '') || !secreto) throw noValido();

  const Tenant = obtenerModelo('Tenant');
  if (!(await Tenant.exists({ _id: tenantId }))) throw noValido();

  const puesto = await ejecutarConTenant(tenantId, () =>
    obtenerModelo('PuestoAcceso').findById(puestoId).select('+tokenHash'),
  );
  if (!puesto || !puesto.activo) throw noValido();

  const esperado = Buffer.from(puesto.tokenHash, 'hex');
  const recibido = Buffer.from(hashSecreto(secreto), 'hex');
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) throw noValido();

  // Para que el dueño vea si el PC de la puerta sigue conectado. Best-effort.
  ejecutarConTenant(tenantId, () =>
    obtenerModelo('PuestoAcceso').updateOne({ _id: puestoId }, { ultimaConexion: new Date() }),
  ).catch(() => {});

  return { puesto: limpiar(puesto), tenantId };
}
