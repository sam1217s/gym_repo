<template>
  <q-dialog :model-value="modelValue" @update:model-value="cerrar">
    <q-card class="tarjeta-pago">
      <q-card-section class="q-pb-sm">
        <div class="text-h6 titulo-display">Registrar pago</div>
        <div v-if="miembro" class="text-caption text-grey-7">
          {{ miembro.nombres }} {{ miembro.apellidos }} · doc. {{ miembro.documento }}
        </div>
      </q-card-section>

      <q-separator />

      <q-form @submit.prevent="enviar">
        <q-card-section class="q-gutter-y-md">
          <q-select
            v-model="formulario.planMembresia"
            label="Plan de membresia"
            outlined
            dense
            emit-value
            map-options
            :options="opcionesPlan"
            :rules="[reglaObligatorio]"
            :hint="opcionesPlan.length === 0 ? 'Esta sede aun no tiene planes. Crealos en Planes.' : ''"
          />

          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.periodoInicio"
              class="col-6"
              type="date"
              label="Inicio del periodo"
              stack-label
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model.number="formulario.monto"
              class="col-6"
              type="number"
              label="Monto"
              prefix="$"
              outlined
              dense
              :rules="[reglaMonto]"
            />
          </div>

          <!-- El vencimiento se calcula aqui igual que en el backend:
               periodoInicio + duracionMeses del plan. Verlo ANTES de cobrar
               evita registrar un periodo equivocado. -->
          <q-banner v-if="periodoFin" dense class="banner-vencimiento">
            Cubre hasta el <strong>{{ periodoFinLegible }}</strong>
            ({{ describirDuracion(planElegido) }} de {{ planElegido.nombre }})
          </q-banner>

          <div>
            <div class="text-caption text-grey-7 q-mb-xs">Metodo de pago</div>
            <q-option-group
              v-model="formulario.metodoPago"
              inline
              :options="OPCIONES_METODO"
            />
          </div>

          <q-input
            v-if="esTransferencia"
            v-model="formulario.referencia"
            label="Referencia de la transferencia"
            hint="Numero de comprobante"
            outlined
            dense
            :rules="[reglaObligatorio]"
          />
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Descartar" :disable="enviando" @click="cerrar(false)" />
          <q-btn
            type="submit"
            color="primary"
            unelevated
            no-caps
            label="Registrar pago"
            :loading="enviando"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, reactive, ref, watch } from 'vue';

import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Registro de un pago de mensualidad. El `periodoFin` que se muestra es un
 * calculo local de cortesia; el que vale lo calcula el backend con la misma
 * formula (`periodoInicio + plan.duracionMeses`, en meses de calendario).
 */

const propiedades = defineProps({
  modelValue: { type: Boolean, required: true },
  miembro: { type: Object, default: null },
});

const emitir = defineEmits(['update:modelValue', 'creado']);

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const enviando = ref(false);

const METODOS = { EFECTIVO: 'efectivo', TRANSFERENCIA: 'transferencia' };

/**
 * Espejo de `sumarMeses()` del backend, que es la fuente de verdad. El dia se
 * recorta al ultimo del mes destino: quien paga el 31 de enero vence el 28 de
 * febrero, no el 3 de marzo.
 */
function sumarMeses(fecha, meses) {
  const base = new Date(fecha);
  const diaDeseado = base.getDate();

  const resultado = new Date(base);
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() + meses);

  const ultimoDiaDelMes = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(diaDeseado, ultimoDiaDelMes));

  return resultado;
}

function describirDuracion(plan) {
  if (plan.duracionDias != null) {
    return plan.duracionDias === 1 ? '1 dia' : `${plan.duracionDias} dias`;
  }
  return plan.duracionMeses === 1 ? '1 mes' : `${plan.duracionMeses} meses`;
}

/**
 * `new Date('2026-07-09')` es medianoche UTC, que aqui puede ser el dia 8.
 * El `<input type="date">` habla de dias civiles, asi que se ancla a medianoche
 * local. El backend hace lo mismo con `diaCivil`.
 */
function interpretarDiaCivil(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}
const OPCIONES_METODO = [
  { label: 'Efectivo', value: METODOS.EFECTIVO },
  { label: 'Transferencia', value: METODOS.TRANSFERENCIA },
];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

const formulario = reactive({
  planMembresia: null,
  periodoInicio: hoyISO(),
  monto: null,
  metodoPago: METODOS.EFECTIVO,
  referencia: '',
});

/**
 * Los planes son POR SEDE: solo se ofrecen los de la sede DEL MIEMBRO. El dueño
 * ve los de todas, asi que sin este filtro podria elegir uno de otra sede y el
 * backend lo rechazaria ("Ese plan es de otra sede").
 */
const opcionesPlan = computed(() =>
  gimnasio.planesMembresia
    .filter((plan) => plan.activo && plan.sede === propiedades.miembro?.sede)
    .map((plan) => ({
      label: `${plan.nombre} — $${plan.precio.toLocaleString('es-CO')} · ${describirDuracion(plan)}`,
      value: plan._id,
    })),
);

const planElegido = computed(
  () => gimnasio.planesMembresia.find((plan) => plan._id === formulario.planMembresia) ?? null,
);

const esTransferencia = computed(() => formulario.metodoPago === METODOS.TRANSFERENCIA);

const periodoFin = computed(() => {
  if (!planElegido.value || !formulario.periodoInicio) return null;
  const inicio = interpretarDiaCivil(formulario.periodoInicio);
  if (Number.isNaN(inicio.getTime())) return null;

  const plan = planElegido.value;
  if (plan.duracionDias != null) {
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + plan.duracionDias);
    return fin;
  }
  return sumarMeses(inicio, plan.duracionMeses);
});

const periodoFinLegible = computed(() =>
  periodoFin.value
    ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        periodoFin.value,
      )
    : '',
);

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaMonto = (valor) => (typeof valor === 'number' && valor >= 0) || 'Monto invalido';

// Al elegir plan, el monto se propone desde su precio (editable: descuentos).
watch(planElegido, (plan) => {
  if (plan) formulario.monto = plan.precio;
});

// Cada apertura arranca limpia y con los planes cargados.
watch(
  () => propiedades.modelValue,
  async (abierto) => {
    if (!abierto) return;

    Object.assign(formulario, {
      planMembresia: null,
      periodoInicio: hoyISO(),
      monto: null,
      metodoPago: METODOS.EFECTIVO,
      referencia: '',
    });

    if (gimnasio.planesMembresia.length === 0) {
      try {
        await gimnasio.cargarPlanesMembresia();
      } catch {
        quasar.notify({ type: 'negative', message: 'No se pudieron cargar los planes' });
      }
    }
  },
);

async function enviar() {
  enviando.value = true;
  try {
    await gimnasio.registrarPago({
      miembro: propiedades.miembro._id,
      planMembresia: formulario.planMembresia,
      metodoPago: formulario.metodoPago,
      monto: formulario.monto,
      periodoInicio: formulario.periodoInicio,
      ...(esTransferencia.value ? { referencia: formulario.referencia } : {}),
    });

    quasar.notify({
      type: 'positive',
      message: 'Pago registrado',
      caption: `Cubre hasta el ${periodoFinLegible.value}`,
    });

    emitir('creado');
    emitir('update:modelValue', false);
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo registrar el pago',
    });
  } finally {
    enviando.value = false;
  }
}

function cerrar(valor) {
  if (enviando.value) return;
  emitir('update:modelValue', Boolean(valor));
}
</script>

<style scoped>
.tarjeta-pago {
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
