import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import { entorno } from '../src/config/entorno.js';
import { registrarModelos } from '../src/modelos/indice.js';
import { ejecutarAvisosDeVencimiento } from '../src/tareas/vencimientos.tarea.js';

/**
 * Dispara la corrida de avisos de vencimiento AHORA, sin esperar al cron de las
 * 9:00. Sirve para probar el canal de WhatsApp recien configurado.
 *
 * Es la MISMA funcion que corre el cron, asi que lo que pase aqui es lo que
 * pasara manana: si un miembro recibe el aviso, su ultimo pago queda marcado
 * como `notificado` y no se le vuelve a avisar por ese periodo.
 *
 *   node scripts/enviarAvisosAhora.js
 */
async function main() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);

  const resumen = await ejecutarAvisosDeVencimiento();
  console.log('Resumen de la corrida:', JSON.stringify(resumen, null, 2));
}

main()
  .catch((error) => {
    console.error('Fallo la corrida de avisos:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
