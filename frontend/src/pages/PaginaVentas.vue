<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Ventas</h1>
        <div class="text-caption text-grey-7">Productos vendidos en el mostrador, por sede</div>
      </div>

      <q-input v-model="fecha" type="date" outlined dense label="Dia" style="max-width: 190px" @update:model-value="cargar" />
    </div>

    <!-- Resumen del dia: la cifra heroe va en la sans del cuerpo, no en display. -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-12 col-sm-4">
        <q-card flat bordered class="tarjeta-cifra">
          <q-card-section>
            <div class="ceja">Total del dia</div>
            <div class="cifra-heroe">${{ FORMATO_PESOS.format(gimnasio.resumenVentas.total) }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-sm-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="ceja">Unidades</div>
            <div class="cifra-heroe cifra-tabular">{{ gimnasio.resumenVentas.unidades }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-sm-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="ceja">Operaciones</div>
            <div class="cifra-heroe cifra-tabular">{{ gimnasio.resumenVentas.operaciones }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.ventas"
      :columns="columnas"
      :loading="cargando"
      :pagination="{ rowsPerPage: 25, sortBy: 'hora', descending: true }"
      no-data-label="No hay ventas en este dia."
    />
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';

import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Ventas de productos, por sede. El backend acota por sede segun el rol: un
 * sede_admin solo ve las de la suya. Es un flujo de dinero DISTINTO de la
 * mensualidad del miembro y de la suscripcion del gimnasio a la plataforma.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const FORMATO_PESOS = new Intl.NumberFormat('es-CO');
const cargando = ref(false);

// Por defecto, HOY (en formato YYYY-MM-DD, lo que espera <input type="date">).
const fecha = ref(new Date().toLocaleDateString('en-CA'));

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? '—';
}

const columnas = [
  {
    name: 'hora',
    label: 'Hora',
    field: 'createdAt',
    align: 'left',
    sortable: true,
    format: (valor) => new Date(valor).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
  },
  { name: 'producto', label: 'Producto', field: 'nombreProducto', align: 'left', sortable: true },
  { name: 'sede', label: 'Sede', field: (fila) => nombreSede(fila.sede), align: 'left' },
  { name: 'cantidad', label: 'Cantidad', field: 'cantidad', align: 'right', sortable: true, classes: 'cifra-tabular' },
  {
    name: 'precioUnitario',
    label: 'Precio unit.',
    field: 'precioUnitario',
    align: 'right',
    format: (valor) => `$${FORMATO_PESOS.format(valor)}`,
    classes: 'cifra-tabular',
  },
  {
    name: 'total',
    label: 'Total',
    field: 'total',
    align: 'right',
    sortable: true,
    format: (valor) => `$${FORMATO_PESOS.format(valor)}`,
    classes: 'cifra-tabular text-weight-medium',
  },
];

async function cargar() {
  cargando.value = true;
  try {
    // `fecha` es un dia civil; se manda como desde=hasta para acotar a ese dia.
    await gimnasio.cargarVentas({ desde: fecha.value, hasta: fecha.value });
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar las ventas' });
  } finally {
    cargando.value = false;
  }
}

onMounted(async () => {
  await Promise.all([gimnasio.cargarSedes().catch(() => {}), cargar()]);
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.tarjeta-cifra {
  border-top: 4px solid var(--q-primary);
}

/* La cifra heroe va en la sans del cuerpo, nunca en Barlow Condensed. */
.cifra-heroe {
  font-size: 2.2rem;
  font-weight: 600;
  line-height: 1.1;
  margin-top: 4px;
}
</style>
