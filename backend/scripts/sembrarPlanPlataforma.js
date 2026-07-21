import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import { PLAN_SUSCRIPCION_NOMBRE, PLAN_SUSCRIPCION_PRECIO } from '../src/config/constantes.js';
import { entorno } from '../src/config/entorno.js';
import { ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo, registrarModelos, sincronizarIndices } from '../src/modelos/indice.js';

/**
 * Crea el PlanPlataforma inicial ('Estandar'), sin el cual el super_admin no
 * puede dar de alta gimnasios (el selector de plan sale vacio) y el registro
 * publico responde 503. Idempotente: si ya existe, no hace nada.
 *
 *   npm run sembrar:plan
 */
async function sembrar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);
  await sincronizarIndices(conexion);

  await ejecutarSinTenant(async () => {
    const PlanPlataforma = obtenerModelo('PlanPlataforma');

    const yaExiste = await PlanPlataforma.findOne({ nombre: PLAN_SUSCRIPCION_NOMBRE });
    if (yaExiste) {
      console.log(`El plan '${PLAN_SUSCRIPCION_NOMBRE}' ya existe. Nada que hacer.`);
      return;
    }

    await PlanPlataforma.create({
      nombre: PLAN_SUSCRIPCION_NOMBRE,
      precioMensual: PLAN_SUSCRIPCION_PRECIO,
      limites: { maxSedes: 10, maxMiembros: 2000, maxUsuarios: 50 },
      features: { whatsapp: true, reportes: true },
    });

    console.log(`Plan de plataforma creado: '${PLAN_SUSCRIPCION_NOMBRE}' ($${PLAN_SUSCRIPCION_PRECIO}/mes).`);
  });
}

sembrar()
  .catch((error) => {
    console.error('Fallo el seed del plan:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
