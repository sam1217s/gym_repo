import { ROLES } from '../config/constantes.js';
import { registrarMovimiento } from '../servicios/auditoria.servicio.js';

/**
 * Middleware transversal que anota en la bitacora CADA operacion que muta datos
 * y termina bien. Va montado al inicio del router de `/api`: registra un
 * `res.on('finish')` que, cuando la respuesta ya salio, lee lo que dejo
 * `autenticar` (`peticion.usuario`) y escribe el movimiento.
 *
 * Es "el que sabe" traducir una ruta a una frase legible: los servicios no se
 * enteran de que existe la auditoria (cero acoplamiento).
 */

/**
 * Mapa recurso -> etiqueta por metodo. Lo que no esta aqui NO se audita
 * (listados GET, login, webhooks, marcar leidos...): no son "movimientos".
 */
const MOVIMIENTOS = {
  pagos: { POST: 'Registro un pago' },
  ventas: { POST: 'Vendio un producto' },
  miembros: { POST: 'Registro un miembro', PATCH: 'Actualizo un miembro' },
  inventario: {
    POST: 'Agrego un producto',
    PATCH: 'Edito un producto',
    DELETE: 'Archivo un producto',
  },
  maquinas: {
    POST: 'Registro una maquina',
    PATCH: 'Actualizo una maquina',
    DELETE: 'Archivo una maquina',
  },
  gastos: { POST: 'Registro un gasto', PATCH: 'Edito un gasto', DELETE: 'Elimino un gasto' },
  deudas: {
    POST: 'Registro una deuda',
    PATCH: 'Actualizo una deuda',
    DELETE: 'Archivo una deuda',
  },
  sedes: { POST: 'Creo una sede', PATCH: 'Actualizo una sede' },
  usuarios: { POST: 'Agrego un usuario al equipo', PATCH: 'Actualizo un usuario' },
  'planes-membresia': {
    POST: 'Creo un plan de membresia',
    PATCH: 'Actualizo un plan de membresia',
    DELETE: 'Archivo un plan de membresia',
  },
};

/** Describe el movimiento a partir de la ruta y el metodo, o `null` si no aplica. */
function describirMovimiento(peticion) {
  // Se lee de `originalUrl` (nunca se reescribe): en `res.on('finish')` la pila
  // de routers ya se desenrollo, asi que `peticion.path` volveria a ser
  // "/api/miembros". Se quita el prefijo "api" y la query.
  const partes = peticion.originalUrl.split('?')[0].split('/').filter(Boolean);
  if (partes[0] === 'api') partes.shift();
  const recurso = partes[0]; // "pagos", "inventario", ...
  const subaccion = partes[2]; // "/:id/ajuste", "/:id/venta", ...

  // Caso especial: ajustar existencias no es "editar" el producto.
  if (recurso === 'inventario' && subaccion === 'ajuste') {
    return { recurso: 'inventario', accion: 'Ajusto existencias' };
  }

  // Abonar a una deuda no es "actualizarla": es un pago.
  if (recurso === 'deudas' && subaccion === 'abonos') {
    return { recurso: 'deudas', accion: 'Abono a una deuda' };
  }

  const accion = MOVIMIENTOS[recurso]?.[peticion.method];
  return accion ? { recurso, accion } : null;
}

/** Dato corto para identificar el movimiento, a partir del cuerpo. */
function detalleDeCuerpo(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') return '';
  if (cuerpo.nombres) return `${cuerpo.nombres} ${cuerpo.apellidos ?? ''}`.trim();
  if (cuerpo.nombre) return String(cuerpo.nombre);
  if (cuerpo.estado) return String(cuerpo.estado);
  if (cuerpo.monto != null) return `$${cuerpo.monto}`;
  if (cuerpo.delta != null) return `${cuerpo.delta > 0 ? '+' : ''}${cuerpo.delta} u`;
  if (cuerpo.cantidad != null) return `${cuerpo.cantidad} u`;
  return '';
}

export function auditar(peticion, respuesta, siguiente) {
  respuesta.on('finish', () => {
    try {
      // Solo operaciones exitosas que mutan, y de personal del gimnasio (el
      // super_admin opera la plataforma, no un gimnasio).
      if (respuesta.statusCode >= 400) return;
      if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(peticion.method)) return;

      const usuario = peticion.usuario;
      if (!usuario || usuario.rol === ROLES.SUPER_ADMIN) return;

      const movimiento = describirMovimiento(peticion);
      if (!movimiento) return;

      // Fire-and-forget: la peticion ya termino, un fallo aqui no la afecta.
      registrarMovimiento(usuario.tenant, {
        usuario: usuario._id,
        usuarioNombre: usuario.nombreCompleto,
        usuarioRol: usuario.rol,
        accion: movimiento.accion,
        recurso: movimiento.recurso,
        detalle: detalleDeCuerpo(peticion.body),
        metodo: peticion.method,
        ruta: peticion.originalUrl,
      }).catch(() => {});
    } catch {
      // La auditoria nunca rompe nada: si algo falla, se ignora en silencio.
    }
  });

  return siguiente();
}
