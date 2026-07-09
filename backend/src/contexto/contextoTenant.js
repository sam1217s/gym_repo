import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant por peticion.
 *
 * Este modulo es el corazon del multi-tenancy. `AsyncLocalStorage` mantiene un
 * almacen vivo durante todo el ciclo de una peticion (incluso a traves de
 * `await`), de forma que el plugin de Mongoose puede leer el tenant actual sin
 * que nadie tenga que ir pasando `tenantId` de capa en capa.
 *
 * REGLA SAGRADA: si una coleccion tenant-scoped se consulta sin contexto de
 * tenant, la operacion FALLA. Nunca "trae todo". La unica forma de salir del
 * aislamiento es la escotilla explicita `ejecutarSinTenant()`, que se puede
 * auditar con un simple grep.
 */

const almacen = new AsyncLocalStorage();

/**
 * Error que lanza el plugin cuando no hay tenant y no se pidio omitir el
 * aislamiento. Se traduce a HTTP 500 en el manejador central: llegar aqui
 * significa que hay un bug en el codigo, no un error del cliente.
 */
export class ErrorSinContextoTenant extends Error {
  constructor(operacion = 'desconocida') {
    super(
      `Se intento ejecutar la operacion "${operacion}" sobre una coleccion ` +
        'tenant-scoped sin contexto de tenant. Envuelve la llamada en ' +
        'ejecutarConTenant() o, si es intencional, en ejecutarSinTenant().',
    );
    this.name = 'ErrorSinContextoTenant';
  }
}

/** Devuelve el contexto actual, o `null` si no hay ninguno abierto. */
export function obtenerContexto() {
  return almacen.getStore() ?? null;
}

const CONTEXTO_VACIO = { tenantId: null, usuarioId: null, rol: null, sedeId: null };

/**
 * Abre un contexto y ejecuta `fn` dentro. Version cruda, sin envolver el
 * resultado: la usa el middleware de Express, donde `fn` es el `next()` de la
 * cadena y todo lo de abajo corre de forma sincrona dentro del contexto.
 *
 * @param {{ tenantId, usuarioId, rol, sedeId, omitirAislamiento? }} datos
 */
export function ejecutarConContexto(datos, fn) {
  return almacen.run({ ...CONTEXTO_VACIO, omitirAislamiento: false, ...datos }, fn);
}

/**
 * Envuelve el resultado de `fn` en una promesa DENTRO del contexto.
 *
 * Sin esto hay un footgun facil de pisar: las Query de Mongoose son perezosas.
 * `ejecutarConTenant(id, () => Miembro.find())` construye la query dentro del
 * contexto pero la EJECUTA fuera, cuando quien llama hace `await`, y para
 * entonces el contexto ya se cerro. `Promise.resolve()` adopta el thenable
 * mientras el contexto sigue abierto, asi que `exec()` ve el tenant.
 *
 * Gracias a esto, tanto `() => Modelo.find()` como `async () => await Modelo.find()`
 * se comportan igual.
 */
function ejecutarEnvuelto(contexto, fn) {
  return almacen.run(contexto, () => Promise.resolve(fn()));
}

/**
 * Abre un contexto con solo el tenant. Lo usan el cron, los scripts y las
 * pruebas, que operan fuera de una peticion HTTP.
 */
export function ejecutarConTenant(tenantId, fn) {
  if (!tenantId) throw new Error('ejecutarConTenant() requiere un tenantId');
  return ejecutarEnvuelto({ ...CONTEXTO_VACIO, tenantId, omitirAislamiento: false }, fn);
}

/**
 * ESCOTILLA EXPLICITA. Desactiva el filtro automatico de tenant.
 *
 * Usos legitimos, y ningun otro:
 *   - un `super_admin` consultando datos de la plataforma;
 *   - el seed inicial;
 *   - el cron, para listar los tenants activos antes de iterarlos.
 *
 * Dentro de este contexto, `save()` exige que el `tenant` venga puesto a mano:
 * el campo sigue siendo obligatorio en el esquema.
 */
export function ejecutarSinTenant(fn) {
  return ejecutarEnvuelto({ ...CONTEXTO_VACIO, omitirAislamiento: true }, fn);
}

/** `true` si el contexto actual pidio saltarse el aislamiento. */
export function omiteAislamiento() {
  return obtenerContexto()?.omitirAislamiento === true;
}

/**
 * Devuelve el tenant actual o lanza. Es la funcion que hace cumplir la regla
 * sagrada; el plugin de Mongoose la llama en cada operacion.
 */
export function exigirTenantActual(operacion) {
  const contexto = obtenerContexto();
  if (!contexto || !contexto.tenantId) {
    throw new ErrorSinContextoTenant(operacion);
  }
  return contexto.tenantId;
}
