<template>
  <q-page padding class="pagina-panel">
    <!-- El super_admin no pertenece a ningun gimnasio: los reportes de aqui
         son tenant-scoped, asi que ve solo su sesion. -->
    <template v-if="esSuperAdmin">
      <div class="text-h5 q-mb-md">Hola, {{ usuario?.nombres }}</div>

      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2 text-grey-7">Sesion actual</div>
        </q-card-section>
        <q-separator />
        <q-list dense>
          <q-item v-for="dato in datosSesion" :key="dato.etiqueta">
            <q-item-section>{{ dato.etiqueta }}</q-item-section>
            <q-item-section side class="text-weight-medium">{{ dato.valor }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </template>

    <template v-else>
      <div class="q-mb-lg">
        <div class="ceja">Este mes</div>
        <div class="hero-cifra">{{ totalMesLegible }}</div>
        <div class="text-caption text-grey-7">Ingresos totales, {{ nombreMesActual }}</div>
      </div>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-md-7">
          <q-card flat bordered class="q-pa-md">
            <GraficaIngresos v-if="!cargando" :filas="ingresosPorSede" />
            <q-skeleton v-else type="rect" height="220px" />
          </q-card>
        </div>

        <div class="col-12 col-md-5">
          <q-card flat bordered class="q-pa-md full-height">
            <div class="text-subtitle2 text-grey-8 q-mb-md">Miembros activos</div>

            <div class="fila-discos">
              <div v-for="resumen in discosEstado" :key="resumen.estado" class="celda-disco">
                <div class="disco disco-chico" :style="{ borderColor: resumen.color }">
                  <span class="titulo-display numero-disco-chico cifra-tabular">{{ resumen.total }}</span>
                </div>
                <div class="etiqueta-disco">{{ resumen.etiqueta }}</div>
              </div>
            </div>

            <q-separator class="q-my-md" />

            <q-item dense class="q-px-none">
              <q-item-section>Total de miembros activos</q-item-section>
              <q-item-section side class="text-weight-bold cifra-tabular">
                {{ conteoMiembros.total }}
              </q-item-section>
            </q-item>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted } from 'vue';

import GraficaIngresos from 'src/components/GraficaIngresos.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * El dashboard real de la Fase 4: ingresos del mes por sede (split efectivo
 * vs transferencia) y el conteo de miembros por estado de vencimiento. El
 * alcance por sede lo decide el backend: un sede_admin recibe aqui solo su
 * sede; el dueno ve el consolidado de todo el gimnasio.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();
const { usuario } = useAutenticacion();

const SIN_DATO = '—';
const cargando = computed(() => gimnasio.reportePanel === null);

const esSuperAdmin = computed(() => usuario.value?.rol === ROLES.SUPER_ADMIN);

const datosSesion = computed(() => [
  { etiqueta: 'Correo', valor: usuario.value?.email ?? SIN_DATO },
  { etiqueta: 'Rol', valor: usuario.value?.rol ?? SIN_DATO },
]);

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const NOMBRE_MES = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date());

const nombreMesActual = computed(() => NOMBRE_MES);

const ingresosPorSede = computed(() => gimnasio.reportePanel?.ingresosPorSede ?? []);
const totalMesLegible = computed(() => `$${FORMATO_PESOS.format(gimnasio.reportePanel?.totalMes ?? 0)}`);

const conteoMiembros = computed(
  () =>
    gimnasio.reportePanel?.miembros ?? {
      total: 0,
      al_dia: 0,
      por_vencer: 0,
      vencido: 0,
      sin_pagos: 0,
    },
);

/** Mismos colores de "banda de disco" que ya usa la pantalla de miembros. */
const APARIENCIA_ESTADO = {
  al_dia: { etiqueta: 'Al dia', color: 'var(--q-positive)' },
  por_vencer: { etiqueta: 'Por vencer', color: 'var(--q-warning)' },
  vencido: { etiqueta: 'Vencidos', color: 'var(--q-negative)' },
  sin_pagos: { etiqueta: 'Sin pagos', color: '#667085' },
};

const discosEstado = computed(() =>
  Object.entries(APARIENCIA_ESTADO).map(([estado, apariencia]) => ({
    estado,
    etiqueta: apariencia.etiqueta,
    color: apariencia.color,
    total: conteoMiembros.value[estado] ?? 0,
  })),
);

onMounted(async () => {
  if (esSuperAdmin.value) return;

  try {
    await gimnasio.cargarReportePanel();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar el reporte' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.hero-cifra {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1.1;
  color: #1b1e24;
}

.full-height {
  height: 100%;
}

.disco-chico {
  width: 60px;
  height: 60px;
  border-width: 5px;
}

.numero-disco-chico {
  font-size: 1.3rem;
  color: #1b1e24;
}
</style>
