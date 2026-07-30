<template>
  <q-page padding class="pagina-panel">
    <div class="q-mb-lg">
      <div class="ceja">Tu suscripcion</div>
      <h1 class="titulo-display titulo-pagina q-my-none">Facturacion</h1>
      <div class="text-caption text-grey-7">Lo que tu gimnasio le paga a GymSaaS</div>
    </div>

    <!-- Si esta suspendido, esto es lo primero y lo unico que importa. -->
    <q-banner v-if="estaSuspendido" class="aviso-suspendido q-mb-lg">
      <template #avatar><q-icon name="lock" color="negative" size="28px" /></template>
      <div class="text-weight-bold">Tu gimnasio esta suspendido</div>
      <div class="text-body2">
        Mientras haya una factura vencida, tu equipo no puede registrar miembros ni cobrar
        mensualidades. Paga la factura pendiente y el acceso vuelve de inmediato.
      </div>
    </q-banner>

    <q-skeleton v-if="cargando" type="rect" height="180px" />

    <template v-else>
      <!-- La factura pendiente es la accion; el resto es historia. -->
      <q-card v-if="facturaPendiente" flat bordered class="tarjeta-pendiente q-mb-lg">
        <div class="row items-center justify-between q-col-gutter-md">
          <div>
            <div class="ceja">Pendiente de pago</div>
            <div class="monto-pendiente">{{ formatearMoneda(facturaPendiente.monto) }}</div>
            <div class="text-caption text-grey-7">
              {{ describirPeriodo(facturaPendiente) }} ·
              <span :class="{ 'text-weight-bold text-negative': estaVencida(facturaPendiente) }">
                {{ describirVencimiento(facturaPendiente) }}
              </span>
            </div>
          </div>

          <q-btn
            color="primary"
            unelevated
            no-caps
            size="lg"
            icon-right="open_in_new"
            label="Pagar con Wompi"
            :loading="generandoEnlace"
            @click="pagar(facturaPendiente)"
          />
        </div>
      </q-card>

      <q-banner v-else-if="!estaSuspendido" class="al-dia q-mb-lg">
        <template #avatar><q-icon name="check_circle" color="positive" size="24px" /></template>
        No tienes facturas pendientes. Tu suscripcion esta al dia.
      </q-banner>

      <div class="ceja q-mb-sm">Historial</div>
      <q-table
        flat
        bordered
        row-key="_id"
        :rows="facturas"
        :columns="COLUMNAS"
        :pagination="{ rowsPerPage: 12 }"
        :hide-bottom="facturas.length <= 12"
        no-data-label="Todavia no se ha emitido ninguna factura."
      >
        <template #body-cell-estado="props">
          <q-td :props="props">
            <span class="chip-banda" :style="{ '--banda': APARIENCIA[props.row.estado].color }">
              {{ APARIENCIA[props.row.estado].etiqueta }}
            </span>
          </q-td>
        </template>

        <template #body-cell-referencia="props">
          <q-td :props="props">
            <div class="cifra-tabular text-caption">{{ props.row.referencia }}</div>
            <div v-if="props.row.detalleFallo" class="text-caption text-negative">
              {{ props.row.detalleFallo }}
            </div>
          </q-td>
        </template>
      </q-table>
    </template>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import * as servicioFacturacion from 'src/servicios/facturacion.servicio.js';

/**
 * Facturacion del gimnasio. Es la UNICA pantalla que un gimnasio suspendido
 * alcanza: el backend le cierra el resto hasta que se ponga al dia.
 *
 * El enlace de pago lo firma el backend (el secreto de integridad de Wompi no
 * puede pisar el navegador); aqui solo se abre.
 */

const quasar = useQuasar();

const cargando = ref(true);
const generandoEnlace = ref(false);
const facturas = ref([]);
const facturaPendiente = ref(null);
const estadoGimnasio = ref(null);

const estaSuspendido = computed(() => estadoGimnasio.value === 'suspendido');

const APARIENCIA = {
  pendiente: { etiqueta: 'Pendiente', color: 'var(--q-warning)' },
  pagada: { etiqueta: 'Pagada', color: 'var(--q-positive)' },
  fallida: { etiqueta: 'Fallida', color: 'var(--q-negative)' },
  anulada: { etiqueta: 'Anulada', color: '#667085' },
};

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const FORMATO_MES = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

function formatearMoneda(valor) {
  return `$${FORMATO_PESOS.format(valor)}`;
}

function describirPeriodo(factura) {
  return FORMATO_MES.format(new Date(factura.periodoInicio));
}

function estaVencida(factura) {
  return new Date(factura.fechaVencimiento) < new Date();
}

function describirVencimiento(factura) {
  const dias = Math.ceil((new Date(factura.fechaVencimiento) - Date.now()) / MILISEGUNDOS_POR_DIA);

  if (dias < 0) return `vencio hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'vence hoy';
  return `vence en ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

const COLUMNAS = [
  {
    name: 'periodo',
    label: 'Periodo',
    field: (fila) => describirPeriodo(fila),
    align: 'left',
    sortable: true,
  },
  {
    name: 'monto',
    label: 'Monto',
    field: 'monto',
    align: 'right',
    format: formatearMoneda,
    classes: 'cifra-tabular',
    sortable: true,
  },
  {
    name: 'vencimiento',
    label: 'Vence',
    field: 'fechaVencimiento',
    align: 'left',
    format: (valor) => FORMATO_FECHA.format(new Date(valor)),
    sortable: true,
  },
  {
    name: 'pagada',
    label: 'Pagada el',
    field: 'pagadaEn',
    align: 'left',
    format: (valor) => (valor ? FORMATO_FECHA.format(new Date(valor)) : '—'),
  },
  { name: 'referencia', label: 'Referencia', field: 'referencia', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
];

async function pagar(factura) {
  generandoEnlace.value = true;
  try {
    const url = await servicioFacturacion.obtenerEnlaceDePago(factura._id);
    // Se abre en la misma pestaña: Wompi devuelve al panel al terminar.
    window.location.assign(url);
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo generar el enlace de pago',
    });
    generandoEnlace.value = false;
  }
}

onMounted(async () => {
  try {
    const datos = await servicioFacturacion.misFacturas();
    facturas.value = datos.facturas;
    facturaPendiente.value = datos.facturaPendiente;
    estadoGimnasio.value = datos.estadoGimnasio;
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar la facturacion' });
  } finally {
    cargando.value = false;
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.aviso-suspendido {
  background: rgba(143, 29, 20, 0.06);
  border-left: 4px solid var(--q-negative);
  border-radius: 4px;
}

.al-dia {
  background: rgba(31, 122, 70, 0.06);
  border-left: 4px solid var(--q-positive);
  border-radius: 4px;
}

.tarjeta-pendiente {
  padding: 22px;
  border-top: 4px solid var(--q-primary);
  border-radius: 4px;
}

.monto-pendiente {
  font-size: 2.4rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #0b0b0b;
}
</style>
