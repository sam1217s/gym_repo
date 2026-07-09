<template>
  <div class="grafica-ingresos">
    <div class="row items-center justify-between q-mb-sm">
      <div class="text-subtitle2 text-grey-8">Ingresos por sede</div>

      <!-- Leyenda: identidad de las dos series. Nunca solo color: cada swatch lleva su nombre. -->
      <div class="leyenda">
        <span class="entrada-leyenda">
          <span class="marca-leyenda" :style="{ background: COLOR_EFECTIVO }" />
          Efectivo
        </span>
        <span class="entrada-leyenda">
          <span class="marca-leyenda" :style="{ background: COLOR_TRANSFERENCIA }" />
          Transferencia
        </span>
      </div>
    </div>

    <svg
      :viewBox="`0 0 ${anchoTotal} ${altoTotal}`"
      class="lienzo"
      role="img"
      :aria-label="etiquetaAccesible"
    >
      <!-- Gridlines: hairline recesivo, nunca discontinuo, un paso mas claro que el fondo. -->
      <g class="rejilla">
        <g v-for="tick in ticksEje" :key="tick.valor">
          <line
            :x1="MARGEN_IZQUIERDO"
            :x2="anchoTotal"
            :y1="tick.y"
            :y2="tick.y"
            class="linea-rejilla"
          />
          <text :x="MARGEN_IZQUIERDO - 8" :y="tick.y + 4" class="etiqueta-eje" text-anchor="end">
            {{ tick.etiqueta }}
          </text>
        </g>
      </g>

      <g v-for="barra in barras" :key="barra.sede">
        <clipPath :id="`recorte-${barra.sede}`">
          <path :d="barra.recorte" />
        </clipPath>

        <g :clip-path="`url(#recorte-${barra.sede})`">
          <rect
            v-if="barra.efectivo.alto > 0"
            :x="barra.x"
            :y="barra.efectivo.y"
            :width="ANCHO_BARRA"
            :height="barra.efectivo.alto"
            :fill="COLOR_EFECTIVO"
            class="segmento"
          >
            <title>{{ barra.sedeNombre }} · Efectivo: {{ formatearMoneda(barra.montoEfectivo) }}</title>
          </rect>
          <rect
            v-if="barra.transferencia.alto > 0"
            :x="barra.x"
            :y="barra.transferencia.y"
            :width="ANCHO_BARRA"
            :height="barra.transferencia.alto"
            :fill="COLOR_TRANSFERENCIA"
            class="segmento"
          >
            <title>
              {{ barra.sedeNombre }} · Transferencia: {{ formatearMoneda(barra.montoTransferencia) }}
            </title>
          </rect>
          <rect
            v-if="barra.esCero"
            :x="barra.x"
            :y="ALTO_GRAFICA - 3"
            :width="ANCHO_BARRA"
            height="3"
            class="marca-cero"
          >
            <title>{{ barra.sedeNombre }} · Sin ingresos este mes</title>
          </rect>
        </g>

        <!-- Valor en el tope de la columna: cabe siempre, a diferencia de un segmento interno. -->
        <text
          :x="barra.x + ANCHO_BARRA / 2"
          :y="barra.yTope - 8"
          class="etiqueta-total"
          text-anchor="middle"
        >
          {{ formatearMonedaCorta(barra.total) }}
        </text>

        <text
          :x="barra.x + ANCHO_BARRA / 2"
          :y="ALTO_GRAFICA + 20"
          class="etiqueta-categoria"
          text-anchor="middle"
        >
          {{ barra.sedeNombre }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';

/**
 * Barras apiladas: una columna por sede, dividida en efectivo/transferencia.
 * Colores validados con el script de la skill dataviz (CVD y contraste
 * frente al fondo de la tarjeta) y elegidos fuera de la familia de tonos que
 * ya usan los estados de vencimiento (verde/ambar/rojo/azul), para que una
 * serie de pago nunca se confunda con un estado.
 */

const props = defineProps({
  filas: { type: Array, required: true }, // [{ sedeNombre, efectivo, transferencia, total }]
});

const COLOR_EFECTIVO = '#4a3aa7';
const COLOR_TRANSFERENCIA = '#eb6834';

const ANCHO_BARRA = 22;
const ESPACIO_ENTRE_BARRAS = 46;
const MARGEN_IZQUIERDO = 56;
const ALTO_GRAFICA = 180;
const ALTO_TOTAL_EXTRA = 46; // espacio para la etiqueta de categoria y el margen superior
const RADIO_ESQUINA = 4;
const HOLGURA_SEGMENTOS = 2;

const altoTotal = ALTO_GRAFICA + ALTO_TOTAL_EXTRA;

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

function formatearMoneda(valor) {
  return `$${FORMATO_PESOS.format(valor)}`;
}

function formatearMonedaCorta(valor) {
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (valor >= 1_000) return `$${Math.round(valor / 1_000)}K`;
  return `$${valor}`;
}

/** Redondea el techo del eje a un numero "limpio" (1/2/5 x 10^n), nunca al valor exacto. */
function calcularMaximoLimpio(valor) {
  if (valor <= 0) return 100_000;
  const magnitud = 10 ** Math.floor(Math.log10(valor));
  const normalizado = valor / magnitud;
  const escalones = [1, 2, 5, 10];
  const escalon = escalones.find((candidato) => normalizado <= candidato) ?? 10;
  return escalon * magnitud;
}

/** Rectangulo con solo las esquinas superiores redondeadas; la base queda cuadrada en el eje. */
function trazarBarraRedondeada(x, yTope, ancho, alto) {
  if (alto <= 0) return '';
  const radio = Math.min(RADIO_ESQUINA, alto / 2, ancho / 2);
  const yBase = yTope + alto;
  return [
    `M ${x} ${yBase}`,
    `L ${x} ${yTope + radio}`,
    `Q ${x} ${yTope} ${x + radio} ${yTope}`,
    `L ${x + ancho - radio} ${yTope}`,
    `Q ${x + ancho} ${yTope} ${x + ancho} ${yTope + radio}`,
    `L ${x + ancho} ${yBase}`,
    'Z',
  ].join(' ');
}

const maximoLimpio = computed(() =>
  calcularMaximoLimpio(Math.max(0, ...props.filas.map((fila) => fila.total))),
);

const anchoTotal = computed(
  () => MARGEN_IZQUIERDO + Math.max(1, props.filas.length) * ESPACIO_ENTRE_BARRAS,
);

const ticksEje = computed(() =>
  [0, 0.5, 1].map((fraccion) => ({
    valor: maximoLimpio.value * fraccion,
    y: ALTO_GRAFICA - ALTO_GRAFICA * fraccion,
    etiqueta: formatearMonedaCorta(maximoLimpio.value * fraccion),
  })),
);

function escalar(valor) {
  return (valor / maximoLimpio.value) * ALTO_GRAFICA;
}

const barras = computed(() =>
  props.filas.map((fila, indice) => {
    const x = MARGEN_IZQUIERDO + indice * ESPACIO_ENTRE_BARRAS + (ESPACIO_ENTRE_BARRAS - ANCHO_BARRA) / 2;

    const altoEfectivo = escalar(fila.efectivo);
    const altoTransferenciaBruto = escalar(fila.transferencia);
    const hayHolgura = altoEfectivo > 0 && altoTransferenciaBruto > 0;
    const altoTransferencia = hayHolgura
      ? Math.max(0, altoTransferenciaBruto - HOLGURA_SEGMENTOS)
      : altoTransferenciaBruto;

    const yEfectivo = ALTO_GRAFICA - altoEfectivo;
    const yTransferencia = yEfectivo - (hayHolgura ? HOLGURA_SEGMENTOS : 0) - altoTransferencia;

    const totalAlto = altoEfectivo + (hayHolgura ? HOLGURA_SEGMENTOS : 0) + altoTransferencia;
    const yTope = ALTO_GRAFICA - totalAlto;

    return {
      sede: fila.sede,
      sedeNombre: fila.sedeNombre,
      x,
      total: fila.total,
      montoEfectivo: fila.efectivo,
      montoTransferencia: fila.transferencia,
      esCero: fila.total === 0,
      efectivo: { y: yEfectivo, alto: altoEfectivo },
      transferencia: { y: yTransferencia, alto: altoTransferencia },
      yTope: fila.total === 0 ? ALTO_GRAFICA : yTope,
      recorte: trazarBarraRedondeada(x, yTope, ANCHO_BARRA, totalAlto),
    };
  }),
);

const etiquetaAccesible = computed(
  () =>
    `Ingresos del mes por sede: ${props.filas
      .map((fila) => `${fila.sedeNombre} ${formatearMoneda(fila.total)}`)
      .join(', ')}`,
);
</script>

<style scoped>
.grafica-ingresos {
  width: 100%;
}

.leyenda {
  display: flex;
  gap: 16px;
}

.entrada-leyenda {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #52514e;
}

.marca-leyenda {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}

.lienzo {
  width: 100%;
  height: auto;
  overflow: visible;
}

.linea-rejilla {
  stroke: #e1e0d9;
  stroke-width: 1;
}

.etiqueta-eje,
.etiqueta-categoria {
  font-size: 10px;
  fill: #898781;
}

.etiqueta-total {
  font-size: 11px;
  font-weight: 600;
  fill: #0b0b0b;
}

.segmento {
  transition: opacity 0.15s ease;
}

.segmento:hover {
  opacity: 0.85;
}

.marca-cero {
  fill: #c3c2b7;
}
</style>
