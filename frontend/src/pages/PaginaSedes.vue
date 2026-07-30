<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Sedes</h1>
        <div class="text-caption text-grey-7">{{ gimnasio.sedes.length }} en total</div>
      </div>

      <q-btn color="primary" unelevated no-caps icon="add" label="Nueva sede" @click="abrirCreacion" />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.sedes"
      :columns="columnasResponsivas"
      :pagination="{ rowsPerPage: 15 }"
      :hide-bottom="gimnasio.sedes.length <= 15"
      no-data-label="Aun no hay sedes."
    >
      <template #body-cell-estado="props">
        <q-td :props="props">
          <span
            class="chip-banda"
            :style="{ '--banda': props.row.activa ? 'var(--q-positive)' : '#667085' }"
          >
            {{ props.row.activa ? 'Activa' : 'Inactiva' }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn round flat dense color="grey-8" icon="edit" @click="abrirEdicion(props.row)">
            <q-tooltip>Editar</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogoAbierto">
      <q-card class="tarjeta-sede">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">{{ editando ? 'Editar sede' : 'Nueva sede' }}</div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardar">
          <q-card-section class="q-gutter-y-sm">
            <q-input v-model="formulario.nombre" label="Nombre" outlined dense :rules="[reglaObligatorio]" />
            <q-input v-model="formulario.direccion" label="Direccion" outlined dense :rules="[reglaObligatorio]" />
            <q-input v-model="formulario.telefono" label="Telefono (opcional)" outlined dense />
            <q-toggle v-if="editando" v-model="formulario.activa" label="Sede activa" />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoAbierto = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              :label="editando ? 'Guardar cambios' : 'Crear sede'"
              :loading="guardando"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { onMounted, reactive, ref } from 'vue';

import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';

import { useGimnasioStore } from 'src/stores/gimnasio.js';

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);
const editando = ref(false);
const guardando = ref(false);
const sedeActiva = ref(null);

const COLUMNAS = [
  { name: 'nombre', label: 'Sede', field: 'nombre', align: 'left', sortable: true },
  { name: 'direccion', label: 'Direccion', field: 'direccion', align: 'left' },
  { name: 'telefono', label: 'Telefono', field: (fila) => fila.telefono || '—', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'activa', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

// En movil, la columna de acciones va primero (ver el composable).
const columnasResponsivas = useColumnasResponsive(COLUMNAS);

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';

const formulario = reactive({ nombre: '', direccion: '', telefono: '', activa: true });

function abrirCreacion() {
  editando.value = false;
  sedeActiva.value = null;
  Object.assign(formulario, { nombre: '', direccion: '', telefono: '', activa: true });
  dialogoAbierto.value = true;
}

function abrirEdicion(sede) {
  editando.value = true;
  sedeActiva.value = sede;
  Object.assign(formulario, {
    nombre: sede.nombre,
    direccion: sede.direccion,
    telefono: sede.telefono ?? '',
    activa: sede.activa,
  });
  dialogoAbierto.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    const datos = {
      nombre: formulario.nombre,
      direccion: formulario.direccion,
      ...(formulario.telefono.trim() ? { telefono: formulario.telefono } : {}),
    };

    if (editando.value) {
      await gimnasio.actualizarSede(sedeActiva.value._id, { ...datos, activa: formulario.activa });
      quasar.notify({ type: 'positive', message: 'Sede actualizada' });
    } else {
      await gimnasio.crearSede(datos);
      quasar.notify({ type: 'positive', message: 'Sede creada' });
    }

    dialogoAbierto.value = false;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar la sede',
    });
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  try {
    await gimnasio.cargarSedes();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar las sedes' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.tarjeta-sede {
  width: 100%;
  max-width: 440px;
  border-top: 4px solid var(--q-primary);
}
</style>
