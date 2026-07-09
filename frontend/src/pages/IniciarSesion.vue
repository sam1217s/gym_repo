<template>
  <q-card class="tarjeta-acceso q-pa-lg">
    <q-card-section class="text-center q-pb-none">
      <div class="text-h5 text-weight-bold">GymSaaS</div>
      <div class="text-caption text-grey-7">Entra al panel de tu gimnasio</div>
    </q-card-section>

    <q-card-section>
      <q-form class="q-gutter-md" @submit.prevent="enviar">
        <q-input
          v-model="formulario.email"
          type="email"
          label="Correo electronico"
          autocomplete="username"
          outlined
          :rules="[reglaObligatorio]"
        >
          <template #prepend><q-icon name="mail" /></template>
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

        <q-btn
          type="submit"
          label="Entrar"
          color="primary"
          class="full-width"
          size="lg"
          unelevated
          :loading="cargando"
        />
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { reactive, ref } from 'vue';

import { useAutenticacion } from 'src/composables/useAutenticacion.js';

const { iniciarSesion, cargando, exigeGimnasio } = useAutenticacion();

const contrasenaVisible = ref(false);

const formulario = reactive({
  email: '',
  contrasena: '',
  slugGimnasio: '',
});

const reglaObligatorio = (valor) => Boolean(valor?.trim()) || 'Este campo es obligatorio';

function enviar() {
  // `slugGimnasio` solo se manda si el backend lo pidio: enviarlo vacio provoca
  // que busque un gimnasio con slug "" y falle.
  const credenciales = {
    email: formulario.email,
    contrasena: formulario.contrasena,
    ...(exigeGimnasio.value ? { slugGimnasio: formulario.slugGimnasio } : {}),
  };

  return iniciarSesion(credenciales);
}
</script>

<style scoped>
.tarjeta-acceso {
  width: 100%;
  max-width: 420px;
}
</style>
