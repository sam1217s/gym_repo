<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-md encabezado">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Miembros</h1>
        <div class="text-caption text-grey-7">{{ vencimientos.length }} activos</div>
      </div>

      <div class="row q-gutter-sm">
        <q-btn
          v-if="esDueno"
          flat
          no-caps
          color="grey-8"
          icon="archive"
          label="Archivados"
          @click="abrirArchivados"
        />
        <q-btn
          color="primary"
          unelevated
          no-caps
          icon="person_add"
          label="Nuevo miembro"
          class="boton-nuevo"
          @click="abrirCreacion"
        />
      </div>
    </div>

    <!-- El semaforo de la operacion diaria, ahora tambien es el filtro: un clic y
         la tabla muestra solo ese estado. -->
    <div class="filtros-estado" role="tablist" aria-label="Filtrar por estado">
      <button
        v-for="pestana in pestanasEstado"
        :key="pestana.estado"
        type="button"
        role="tab"
        :aria-selected="filtroEstado === pestana.estado"
        :class="['pestana-estado', { activa: filtroEstado === pestana.estado }]"
        :style="{ '--banda': pestana.color }"
        @click="filtroEstado = pestana.estado"
      >
        <span class="pestana-total cifra-tabular">{{ pestana.total }}</span>
        <span class="pestana-etiqueta">{{ pestana.etiqueta }}</span>
      </button>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <q-input
        v-model="busqueda"
        class="col-12 col-sm-6 col-md-5"
        dense
        outlined
        clearable
        bg-color="white"
        placeholder="Buscar por nombre o documento"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-select
        v-if="sedesVisibles"
        v-model="filtroSede"
        class="col-12 col-sm-4 col-md-3"
        dense
        outlined
        clearable
        emit-value
        map-options
        bg-color="white"
        label="Todas las sedes"
        :options="opcionesSede"
      />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      class="tabla-miembros"
      :grid="quasar.screen.lt.md"
      :rows="filasFiltradas"
      :columns="columnasResponsivas"
      :loading="cargando"
      :pagination="{ rowsPerPage: 50 }"
      :rows-per-page-options="[50, 100, 200, 0]"
      :hide-bottom="filasFiltradas.length <= 50"
      :no-data-label="textoSinFilas"
    >
      <!-- Escritorio: fila blanca, banda de color del estado a la izquierda. -->
      <template #body="props">
        <q-tr :props="props" :class="`fila-miembro fila-${props.row.estado}`">
          <q-td v-for="col in props.cols" :key="col.name" :props="props" :class="col.classes">
            <template v-if="col.name === 'miembro'">
              <div class="celda-miembro">
                <span class="avatar" :style="{ '--anillo': APARIENCIA_VENCIMIENTO[props.row.estado].color }">
                  {{ iniciales(props.row.miembro) }}
                </span>
                <div>
                  <div class="nombre-miembro">
                    {{ props.row.miembro.nombres }} {{ props.row.miembro.apellidos }}
                  </div>
                  <div class="text-caption text-grey-7">doc. {{ props.row.miembro.documento }}</div>
                </div>
              </div>
            </template>

            <template v-else-if="col.name === 'sede'">
              <span class="chip-sede">{{ col.value }}</span>
            </template>

            <template v-else-if="col.name === 'telefono'">
              <a
                class="enlace-telefono"
                :href="enlaceWhatsapp(props.row.miembro)"
                target="_blank"
                rel="noopener"
                :aria-label="`Escribir a ${props.row.miembro.nombres} por WhatsApp`"
              >
                <IconoWhatsapp class="icono-wa" />
                <span class="cifra-tabular">{{ col.value }}</span>
              </a>
            </template>

            <template v-else-if="col.name === 'vence'">
              <div class="celda-vigencia">
                <div class="row items-baseline justify-between no-wrap">
                  <span>{{ formatearFecha(props.row.ultimoPago?.periodoFin) }}</span>
                </div>
                <div class="riel-vigencia">
                  <div
                    class="carga-vigencia"
                    :style="{
                      width: `${vigencia(props.row) * 100}%`,
                      background: APARIENCIA_VENCIMIENTO[props.row.estado].color,
                    }"
                  />
                </div>
                <div :class="['text-caption', `texto-${props.row.estado}`]">
                  {{ describirVencimiento(props.row) }}
                </div>
              </div>
            </template>

            <template v-else-if="col.name === 'estado'">
              <span class="chip-banda" :style="{ '--banda': APARIENCIA_VENCIMIENTO[props.row.estado].color }">
                {{ APARIENCIA_VENCIMIENTO[props.row.estado].etiqueta }}
              </span>
            </template>

            <template v-else-if="col.name === 'acciones'">
              <div class="acciones">
                <q-btn
                  unelevated
                  dense
                  no-caps
                  color="primary"
                  text-color="dark"
                  icon="payments"
                  label="Cobrar"
                  class="boton-cobrar"
                  @click="abrirPago(props.row.miembro)"
                />
                <q-btn
                  round
                  flat
                  dense
                  icon="fingerprint"
                  :color="conHuella.has(props.row.miembro._id) ? 'positive' : 'grey-6'"
                  @click="abrirHuellas(props.row.miembro)"
                >
                  <q-tooltip>
                    {{ conHuella.has(props.row.miembro._id) ? 'Huella registrada' : 'Sin huella: registrala para la puerta' }}
                  </q-tooltip>
                </q-btn>
                <q-btn round flat dense color="grey-7" icon="more_vert" aria-label="Más acciones">
                  <q-menu anchor="bottom right" self="top right">
                    <q-list dense style="min-width: 190px">
                      <q-item v-close-popup clickable @click="abrirHistorial(props.row.miembro)">
                        <q-item-section avatar><q-icon name="history" /></q-item-section>
                        <q-item-section>Historial de pagos</q-item-section>
                      </q-item>
                      <q-item v-close-popup clickable @click="abrirEdicion(props.row.miembro)">
                        <q-item-section avatar><q-icon name="edit" /></q-item-section>
                        <q-item-section>Editar miembro</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </template>

            <template v-else>{{ col.value }}</template>
          </q-td>
        </q-tr>
      </template>

      <!-- Celular: una tarjeta por miembro. -->
      <template #item="props">
        <div class="col-12 q-pa-xs">
          <div :class="`tarjeta-miembro-movil fila-${props.row.estado}`">
            <div class="celda-miembro">
              <span class="avatar" :style="{ '--anillo': APARIENCIA_VENCIMIENTO[props.row.estado].color }">
                {{ iniciales(props.row.miembro) }}
              </span>
              <div class="col">
                <div class="nombre-miembro">{{ props.row.miembro.nombres }} {{ props.row.miembro.apellidos }}</div>
                <div class="text-caption text-grey-7">{{ nombreSede(props.row.miembro.sede) }} · doc. {{ props.row.miembro.documento }}</div>
              </div>
              <span class="chip-banda" :style="{ '--banda': APARIENCIA_VENCIMIENTO[props.row.estado].color }">
                {{ APARIENCIA_VENCIMIENTO[props.row.estado].etiqueta }}
              </span>
            </div>
            <div class="riel-vigencia q-mt-sm">
              <div
                class="carga-vigencia"
                :style="{ width: `${vigencia(props.row) * 100}%`, background: APARIENCIA_VENCIMIENTO[props.row.estado].color }"
              />
            </div>
            <div :class="['text-caption', 'q-mt-xs', `texto-${props.row.estado}`]">
              {{ describirVencimiento(props.row) }} · {{ formatearFecha(props.row.ultimoPago?.periodoFin) }}
            </div>
            <div class="acciones q-mt-sm">
              <q-btn unelevated dense no-caps color="primary" text-color="dark" icon="payments" label="Cobrar" class="boton-cobrar" @click="abrirPago(props.row.miembro)" />
              <q-btn round flat dense type="a" :href="enlaceWhatsapp(props.row.miembro)" target="_blank" rel="noopener" class="boton-wa-movil" aria-label="WhatsApp">
                <IconoWhatsapp />
              </q-btn>
              <q-btn round flat dense icon="fingerprint" :color="conHuella.has(props.row.miembro._id) ? 'positive' : 'grey-6'" @click="abrirHuellas(props.row.miembro)" />
              <q-btn round flat dense color="grey-7" icon="history" @click="abrirHistorial(props.row.miembro)" />
              <q-btn round flat dense color="grey-7" icon="edit" @click="abrirEdicion(props.row.miembro)" />
            </div>
          </div>
        </div>
      </template>
    </q-table>

    <FormularioPago v-model="dialogoPago" :miembro="miembroActivo" />

    <!-- Solo montado mientras esta abierto: asi no se conecta al agente de la puerta si nadie lo usa. -->
    <DialogoHuellas
      v-if="dialogoHuellas"
      v-model="dialogoHuellas"
      :miembro="miembroActivo"
      @actualizado="cargarConHuella"
    />

    <DialogoHistorialPagos
      v-model="dialogoHistorial"
      :miembro="miembroActivo"
      :puede-editar="esDueno"
      @actualizado="cargar"
    />

    <!-- Miembros archivados: reactivar a quien se desactivo por error -->
    <q-dialog v-model="dialogoArchivados">
      <q-card class="tarjeta-archivados">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Miembros archivados</div>
          <div class="text-caption text-grey-7">Reactiva a quien desactivaste por error.</div>
        </q-card-section>

        <q-separator />

        <q-card-section class="seccion-archivados">
          <q-inner-loading :showing="cargandoArchivados" label="Cargando…" />

          <div
            v-if="!cargandoArchivados && archivados.length === 0"
            class="text-grey-7 text-center q-pa-lg"
          >
            No hay miembros archivados.
          </div>

          <q-list v-else separator>
            <q-item v-for="m in archivados" :key="m._id">
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ m.nombres }} {{ m.apellidos }}</q-item-label>
                <q-item-label caption>doc. {{ m.documento }} · {{ nombreSede(m.sede) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  no-caps
                  color="primary"
                  icon="restore"
                  label="Reactivar"
                  :loading="reactivandoId === m._id"
                  @click="reactivar(m)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Cerrar" @click="dialogoArchivados = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

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
import DialogoHistorialPagos from 'src/components/DialogoHistorialPagos.vue';
import DialogoHuellas from 'src/components/DialogoHuellas.vue';
import IconoWhatsapp from 'src/components/IconoWhatsapp.vue';
import FormularioPago from 'src/components/FormularioPago.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import {
  APARIENCIA_VENCIMIENTO,
  ESTADOS_VENCIMIENTO,
  useVencimientos,
} from 'src/composables/useVencimientos.js';
import { listarMiembrosConHuella } from 'src/servicios/gimnasio.servicio.js';
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
// '' = todos. Si no, uno de ESTADOS_VENCIMIENTO.
const filtroEstado = ref('');

const dialogoPago = ref(false);
const dialogoMiembro = ref(false);
const dialogoHistorial = ref(false);
const dialogoHuellas = ref(false);
const dialogoArchivados = ref(false);
const cargandoArchivados = ref(false);
const reactivandoId = ref(null);
const miembroActivo = ref(null);
const editando = ref(false);
const guardando = ref(false);

/** El selector de sede y las acciones de archivado son cosa del dueño. */
const esDueno = computed(() => usuario.value?.rol === ROLES.TENANT_OWNER);
const sedesVisibles = esDueno;

const archivados = computed(() => gimnasio.miembrosArchivados);

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
    label: 'Vigencia',
    field: (fila) => fila.ultimoPago?.periodoFin ?? '',
    align: 'left',
    sortable: true,
  },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: (fila) => fila.miembro._id, align: 'right' },
];

// En movil, la columna de acciones va primero (ver el composable).
const columnasResponsivas = useColumnasResponsive(COLUMNAS);

/**
 * Pestanas de estado: el conteo y, a la vez, el filtro de la tabla. "Sin pagos"
 * no tiene pestana (se ve dentro de "Todos").
 */
const PESTANAS = [
  { estado: '', etiqueta: 'Todos', color: 'var(--q-secondary)' },
  ...[
    ESTADOS_VENCIMIENTO.AL_DIA,
    ESTADOS_VENCIMIENTO.POR_VENCER,
    ESTADOS_VENCIMIENTO.VENCIDO,
  ].map((estado) => ({
    estado,
    etiqueta: APARIENCIA_VENCIMIENTO[estado].plural,
    color: APARIENCIA_VENCIMIENTO[estado].color,
  })),
];

const pestanasEstado = computed(() =>
  PESTANAS.map((pestana) => ({
    ...pestana,
    total: pestana.estado ? conteosPorEstado.value[pestana.estado] : vencimientos.value.length,
  })),
);

const textoSinFilas = computed(() =>
  vencimientos.value.length === 0 ? 'Aun no hay miembros. Registra el primero.' : 'Ningun miembro coincide con el filtro.',
);

/** Iniciales para el avatar ("Ana Ramirez" -> "AR"). */
function iniciales(miembro) {
  return `${miembro.nombres?.[0] ?? ''}${miembro.apellidos?.[0] ?? ''}`.toUpperCase();
}

/**
 * Cuanto le queda de la mensualidad pagada, de 0 a 1 (el riel de vigencia).
 * Vencido o sin pagos: 0.
 */
function vigencia(fila) {
  const pago = fila.ultimoPago;
  if (!pago) return 0;
  const inicio = new Date(pago.periodoInicio).getTime();
  const fin = new Date(pago.periodoFin).getTime();
  if (!(fin > inicio)) return 0;
  return Math.min(Math.max((fin - Date.now()) / (fin - inicio), 0), 1);
}

function enlaceWhatsapp(miembro) {
  const texto = `Hola ${miembro.nombres}, te escribimos de ${usuario.value?.tenantNombre || 'Gym Barichara'}.`;
  return `https://wa.me/${miembro.telefono}?text=${encodeURIComponent(texto)}`;
}

const filasFiltradas = computed(() => {
  const texto = (busqueda.value ?? '').trim().toLowerCase();

  return vencimientos.value.filter((fila) => {
    if (filtroEstado.value && fila.estado !== filtroEstado.value) return false;
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

function abrirHistorial(miembro) {
  miembroActivo.value = miembro;
  dialogoHistorial.value = true;
}

// Quien ya tiene huella para la puerta: su icono va en verde.
const conHuella = ref(new Set());

async function cargarConHuella() {
  try {
    conHuella.value = new Set(await listarMiembrosConHuella());
  } catch {
    // No es critico: sin esto el icono solo queda gris.
  }
}

function abrirHuellas(miembro) {
  miembroActivo.value = miembro;
  dialogoHuellas.value = true;
}

async function abrirArchivados() {
  dialogoArchivados.value = true;
  cargandoArchivados.value = true;
  try {
    await gimnasio.cargarArchivados();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los archivados' });
  } finally {
    cargandoArchivados.value = false;
  }
}

async function reactivar(miembro) {
  reactivandoId.value = miembro._id;
  try {
    await gimnasio.reactivarMiembro(miembro._id);
    quasar.notify({ type: 'positive', message: `${miembro.nombres} vuelve a estar activo` });
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo reactivar',
    });
  } finally {
    reactivandoId.value = null;
  }
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
    await Promise.all([cargar(), gimnasio.cargarSedes(), cargarConHuella()]);
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

.tarjeta-archivados {
  width: 100%;
  max-width: 480px;
  border-top: 4px solid var(--q-primary);
}

.seccion-archivados {
  position: relative;
  min-height: 120px;
  max-height: 60vh;
  overflow-y: auto;
}

/* --- Pestanas de estado (conteo + filtro) --- */
.filtros-estado {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}
.pestana-estado {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 16px 10px 14px;
  border: 1px solid #e4e7ec;
  border-left: 4px solid var(--banda);
  border-radius: 10px;
  background: #fff;
  color: #3b3f46;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}
.pestana-estado:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
}
.pestana-estado:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
.pestana-estado.activa {
  background: #14161b;
  border-color: #14161b;
  border-left-color: var(--banda);
  color: #fff;
}
.pestana-total {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}
.pestana-etiqueta {
  font-size: 0.85rem;
  font-weight: 600;
}
/* En celular: una sola fila delgada que se desliza de lado si no cabe. */
@media (max-width: 600px) {
  .filtros-estado {
    flex-wrap: nowrap;
    gap: 6px;
    margin: 0 -16px 12px;
    padding: 0 16px 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .filtros-estado::-webkit-scrollbar {
    display: none;
  }
  .pestana-estado {
    flex-shrink: 0;
    gap: 5px;
    padding: 6px 10px 6px 8px;
    border-left-width: 3px;
    border-radius: 8px;
  }
  .pestana-total {
    font-size: 1rem;
  }
  .pestana-etiqueta {
    font-size: 0.74rem;
  }
}

/* --- Tabla --- */
.tabla-miembros {
  border-radius: 12px;
}
.tabla-miembros :deep(thead th) {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6b7280;
  background: #fafafa;
}
.fila-miembro :deep(td:first-child) {
  border-left: 4px solid transparent;
}
.fila-miembro:hover {
  background: #f8f9fb;
}
.fila-al_dia :deep(td:first-child) {
  border-left-color: var(--q-positive);
}
.fila-por_vencer :deep(td:first-child) {
  border-left-color: var(--q-warning);
}
.fila-vencido :deep(td:first-child) {
  border-left-color: var(--q-negative);
}
.fila-sin_pagos :deep(td:first-child) {
  border-left-color: #667085;
}

.celda-miembro {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* Avatar con iniciales: el anillo lleva el color del estado. */
.avatar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #14161b;
  color: #fff;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.04em;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--anillo);
}
.nombre-miembro {
  font-weight: 600;
  color: #0b0b0b;
}
.chip-sede {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f1f2f4;
  font-size: 0.8rem;
  font-weight: 600;
  color: #3b3f46;
}
.enlace-telefono {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: inherit;
  text-decoration: none;
}
.enlace-telefono:hover {
  color: #1faa52;
}
.icono-wa {
  font-size: 17px;
  color: #1faa52;
}

/* Riel de vigencia: lo que le queda de la mensualidad pagada. */
.celda-vigencia {
  min-width: 150px;
}
.riel-vigencia {
  height: 6px;
  margin: 5px 0 3px;
  border-radius: 3px;
  background: #eceef1;
  overflow: hidden;
}
.carga-vigencia {
  height: 100%;
  border-radius: 3px;
}
.texto-vencido {
  color: var(--q-negative) !important;
}
.texto-por_vencer {
  color: var(--q-warning) !important;
}
.texto-al_dia {
  color: var(--q-positive) !important;
}

.acciones {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.boton-cobrar {
  padding: 2px 12px;
  border-radius: 8px;
  font-weight: 700;
}

/* --- Celular: tarjetas --- */
.tarjeta-miembro-movil {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e4e7ec;
  border-left: 4px solid #667085;
  background: #fff;
}
.tarjeta-miembro-movil.fila-al_dia {
  border-left-color: var(--q-positive);
}
.tarjeta-miembro-movil.fila-por_vencer {
  border-left-color: var(--q-warning);
}
.tarjeta-miembro-movil.fila-vencido {
  border-left-color: var(--q-negative);
}
.boton-wa-movil {
  color: #1faa52;
  font-size: 20px;
}
</style>
