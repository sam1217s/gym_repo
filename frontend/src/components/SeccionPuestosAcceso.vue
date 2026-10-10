<template>
  <div>
    <div class="row items-end justify-between q-mb-md">
      <div>
        <div class="text-h6 titulo-display">Puestos de entrada</div>
        <div class="text-caption text-grey-7">
          El PC de la puerta de cada sede, con el lector de huella. Para conectar uno, instala
          ahi <b>GymBarichara Puerta</b>, abrelo y pulsa «Vincular este equipo».
        </div>
      </div>
      <div class="row q-gutter-sm">
        <q-btn
          outline
          color="secondary"
          no-caps
          icon="download"
          label="Descargar instalador"
          href="/descargas/InstalarPuertaGymBarichara.exe"
          download
        >
          <q-tooltip>Para el PC de la puerta, con el lector conectado (Windows, ~37 MB)</q-tooltip>
        </q-btn>
        <q-btn color="primary" unelevated no-caps icon="add" label="Nuevo puesto" @click="abrirCreacion" />
      </div>
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="puestos"
      :columns="COLUMNAS"
      :loading="cargando"
      hide-bottom
      no-data-label="Aun no hay puestos de entrada."
    >
      <template #body-cell-estado="props">
        <q-td :props="props">
          <span class="chip-banda" :style="{ '--banda': props.row.activo ? 'var(--q-positive)' : '#667085' }">
            {{ props.row.activo ? 'Activo' : 'Desactivado' }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn round flat dense color="grey-8" icon="key" @click="regenerar(props.row)">
            <q-tooltip>Generar token nuevo</q-tooltip>
          </q-btn>
          <q-btn v-if="props.row.activo" round flat dense color="grey-8" icon="block" @click="desactivar(props.row)">
            <q-tooltip>Desactivar</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Alta -->
    <q-dialog v-model="dialogoCreacion">
      <q-card class="tarjeta-puesto">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Nuevo puesto de entrada</div>
        </q-card-section>
        <q-separator />
        <q-form @submit.prevent="crear">
          <q-card-section class="q-gutter-y-sm">
            <q-input v-model="formulario.nombre" label="Nombre" hint="Ej: Puerta principal" outlined dense :rules="[reglaObligatorio]" />
            <q-select
              v-model="formulario.sede"
              label="Sede"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSede"
              :rules="[reglaObligatorio]"
            />
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoCreacion = false" />
            <q-btn type="submit" color="primary" unelevated no-caps label="Crear puesto" :loading="guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- El token se ve UNA sola vez -->
    <q-dialog v-model="dialogoToken" persistent>
      <q-card class="tarjeta-puesto">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Token de {{ tokenMostrado.nombre }}</div>
          <div class="text-caption text-negative text-weight-medium">
            Copialo ahora: no se vuelve a mostrar. Si lo pierdes, genera uno nuevo.
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-xs">
            Normalmente no hace falta: en el PC de la puerta abre <b>GymBarichara Puerta</b> y pulsa
            «Vincular este equipo». Este token es solo para configurarlo a mano:
          </div>
          <div class="caja-token">{{ tokenMostrado.token }}</div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps icon="content_copy" label="Copiar" @click="copiar" />
          <q-btn color="primary" unelevated no-caps label="Ya lo guarde" @click="dialogoToken = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { copyToClipboard, useQuasar } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import {
  crearPuestoAcceso,
  desactivarPuestoAcceso,
  listarPuestosAcceso,
  regenerarTokenPuesto,
} from 'src/servicios/gimnasio.servicio.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Puestos de entrada (solo el dueño). El backend guarda solo el hash del token,
 * asi que se muestra una vez al crearlo o regenerarlo, y desactivar el puesto lo
 * deja sin servir al instante (por si se pierde o se roban el PC).
 */

const quasar = useQuasar();
const gimnasio = useGimnasioStore();

const puestos = ref([]);
const cargando = ref(false);
const guardando = ref(false);
const dialogoCreacion = ref(false);
const dialogoToken = ref(false);
const tokenMostrado = reactive({ nombre: '', token: '' });
const formulario = reactive({ nombre: '', sede: null });

const COLUMNAS = [
  { name: 'nombre', label: 'Puesto', field: 'nombre', align: 'left' },
  { name: 'sede', label: 'Sede', field: (fila) => fila.sede?.nombre ?? '—', align: 'left' },
  { name: 'conexion', label: 'Ultima conexion', field: 'ultimaConexion', format: (valor) => fechaHora(valor), align: 'left' },
  { name: 'estado', label: 'Estado', field: 'activo', align: 'left' },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const opcionesSede = computed(() => gimnasio.sedes.map((sede) => ({ label: sede.nombre, value: sede._id })));
const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';

function fechaHora(valor) {
  return valor ? new Date(valor).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca';
}

const mensajeError = (error, porDefecto) => error.response?.data?.error?.mensaje ?? porDefecto;

async function cargar() {
  cargando.value = true;
  try {
    puestos.value = await listarPuestosAcceso();
  } catch (error) {
    quasar.notify({ type: 'negative', message: mensajeError(error, 'No se pudieron cargar los puestos') });
  } finally {
    cargando.value = false;
  }
}

function mostrarToken({ puesto, token }) {
  Object.assign(tokenMostrado, { nombre: puesto.nombre, token });
  dialogoToken.value = true;
}

function abrirCreacion() {
  Object.assign(formulario, { nombre: '', sede: null });
  dialogoCreacion.value = true;
}

async function crear() {
  guardando.value = true;
  try {
    const creado = await crearPuestoAcceso({ ...formulario });
    dialogoCreacion.value = false;
    mostrarToken(creado);
    await cargar();
  } catch (error) {
    quasar.notify({ type: 'negative', message: mensajeError(error, 'No se pudo crear el puesto') });
  } finally {
    guardando.value = false;
  }
}

function regenerar(puesto) {
  quasar
    .dialog({
      title: 'Generar token nuevo',
      message: `El token actual de "${puesto.nombre}" dejara de servir. Tendras que poner el nuevo en el PC de la puerta.`,
      cancel: { flat: true, noCaps: true, label: 'Cancelar' },
      ok: { color: 'primary', unelevated: true, noCaps: true, label: 'Generar' },
    })
    .onOk(async () => {
      try {
        mostrarToken(await regenerarTokenPuesto(puesto._id));
        await cargar();
      } catch (error) {
        quasar.notify({ type: 'negative', message: mensajeError(error, 'No se pudo generar el token') });
      }
    });
}

function desactivar(puesto) {
  quasar
    .dialog({
      title: 'Desactivar puesto',
      message: `"${puesto.nombre}" dejara de controlar la puerta. Puedes reactivarlo generando un token nuevo.`,
      cancel: { flat: true, noCaps: true, label: 'Cancelar' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Desactivar' },
    })
    .onOk(async () => {
      try {
        await desactivarPuestoAcceso(puesto._id);
        await cargar();
      } catch (error) {
        quasar.notify({ type: 'negative', message: mensajeError(error, 'No se pudo desactivar') });
      }
    });
}

async function copiar() {
  await copyToClipboard(`TOKEN_PUESTO=${tokenMostrado.token}`);
  quasar.notify({ type: 'positive', message: 'Copiado' });
}

onMounted(cargar);
</script>

<style scoped>
.tarjeta-puesto {
  width: 100%;
  max-width: 520px;
  border-top: 4px solid var(--q-primary);
}

.caja-token {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.8rem;
  word-break: break-all;
  background: #f4f6f8;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 10px 12px;
  user-select: all;
}
</style>
