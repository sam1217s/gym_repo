<template>
  <q-page class="flex flex-center">
    <q-card class="tarjeta-contrasena q-pa-md">
      <q-card-section>
        <div class="text-h6">Cambia tu contrasena</div>
        <div v-if="esObligatorio" class="text-caption text-warning q-mt-xs">
          Es tu primer acceso: debes definir una contrasena propia antes de continuar.
        </div>
      </q-card-section>

      <q-card-section>
        <q-form class="q-gutter-md" @submit.prevent="enviar">
          <q-input
            v-model="formulario.contrasenaActual"
            type="password"
            label="Contrasena actual"
            autocomplete="current-password"
            outlined
            :rules="[reglaObligatorio]"
          />

          <q-input
            v-model="formulario.contrasenaNueva"
            type="password"
            label="Contrasena nueva"
            autocomplete="new-password"
            outlined
            :rules="reglasContrasenaNueva"
          />

          <q-input
            v-model="confirmacion"
            type="password"
            label="Repite la contrasena nueva"
            autocomplete="new-password"
            outlined
            :rules="[reglaCoincide]"
          />

          <q-btn
            type="submit"
            label="Guardar"
            color="primary"
            class="full-width"
            unelevated
            :loading="cargando"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';

import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { useAutenticacionStore } from 'src/stores/autenticacion.js';

const LONGITUD_MINIMA = 8;

const { cambiarContrasena, cargando } = useAutenticacion();
const autenticacion = useAutenticacionStore();

const esObligatorio = computed(() => autenticacion.debeCambiarContrasena);

const formulario = reactive({ contrasenaActual: '', contrasenaNueva: '' });
const confirmacion = ref('');

const reglaObligatorio = (valor) => Boolean(valor) || 'Este campo es obligatorio';

// Espejo de `validaciones/auth.validacion.js` en el backend. El backend manda:
// esto solo evita un viaje al servidor para descubrir lo obvio.
const reglasContrasenaNueva = [
  reglaObligatorio,
  (valor) => valor.length >= LONGITUD_MINIMA || `Minimo ${LONGITUD_MINIMA} caracteres`,
  (valor) => /[a-z]/.test(valor) || 'Debe incluir una minuscula',
  (valor) => /[A-Z]/.test(valor) || 'Debe incluir una mayuscula',
  (valor) => /\d/.test(valor) || 'Debe incluir un numero',
  (valor) => valor !== formulario.contrasenaActual || 'Debe ser distinta de la actual',
];

const reglaCoincide = (valor) => valor === formulario.contrasenaNueva || 'Las contrasenas no coinciden';

function enviar() {
  return cambiarContrasena({ ...formulario });
}
</script>

<style scoped>
.tarjeta-contrasena {
  width: 100%;
  max-width: 460px;
}
</style>
