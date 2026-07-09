<template>
  <div class="grafica">
    <div class="row items-baseline justify-between q-mb-lg">
      <div>
        <div class="ceja">Ingresos por sede</div>
        <div class="text-caption text-grey-7">Lo cobrado en {{ nombreMes }}</div>
      </div>

      <!-- Leyenda: identidad de las dos series. Cada swatch lleva su nombre; nunca solo color. -->
      <div class="leyenda">
        <span class="entrada-leyenda">
          <span class="marca-leyenda marca-efectivo" />Efectivo
        </span>
        <span class="entrada-leyenda">
          <span class="marca-leyenda marca-transferencia" />Transferencia
        </span>
      </div>
    </div>

    <p v-if="sinIngresos" class="vacio">
      Todavia no hay pagos registrados en {{ nombreMes }}.<br />
      <span class="text-grey-7">Registra el primero desde la pantalla de miembros.</span>
    </p>

    <div v-else class="pila-sedes">
      <div v-for="fila in filasCalculadas" :key="fila.sede" class="fila-sede">
        <div class="encabezado-fila">
          <span class="nombre-sede">{{ fila.sedeNombre }}</span>
          <span class="total-sede cifra-tabular">{{ formatearMoneda(fila.total) }}</span>
        </div>

        <!-- La manga: el riel completo es la sede con mas ingresos; lo cargado es su dinero. -->
        <div class="manga">
          <div v-if="fila.sinIngresos" class="sin-carga">Sin ingresos este mes</div>

          <div v-else class="carga" :style="{ width: `${fila.anchoCarga}%` }">
            <div
              v-if="fila.efectivo > 0"
              class="segmento seg-efectivo"
              :style="{ flexGrow: fila.efectivo }"
            >
              <q-tooltip anchor="top middle" self="bottom middle">
                Efectivo · {{ formatearMoneda(fila.efectivo) }}
              </q-tooltip>
            </div>
            <div
              v-if="fila.transferencia > 0"
              class="segmento seg-transferencia"
              :style="{ flexGrow: fila.transferencia }"
            >
              <q-tooltip anchor="top middle" self="bottom middle">
                Transferencia · {{ formatearMoneda(fila.transferencia) }}
              </q-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- El desglose no puede vivir solo en el tooltip: quien no pueda pasar el
         mouse tiene que poder leer los mismos numeros. -->
    <template v-if="!sinIngresos">
      <q-separator class="q-my-lg" />

      <table class="desglose">
        <caption class="sr-solo">Desglose de ingresos por sede y metodo de pago</caption>
        <thead>
          <tr>
            <th scope="col" class="col-texto">Sede</th>
            <th scope="col">Efectivo</th>
            <th scope="col">Transferencia</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fila in filasCalculadas" :key="fila.sede">
            <th scope="row" class="col-texto">{{ fila.sedeNombre }}</th>
            <td class="cifra-tabular">{{ formatearMoneda(fila.efectivo) }}</td>
            <td class="cifra-tabular">{{ formatearMoneda(fila.transferencia) }}</td>
            <td class="cifra-tabular text-weight-bold">{{ formatearMoneda(fila.total) }}</td>
          </tr>
        </tbody>
        <!-- Con una sola sede el total repetiria su propia fila. -->
        <tfoot v-if="filasCalculadas.length > 1">
          <tr>
            <th scope="row" class="col-texto">Todas</th>
            <td class="cifra-tabular">{{ formatearMoneda(totales.efectivo) }}</td>
            <td class="cifra-tabular">{{ formatearMoneda(totales.transferencia) }}</td>
            <td class="cifra-tabular text-weight-bold">{{ formatearMoneda(totales.total) }}</td>
          </tr>
        </tfoot>
      </table>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';

/**
 * Ingresos del mes por sede: una barra horizontal por sede, cargada con los
 * dos metodos de pago.
 *
 * La forma sale del mundo del gimnasio: cada fila es la manga de una barra
 * olimpica, y el dinero es el peso montado en ella. El riel completo es la
 * sede que mas cobro, asi que la comparacion entre sedes es inmediata.
 *
 * Los colores de las series (violeta/naranja) estan validados con el script de
 * la skill `dataviz` y viven fuera de la familia de tonos de los estados de
 * vencimiento, para que una serie de pago no se lea nunca como un estado.
 */

const props = defineProps({
  // [{ sede, sedeNombre, efectivo, transferencia, total }]
  filas: { type: Array, required: true },
  nombreMes: { type: String, required: true },
});

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

function formatearMoneda(valor) {
  return `$${FORMATO_PESOS.format(valor)}`;
}

const maximo = computed(() => Math.max(0, ...props.filas.map((fila) => fila.total)));

const sinIngresos = computed(() => maximo.value === 0);

const filasCalculadas = computed(() =>
  // La sede que mas cobro llena el riel; el resto se mide contra ella.
  props.filas.map((fila) => ({
    ...fila,
    sinIngresos: fila.total === 0,
    anchoCarga: maximo.value === 0 ? 0 : (fila.total / maximo.value) * 100,
  })),
);

const totales = computed(() =>
  props.filas.reduce(
    (acumulado, fila) => ({
      efectivo: acumulado.efectivo + fila.efectivo,
      transferencia: acumulado.transferencia + fila.transferencia,
      total: acumulado.total + fila.total,
    }),
    { efectivo: 0, transferencia: 0, total: 0 },
  ),
);
</script>

<style scoped>
.leyenda {
  display: flex;
  gap: 18px;
}

.entrada-leyenda {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  color: #52514e;
}

.marca-leyenda {
  width: 11px;
  height: 11px;
  border-radius: 2px;
}

.marca-efectivo {
  background: #4a3aa7;
}

.marca-transferencia {
  background: #eb6834;
}

.pila-sedes {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.encabezado-fila {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 7px;
  gap: 12px;
}

.nombre-sede {
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #52514e;
}

.total-sede {
  font-size: 0.95rem;
  font-weight: 600;
  color: #0b0b0b;
}

/* El riel de la manga: recesivo, nunca compite con la carga. */
.manga {
  position: relative;
  height: 18px;
  background: rgba(27, 30, 36, 0.055);
  border-radius: 2px;
}

.carga {
  display: flex;
  /* Los 2px de aire entre segmentos: el fondo separando, nunca un borde. */
  gap: 2px;
  height: 100%;
  /* Cuadrada contra la linea base, redondeada en el extremo del dato. */
  border-radius: 0 4px 4px 0;
  overflow: hidden;
}

.segmento {
  flex-basis: 0;
  min-width: 3px;
  transition: filter 0.15s ease;
  cursor: default;
}

.segmento:hover {
  filter: brightness(1.12);
}

.seg-efectivo {
  background: #4a3aa7;
}

.seg-transferencia {
  background: #eb6834;
}

.sin-carga {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding-left: 10px;
  font-size: 0.72rem;
  color: #898781;
}

.vacio {
  margin: 0;
  padding: 28px 0;
  font-size: 0.9rem;
  color: #52514e;
  line-height: 1.6;
}

/* --- Vista de tabla: los mismos numeros, sin depender del hover ------------- */

.desglose {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.desglose th,
.desglose td {
  padding: 7px 0;
  text-align: right;
  font-weight: 400;
  color: #52514e;
}

.desglose .col-texto {
  text-align: left;
}

.desglose thead th {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #898781;
  border-bottom: 1px solid #e1e0d9;
}

.desglose tbody th {
  font-weight: 500;
  color: #0b0b0b;
}

.desglose tfoot th,
.desglose tfoot td {
  border-top: 1px solid #e1e0d9;
  color: #0b0b0b;
  font-weight: 600;
}

/* Visible para lectores de pantalla, fuera de la vista. */
.sr-solo {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
