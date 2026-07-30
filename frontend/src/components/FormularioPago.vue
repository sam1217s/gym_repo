<template>
  <q-dialog :model-value="modelValue" @update:model-value="cerrar">
    <q-card class="tarjeta-pago">
      <q-inner-loading :showing="preparando" label="Cargando datos del pago…" />

      <q-card-section class="q-pb-sm">
        <div class="text-h6 titulo-display">{{ modoAprobacion ? 'Aprobar pago' : 'Registrar pago' }}</div>
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

          <!-- En aprobacion la fecha (hoy) y el monto (precio del plan) se dan
               por sentados: ya se verifico el comprobante, no hay que teclearlos. -->
          <div v-if="!modoAprobacion" class="row q-col-gutter-md">
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
          <!-- En aprobacion: se muestra el plan del miembro y el valor esperado
               BIEN visible, para cotejarlo con el monto del comprobante. -->
          <q-banner v-if="modoAprobacion && planElegido" dense class="banner-aprobacion">
            <div class="row items-baseline justify-between">
              <div class="text-weight-medium">{{ planElegido.nombre }}</div>
              <div class="valor-aprobacion cifra-tabular">
                ${{ Number(formulario.monto || 0).toLocaleString('es-CO') }}
              </div>
            </div>
            <div class="text-caption text-grey-8 q-mt-xs">
              Transferencia · cubre hasta el {{ periodoFinLegible }}
            </div>
            <div class="text-caption text-orange-9 q-mt-xs">
              Verifica que este valor coincida con el del comprobante.
            </div>
          </q-banner>

          <q-banner v-else-if="periodoFin" dense class="banner-vencimiento">
            Cubre hasta el <strong>{{ periodoFinLegible }}</strong>
            ({{ describirDuracion(planElegido) }} de {{ planElegido.nombre }})
          </q-banner>

          <div v-if="!modoAprobacion">
            <div class="text-caption text-grey-7 q-mb-xs">Metodo de pago</div>
            <q-option-group
              v-model="formulario.metodoPago"
              inline
              :options="OPCIONES_METODO"
            />
          </div>

          <q-input
            v-if="esTransferencia && !modoAprobacion"
            v-model="formulario.referencia"
            label="Referencia de la transferencia (opcional)"
            hint="Numero de comprobante, si lo tienes a la mano"
            outlined
            dense
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
            :label="modoAprobacion ? 'Aprobar pago' : 'Registrar pago'"
            :loading="enviando"
            :disable="preparando"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, reactive, ref, watch } from 'vue';

import { listarPagosDeMiembro } from 'src/servicios/gimnasio.servicio.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Registro de un pago de mensualidad. El `periodoFin` que se muestra es un
 * calculo local de cortesia; el que vale lo calcula el backend con la misma
 * formula (`periodoInicio + plan.duracionMeses`, en meses de calendario).
 */

const propiedades = defineProps({
  modelValue: { type: Boolean, required: true },
  miembro: { type: Object, default: null },
  // Modo "aprobar comprobante" (desde la bandeja): ya se verifico el pago, asi
  // que se fija transferencia, se ocultan fecha/monto/referencia y se
  // preselecciona el plan. Un clic aprueba.
  modoAprobacion: { type: Boolean, default: false },
});

const emitir = defineEmits(['update:modelValue', 'creado']);

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const enviando = ref(false);
// Se prepara la aprobacion (trae el plan del ultimo pago): muestra spinner.
const preparando = ref(false);

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

/**
 * Fecha (o ISO) -> "YYYY-MM-DD" del dia LOCAL, para el `<input type="date">`.
 * Se usan los componentes locales (no `toISOString`, que es UTC y correria el
 * dia) para que coincida con como se muestra el vencimiento en la tabla.
 */
function aFechaInput(valor) {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const OPCIONES_METODO = [
  { label: 'Efectivo', value: METODOS.EFECTIVO },
  { label: 'Transferencia', value: METODOS.TRANSFERENCIA },
];

// "Hoy" en dia LOCAL, no UTC: cerca de medianoche `toISOString` daria el dia
// equivocado.
function hoyISO() {
  return aFechaInput(new Date());
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
      // En aprobacion el metodo es SIEMPRE transferencia (el miembro pago por ahi).
      metodoPago: propiedades.modoAprobacion ? METODOS.TRANSFERENCIA : METODOS.EFECTIVO,
      referencia: '',
    });

    // En aprobacion se espera a tener plan+monto para poder cotejar; se muestra un
    // spinner en vez de un modal a medio llenar. Las dos consultas van EN PARALELO.
    preparando.value = propiedades.modoAprobacion;
    try {
      const tareas = [];
      if (gimnasio.planesMembresia.length === 0) tareas.push(gimnasio.cargarPlanesMembresia());

      // Se trae el ultimo pago para preseleccionar SU plan, tanto al aprobar como
      // al registrar normal: el plan del miembro se autocompleta y no hay que
      // elegirlo (se puede cambiar igual). Va en paralelo con la carga de planes.
      const pagosPromesa = propiedades.miembro
        ? listarPagosDeMiembro(propiedades.miembro._id).catch(() => [])
        : null;

      await Promise.all(tareas);

      const pagos = pagosPromesa ? await pagosPromesa : [];
      const ultimo = pagos?.[0] ?? null; // vienen del mas reciente al mas viejo

      // Inicio = VENCIMIENTO del ultimo pago: el nuevo mes continua donde termino
      // el anterior (no se "pierde" la mensualidad por pagar tarde). Si nunca ha
      // pagado, arranca hoy. En el form completo la fecha es editable para el
      // caso raro de alguien con MESES vencido (quedaria en el pasado).
      if (ultimo?.periodoFin) {
        formulario.periodoInicio = aFechaInput(ultimo.periodoFin);
      }

      const elegido = ultimo?.planMembresia?._id ?? null;
      const enOpciones = elegido && opcionesPlan.value.some((opcion) => opcion.value === elegido);
      if (enOpciones) {
        formulario.planMembresia = elegido;
      } else if (opcionesPlan.value.length === 1) {
        formulario.planMembresia = opcionesPlan.value[0].value;
      }
    } catch {
      quasar.notify({ type: 'negative', message: 'No se pudieron cargar los planes' });
    } finally {
      preparando.value = false;
    }
  },
);

async function enviar() {
  enviando.value = true;
  try {
    const pago = await gimnasio.registrarPago({
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

    // Se emite el pago creado (con su periodoFin) por si el padre lo necesita,
    // p.ej. la bandeja, que le confirma al miembro por WhatsApp.
    emitir('creado', pago);
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

.banner-aprobacion {
  background: rgba(206, 17, 38, 0.06);
  border-left: 4px solid var(--q-primary);
  border-radius: 3px;
}

.valor-aprobacion {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--q-secondary);
}
</style>
