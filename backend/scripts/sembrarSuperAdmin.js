import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import { ROLES } from '../src/config/constantes.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo, registrarModelos, sincronizarIndices } from '../src/modelos/indice.js';
import { cifrarContrasena } from '../src/utilidades/contrasena.js';

/**
 * Crea el `super_admin` inicial: el dueno de la plataforma.
 *
 * Es el unico usuario que no puede crear nadie desde la interfaz, porque no hay
 * nadie con permiso para crearlo todavia. Idempotente: si ya existe, no hace nada.
 *
 *   npm run sembrar
 */
async function sembrar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);
  await sincronizarIndices(conexion);

  // El seed corre fuera de cualquier peticion HTTP, asi que no hay contexto de
  // tenant. `Usuario` no es tenant-scoped, pero se envuelve igual para dejar
  // explicito que esto opera a nivel plataforma.
  await ejecutarSinTenant(async () => {
    const Usuario = obtenerModelo('Usuario');
    const email = entorno.SEMILLA_SUPERADMIN_EMAIL;

    const yaExiste = await Usuario.findOne({ email, rol: ROLES.SUPER_ADMIN });
    if (yaExiste) {
      console.log(`El super_admin ${email} ya existe. Nada que hacer.`);
      return;
    }

    await Usuario.create({
      tenant: null,
      sede: null,
      nombres: 'Super',
      apellidos: 'Admin',
      email,
      contrasenaHash: await cifrarContrasena(entorno.SEMILLA_SUPERADMIN_CONTRASENA),
      rol: ROLES.SUPER_ADMIN,
      activo: true,
      // Obliga a cambiar la clave del `.env` en el primer acceso.
      debeCambiarContrasena: true,
    });

    console.log(`super_admin creado: ${email}`);
    console.log('Debera cambiar la contrasena en su primer inicio de sesion.');
  });
}

sembrar()
  .catch((error) => {
    console.error('Fallo el seed:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
