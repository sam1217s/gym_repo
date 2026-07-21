import { obtenerContexto } from '../contexto/contextoTenant.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';

/**
 * Ventas de productos del inventario, POR SEDE.
 *
 * El aislamiento por tenant lo pone el plugin; el alcance por SEDE llega como
 * `filtroSede` desde `limitarASede` (`{}` para el dueno, `{ sede }` para un
 * sede_admin). Mismo contrato que Producto/Miembro/Pago: el filtro va en la
 * BUSQUEDA, asi que un producto de otra sede es un 404, no un 403.
 */

/** Medianoche local del dia de `fecha`. */
function inicioDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Medianoche local del dia SIGUIENTE (limite superior exclusivo del rango). */
function finDiaExclusivo(fecha) {
  const d = inicioDia(fecha);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Registra la venta de un producto: descuenta el stock y guarda la venta con el
 * precio del momento. Sin transacciones (no hay replica set), se compensa a
 * mano: si falla el registro de la venta, se devuelve el stock descontado.
 */
export async function registrarVenta({ producto: productoId, cantidad }, filtroSede = {}) {
  const Producto = obtenerModelo('Producto');
  const VentaProducto = obtenerModelo('VentaProducto');

  // El filtro de sede va en la busqueda: un producto de otra sede no existe.
  const producto = await Producto.findOne({ _id: productoId, ...filtroSede });
  if (!producto) throw ErrorApi.noEncontrado('El producto no existe');
  if (!producto.activo) throw ErrorApi.solicitudInvalida('El producto esta archivado');

  if (producto.cantidad < cantidad) {
    throw ErrorApi.solicitudInvalida(
      `No hay existencias suficientes: quedan ${producto.cantidad} y quieres vender ${cantidad}`,
    );
  }

  const precioUnitario = producto.precio;
  const total = precioUnitario * cantidad;

  // 1. Descuenta el stock.
  producto.cantidad -= cantidad;
  await producto.save();

  // 2. Registra la venta (foto de nombre y precio). Compensa si falla.
  try {
    const venta = await VentaProducto.create({
      sede: producto.sede,
      producto: producto._id,
      nombreProducto: producto.nombre,
      cantidad,
      precioUnitario,
      total,
      registradoPor: obtenerContexto().usuarioId,
    });
    return { venta, producto };
  } catch (error) {
    // Devuelve el stock: la venta no quedo registrada.
    producto.cantidad += cantidad;
    await producto.save();
    throw error;
  }
}

/**
 * Lista las ventas de un rango de dias (por defecto HOY) y su resumen. El
 * resumen (total en dinero y unidades) se agrega en la misma consulta para no
 * recorrer dos veces.
 */
export async function listarVentas(filtroSede = {}, { sede, desde, hasta } = {}) {
  const VentaProducto = obtenerModelo('VentaProducto');

  const inicio = inicioDia(desde ?? new Date());
  const fin = finDiaExclusivo(hasta ?? desde ?? new Date());

  const filtro = { ...filtroSede, createdAt: { $gte: inicio, $lt: fin } };
  // El filtro del rol gana: un sede_admin no puede pedir otra sede por query.
  if (sede && !filtroSede.sede) filtro.sede = sede;

  const ventas = await VentaProducto.find(filtro).sort({ createdAt: -1 });

  const resumen = ventas.reduce(
    (acc, venta) => {
      acc.total += venta.total;
      acc.unidades += venta.cantidad;
      return acc;
    },
    { total: 0, unidades: 0, operaciones: ventas.length },
  );

  return { ventas, resumen, desde: inicio, hasta: fin };
}
