<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Miembros</h1>
        <div class="text-caption text-grey-7">{{ vencimientos.length }} activos</div>
      </div>

      <q-btn
        color="primary"
        unelevated
        no-caps
        icon="person_add"
        label="Nuevo miembro"
        @click="abrirCreacion"
      />
    </div>

    <!-- El semaforo de la operacion diaria: quien esta al dia, quien esta por
         vencer (a quien hay que llamar) y quien ya vencio. -->
    <div class="fila-discos q-mb-lg">
      <div v-for="resumen in discosEstado" :key="resumen.estado" class="celda-disco">
        <div class="disco" :style="{ borderColor: resumen.color }">
          <span class="titulo-display numero-disco cifra-tabular">{{ resumen.total }}</span>
        </div>
        <div class="etiqueta-disco">{{ resumen.etiqueta }}</div>
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <q-input
        v-model="busqueda"
        class="col-12 col-sm-5"
        dense
        outlined
        clearable
        placeholder="Buscar por nombre o documento"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-select
        v-if="sedesVisibles"
        v-model="filtroSede"
        class="col-12 col-sm-4"
        dense
        outlined
        clearable
        emit-value
        map-options
        label="Todas las sedes"
        :options="opcionesSede"
      />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="filasFiltradas"
      :columns="columnasResponsivas"
      :loading="cargando"
      :pagination="{ rowsPerPage: 15 }"
      :hide-bottom="filasFiltradas.length <= 15"
      no-data-label="Aun no hay miembros. Registra el primero."
    >
      <!-- Fila completa tintada con el color (suave) del estado del miembro, para
           leer de un vistazo quien esta al dia, por vencer o vencido. `props.cols`
           respeta el reordenamiento responsive de columnas. -->
      <template #body="props">
        <q-tr :props="props" :class="`fila-estado fila-${props.row.estado}`">
          <q-td v-for="col in props.cols" :key="col.name" :props="props" :class="col.classes">
            <template v-if="col.name === 'miembro'">
              <div class="text-weight-medium">
                {{ props.row.miembro.nombres }} {{ props.row.miembro.apellidos }}
              </div>
              <div class="text-caption text-grey-7">doc. {{ props.row.miembro.documento }}</div>
            </template>

            <template v-else-if="col.name === 'vence'">
              <div>{{ formatearFecha(props.row.ultimoPago?.periodoFin) }}</div>
              <div class="text-caption text-grey-7">{{ describirVencimiento(props.row) }}</div>
            </template>

            <template v-else-if="col.name === 'estado'">
              <span
                class="chip-banda"
                :style="{ '--banda': APARIENCIA_VENCIMIENTO[props.row.estado].color }"
              >
                {{ APARIENCIA_VENCIMIENTO[props.row.estado].etiqueta }}
              </span>
            </template>

            <template v-else-if="col.name === 'acciones'">
              <q-btn round flat dense color="primary" icon="payments" @click="abrirPago(props.row.miembro)">
                <q-tooltip>Registrar pago</q-tooltip>
              </q-btn>
              <q-btn round flat dense color="grey-8" icon="edit" @click="abrirEdicion(props.row.miembro)">
                <q-tooltip>Editar</q-tooltip>
              </q-btn>
            </template>

            <template v-else>{{ col.value }}</template>
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <FormularioPago v-model="dialogoPago" :miembro="miembroActivo" />

    <!-- Alta y edicion de miembro -->
    <q-dialog v-model="dialogoMiembro">
      <q-card class="tarjeta-miembro">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">
            {{ editando ? 'Editar miembro' : 'Nuevo miembro' }}
          </div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardarMiembro">
          <q-card-section class="q-gutter-y-sm">
            <div class="row q-col-gutter-md">
              <q-input
                v-model="formulario.nombres"
                class="col-12 col-sm-6"
                label="Nombres"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
              <q-input
                v-model="formulario.apellidos"
                class="col-12 col-sm-6"
                label="Apellidos"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
              <q-input
                v-model="formulario.documento"
                class="col-12 col-sm-6"
                label="Documento"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
              <campo-telefono v-model="formulario.telefono" class="col-12" />
              <q-input
                v-model="formulario.email"
                class="col-12"
                type="email"
                label="Correo (opcional)"
                hint="Para el recibo del pago en linea"
                outlined
                dense
                :rules="[reglaEmailOpcional]"
              />
              <q-select
                v-if="sedesVisibles"
                v-model="formulario.sede"
                class="col-12"
                label="Sede"
                outlined
                dense
                emit-value
                map-options
                :options="opcionesSede"
                :rules="[reglaObligatorio]"
              />
            </div>

            <!-- Primera mensualidad (solo al crear): define desde cuando cuenta su
                 pago. Si se elige plan, se registra el primer pago junto con el alta. -->
            <template v-if="!editando">
              <q-separator class="q-my-xs" />
              <div class="text-caption text-weight-medium text-grey-8">
                Primera mensualidad <span class="text-grey-6">(opcional)</span>
              </div>
              <q-select
                v-model="primeraMensualidad.plan"
                label="Plan"
                outlined
                dense
                clearable
                emit-value
                map-options
                :options="opcionesPlanPrimera"
                :hint="
                  formulario.sede || !sedesVisibles
                    ? 'Si eliges un plan, se registra su primer pago'
                    : 'Elige primero la sede'
                "
              />
              <div v-if="primeraMensualidad.plan" class="row q-col-gutter-md items-center">
                <q-input
                  v-model="primeraMensualidad.fecha"
                  class="col-12 col-sm-6"
                  type="date"
                  label="Fecha de pago"
                  stack-label
                  outlined
                  dense
                  :rules="[reglaObligatorio]"
                />
                <div class="col-12 col-sm-6">
                  <div class="text-caption text-grey-7 q-mb-xs">Metodo</div>
                  <q-option-group
                    v-model="primeraMensualidad.metodo"
                    inline
                    :options="OPCIONES_METODO_PRIMERA"
                  />
                </div>
              </div>
            </template>

            <q-toggle v-if="editando" v-model="formulario.activo" label="Miembro activo" />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoMiembro = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              :label="editando ? 'Guardar cambios' : 'Registrar miembro'"
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
import { computed, onMounted, reactive, ref } from 'vue';

import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';

import CampoTelefono from 'src/components/CampoTelefono.vue';
import FormularioPago from 'src/components/FormularioPago.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import {
  APARIENCIA_VENCIMIENTO,
  ESTADOS_VENCIMIENTO,
  useVencimientos,
} from 'src/composables/useVencimientos.js';
import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * La pantalla del dia a dia: cada miembro con su estado de membresia derivado
 * (el backend lo saca del ultimo pago) y el pago a un clic. Un sede_admin
 * recibe del backend solo su sede; el selector de sede es cosa del dueno.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();
const { usuario } = useAutenticacion();
const { vencimientos, cargando, conteosPorEstado, cargar, formatearFecha, describirVencimiento } =
  useVencimientos();

const busqueda = ref('');
const filtroSede = ref(null);

const dialogoPago = ref(false);
const dialogoMiembro = ref(false);
const miembroActivo = ref(null);
const editando = ref(false);
const guardando = ref(false);

/** El selector de sede solo tiene sentido para quien ve mas de una. */
const sedesVisibles = computed(() => usuario.value?.rol === ROLES.TENANT_OWNER);

const opcionesSede = computed(() =>
  gimnasio.sedes.map((sede) => ({ label: sede.nombre, value: sede._id })),
);

const COLUMNAS = [
  {
    name: 'miembro',
    label: 'Miembro',
    field: (fila) => fila.miembro.nombres,
    align: 'left',
    sortable: true,
  },
  {
    name: 'sede',
    label: 'Sede',
    field: (fila) => nombreSede(fila.miembro.sede),
    align: 'left',
    sortable: true,
  },
  {
    name: 'telefono',
    label: 'Telefono',
    field: (fila) => fila.miembro.telefono,
    format: (valor) => mostrarTelefono(valor),
    align: 'left',
    classes: 'cifra-tabular',
  },
  {
    name: 'vence',
    label: 'Vence',
    field: (fila) => fila.ultimoPago?.periodoFin ?? '',
    align: 'left',
    sortable: true,
  },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: (fila) => fila.miembro._id, align: 'right' },
];

// En movil, la columna de acciones va primero (ver el composable).
const columnasResponsivas = useColumnasResponsive(COLUMNAS);

const ORDEN_DISCOS = [
  ESTADOS_VENCIMIENTO.AL_DIA,
  ESTADOS_VENCIMIENTO.POR_VENCER,
  ESTADOS_VENCIMIENTO.VENCIDO,
];

const discosEstado = computed(() =>
  ORDEN_DISCOS.map((estado) => ({
    estado,
    etiqueta: APARIENCIA_VENCIMIENTO[estado].plural,
    color: APARIENCIA_VENCIMIENTO[estado].color,
    total: conteosPorEstado.value[estado],
  })),
);

const filasFiltradas = computed(() => {
  const texto = (busqueda.value ?? '').trim().toLowerCase();

  return vencimientos.value.filter((fila) => {
    if (filtroSede.value && fila.miembro.sede !== filtroSede.value) return false;
    if (!texto) return true;

    const nombre = `${fila.miembro.nombres} ${fila.miembro.apellidos}`.toLowerCase();
    return nombre.includes(texto) || fila.miembro.documento.includes(texto);
  });
});

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? '—';
}

// Indicativos que sabe quitar para mostrar; el mas largo que encaje gana.
const INDICATIVOS = ['57', '52', '54', '51', '58', '34', '1'];

/**
 * El telefono se guarda con indicativo ("573001695629"); en la tabla se muestra
 * SOLO el numero local y agrupado ("300 169 5629"), sin el "+57".
 */
function mostrarTelefono(numero) {
  const digitos = String(numero ?? '').replace(/\D/g, '');
  if (!digitos) return '—';

  const indicativo = [...INDICATIVOS]
    .sort((a, b) => b.length - a.length)
    .find((ind) => digitos.startsWith(ind) && digitos.length - ind.length >= 7);

  const local = indicativo ? digitos.slice(indicativo.length) : digitos;
  return local.replace(/(\d{3})(\d{3})(\d{2,})/, '$1 $2 $3');
}

// --- Alta y edicion -----------------------------------------------------------

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
// Vacio es valido (opcional); si viene, debe parecer un correo.
const reglaEmailOpcional = (valor) =>
  !String(valor ?? '').trim() || /.+@.+\..+/.test(valor) || 'Correo invalido';

const formulario = reactive({
  nombres: '',
  apellidos: '',
  documento: '',
  telefono: '',
  email: '',
  sede: null,
  activo: true,
});

const OPCIONES_METODO_PRIMERA = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Transferencia', value: 'transferencia' },
];

// Primera mensualidad opcional al dar de alta: define desde cuando cuenta el pago.
const primeraMensualidad = reactive({ plan: null, fecha: hoyLocal(), metodo: 'efectivo' });

function hoyLocal() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Planes de la sede elegida. Un sede_admin (sin selector de sede) ya recibe solo
// los de la suya, asi que sin sede se muestran todos los que tiene cargados.
const opcionesPlanPrimera = computed(() => {
  const sedeElegida = formulario.sede;
  return gimnasio.planesMembresia
    .filter((plan) => plan.activo && (!sedeElegida || plan.sede === sedeElegida))
    .map((plan) => ({
      label: `${plan.nombre} — $${plan.precio.toLocaleString('es-CO')}`,
      value: plan._id,
    }));
});

function abrirCreacion() {
  editando.value = false;
  miembroActivo.value = null;
  Object.assign(formulario, {
    nombres: '',
    apellidos: '',
    documento: '',
    telefono: '',
    email: '',
    sede: null,
    activo: true,
  });
  Object.assign(primeraMensualidad, { plan: null, fecha: hoyLocal(), metodo: 'efectivo' });
  // Los planes alimentan el selector de la primera mensualidad.
  if (gimnasio.planesMembresia.length === 0) gimnasio.cargarPlanesMembresia().catch(() => {});
  dialogoMiembro.value = true;
}

function abrirEdicion(miembro) {
  editando.value = true;
  miembroActivo.value = miembro;
  Object.assign(formulario, {
    nombres: miembro.nombres,
    apellidos: miembro.apellidos,
    documento: miembro.documento,
    telefono: miembro.telefono,
    email: miembro.email ?? '',
    sede: miembro.sede,
    activo: miembro.activo,
  });
  dialogoMiembro.value = true;
}

function abrirPago(miembro) {
  miembroActivo.value = miembro;
  dialogoPago.value = true;
}

async function guardarMiembro() {
  guardando.value = true;
  try {
    const datos = {
      nombres: formulario.nombres,
      apellidos: formulario.apellidos,
      documento: formulario.documento,
      telefono: formulario.telefono,
      email: formulario.email.trim(),
      // La sede solo viaja si hay algo que decir: al sede_admin se la fuerza el backend.
      ...(formulario.sede ? { sede: formulario.sede } : {}),
    };

    if (editando.value) {
      await gimnasio.actualizarMiembro(miembroActivo.value._id, {
        ...datos,
        activo: formulario.activo,
      });
      quasar.notify({ type: 'positive', message: 'Miembro actualizado' });
    } else {
      const nuevo = await gimnasio.crearMiembro(datos);

      // Si se eligio plan, se registra su primera mensualidad con la fecha dada:
      // el miembro nace con vencimiento, no "sin pagos".
      if (primeraMensualidad.plan) {
        const plan = gimnasio.planesMembresia.find((p) => p._id === primeraMensualidad.plan);
        await gimnasio.registrarPago({
          miembro: nuevo._id,
          planMembresia: primeraMensualidad.plan,
          metodoPago: primeraMensualidad.metodo,
          monto: plan?.precio,
          periodoInicio: primeraMensualidad.fecha,
        });
      }

      quasar.notify({
        type: 'positive',
        message: primeraMensualidad.plan ? 'Miembro registrado con su primera mensualidad' : 'Miembro registrado',
      });
    }

    dialogoMiembro.value = false;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar el miembro',
    });
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  try {
    await Promise.all([cargar(), gimnasio.cargarSedes()]);
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los miembros' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.tarjeta-miembro {
  width: 100%;
  max-width: 520px;
  border-top: 4px solid var(--q-primary);
}

/* Fondo suave por estado del miembro, para leer de un vistazo. Los colores son
   los de las bandas de disco, muy diluidos para no competir con el texto. Una
   banda a la izquierda refuerza el estado sin depender solo del color. */
.fila-estado :deep(td:first-child) {
  border-left: 3px solid transparent;
}

.fila-al_dia {
  background: rgba(31, 122, 70, 0.08);
}
.fila-al_dia :deep(td:first-child) {
  border-left-color: var(--q-positive);
}

.fila-por_vencer {
  background: rgba(154, 112, 22, 0.12);
}
.fila-por_vencer :deep(td:first-child) {
  border-left-color: var(--q-warning);
}

.fila-vencido {
  background: rgba(143, 29, 20, 0.09);
}
.fila-vencido :deep(td:first-child) {
  border-left-color: var(--q-negative);
}

.fila-sin_pagos {
  background: rgba(102, 112, 133, 0.08);
}
.fila-sin_pagos :deep(td:first-child) {
  border-left-color: #667085;
}

/* Al pasar el mouse, el tinte se intensifica un poco (gana al hover de Quasar). */
.fila-al_dia:hover {
  background: rgba(31, 122, 70, 0.15) !important;
}
.fila-por_vencer:hover {
  background: rgba(154, 112, 22, 0.2) !important;
}
.fila-vencido:hover {
  background: rgba(143, 29, 20, 0.16) !important;
}
.fila-sin_pagos:hover {
  background: rgba(102, 112, 133, 0.14) !important;
}
</style>
