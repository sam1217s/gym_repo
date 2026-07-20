<template>
  <q-page padding class="pagina-panel">
    <div class="q-mb-lg">
      <div class="ceja">Mi gimnasio</div>
      <h1 class="titulo-display titulo-pagina q-my-none">Cobros a miembros</h1>
      <div class="text-caption text-grey-7">
        Conecta tu cuenta de Wompi para que tus miembros paguen la mensualidad en línea, por
        WhatsApp. El dinero cae en <strong>tu</strong> Wompi, no en el de GymSaaS.
      </div>
    </div>

    <q-card flat bordered class="tarjeta-cobros">
      <q-card-section class="row items-center q-gutter-sm">
        <span
          class="chip-banda"
          :style="{ '--banda': config.configurado ? 'var(--q-positive)' : 'var(--q-warning)' }"
        >
          {{ config.configurado ? 'Pago en línea activo' : 'Sin configurar' }}
        </span>
        <q-space />
        <q-btn
          v-if="!editando && config.configurado"
          flat
          no-caps
          color="primary"
          icon="edit"
          label="Cambiar llaves"
          @click="empezarEdicion"
        />
      </q-card-section>

      <q-separator />

      <!-- Estado de solo lectura: ya configurado y sin editar. -->
      <q-card-section v-if="config.configurado && !editando">
        <div class="text-caption text-grey-7">Llave pública</div>
        <div class="cifra-tabular q-mb-md">{{ config.llavePublica }}</div>
        <div class="text-caption text-grey-7">Los secretos están guardados y no se muestran.</div>
      </q-card-section>

      <!-- Formulario: primera vez o al cambiar llaves. -->
      <q-form v-else @submit.prevent="guardar">
        <q-card-section class="q-gutter-y-md">
          <q-input
            v-model="formulario.llavePublica"
            label="Llave pública"
            hint="Empieza por pub_prod_ (o pub_test_ en pruebas)"
            outlined
            dense
            :rules="[reglaObligatorio]"
          />
          <q-input
            v-model="formulario.secretoIntegridad"
            :type="verSecretos ? 'text' : 'password'"
            label="Secreto de integridad"
            outlined
            dense
            :rules="[reglaObligatorio]"
          >
            <template #append>
              <q-icon
                :name="verSecretos ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="verSecretos = !verSecretos"
              />
            </template>
          </q-input>
          <q-input
            v-model="formulario.secretoEventos"
            :type="verSecretos ? 'text' : 'password'"
            label="Secreto de eventos"
            hint="El que separa un pago real de uno falso. No lo compartas."
            outlined
            dense
            :rules="[reglaObligatorio]"
          />
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn v-if="editando" flat no-caps label="Cancelar" :disable="guardando" @click="cancelar" />
          <q-btn type="submit" color="primary" unelevated no-caps label="Guardar llaves" :loading="guardando" />
        </q-card-actions>
      </q-form>
    </q-card>

    <!-- La URL del webhook: hay que registrarla en el panel de Wompi. -->
    <q-card flat bordered class="tarjeta-cobros q-mt-md">
      <q-card-section>
        <div class="text-subtitle2 titulo-display">Un paso en Wompi</div>
        <p class="text-body2 text-grey-8 q-mt-sm q-mb-sm">
          En tu panel de Wompi, registra esta URL como <strong>URL de eventos</strong> para que nos
          avise cuando un miembro pague:
        </p>
        <div class="fila-webhook">
          <code class="url-webhook">{{ config.urlWebhook }}</code>
          <q-btn flat dense round icon="content_copy" aria-label="Copiar" @click="copiar(config.urlWebhook)" />
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { onMounted, reactive, ref } from 'vue';

import * as servicioCobros from 'src/servicios/cobros.servicio.js';

/**
 * Config del cobro en linea a miembros. Solo el dueno. Los secretos nunca
 * vuelven del backend: al cambiarlos hay que escribir los tres de nuevo.
 */

const quasar = useQuasar();

const config = reactive({ configurado: false, llavePublica: null, urlWebhook: '' });
const editando = ref(false);
const guardando = ref(false);
const verSecretos = ref(false);

const formulario = reactive({ llavePublica: '', secretoIntegridad: '', secretoEventos: '' });

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';

function empezarEdicion() {
  formulario.llavePublica = config.llavePublica ?? '';
  formulario.secretoIntegridad = '';
  formulario.secretoEventos = '';
  verSecretos.value = false;
  editando.value = true;
}

function cancelar() {
  editando.value = false;
}

async function guardar() {
  guardando.value = true;
  try {
    const actualizada = await servicioCobros.guardarConfig({ ...formulario });
    Object.assign(config, actualizada);
    editando.value = false;
    quasar.notify({ type: 'positive', message: 'Llaves guardadas' });
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudieron guardar las llaves',
    });
  } finally {
    guardando.value = false;
  }
}

function copiar(texto) {
  navigator.clipboard?.writeText(texto);
  quasar.notify({ type: 'positive', message: 'URL copiada', timeout: 1200 });
}

onMounted(async () => {
  try {
    Object.assign(config, await servicioCobros.obtenerConfig());
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar la configuración de cobros' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 720px;
  margin: 0 auto;
}

.tarjeta-cobros {
  border-top: 4px solid var(--q-primary);
}

.fila-webhook {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f2f4f7;
  border-radius: 8px;
  padding: 8px 12px;
}

.url-webhook {
  flex: 1;
  word-break: break-all;
  font-size: 0.85rem;
}
</style>
