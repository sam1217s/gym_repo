<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="cerrar">
    <q-card class="tarjeta-onboarding">
      <q-card-section class="row items-center q-pb-sm">
        <div>
          <div class="text-h5 titulo-display">Dar de alta un gimnasio</div>
          <div class="text-caption text-grey-7">
            Nace con su dueño y su primera sede, en este orden.
          </div>
        </div>
        <q-space />
        <q-btn flat dense round icon="close" aria-label="Cerrar" :disable="enviando" @click="cerrar(false)" />
      </q-card-section>

      <q-separator />

      <q-form @submit.prevent="enviar">
        <q-card-section class="q-gutter-y-md seccion-scroll">
          <!-- Los numeros no son decoracion: son el orden real de creacion en el backend. -->
          <div class="encabezado-paso">
            <span class="disco-paso disco-trial">1</span>
            <span class="titulo-display texto-paso">El gimnasio</span>
          </div>

          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.gimnasio.nombre"
              class="col-12 col-sm-7"
              label="Nombre del gimnasio"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
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
              label="Identificador (slug)"
              hint="Con el entra su gente cuando el correo se repite entre gimnasios"
              outlined
              dense
              :rules="[reglaObligatorio, reglaSlug]"
              @update:model-value="slugEditadoAMano = true"
            />
            <q-select
              v-model="formulario.gimnasio.planPlataforma"
              class="col-12 col-sm-5"
              label="Plan"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesPlan"
              :rules="[reglaObligatorio]"
            />
          </div>

          <div class="encabezado-paso">
            <span class="disco-paso disco-activo">2</span>
            <span class="titulo-display texto-paso">Su dueño</span>
          </div>

          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.dueno.nombres"
              class="col-12 col-sm-6"
              label="Nombres"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.dueno.apellidos"
              class="col-12 col-sm-6"
              label="Apellidos"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.dueno.email"
              class="col-12 col-sm-6"
              type="email"
              label="Correo electronico"
              outlined
              dense
              :rules="[reglaObligatorio, reglaEmail]"
            />
            <q-input
              v-model="formulario.dueno.contrasenaInicial"
              class="col-12 col-sm-6"
              :type="contrasenaVisible ? 'text' : 'password'"
              label="Contraseña inicial"
              hint="Deberá cambiarla en su primer acceso"
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
          </div>

          <div class="encabezado-paso">
            <span class="disco-paso disco-suspendido">3</span>
            <span class="titulo-display texto-paso">Primera sede</span>
          </div>

          <div class="row q-col-gutter-md">
            <q-input
              v-model="formulario.sede.nombre"
              class="col-12 col-sm-5"
              label="Nombre de la sede"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.sede.direccion"
              class="col-12 col-sm-7"
              label="Direccion"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="formulario.sede.telefono"
              class="col-12 col-sm-5"
              label="Telefono (opcional)"
              outlined
              dense
            />
          </div>
        </q-card-section>

        <q-separator />

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat no-caps label="Descartar" :disable="enviando" @click="cerrar(false)" />
          <q-btn
            type="submit"
            color="primary"
            unelevated
            no-caps
            label="Dar de alta"
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

import { usePlataformaStore } from 'src/stores/plataforma.js';

/**
 * Alta de un gimnasio con sus tres piezas: tenant, dueño y primera sede.
 * El formulario refleja el orden real en que el backend las crea.
 */

const propiedades = defineProps({
  modelValue: { type: Boolean, required: true },
});

const emitir = defineEmits(['update:modelValue', 'creado']);

const plataforma = usePlataformaStore();
const quasar = useQuasar();

const enviando = ref(false);
const contrasenaVisible = ref(false);
const slugEditadoAMano = ref(false);

const FORMULARIO_VACIO = () => ({
  gimnasio: { nombre: '', nit: '', slug: '', planPlataforma: null },
  dueno: { nombres: '', apellidos: '', email: '', contrasenaInicial: '' },
  sede: { nombre: '', direccion: '', telefono: '' },
});

const formulario = reactive(FORMULARIO_VACIO());

const opcionesPlan = computed(() =>
  plataforma.planesAsignables.map((plan) => ({
    label: `${plan.nombre} — $${plan.precioMensual.toLocaleString('es-CO')}/mes`,
    value: plan._id,
  })),
);

// --- Reglas de validacion (espejo de la validacion Zod del backend) ---------
const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaEmail = (valor) => /.+@.+\..+/.test(valor) || 'Email invalido';
const reglaSlug = (valor) =>
  /^[a-z0-9-]{3,}$/.test(valor) || 'Minimo 3 caracteres: minusculas, numeros y guiones';
const reglaContrasena = (valor) =>
  (valor.length >= 8 && /[a-z]/.test(valor) && /[A-Z]/.test(valor) && /\d/.test(valor)) ||
  'Minimo 8 caracteres, con mayuscula, minuscula y numero';

/** El slug se propone desde el nombre hasta que alguien lo toque a mano. */
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

// Los planes se piden al abrir el dialogo, no al montar la pagina.
watch(
  () => propiedades.modelValue,
  async (abierto) => {
    if (abierto && plataforma.planes.length === 0) {
      try {
        await plataforma.cargarPlanes();
      } catch {
        quasar.notify({ type: 'negative', message: 'No se pudieron cargar los planes' });
      }
    }
  },
);

async function enviar() {
  enviando.value = true;
  try {
    const creado = await plataforma.crearGimnasio({
      gimnasio: formulario.gimnasio,
      dueno: formulario.dueno,
      sede: {
        nombre: formulario.sede.nombre,
        direccion: formulario.sede.direccion,
        ...(formulario.sede.telefono.trim() ? { telefono: formulario.sede.telefono } : {}),
      },
    });

    quasar.notify({
      type: 'positive',
      message: `${creado.tenant.nombre} dado de alta`,
      caption: 'El dueño deberá cambiar su contraseña al entrar',
    });

    reiniciar();
    emitir('creado', creado);
    emitir('update:modelValue', false);
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo dar de alta el gimnasio',
    });
  } finally {
    enviando.value = false;
  }
}

function reiniciar() {
  Object.assign(formulario, FORMULARIO_VACIO());
  slugEditadoAMano.value = false;
  contrasenaVisible.value = false;
}

function cerrar(valor) {
  if (enviando.value) return;
  emitir('update:modelValue', Boolean(valor));
}
</script>

<style scoped>
.tarjeta-onboarding {
  width: 100%;
  max-width: 680px;
  border-top: 4px solid var(--q-primary);
}

.seccion-scroll {
  max-height: 70vh;
  overflow-y: auto;
}

.encabezado-paso {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.texto-paso {
  font-size: 1.1rem;
  letter-spacing: 0.05em;
}

/* Un disco en miniatura: la banda de color es el borde. */
.disco-paso {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 3px solid currentColor;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
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
</style>
