import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { exigirSede } from './sedes.servicio.js';

/**
 * Inventario del gimnasio, POR SEDE.
 *
 * El aislamiento por tenant lo pone el plugin; el alcance por SEDE llega como
 * `filtroSede` desde `limitarASede` (`{}` para el dueno, `{ sede }` para un
 * sede_admin). Todo lo que entra aqui lo aplica: es la muralla entre un
 * sede_admin y las otras sedes de su gimnasio (mismo contrato que Miembro/Pago).
 */

const CODIGO_DUPLICADO_MONGO = 11000;

export function listarInventario(filtroSede = {}, { sede, activo } = {}) {
  const Producto = obtenerModelo('Producto');

  const filtro = { ...filtroSede };
  // El filtro del rol gana: un sede_admin no puede pedir otra sede por query.
  if (sede && !filtroSede.sede) filtro.sede = sede;
  if (activo !== undefined) filtro.activo = activo === 'true';

  return Producto.find(filtro).sort({ nombre: 1 });
}

export async function crearProducto(datos, { filtroSede = {}, sedePorDefecto = null } = {}) {
  const Producto = obtenerModelo('Producto');

  // Un sede_admin crea siempre en SU sede, diga lo que diga el cuerpo.
  const sede = filtroSede.sede ?? datos.sede ?? sedePorDefecto;
  if (!sede) throw ErrorApi.solicitudInvalida('Indica la sede del producto');

  await exigirSede(sede);

  try {
    return await Producto.create({
      sede,
      nombre: datos.nombre,
      cantidad: datos.cantidad ?? 0,
      precio: datos.precio,
    });
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un producto con ese nombre en esa sede');
    }
    throw error;
  }
}

export async function actualizarProducto(id, datos, filtroSede = {}) {
  const Producto = obtenerModelo('Producto');

  // El filtro de sede va en la BUSQUEDA: para un sede_admin, un producto de
  // otra sede no existe.
  const producto = await Producto.findOne({ _id: id, ...filtroSede });
  if (!producto) throw ErrorApi.noEncontrado('El producto no existe');

  Object.assign(producto, datos);

  try {
    return await producto.save();
  } catch (error) {
    if (error.code === CODIGO_DUPLICADO_MONGO) {
      throw ErrorApi.conflicto('Ya existe un producto con ese nombre en esa sede');
    }
    throw error;
  }
}

/**
 * Suma o resta existencias. `delta` positivo entra stock; negativo lo saca. Las
 * existencias nunca bajan de 0: sacar mas de lo que hay es un 400, no un numero
 * negativo.
 */
export async function ajustarStock(id, delta, filtroSede = {}) {
  const Producto = obtenerModelo('Producto');

  const producto = await Producto.findOne({ _id: id, ...filtroSede });
  if (!producto) throw ErrorApi.noEncontrado('El producto no existe');

  const nueva = producto.cantidad + delta;
  if (nueva < 0) {
    throw ErrorApi.solicitudInvalida(
      `No hay existencias suficientes: quedan ${producto.cantidad} y quieres sacar ${-delta}`,
    );
  }

  producto.cantidad = nueva;
  return producto.save();
}

export async function archivarProducto(id, filtroSede = {}) {
  const Producto = obtenerModelo('Producto');

  const producto = await Producto.findOne({ _id: id, ...filtroSede });
  if (!producto) throw ErrorApi.noEncontrado('El producto no existe');

  producto.activo = false;
  return producto.save();
}
