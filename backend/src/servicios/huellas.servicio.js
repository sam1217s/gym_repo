import { BYTES_MAX_PLANTILLA_HUELLA, MAX_HUELLAS_POR_MIEMBRO } from '../config/constantes.js';
import { obtenerModelo } from '../modelos/indice.js';
import { cifrarPlantilla, descifrarPlantilla } from '../utilidades/cifradoBiometrico.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Huellas de los miembros: registro desde la ficha (personal del gimnasio) y
 * sincronizacion hacia los puestos de la puerta.
 *
 * El registro respeta `filtroSede` igual que el resto de la ficha (un sede_admin
 * solo enrola a miembros de SU sede). La sincronizacion NO: la huella sirve en
 * cualquier sede del gimnasio, asi que cada puesto baja las de todos.
 */

/** El miembro de la ficha, dentro del alcance de quien opera. 404 si no le toca. */
async function exigirMiembro(miembroId, filtroSede) {
  const Miembro = obtenerModelo('Miembro');
  const miembro = await Miembro.findOne({ _id: miembroId, ...filtroSede });
  if (!miembro) throw ErrorApi.noEncontrado('El miembro no existe');
  return miembro;
}

/** Huellas registradas de un miembro, SIN la plantilla. */
export async function listarHuellas(miembroId, filtroSede = {}) {
  await exigirMiembro(miembroId, filtroSede);
  const HuellaMiembro = obtenerModelo('HuellaMiembro');
  return HuellaMiembro.find({ miembro: miembroId }).sort({ createdAt: 1 });
}

/**
 * Enrola una huella. `plantilla` llega en base64 tal como la entrega el SDK
 * (ya fusionada de 3 capturas). La autorizacion de datos biometricos la exige la
 * validacion de entrada; aqui se deja constancia de cuando y quien.
 */
export async function registrarHuella(miembroId, { plantilla, dedo }, { filtroSede = {}, actor } = {}) {
  const miembro = await exigirMiembro(miembroId, filtroSede);
  if (!miembro.activo) throw ErrorApi.solicitudInvalida('El miembro esta dado de baja');

  const bytes = Buffer.from(plantilla, 'base64');
  if (bytes.length === 0 || bytes.length > BYTES_MAX_PLANTILLA_HUELLA) {
    throw ErrorApi.solicitudInvalida('La plantilla de huella no es valida');
  }

  const HuellaMiembro = obtenerModelo('HuellaMiembro');
  const registradas = await HuellaMiembro.countDocuments({ miembro: miembroId });
  if (registradas >= MAX_HUELLAS_POR_MIEMBRO) {
    throw ErrorApi.conflicto(
      `El miembro ya tiene ${MAX_HUELLAS_POR_MIEMBRO} huellas registradas. Borra una para registrar otra`,
    );
  }

  const huella = await HuellaMiembro.create({
    miembro: miembroId,
    dedo,
    plantillaCifrada: cifrarPlantilla(bytes),
    autorizacion: { fecha: new Date(), registradaPor: actor?._id ?? null },
  });

  // `create` devuelve el documento con la plantilla puesta; no sale de aqui.
  const respuesta = huella.toObject();
  delete respuesta.plantillaCifrada;
  return respuesta;
}

export async function eliminarHuella(miembroId, huellaId, filtroSede = {}) {
  await exigirMiembro(miembroId, filtroSede);
  const HuellaMiembro = obtenerModelo('HuellaMiembro');
  const borrada = await HuellaMiembro.findOneAndDelete({ _id: huellaId, miembro: miembroId });
  if (!borrada) throw ErrorApi.noEncontrado('La huella no existe');
  return { _id: borrada._id };
}

/**
 * Ids de los miembros que ya tienen al menos una huella, dentro del alcance de
 * quien consulta. La ficha los pinta distinto para saber a quien falta enrolar.
 */
export async function listarMiembrosConHuella(filtroSede = {}) {
  const HuellaMiembro = obtenerModelo('HuellaMiembro');
  const conHuella = await HuellaMiembro.distinct('miembro');
  if (!filtroSede.sede) return conHuella.map(String);

  // Las huellas no guardan sede: se acota por la del miembro.
  const Miembro = obtenerModelo('Miembro');
  const visibles = await Miembro.find({ _id: { $in: conHuella }, ...filtroSede }).distinct('_id');
  return visibles.map(String);
}

/** Borra TODAS las huellas de un miembro (baja del miembro: no se conservan). */
export function eliminarHuellasDeMiembro(miembroId) {
  const HuellaMiembro = obtenerModelo('HuellaMiembro');
  return HuellaMiembro.deleteMany({ miembro: miembroId });
}

/**
 * Lo que baja el puesto de la puerta: las plantillas (descifradas, en base64) de
 * los miembros ACTIVOS de todo el gimnasio. Un miembro dado de baja desaparece
 * del lector en la siguiente sincronizacion aunque sus huellas no se hayan
 * borrado todavia.
 */
export async function listarPlantillasParaPuesto() {
  const Miembro = obtenerModelo('Miembro');
  const HuellaMiembro = obtenerModelo('HuellaMiembro');

  const activos = await Miembro.find({ activo: true }).select('_id').lean();
  const huellas = await HuellaMiembro.find({ miembro: { $in: activos.map((m) => m._id) } })
    .select('+plantillaCifrada miembro')
    .lean();

  return huellas.map((huella) => ({
    id: String(huella._id),
    miembro: String(huella.miembro),
    plantilla: descifrarPlantilla(huella.plantillaCifrada).toString('base64'),
  }));
}
