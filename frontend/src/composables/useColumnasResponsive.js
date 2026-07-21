import { useQuasar } from 'quasar';
import { computed } from 'vue';

/**
 * Reordena las columnas de una `q-table` segun el tamano de pantalla.
 *
 * En movil, la columna de acciones va PRIMERO: en una pantalla estrecha la tabla
 * se desplaza en horizontal, y no queremos que el usuario tenga que arrastrar
 * hasta el final para registrar un pago o editar. En pantallas grandes las
 * acciones quedan al final, como es la convencion.
 */
export function useColumnasResponsive(columnas, { nombreAcciones = 'acciones' } = {}) {
  const quasar = useQuasar();

  return computed(() => {
    if (!quasar.screen.lt.md) return columnas;

    const acciones = columnas.filter((columna) => columna.name === nombreAcciones);
    const resto = columnas.filter((columna) => columna.name !== nombreAcciones);
    return [...acciones, ...resto];
  });
}
