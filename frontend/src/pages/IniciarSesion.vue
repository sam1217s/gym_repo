<template>
  <q-card class="tarjeta-acceso q-pa-lg">
    <q-card-section class="text-center q-pb-none">
      <div class="text-h4 titulo-display">GymSaaS</div>
      <div class="text-caption text-grey-7">Entra al panel de tu gimnasio</div>
    </q-card-section>

    <q-card-section>
      <q-form class="q-gutter-md" @submit.prevent="enviar">
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
  identificador: '',
  contrasena: '',
  slugGimnasio: '',
});

const reglaObligatorio = (valor) => Boolean(valor?.trim()) || 'Este campo es obligatorio';

function enviar() {
  // Se puede entrar por correo o por cedula: ambos viajan en `identificador`.
  // Se recortan los espacios de los bordes: un espacio colado (autocompletado,
  // copiar/pegar, un dedo de mas) hacia que bcrypt no cuadrara y el backend
  // respondiera 401, sin que el usuario viera nada raro en el campo.
  // `slugGimnasio` solo se manda si el backend lo pidio: enviarlo vacio provoca
  // que busque un gimnasio con slug "" y falle.
  const credenciales = {
    identificador: formulario.identificador.trim(),
    contrasena: formulario.contrasena.trim(),
    ...(exigeGimnasio.value ? { slugGimnasio: formulario.slugGimnasio.trim() } : {}),
  };

  return iniciarSesion(credenciales);
}
</script>

<style scoped>
.tarjeta-acceso {
  width: 100%;
  max-width: 420px;
  /* La banda de disco: la misma franja roja que corona el header del panel. */
  border-top: 4px solid var(--q-primary);
}

.enlace-registro {
  color: var(--q-primary);
  font-weight: 600;
  text-decoration: none;
}

</style>
