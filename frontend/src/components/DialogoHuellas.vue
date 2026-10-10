<template>
  <q-dialog :model-value="modelValue" @update:model-value="cerrar">
    <q-card class="tarjeta-huellas">
      <q-card-section class="q-pb-sm">
        <div class="text-h6 titulo-display">Huellas de {{ nombreMiembro }}</div>
        <div class="text-caption text-grey-7">Para entrar por la puerta de cualquier sede.</div>
      </q-card-section>

      <q-separator />

      <!-- Huellas ya registradas -->
      <q-card-section class="seccion-lista">
        <q-inner-loading :showing="cargando" />

        <div v-if="!cargando && huellas.length === 0" class="text-grey-7 text-center q-pa-md">
          Aun no tiene huellas registradas.
        </div>

        <q-list v-else separator>
          <q-item v-for="huella in huellas" :key="huella._id">
            <q-item-section avatar>
              <q-icon name="fingerprint" color="primary" size="md" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ ETIQUETAS_DEDO[huella.dedo] ?? 'Huella' }}</q-item-label>
              <q-item-label caption>Autorizada el {{ fechaLegible(huella.autorizacion?.fecha) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense color="grey-8" icon="delete" :loading="borrandoId === huella._id" @click="borrar(huella)">
                <q-tooltip>Eliminar huella</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-separator />

      <!-- Registro de una huella nueva -->
      <q-card-section v-if="huellas.length < MAX_HUELLAS" class="q-gutter-y-sm">
        <div class="row items-center justify-between">
          <div class="text-subtitle2">Registrar huella</div>
          <span class="chip-banda" :style="{ '--banda': listoParaLeer ? 'var(--q-positive)' : 'var(--q-warning)' }">
            {{ textoEstadoLector }}
          </span>
        </div>

        <template v-if="!capturando">
          <q-select
            v-model="dedo"
            label="Dedo"
            outlined
            dense
            emit-value
            map-options
            :options="OPCIONES_DEDO"
          />
          <q-checkbox v-model="autorizacion" class="texto-autorizacion">
            El miembro autoriza el tratamiento de su huella dactilar (dato sensible) con el unico fin de
            controlar su ingreso a las sedes del gimnasio, conforme a la Ley 1581 de 2012. Puede pedir que se
            elimine en cualquier momento.
          </q-checkbox>
        </template>

        <!-- Las 3 tomas del mismo dedo -->
        <div v-else class="panel-captura text-center q-pa-md">
          <q-icon name="fingerprint" size="64px" :color="avisoRepetir ? 'warning' : 'primary'" class="huella-pulso" />
          <div class="text-h6 q-mt-sm">{{ guardando ? 'Guardando…' : `Pon el dedo en el lector (${paso} de ${total})` }}</div>
          <div class="text-caption" :class="avisoRepetir ? 'text-warning text-weight-medium' : 'text-grey-7'">
            {{ avisoRepetir || 'Apoyalo plano, levantalo y vuelve a ponerlo cuando se pida.' }}
          </div>
          <q-linear-progress :value="(paso - 1) / total" color="primary" class="q-mt-md" rounded />
        </div>
      </q-card-section>

      <q-card-section v-else class="text-caption text-grey-7">
        Ya tiene {{ MAX_HUELLAS }} huellas registradas. Elimina una para registrar otra.
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn v-if="capturando" flat no-caps label="Cancelar" :disable="guardando" @click="cancelarCaptura" />
        <q-btn v-else flat no-caps label="Cerrar" @click="cerrar(false)" />
        <q-btn
          v-if="!capturando && huellas.length < MAX_HUELLAS"
          color="primary"
          unelevated
          no-caps
          icon="fingerprint"
          label="Tomar huella"
          :disable="!autorizacion || !listoParaLeer"
          @click="iniciarCaptura"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import { useAgenteAcceso } from 'src/composables/useAgenteAcceso.js';
import { eliminarHuella, listarHuellas, registrarHuella } from 'src/servicios/gimnasio.servicio.js';

/**
 * Registro de huellas desde la ficha del miembro. Se monta solo mientras esta
 * abierto (asi no se conecta al agente si nadie lo usa).
 *
 * Flujo: el agente local toma 3 capturas del mismo dedo y devuelve la plantilla
 * fusionada; esta pantalla la sube con la sesion de quien registra (el agente
 * nunca sube nada por su cuenta) y luego le pide al agente que se resincronice.
 */

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  miembro: { type: Object, default: null },
});
// `actualizado`: se registro o borro una huella (la tabla repinta el icono).
const emit = defineEmits(['update:modelValue', 'actualizado']);

const quasar = useQuasar();

const MAX_HUELLAS = 2;
const ETIQUETAS_DEDO = {
  indice_derecho: 'Indice derecho',
  pulgar_derecho: 'Pulgar derecho',
  medio_derecho: 'Medio derecho',
  anular_derecho: 'Anular derecho',
  menique_derecho: 'Menique derecho',
  indice_izquierdo: 'Indice izquierdo',
  pulgar_izquierdo: 'Pulgar izquierdo',
  medio_izquierdo: 'Medio izquierdo',
  anular_izquierdo: 'Anular izquierdo',
  menique_izquierdo: 'Menique izquierdo',
};
const OPCIONES_DEDO = Object.entries(ETIQUETAS_DEDO).map(([value, label]) => ({ value, label }));

const huellas = ref([]);
const cargando = ref(false);
const borrandoId = ref(null);

const dedo = ref('indice_derecho');
const autorizacion = ref(false);
const capturando = ref(false);
const guardando = ref(false);
const paso = ref(1);
const total = ref(3);
const avisoRepetir = ref('');

const nombreMiembro = computed(() => (props.miembro ? `${props.miembro.nombres} ${props.miembro.apellidos}` : ''));

const { conectado, estado, enviar } = useAgenteAcceso(alMensajeAgente);

const listoParaLeer = computed(() => conectado.value && estado.value.lector);
const textoEstadoLector = computed(() => {
  if (!conectado.value) return 'Agente de huella apagado';
  if (!estado.value.lector) return 'Lector desconectado';
  return 'Lector listo';
});

function fechaLegible(valor) {
  return valor ? new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

async function cargar() {
  if (!props.miembro) return;
  cargando.value = true;
  try {
    huellas.value = await listarHuellas(props.miembro._id);
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudieron cargar las huellas' });
  } finally {
    cargando.value = false;
  }
}

function iniciarCaptura() {
  avisoRepetir.value = '';
  paso.value = 1;
  if (enviar({ tipo: 'enrolar' })) capturando.value = true;
}

function cancelarCaptura() {
  enviar({ tipo: 'cancelar' });
  capturando.value = false;
}

async function alMensajeAgente(mensaje) {
  if (!capturando.value) return;

  if (mensaje.tipo === 'enrolamiento') {
    paso.value = mensaje.paso;
    total.value = mensaje.total;
    avisoRepetir.value = '';
  } else if (mensaje.tipo === 'enrolamiento_repetir') {
    avisoRepetir.value = 'No coincide con la toma anterior. Usa el MISMO dedo.';
  } else if (mensaje.tipo === 'enrolamiento_duplicada') {
    capturando.value = false;
    const esDelMismo = mensaje.miembro === props.miembro?._id;
    quasar.notify({
      type: 'warning',
      message: esDelMismo ? 'Ese dedo ya esta registrado para este miembro' : 'Esa huella ya esta registrada a nombre de otro miembro',
    });
  } else if (mensaje.tipo === 'enrolamiento_listo') {
    await guardar(mensaje.plantilla);
  } else if (mensaje.tipo === 'error') {
    capturando.value = false;
    quasar.notify({ type: 'negative', message: mensaje.mensaje });
  }
}

async function guardar(plantilla) {
  guardando.value = true;
  try {
    await registrarHuella(props.miembro._id, { plantilla, dedo: dedo.value, autorizacionDatosBiometricos: true });
    enviar({ tipo: 'sincronizar' });
    quasar.notify({ type: 'positive', message: `Huella registrada para ${nombreMiembro.value}` });
    emit('actualizado');
    capturando.value = false;
    emit('update:modelValue', false);
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar la huella' });
  } finally {
    guardando.value = false;
    capturando.value = false;
  }
}

function borrar(huella) {
  quasar
    .dialog({
      title: 'Eliminar huella',
      message: `¿Eliminar la huella "${ETIQUETAS_DEDO[huella.dedo] ?? 'Huella'}"? Ya no servira para entrar.`,
      cancel: { flat: true, noCaps: true, label: 'Cancelar' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Eliminar' },
    })
    .onOk(async () => {
      borrandoId.value = huella._id;
      try {
        await eliminarHuella(props.miembro._id, huella._id);
        enviar({ tipo: 'sincronizar' });
        emit('actualizado');
        await cargar();
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo eliminar' });
      } finally {
        borrandoId.value = null;
      }
    });
}

function cerrar(valor) {
  if (capturando.value) cancelarCaptura();
  emit('update:modelValue', valor);
}

onMounted(cargar);
</script>

<style scoped>
.tarjeta-huellas {
  width: 100%;
  max-width: 480px;
  border-top: 4px solid var(--q-primary);
}

.seccion-lista {
  position: relative;
  min-height: 72px;
}

.texto-autorizacion {
  font-size: 0.8rem;
  line-height: 1.35;
  align-items: flex-start;
}

.panel-captura {
  background: #f4f6f8;
  border-radius: 8px;
}

.huella-pulso {
  animation: pulso 1.4s ease-in-out infinite;
}

@keyframes pulso {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
</style>
