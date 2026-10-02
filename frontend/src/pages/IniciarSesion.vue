<template>
  <q-card class="tarjeta-acceso q-pa-lg">
    <q-card-section class="text-center q-pb-none">
      <img src="/landing/logo-barichara.jpeg" alt="Logo Gym Barichara" class="logo-acceso" />
      <div class="text-h4 titulo-display">Gym Barichara</div>
      <div class="text-caption text-grey-7">Acceso para funcionarios</div>
    </q-card-section>

    <q-tabs v-model="modo" class="text-grey-7 q-mt-sm" active-color="primary" indicator-color="primary" dense narrow-indicator>
      <q-tab name="correo" icon="badge" label="Correo" no-caps />
      <q-tab name="telefono" icon="smartphone" label="Telefono" no-caps />
    </q-tabs>
    <q-separator />

    <q-tab-panels v-model="modo" animated>
      <!-- Acceso por correo/cedula + contrasena -->
      <q-tab-panel name="correo">
        <q-form class="q-gutter-md" @submit.prevent="enviarCredenciales">
          <q-input
            v-model="formulario.identificador"
            label="Correo o cedula"
            autocomplete="username"
            outlined
            :rules="[reglaObligatorio]"
          >
            <template #prepend><q-icon name="badge" /></template>
          </q-input>

          <q-input
            v-model="formulario.contrasena"
            :type="contrasenaVisible ? 'text' : 'password'"
            label="Contrasena"
            autocomplete="current-password"
            outlined
            :rules="[reglaObligatorio]"
          >
            <template #prepend><q-icon name="lock" /></template>
            <template #append>
              <q-icon
                :name="contrasenaVisible ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="contrasenaVisible = !contrasenaVisible"
              />
            </template>
          </q-input>

          <!-- Solo aparece si el backend responde que ese correo existe en varios gimnasios. -->
          <q-input
            v-if="exigeGimnasio"
            v-model="formulario.slugGimnasio"
            label="Identificador de tu gimnasio"
            hint="Por ejemplo: gimnasio-central"
            outlined
            :rules="[reglaObligatorio]"
          >
            <template #prepend><q-icon name="apartment" /></template>
          </q-input>

          <q-btn type="submit" label="Entrar" color="primary" class="full-width" size="lg" unelevated :loading="cargando" />
        </q-form>
      </q-tab-panel>

      <!-- Acceso por telefono + codigo (OTP por SMS o WhatsApp) -->
      <q-tab-panel name="telefono">
        <!-- Paso 1: pedir el codigo -->
        <q-form v-if="!codigoEnviado" class="q-gutter-md" @submit.prevent="pedirCodigo">
          <CampoTelefono v-model="otp.telefono" label="Tu telefono" />

          <div class="text-caption text-grey-7">Enviar el codigo por:</div>
          <q-btn-toggle
            v-model="otp.canal"
            spread
            no-caps
            unelevated
            toggle-color="primary"
            color="grey-3"
            text-color="grey-8"
            :options="[
              { label: 'WhatsApp', value: 'whatsapp', icon: 'chat' },
              { label: 'SMS', value: 'sms', icon: 'sms' },
            ]"
          />

          <q-btn
            type="submit"
            label="Enviar codigo"
            color="primary"
            class="full-width"
            size="lg"
            unelevated
            :loading="cargando"
            :disable="!otp.telefono"
          />
        </q-form>

        <!-- Paso 2: escribir el codigo recibido -->
        <q-form v-else class="q-gutter-md" @submit.prevent="entrarConCodigo">
          <div class="text-body2 text-grey-8">
            Escribe el codigo que enviamos por
            <strong>{{ otp.canal === 'sms' ? 'SMS' : 'WhatsApp' }}</strong>.
          </div>

          <q-input
            v-model="otp.codigo"
            label="Codigo de 6 digitos"
            inputmode="numeric"
            maxlength="6"
            outlined
            autofocus
            :rules="[(v) => /^\d{4,8}$/.test(v || '') || 'Codigo invalido']"
          >
            <template #prepend><q-icon name="password" /></template>
          </q-input>

          <q-btn type="submit" label="Entrar" color="primary" class="full-width" size="lg" unelevated :loading="cargando" />

          <div class="text-center">
            <a class="enlace-registro cursor-pointer" @click="reiniciarOtp">Usar otro numero</a>
          </div>
        </q-form>
      </q-tab-panel>
    </q-tab-panels>

    <div class="text-center q-mt-sm">
      <router-link :to="{ name: 'inicio' }" class="enlace-registro">
        ← Volver al inicio
      </router-link>
    </div>
  </q-card>
</template>

<script setup>
import { reactive, ref } from 'vue';

import CampoTelefono from 'src/components/CampoTelefono.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';

const { iniciarSesion, enviarOtp, iniciarSesionOtp, cargando, exigeGimnasio } = useAutenticacion();

const modo = ref('correo');
const contrasenaVisible = ref(false);

const formulario = reactive({
  identificador: '',
  contrasena: '',
  slugGimnasio: '',
});

const otp = reactive({ telefono: '', canal: 'whatsapp', codigo: '' });
const codigoEnviado = ref(false);

const reglaObligatorio = (valor) => Boolean(valor?.trim()) || 'Este campo es obligatorio';

function enviarCredenciales() {
  // Se puede entrar por correo o por cedula: ambos viajan en `identificador`.
  // Se recortan los espacios de los bordes: un espacio colado (autocompletado,
  // copiar/pegar, un dedo de mas) hacia que bcrypt no cuadrara y el backend
  // respondiera 401. `slugGimnasio` solo se manda si el backend lo pidio.
  const credenciales = {
    identificador: formulario.identificador.trim(),
    contrasena: formulario.contrasena.trim(),
    ...(exigeGimnasio.value ? { slugGimnasio: formulario.slugGimnasio.trim() } : {}),
  };

  return iniciarSesion(credenciales);
}

async function pedirCodigo() {
  const enviado = await enviarOtp({ telefono: otp.telefono, canal: otp.canal });
  if (enviado) codigoEnviado.value = true;
}

function entrarConCodigo() {
  return iniciarSesionOtp({ telefono: otp.telefono, codigo: otp.codigo });
}

function reiniciarOtp() {
  codigoEnviado.value = false;
  otp.codigo = '';
}
</script>

<style scoped>
.logo-acceso {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 8px;
}

.tarjeta-acceso {
  width: 100%;
  max-width: 420px;
  /* La banda de disco: la misma franja roja que corona el header del panel. */
  border-top: 4px solid var(--q-primary);
}

.enlace-registro {
  color: var(--color-primario-texto);
  font-weight: 600;
  text-decoration: none;
}
</style>
