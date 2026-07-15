<template>
  <q-card class="tarjeta-verificar q-pa-lg text-center">
    <q-card-section>
      <template v-if="estado === 'verificando'">
        <q-spinner color="primary" size="42px" />
        <div class="text-h6 titulo-display q-mt-md">Verificando tu correo…</div>
      </template>

      <template v-else-if="estado === 'ok'">
        <q-icon name="check_circle" color="positive" size="52px" />
        <div class="text-h5 titulo-display q-mt-sm">¡Correo confirmado!</div>
        <p class="text-body2 text-grey-8 q-mt-md">
          Tu cuenta ya está activa. Entra y empieza tus 2 meses gratis.
        </p>
        <q-btn
          color="primary"
          unelevated
          no-caps
          size="lg"
          label="Iniciar sesión"
          :to="{ name: 'iniciar-sesion' }"
        />
      </template>

      <template v-else>
        <q-icon name="error_outline" color="negative" size="52px" />
        <div class="text-h5 titulo-display q-mt-sm">No pudimos verificar</div>
        <p class="text-body2 text-grey-8 q-mt-md">{{ mensajeError }}</p>
        <q-btn flat no-caps color="primary" label="Ir a iniciar sesión" :to="{ name: 'iniciar-sesion' }" />
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import * as servicioAuth from 'src/servicios/auth.servicio.js';

/**
 * Aterriza el enlace del correo de verificacion. Lee el token de la URL, lo
 * canjea contra el backend, y muestra el resultado. No abre sesion: solo
 * desbloquea el login.
 */

const ruta = useRoute();

const estado = ref('verificando'); // verificando | ok | error
const mensajeError = ref('');

onMounted(async () => {
  const token = ruta.query.token;

  if (!token) {
    estado.value = 'error';
    mensajeError.value = 'El enlace está incompleto. Vuelve a abrirlo desde el correo.';
    return;
  }

  try {
    await servicioAuth.verificarEmail(token);
    estado.value = 'ok';
  } catch (error) {
    estado.value = 'error';
    mensajeError.value =
      error.response?.data?.error?.mensaje ??
      'El enlace no es válido o ya expiró. Regístrate de nuevo o pide otro enlace.';
  }
});
</script>

<style scoped>
.tarjeta-verificar {
  width: 100%;
  max-width: 420px;
  border-top: 4px solid var(--q-primary);
}
</style>
