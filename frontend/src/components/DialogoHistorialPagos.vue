<template>
  <q-dialog :model-value="modelValue" @update:model-value="cerrar">
    <q-card class="tarjeta-historial">
      <q-card-section class="q-pb-sm">
        <div class="text-h6 titulo-display">Pagos de {{ nombreMiembro }}</div>
        <div v-if="puedeEditar" class="text-caption text-grey-7">
          Corrige el periodo si registraste una fecha equivocada.
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="seccion-lista">
        <q-inner-loading :showing="cargando" label="Cargando pagos…" />

        <div v-if="!cargando && pagos.length === 0" class="text-grey-7 text-center q-pa-lg">
          Este miembro aun no tiene pagos.
        </div>

        <q-list v-else separator>
          <q-item v-for="pago in pagos" :key="pago._id">
            <q-item-section>
              <q-item-label class="text-weight-medium">
                Del {{ fechaLegible(pago.periodoInicio) }} al {{ fechaLegible(pago.periodoFin) }}
              </q-item-label>
              <q-item-label caption>
                {{ pago.planMembresia?.nombre ?? 'Plan' }} ·
                ${{ Number(pago.monto).toLocaleString('es-CO') }} · {{ pago.metodoPago }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-if="puedeEditar" side>
              <q-btn flat round dense color="grey-8" icon="edit" @click="abrirEdicion(pago)">
                <q-tooltip>Corregir este pago</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat no-caps label="Cerrar" @click="cerrar(false)" />
      </q-card-actions>
    </q-card>

    <!-- Correccion de un pago concreto -->
    <q-dialog v-model="dialogoEdicion">
      <q-card class="tarjeta-edicion">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Corregir pago</div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardar">
          <q-card-section class="q-gutter-y-md">
            <q-select
              v-model="edicion.planMembresia"
              label="Plan de membresia"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesPlan"
              :rules="[reglaObligatorio]"
            />

            <div class="row q-col-gutter-md">
              <q-input
                v-model="edicion.periodoInicio"
                class="col-6"
                type="date"
                label="Cubre desde"
                stack-label
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
              <q-input
                v-model.number="edicion.monto"
                class="col-6"
                type="number"
                label="Monto"
                prefix="$"
                outlined
                dense
                :rules="[reglaMonto]"
              />
            </div>

            <!-- El fin se recalcula igual que en el backend: verlo antes de guardar
                 evita dejar el periodo equivocado. -->
            <q-banner v-if="finLegible" dense class="banner-vencimiento">
              Cubre del <strong>{{ inicioLegible }}</strong> al <strong>{{ finLegible }}</strong>
            </q-banner>

            <div>
              <div class="text-caption text-grey-7 q-mb-xs">Metodo de pago</div>
              <q-option-group v-model="edicion.metodoPago" inline :options="OPCIONES_METODO" />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoEdicion = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              label="Guardar cambios"
              :loading="guardando"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, reactive, ref, watch } from 'vue';

import { listarPagosDeMiembro } from 'src/servicios/gimnasio.servicio.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Historial de pagos de un miembro. El dueño puede CORREGIR un pago (su periodo,
 * monto, plan o metodo) por si tecleo mal la fecha. El backend recalcula el
 * vencimiento; el `periodoFin` que se muestra aqui es un calculo local de
 * cortesia, igual que en `FormularioPago.vue`.
 */

const propiedades = defineProps({
  modelValue: { type: Boolean, required: true },
  miembro: { type: Object, default: null },
  // La edicion es solo del dueño; un sede_admin ve el historial pero no lo toca.
  puedeEditar: { type: Boolean, default: false },
});

const emitir = defineEmits(['update:modelValue', 'actualizado']);

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const cargando = ref(false);
const guardando = ref(false);
const pagos = ref([]);

const dialogoEdicion = ref(false);
const pagoEditando = ref(null);
const edicion = reactive({ planMembresia: null, periodoInicio: '', monto: null, metodoPago: 'efectivo' });

const OPCIONES_METODO = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Transferencia', value: 'transferencia' },
];

const nombreMiembro = computed(() =>
  propiedades.miembro ? `${propiedades.miembro.nombres} ${propiedades.miembro.apellidos}` : '',
);

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function fechaLegible(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : FORMATO_FECHA.format(d);
}

/** "2026-08-01" -> Date a medianoche LOCAL (dia civil), no UTC. */
function interpretarDiaCivil(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Date -> "YYYY-MM-DD" del dia LOCAL, para el `<input type="date">`. */
function aFechaInput(valor) {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Espejo de `sumarMeses()` del backend: el dia se recorta al ultimo del mes. */
function sumarMeses(fecha, meses) {
  const base = new Date(fecha);
  const diaDeseado = base.getDate();
  const resultado = new Date(base);
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() + meses);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(diaDeseado, ultimoDia));
  return resultado;
}

// Los planes son POR SEDE: solo los de la sede del miembro (misma regla del cobro).
const opcionesPlan = computed(() =>
  gimnasio.planesMembresia
    .filter((plan) => plan.activo && plan.sede === propiedades.miembro?.sede)
    .map((plan) => ({ label: `${plan.nombre} — $${plan.precio.toLocaleString('es-CO')}`, value: plan._id })),
);

const planElegido = computed(
  () => gimnasio.planesMembresia.find((plan) => plan._id === edicion.planMembresia) ?? null,
);

const periodoFin = computed(() => {
  if (!planElegido.value || !edicion.periodoInicio) return null;
  const inicio = interpretarDiaCivil(edicion.periodoInicio);
  if (Number.isNaN(inicio.getTime())) return null;
  const plan = planElegido.value;
  if (plan.duracionDias != null) {
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + plan.duracionDias);
    return fin;
  }
  return sumarMeses(inicio, plan.duracionMeses);
});

const inicioLegible = computed(() =>
  edicion.periodoInicio ? fechaLegible(interpretarDiaCivil(edicion.periodoInicio)) : '',
);
const finLegible = computed(() => (periodoFin.value ? FORMATO_FECHA.format(periodoFin.value) : ''));

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaMonto = (valor) => (typeof valor === 'number' && valor >= 0) || 'Monto invalido';

async function cargarPagos() {
  cargando.value = true;
  try {
    const tareas = [listarPagosDeMiembro(propiedades.miembro._id)];
    if (gimnasio.planesMembresia.length === 0) tareas.push(gimnasio.cargarPlanesMembresia());
    const [lista] = await Promise.all(tareas);
    pagos.value = lista;
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los pagos' });
  } finally {
    cargando.value = false;
  }
}

// Al abrir el dialogo se cargan los pagos del miembro.
watch(
  () => propiedades.modelValue,
  (abierto) => {
    if (abierto && propiedades.miembro) {
      pagos.value = [];
      cargarPagos();
    }
  },
);

function abrirEdicion(pago) {
  pagoEditando.value = pago;
  Object.assign(edicion, {
    planMembresia: pago.planMembresia?._id ?? null,
    periodoInicio: aFechaInput(pago.periodoInicio),
    monto: pago.monto,
    metodoPago: pago.metodoPago === 'transferencia' ? 'transferencia' : 'efectivo',
  });
  dialogoEdicion.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    await gimnasio.actualizarPago(pagoEditando.value._id, {
      planMembresia: edicion.planMembresia,
      periodoInicio: edicion.periodoInicio,
      monto: edicion.monto,
      metodoPago: edicion.metodoPago,
    });
    quasar.notify({
      type: 'positive',
      message: 'Pago corregido',
      caption: `Cubre del ${inicioLegible.value} al ${finLegible.value}`,
    });
    dialogoEdicion.value = false;
    await cargarPagos(); // refresca la lista con el periodo nuevo
    emitir('actualizado');
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo corregir el pago',
    });
  } finally {
    guardando.value = false;
  }
}

function cerrar(valor) {
  emitir('update:modelValue', Boolean(valor));
}
</script>

<style scoped>
.tarjeta-historial {
  width: 100%;
  max-width: 520px;
  border-top: 4px solid var(--q-primary);
}

.seccion-lista {
  position: relative;
  min-height: 120px;
  max-height: 60vh;
  overflow-y: auto;
}

.tarjeta-edicion {
  width: 100%;
  max-width: 440px;
  border-top: 4px solid var(--q-primary);
}

.banner-vencimiento {
  background: rgba(31, 122, 70, 0.08);
  border-left: 4px solid var(--q-positive);
  border-radius: 3px;
}
</style>
