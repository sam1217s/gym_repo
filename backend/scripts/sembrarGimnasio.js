import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import { ROLES } from '../src/config/constantes.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo, registrarModelos, sincronizarIndices } from '../src/modelos/indice.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';

/**
 * Siembra el (unico) gimnasio en un entorno nuevo: el Tenant, su dueno
 * (`tenant_owner`) y la primera sede. Idempotente: si el dueno ya existe, no hace
 * nada. NO se corre en produccion (alli el gimnasio y el dueno ya existen); sirve
 * para levantar un entorno local o de pruebas desde cero.
 *
 *   npm run sembrar
 *
 * Datos del dueno: `SEMILLA_SUPERADMIN_EMAIL` / `SEMILLA_SUPERADMIN_CONTRASENA`.
 * Datos del gimnasio/sede: opcionales por entorno, con defaults razonables.
 */
const GIMNASIO = {
  nombre: process.env.SEMILLA_GIMNASIO_NOMBRE || 'Mi Gimnasio',
  nit: process.env.SEMILLA_GIMNASIO_NIT || '000000000',
  slug: process.env.SEMILLA_GIMNASIO_SLUG || 'gimnasio',
};
const SEDE = {
  nombre: process.env.SEMILLA_SEDE_NOMBRE || 'Principal',
  direccion: process.env.SEMILLA_SEDE_DIRECCION || 'Sin direccion',
};

async function sembrar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);
  await sincronizarIndices(conexion);

  const email = entorno.SEMILLA_SUPERADMIN_EMAIL;

  const yaExiste = await ejecutarSinTenant(() => obtenerModelo('Usuario').findOne({ email }));
  if (yaExiste) {
    console.log(`El usuario ${email} ya existe. Nada que hacer.`);
    return;
  }

  // 1) El Tenant (coleccion de plataforma: sin contexto).
  const tenant = await ejecutarSinTenant(() => obtenerModelo('Tenant').create(GIMNASIO));

  // 2) El dueno (Usuario tampoco es tenant-scoped; el tenant se asigna a mano).
  const contrasenaHash = await cifrarContrasena(entorno.SEMILLA_SUPERADMIN_CONTRASENA);
  await ejecutarSinTenant(() =>
    obtenerModelo('Usuario').create({
      tenant: tenant._id,
      sede: null,
      nombres: 'Dueno',
      apellidos: GIMNASIO.nombre,
      email,
      contrasenaHash,
      rol: ROLES.TENANT_OWNER,
      activo: true,
      debeCambiarContrasena: true,
    }),
  );

  // 3) La primera sede SI es tenant-scoped: necesita contexto.
  await ejecutarConTenant(tenant._id, () => obtenerModelo('Sede').create(SEDE));

  console.log(`Gimnasio "${GIMNASIO.nombre}" creado con dueno ${email} y sede "${SEDE.nombre}".`);
  console.log('El dueno debera cambiar la contrasena en su primer inicio de sesion.');
}

sembrar()
  .catch((error) => {
    console.error('Fallo el seed:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
