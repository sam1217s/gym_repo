<template>
  <q-card class="tarjeta-registro q-pa-lg">
    <!-- Al terminar, la pantalla cambia a "revisa tu correo": no hay sesion todavia. -->
    <template v-if="registrado">
      <q-card-section class="text-center">
        <q-icon name="mark_email_read" color="primary" size="52px" />
        <div class="text-h5 titulo-display q-mt-sm">Revisa tu correo</div>
        <p class="text-body2 text-grey-8 q-mt-md">
          Te enviamos un enlace a <strong>{{ correoRegistrado }}</strong>. Ábrelo para activar
          <strong>{{ gimnasioRegistrado }}</strong> y empezar tus 2 meses gratis.
        </p>
        <p class="text-caption text-grey-7">
          ¿No llega? Revisa spam. El enlace vence en 2 días.
        </p>
        <q-btn
          flat
          no-caps
          color="primary"
          label="Ir a iniciar sesión"
          :to="{ name: 'iniciar-sesion' }"
        />
      </q-card-section>
    </template>

    <template v-else>
      <q-card-section class="text-center q-pb-none">
        <div class="text-h4 titulo-display">Registra tu gimnasio</div>
        <div class="text-caption text-grey-7">
          2 meses gratis. Después, {{ precioLegible }}/mes. Sin permanencia.
        </div>
      </q-card-section>

      <q-form @submit.prevent="enviar">
        <q-card-section class="q-gutter-y-md seccion-scroll">
          <div class="encabezado-paso">
            <span class="disco-paso disco-trial">1</span>
            <span class="titulo-display texto-paso">Tu gimnasio</span>
          </div>

          <q-input
            v-model="formulario.gimnasio.nombre"
            label="Nombre del gimnasio"
            outlined
            dense
            :rules="[reglaObligatorio]"
          />
          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.gimnasio.nit"
              class="col-12 col-sm-5"
              label="NIT"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.gimnasio.slug"
              class="col-12 col-sm-7"
              label="Identificador (para entrar)"
              hint="Con él entra tu equipo. Solo minúsculas, números y guiones."
              outlined
              dense
              :rules="[reglaObligatorio, reglaSlug]"
              @update:model-value="slugEditadoAMano = true"
            />
          </div>

          <div class="encabezado-paso">
            <span class="disco-paso disco-activo">2</span>
            <span class="titulo-display texto-paso">Tú, el dueño</span>
          </div>

          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.dueno.nombres"
              class="col-6"
              label="Nombres"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.dueno.apellidos"
              class="col-6"
              label="Apellidos"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
          </div>
          <q-input
            v-model="formulario.dueno.email"
            type="email"
            label="Correo electrónico"
            hint="Te enviaremos el enlace de activación aquí"
            outlined
            dense
            :rules="[reglaObligatorio, reglaEmail]"
          />
          <q-input
            v-model="formulario.dueno.cedula"
            label="Cédula (opcional)"
            hint="Podrás entrar con tu cédula además del correo"
            outlined
            dense
            :rules="[reglaCedulaOpcional]"
          />
          <q-input
            v-model="formulario.dueno.contrasena"
            :type="contrasenaVisible ? 'text' : 'password'"
            label="Contraseña"
            autocomplete="new-password"
            outlined
            dense
            :rules="[reglaObligatorio, reglaContrasena]"
          >
            <template #append>
              <q-icon
                :name="contrasenaVisible ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="contrasenaVisible = !contrasenaVisible"
              />
            </template>
          </q-input>

          <div class="encabezado-paso">
            <span class="disco-paso disco-suspendido">3</span>
            <span class="titulo-display texto-paso">Tu primera sede</span>
          </div>

          <q-input
            v-model="formulario.sede.nombre"
            label="Nombre de la sede"
            outlined
            dense
            :rules="[reglaObligatorio]"
          />
          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.sede.direccion"
              class="col-12 col-sm-7"
              label="Dirección"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.sede.telefono"
              class="col-12 col-sm-5"
              label="Teléfono (opcional)"
              outlined
              dense
            />
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-btn
            type="submit"
            label="Crear mi gimnasio"
            color="primary"
            class="full-width"
            size="lg"
            unelevated
            :loading="enviando"
          />
          <div class="text-center q-mt-md text-caption text-grey-7">
            ¿Ya tienes cuenta?
            <router-link :to="{ name: 'iniciar-sesion' }" class="enlace-login">Inicia sesión</router-link>
          </div>
        </q-card-section>
      </q-form>
    </template>
  </q-card>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { reactive, ref, watch } from 'vue';

import * as servicioAuth from 'src/servicios/auth.servicio.js';

/**
 * Registro abierto de un gimnasio. Al terminar NO inicia sesion: el backend
 * exige verificar el correo primero, asi que la pantalla pasa a "revisa tu
 * correo". El plan y el precio los fija el servidor; aqui solo se muestran.
 */

const quasar = useQuasar();

const PRECIO_MENSUAL = 100_000;
const precioLegible = `$${PRECIO_MENSUAL.toLocaleString('es-CO')}`;

const enviando = ref(false);
const registrado = ref(false);
const contrasenaVisible = ref(false);
const slugEditadoAMano = ref(false);

const correoRegistrado = ref('');
const gimnasioRegistrado = ref('');

const formulario = reactive({
  gimnasio: { nombre: '', nit: '', slug: '' },
  dueno: { nombres: '', apellidos: '', email: '', cedula: '', contrasena: '' },
  sede: { nombre: '', direccion: '', telefono: '' },
});

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaEmail = (valor) => /.+@.+\..+/.test(valor) || 'Email inválido';
// Vacia es válida (opcional); si viene, debe ser numérica.
const reglaCedulaOpcional = (valor) =>
  !String(valor ?? '').trim() || /^\d{4,15}$/.test(valor) || 'Cédula numérica (4 a 15 dígitos)';
const reglaSlug = (valor) =>
  /^[a-z0-9-]{3,}$/.test(valor) || 'Mínimo 3 caracteres: minúsculas, números y guiones';
const reglaContrasena = (valor) =>
  (valor.length >= 8 && /[a-z]/.test(valor) && /[A-Z]/.test(valor) && /\d/.test(valor)) ||
  'Mínimo 8 caracteres, con mayúscula, minúscula y número';

// El identificador se propone desde el nombre hasta que alguien lo edite.
watch(
  () => formulario.gimnasio.nombre,
  (nombre) => {
    if (!slugEditadoAMano.value) formulario.gimnasio.slug = slugificar(nombre);
  },
);

function slugificar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    // Quita los diacriticos que el NFD separo (tildes, dieresis).
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function enviar() {
  enviando.value = true;
  try {
    const resultado = await servicioAuth.registrarGimnasio({
      gimnasio: formulario.gimnasio,
      dueno: formulario.dueno,
      sede: {
        nombre: formulario.sede.nombre,
        direccion: formulario.sede.direccion,
        ...(formulario.sede.telefono.trim() ? { telefono: formulario.sede.telefono } : {}),
      },
    });

    correoRegistrado.value = resultado.email;
    gimnasioRegistrado.value = resultado.gimnasio;
    registrado.value = true;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo completar el registro',
    });
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.tarjeta-registro {
  width: 100%;
  max-width: 480px;
  border-top: 4px solid var(--q-primary);
}

.seccion-scroll {
  max-height: 62vh;
  overflow-y: auto;
}

.encabezado-paso {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.texto-paso {
  font-size: 1.05rem;
  letter-spacing: 0.05em;
}

/* Disco en miniatura: la banda de color es el borde, como el motivo de la marca. */
.disco-paso {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid currentColor;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  color: #1b1e24;
}

.disco-trial {
  color: var(--q-info);
}
.disco-activo {
  color: var(--q-positive);
}
.disco-suspendido {
  color: var(--q-warning);
}

.enlace-login {
  color: var(--q-primary);
  font-weight: 600;
  text-decoration: none;
}
</style>
