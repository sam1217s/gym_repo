import { conectarBaseDatos, desconectarBaseDatos } from '../src/config/baseDatos.js';
import { entorno } from '../src/config/entorno.js';
import { registrarModelos } from '../src/modelos/indice.js';

/**
 * Pone `precio: 0` a los productos creados ANTES de que el precio fuera
 * obligatorio (cuando el campo se habia quitado). Sin esto, esos productos
 * quedan invalidos y no se pueden editar ni vender. Idempotente.
 *
 * Se hace sobre la coleccion cruda (no el modelo) a proposito: asi salta el
 * plugin de aislamiento por tenant y arregla los de TODOS los gimnasios de una
 * vez, que es lo que quiere una migracion de operador.
 *
 *   node scripts/migrarPrecioProducto.js
 */
async function migrar() {
  const conexion = await conectarBaseDatos(entorno.MONGO_URI);
  registrarModelos(conexion);

  const resultado = await conexion
    .collection('productos')
    .updateMany({ precio: { $exists: false } }, { $set: { precio: 0 } });

  console.log(`Productos migrados (precio 0 por defecto): ${resultado.modifiedCount}.`);
  console.log('Revisa el inventario y ponles el precio real a los que se vendan.');
}

migrar()
  .catch((error) => {
    console.error('Fallo la migracion de precio:', error.message);
    process.exitCode = 1;
  })
  .finally(desconectarBaseDatos);
