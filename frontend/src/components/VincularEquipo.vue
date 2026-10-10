<template>
  <div class="vincular">
    <q-icon name="link" class="vincular-icono" />
    <div class="titulo-display vincular-ceja">Equipo sin vincular</div>

    <div v-if="paso === 'cargando'" class="vincular-texto">
      <q-spinner size="32px" />
    </div>

    <!-- 1. Sin sesion: el dueño entra una vez desde este mismo PC -->
    <template v-else-if="paso === 'sin-sesion'">
      <div class="vincular-titulo">Conecta este lector a una puerta</div>
      <div class="vincular-texto">
        Inicia sesión con la cuenta del dueño del gimnasio. Solo se hace una vez por equipo.
      </div>
      <q-btn class="q-mt-lg" color="primary" unelevated no-caps size="lg" icon="login" label="Iniciar sesión" @click="irAlLogin" />
    </template>

    <!-- 2. Hay sesion, pero no es del dueño -->
    <template v-else-if="paso === 'sin-permiso'">
      <div class="vincular-titulo">Solo el dueño puede vincular el equipo</div>
      <div class="vincular-texto">Entraste como {{ usuario?.nombre ?? 'administrador de sede' }}.</div>
      <q-btn class="q-mt-lg" color="primary" unelevated no-caps size="lg" icon="swap_horiz" label="Entrar con otra cuenta" @click="cambiarCuenta" />
    </template>

    <!-- 3. Elegir la puerta -->
    <q-form v-else-if="paso === 'formulario'" class="vincular-formulario" @submit.prevent="vincularEquipo">
      <div class="vincular-titulo">¿Qué puerta es esta?</div>

      <q-btn-toggle
        v-if="puestos.length"
        v-model="modo"
        class="q-mt-md"
        spread
        no-caps
        unelevated
        toggle-color="primary"
        color="white"
        text-color="dark"
        :options="[
          { label: 'Una puerta nueva', value: 'nuevo' },
          { label: 'Una que ya existe', value: 'existente' },
        ]"
      />

      <div class="q-mt-md q-gutter-y-sm">
        <template v-if="modo === 'nuevo'">
          <q-select v-model="formulario.sede" label="Sede" filled bg-color="white" emit-value map-options :options="opcionesSede" :rules="[obligatorio]" />
          <q-input v-model="formulario.nombre" label="Nombre de la puerta" filled bg-color="white" :rules="[obligatorio]" />
        </template>
        <template v-else>
          <q-select v-model="formulario.puesto" label="Puerta" filled bg-color="white" emit-value map-options :options="opcionesPuesto" :rules="[obligatorio]" />
          <div class="vincular-nota">Si esa puerta estaba en otro equipo, ese equipo dejará de funcionar.</div>
        </template>
      </div>

      <div v-if="error" class="vincular-error">{{ error }}</div>

      <q-btn class="q-mt-md full-width" type="submit" color="primary" unelevated no-caps size="lg" icon="link" label="Vincular este equipo" :loading="vinculando" />
    </q-form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { crearPuestoAcceso, listarPuestosAcceso, listarSedes, regenerarTokenPuesto } from 'src/servicios/gimnasio.servicio.js';
import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';

/**
 * Vincula el PC de la puerta a un puesto SIN tocar archivos: el dueño inicia
 * sesion aqui una vez, elige la puerta, y el token del puesto va directo al agente
 * local por el WebSocket (`vincular`, prop). Nunca se muestra ni se copia.
 *
 * Al terminar se CIERRA la sesion: en un PC de puerta, a la vista de todos, no
 * puede quedar abierta la cuenta del dueño.
 */

const props = defineProps({
  /** `(token) => Promise<{ nombre, sedeNombre }>`: se lo pasa al agente y espera su respuesta. */
  vincular: { type: Function, required: true },
});

const enrutador = useRouter();
const autenticacion = useAutenticacionStore();

const paso = ref('cargando');
const modo = ref('nuevo');
const puestos = ref([]);
const sedes = ref([]);
const formulario = reactive({ sede: null, nombre: 'Puerta principal', puesto: null });
const vinculando = ref(false);
const error = ref('');

const usuario = computed(() => autenticacion.usuario);
const opcionesSede = computed(() => sedes.value.map((sede) => ({ label: sede.nombre, value: sede._id })));
const opcionesPuesto = computed(() =>
  puestos.value.map((puesto) => ({
    label: `${puesto.nombre} · ${puesto.sede?.nombre ?? 'sin sede'}${puesto.activo ? '' : ' (desactivada)'}`,
    value: puesto._id,
  })),
);
const obligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const mensajeError = (causa, porDefecto) => causa.response?.data?.error?.mensaje ?? causa.message ?? porDefecto;

async function preparar() {
  paso.value = 'cargando';
  const sesion = await autenticacion.verificarSesion();
  if (!sesion) {
    paso.value = 'sin-sesion';
    return;
  }
  if (sesion.rol !== ROLES.TENANT_OWNER) {
    paso.value = 'sin-permiso';
    return;
  }

  try {
    [puestos.value, sedes.value] = await Promise.all([listarPuestosAcceso(), listarSedes()]);
    if (sedes.value.length === 1) formulario.sede = sedes.value[0]._id;
    paso.value = 'formulario';
  } catch (causa) {
    error.value = mensajeError(causa, 'No se pudieron cargar las sedes');
    paso.value = 'formulario';
  }
}

function irAlLogin() {
  enrutador.push({ name: 'iniciar-sesion', query: { redirigir: '/acceso' } });
}

async function cambiarCuenta() {
  await autenticacion.cerrarSesion();
  irAlLogin();
}

async function vincularEquipo() {
  vinculando.value = true;
  error.value = '';
  try {
    let token;
    if (modo.value === 'nuevo') {
      const creado = await crearPuestoAcceso({ sede: formulario.sede, nombre: formulario.nombre.trim() });
      token = creado.token;
      // Si el agente falla, el reintento usa ESTA puerta en vez de crear otra igual.
      puestos.value = [...puestos.value, creado.puesto];
      modo.value = 'existente';
      formulario.puesto = creado.puesto._id;
    } else {
      ({ token } = await regenerarTokenPuesto(formulario.puesto));
    }
    await props.vincular(token);
    await autenticacion.cerrarSesion().catch(() => {});
  } catch (causa) {
    error.value = mensajeError(causa, 'No se pudo vincular el equipo');
  } finally {
    vinculando.value = false;
  }
}

onMounted(preparar);
</script>

<style scoped>
.vincular {
  width: min(520px, 100%);
  text-align: center;
}

.vincular-icono {
  font-size: clamp(72px, 10vw, 110px);
  opacity: 0.85;
}

.vincular-ceja {
  margin-top: 8px;
  font-size: clamp(1.2rem, 2.4vw, 1.7rem);
  letter-spacing: 0.06em;
  opacity: 0.8;
}

.vincular-titulo {
  margin-top: 4px;
  font-size: clamp(1.6rem, 3.6vw, 2.4rem);
  font-weight: 700;
  line-height: 1.15;
}

.vincular-texto {
  margin-top: 12px;
  font-size: 1.1rem;
  opacity: 0.85;
}

.vincular-formulario {
  text-align: left;
}
.vincular-formulario .vincular-titulo {
  text-align: center;
}

.vincular-nota {
  font-size: 0.9rem;
  opacity: 0.8;
}

.vincular-error {
  margin-top: 12px;
  padding: 10px 14px;
  border-left: 4px solid var(--q-negative);
  background: rgba(0, 0, 0, 0.3);
  font-size: 0.95rem;
}
</style>
