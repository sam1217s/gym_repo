<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Reportes</h1>
        <div class="text-caption text-grey-7">
          Maquinas que tus encargados reportaron en mantenimiento o dañadas
        </div>
      </div>
    </div>

    <div v-if="gimnasio.reportesMaquina.length === 0 && !cargando" class="estado-vacio">
      <q-icon name="check_circle" size="42px" color="positive" />
      <div class="q-mt-sm">No hay reportes. Todo tu equipo esta operativo.</div>
    </div>

    <q-list v-else bordered separator class="rounded-borders">
      <q-item v-for="reporte in gimnasio.reportesMaquina" :key="reporte._id" class="reporte">
        <q-item-section avatar>
          <q-avatar :color="COLOR_ESTADO[reporte.estado]" text-color="white" :icon="ICONO_ESTADO[reporte.estado]" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-medium">
            {{ reporte.nombreMaquina }}
            <span class="chip-banda q-ml-sm" :style="{ '--banda': `var(--q-${COLOR_ESTADO[reporte.estado]})` }">
              {{ ETIQUETA_ESTADO[reporte.estado] }}
            </span>
            <!-- Como esta HOY: si ya se arreglo, el reporte queda resuelto. -->
            <q-badge v-if="reporte.estadoActual === 'operativa'" color="positive" class="q-ml-sm">
              Resuelta
            </q-badge>
            <q-badge
              v-else-if="reporte.estadoActual && reporte.estadoActual !== reporte.estado"
              outline
              :color="COLOR_ESTADO[reporte.estadoActual]"
              class="q-ml-sm"
            >
              Ahora: {{ ETIQUETA_ESTADO[reporte.estadoActual] }}
            </q-badge>
          </q-item-label>
          <q-item-label caption>
            {{ nombreSede(reporte.sede) }} · Reporto {{ reporte.reportadoPorNombre }}
          </q-item-label>
          <q-item-label v-if="reporte.nota" class="q-mt-xs nota">"{{ reporte.nota }}"</q-item-label>
        </q-item-section>

        <q-item-section side top>
          <div class="text-caption text-grey-7">{{ formatearFecha(reporte.createdAt) }}</div>
          <q-btn
            v-if="reporte.estadoActual"
            flat
            dense
            no-caps
            size="sm"
            color="primary"
            icon="swap_horiz"
            label="Cambiar estado"
            class="q-mt-sm"
            @click="cambiarEstado(reporte)"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';

import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Panel de reportes de maquinas del dueño. Al abrirlo se marcan todos como
 * leidos: dejan de dispararle la notificacion de inicio de sesion, aunque el
 * equipo siga sin arreglarse. El reporte no se borra: sigue aqui para consultarlo.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const cargando = ref(false);

const ETIQUETA_ESTADO = { mantenimiento: 'En mantenimiento', danada: 'Dañada' };
const COLOR_ESTADO = { mantenimiento: 'warning', danada: 'negative' };
const ICONO_ESTADO = { mantenimiento: 'build', danada: 'report' };

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatearFecha(valor) {
  return valor ? FORMATO_FECHA.format(new Date(valor)) : '—';
}

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? 'Sede';
}

const OPCIONES_ESTADO = [
  { label: 'Operativa', value: 'operativa' },
  { label: 'En mantenimiento', value: 'mantenimiento' },
  { label: 'Dañada', value: 'danada' },
];

/**
 * El dueño resuelve el caso desde aqui: cambia el estado de LA MAQUINA (unica
 * fuente de verdad). El reporte no se toca: conserva su foto de lo que se
 * reporto, y solo cambia el `estadoActual` que se recalcula al recargar.
 */
function cambiarEstado(reporte) {
  quasar
    .dialog({
      title: `Estado — ${reporte.nombreMaquina}`,
      message: '¿Como esta el equipo ahora?',
      options: { type: 'radio', model: reporte.estadoActual, items: OPCIONES_ESTADO },
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'primary', unelevated: true, noCaps: true, label: 'Guardar' },
    })
    .onOk(async (estado) => {
      if (!estado || estado === reporte.estadoActual) return;
      try {
        await gimnasio.actualizarMaquina(reporte.maquina, { estado });
        // Se recarga para refrescar el estado actual de TODOS los reportes de
        // esa maquina, no solo el de la fila tocada.
        await gimnasio.cargarReportesMaquina();
        quasar.notify({ type: 'positive', message: 'Estado actualizado' });
      } catch (error) {
        quasar.notify({
          type: 'negative',
          message: error.response?.data?.error?.mensaje ?? 'No se pudo actualizar',
        });
      }
    });
}

onMounted(async () => {
  cargando.value = true;
  try {
    await Promise.all([gimnasio.cargarReportesMaquina(), gimnasio.cargarSedes().catch(() => {})]);
    // Abrir el panel es "leerlos": no vuelven a notificar en el proximo login.
    if (gimnasio.reportesNoLeidos > 0) await gimnasio.marcarReportesLeidos();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los reportes' });
  } finally {
    cargando.value = false;
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 900px;
  margin: 0 auto;
}

.estado-vacio {
  text-align: center;
  padding: 48px 16px;
  color: var(--q-secondary);
}

.reporte {
  border-left: 3px solid transparent;
}

.nota {
  font-style: italic;
  color: var(--q-secondary);
}
</style>
