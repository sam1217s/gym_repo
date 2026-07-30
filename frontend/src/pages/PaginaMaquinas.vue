<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Maquinas</h1>
        <div class="text-caption text-grey-7">Equipos e implementos y su estado, por sede</div>
      </div>

      <q-btn color="primary" unelevated no-caps icon="add" label="Nueva maquina" @click="abrirCreacion" />
    </div>

    <!-- Resumen: cuantas necesitan atencion. -->
    <div v-if="conAtencion > 0" class="banner-atencion q-mb-md">
      <q-icon name="build" size="20px" class="q-mr-sm" />
      {{ conAtencion }} {{ conAtencion === 1 ? 'equipo requiere' : 'equipos requieren' }} atencion
      (mantenimiento o dañados).
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.maquinas"
      :columns="columnasResponsivas"
      :pagination="{ rowsPerPage: 20 }"
      :hide-bottom="gimnasio.maquinas.length <= 20"
      no-data-label="Aun no hay maquinas. Registra la primera."
    >
      <template #body-cell-estado="props">
        <q-td :props="props">
          <span class="chip-banda" :style="{ '--banda': COLOR_ESTADO[props.row.estado] }">
            {{ ETIQUETA_ESTADO[props.row.estado] }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn round flat dense color="grey-8" icon="swap_horiz" @click="cambiarEstado(props.row)">
            <q-tooltip>Cambiar estado</q-tooltip>
          </q-btn>
          <q-btn round flat dense color="grey-8" icon="edit" @click="abrirEdicion(props.row)">
            <q-tooltip>Editar</q-tooltip>
          </q-btn>
          <q-btn round flat dense color="negative" icon="archive" @click="confirmarArchivado(props.row)">
            <q-tooltip>Archivar</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogoAbierto">
      <q-card class="tarjeta-maquina">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">{{ editando ? 'Editar maquina' : 'Nueva maquina' }}</div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardar">
          <q-card-section class="q-gutter-y-md">
            <q-input v-model="formulario.nombre" label="Nombre del equipo" outlined dense :rules="[reglaObligatorio]" />

            <q-select
              v-if="!editando && sedesVisibles"
              v-model="formulario.sede"
              label="Sede"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSede"
              :rules="[reglaObligatorio]"
            />

            <q-select
              v-model="formulario.estado"
              label="Estado"
              outlined
              dense
              emit-value
              map-options
              :options="OPCIONES_ESTADO"
            />

            <q-input
              v-model="formulario.nota"
              label="Nota (opcional)"
              type="textarea"
              autogrow
              outlined
              dense
              hint="Detalle de la falla o el mantenimiento pendiente"
            />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoAbierto = false" />
            <q-btn type="submit" color="primary" unelevated no-caps :label="editando ? 'Guardar' : 'Crear'" :loading="guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';
import { ROLES } from 'src/stores/autenticacion.js';
import { useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Maquinas del gimnasio, por sede, con su estado de mantenimiento. El backend
 * acota por sede segun el rol: un sede_admin solo ve y toca lo de la suya.
 */

const gimnasio = useGimnasioStore();
const autenticacion = useAutenticacionStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);
const editando = ref(false);
const guardando = ref(false);
const maquinaActiva = ref(null);

// Los estados y su lenguaje visual: reutilizan las bandas de disco (verde =
// bien, ambar = ojo, rojo = parada), igual que los estados de vencimiento.
const ETIQUETA_ESTADO = {
  operativa: 'Operativa',
  mantenimiento: 'En mantenimiento',
  danada: 'Dañada',
};
const COLOR_ESTADO = {
  operativa: 'var(--q-positive)',
  mantenimiento: 'var(--q-warning)',
  danada: 'var(--q-negative)',
};
const OPCIONES_ESTADO = [
  { label: 'Operativa', value: 'operativa' },
  { label: 'En mantenimiento', value: 'mantenimiento' },
  { label: 'Dañada', value: 'danada' },
];

const conAtencion = computed(
  () => gimnasio.maquinas.filter((maquina) => maquina.estado !== 'operativa').length,
);

// El dueno elige sede; al sede_admin se la fuerza el backend, asi no la muestra.
const sedesVisibles = computed(() => autenticacion.usuario?.rol === ROLES.TENANT_OWNER);

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? '—';
}

const COLUMNAS = [
  { name: 'nombre', label: 'Equipo', field: 'nombre', align: 'left', sortable: true },
  { name: 'sede', label: 'Sede', field: (fila) => nombreSede(fila.sede), align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
  { name: 'nota', label: 'Nota', field: 'nota', align: 'left', format: (valor) => valor || '—' },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const columnasResponsivas = useColumnasResponsive(COLUMNAS);

const opcionesSede = computed(() =>
  gimnasio.sedes.filter((sede) => sede.activa).map((sede) => ({ label: sede.nombre, value: sede._id })),
);

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';

const formulario = reactive({ nombre: '', sede: null, estado: 'operativa', nota: '' });

function abrirCreacion() {
  editando.value = false;
  maquinaActiva.value = null;
  Object.assign(formulario, { nombre: '', sede: null, estado: 'operativa', nota: '' });
  dialogoAbierto.value = true;
}

function abrirEdicion(maquina) {
  editando.value = true;
  maquinaActiva.value = maquina;
  Object.assign(formulario, {
    nombre: maquina.nombre,
    sede: maquina.sede,
    estado: maquina.estado,
    nota: maquina.nota ?? '',
  });
  dialogoAbierto.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    if (editando.value) {
      await gimnasio.actualizarMaquina(maquinaActiva.value._id, {
        nombre: formulario.nombre,
        estado: formulario.estado,
        nota: formulario.nota.trim(),
      });
      quasar.notify({ type: 'positive', message: 'Maquina actualizada' });
    } else {
      await gimnasio.crearMaquina({
        nombre: formulario.nombre,
        estado: formulario.estado,
        ...(formulario.sede ? { sede: formulario.sede } : {}),
        ...(formulario.nota.trim() ? { nota: formulario.nota.trim() } : {}),
      });
      quasar.notify({ type: 'positive', message: 'Maquina registrada' });
    }
    dialogoAbierto.value = false;
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar' });
  } finally {
    guardando.value = false;
  }
}

/** Cambio rapido de estado sin abrir el formulario entero. */
function cambiarEstado(maquina) {
  quasar
    .dialog({
      title: `Estado — ${maquina.nombre}`,
      message: '¿Como esta el equipo ahora?',
      options: { type: 'radio', model: maquina.estado, items: OPCIONES_ESTADO },
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'primary', unelevated: true, noCaps: true, label: 'Guardar' },
    })
    .onOk(async (estado) => {
      if (estado === maquina.estado) return;
      try {
        await gimnasio.actualizarMaquina(maquina._id, { estado });
        quasar.notify({ type: 'positive', message: 'Estado actualizado' });
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo actualizar' });
      }
    });
}

function confirmarArchivado(maquina) {
  quasar
    .dialog({
      title: `Archivar ${maquina.nombre}`,
      message: 'Dejara de aparecer en la lista. No se borra el historial.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Archivar' },
    })
    .onOk(async () => {
      try {
        await gimnasio.archivarMaquina(maquina._id);
        quasar.notify({ type: 'positive', message: 'Maquina archivada' });
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo archivar' });
      }
    });
}

onMounted(async () => {
  try {
    await Promise.all([gimnasio.cargarMaquinas(), gimnasio.cargarSedes()]);
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar las maquinas' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.tarjeta-maquina {
  width: 100%;
  max-width: 480px;
  border-top: 4px solid var(--q-primary);
}

.banner-atencion {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-left: 4px solid var(--q-warning);
  background: #fff8ec;
  border-radius: 4px;
  color: #7a5b12;
  font-weight: 500;
}
</style>
