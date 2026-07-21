import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo, registrarModelos } from '../src/modelos/indice.js';

/**
 * Asigna una `sede` a los `PlanMembresia` creados ANTES de que los planes fueran
 * por sede. Cada plan huerfano se adopta en la PRIMERA sede activa de su
 * gimnasio; si el gimnasio tiene varias, el dueño puede crear despues los planes
 * propios de las demas. Idempotente: los que ya tienen sede no se tocan.
 *
 *   node scripts/migrarSedePlanMembresia.js
 */
async function migrar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);

  const tenants = await ejecutarSinTenant(() => obtenerModelo('Tenant').find().lean());
  let migrados = 0;

  for (const tenant of tenants) {
    await ejecutarConTenant(tenant._id, async () => {
      const PlanMembresia = obtenerModelo('PlanMembresia');
      const Sede = obtenerModelo('Sede');

      // Se busca por la coleccion cruda: los planes sin `sede` no pasan la
      // validacion del modelo, pero leerlos con find() si funciona.
      const huerfanos = await PlanMembresia.find({ sede: { $exists: false } }).lean();
      if (huerfanos.length === 0) return;

      const sede = await Sede.findOne({ activa: true }).sort({ createdAt: 1 });
      if (!sede) {
        console.warn(`! "${tenant.nombre}" tiene ${huerfanos.length} plan(es) sin sede y ninguna sede activa. Se omite.`);
        return;
      }

      const resultado = await PlanMembresia.updateMany(
        { sede: { $exists: false } },
        { $set: { sede: sede._id } },
      );

      migrados += resultado.modifiedCount ?? 0;
      console.log(`+ "${tenant.nombre}": ${resultado.modifiedCount} plan(es) asignados a la sede "${sede.nombre}"`);
    });
  }

  console.log(`\nPlanes migrados: ${migrados}.`);
}

migrar()
  .catch((error) => {
    console.error('Fallo la migracion de sede en planes:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
