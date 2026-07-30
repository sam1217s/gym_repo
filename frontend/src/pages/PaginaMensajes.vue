<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-md">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Mensajes</h1>
        <div class="text-caption text-grey-7">
          Lo que te escriben por WhatsApp: comprobantes de pago y preguntas
        </div>
      </div>
      <div class="row items-center q-gutter-sm">
        <!-- Cada sede cobra una mensualidad distinta: el dueño filtra por sede
             para ver solo los comprobantes de una. Un sede_admin no lo ve: su
             rol ya lo deja en una sola sede. -->
        <q-select
          v-if="esDueno"
          v-model="sedeFiltro"
          :options="opcionesSede"
          emit-value
          map-options
          dense
          outlined
          options-dense
          label="Sede"
          style="min-width: 170px"
        />
        <q-btn
          flat
          dense
          no-caps
          icon="refresh"
          label="Actualizar"
          color="primary"
          :loading="cargando"
          @click="cargar"
        />
      </div>
    </div>

    <div v-if="conversaciones.length === 0 && !cargando" class="estado-vacio">
      <q-icon name="chat_bubble_outline" size="42px" color="grey-6" />
      <div class="q-mt-sm">Aun no hay mensajes.</div>
      <div class="text-caption q-mt-xs">
        Llegan aqui cuando alguien le escribe al WhatsApp del gimnasio.
      </div>
    </div>

    <div v-else class="row q-col-gutter-md">
      <!-- Lista de conversaciones. En movil se oculta al abrir una. -->
      <div v-show="!enHilo || $q.screen.gt.sm" class="col-12 col-md-4">
        <q-list bordered separator class="rounded-borders lista-hilos">
          <q-item
            v-for="conversacion in conversaciones"
            :key="conversacion.telefono"
            v-ripple
            clickable
            :active="conversacion.telefono === telefonoAbierto"
            active-class="hilo-activo"
            @click="abrir(conversacion)"
          >
            <q-item-section avatar>
              <q-avatar :color="conversacion.pendientes ? 'primary' : 'grey-5'" text-color="white">
                {{ inicial(conversacion) }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">
                {{ titulo(conversacion) }}
                <q-badge
                  v-if="nombreSede(conversacion)"
                  outline
                  color="secondary"
                  class="q-ml-xs badge-sede"
                >
                  {{ nombreSede(conversacion) }}
                </q-badge>
              </q-item-label>
              <q-item-label caption lines="1">{{ resumen(conversacion.ultimo) }}</q-item-label>
            </q-item-section>
            <q-item-section side top>
              <div class="text-caption text-grey-7">{{ formatearHora(conversacion.ultimo.createdAt) }}</div>
              <q-badge v-if="conversacion.pendientes" color="primary" rounded class="q-mt-xs">
                {{ conversacion.pendientes }}
              </q-badge>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Hilo abierto -->
      <div v-if="hilo" class="col-12 col-md-8">
        <q-card flat bordered class="tarjeta-hilo">
          <q-card-section class="row items-center q-py-sm cabecera-hilo">
            <q-btn
              v-if="$q.screen.lt.md"
              flat
              dense
              round
              icon="arrow_back"
              class="q-mr-sm"
              @click="telefonoAbierto = null"
            />
            <div class="col">
              <div class="text-weight-medium">
                {{ titulo(hilo) }}
                <q-badge
                  v-if="nombreSede(hilo)"
                  outline
                  color="secondary"
                  class="q-ml-xs badge-sede"
                >
                  {{ nombreSede(hilo) }}
                </q-badge>
              </div>
              <div class="text-caption text-grey-7">
                +{{ hilo.telefono }}
                <span v-if="!hilo.miembro"> · sin miembro asociado</span>
              </div>
            </div>
            <q-btn
              v-if="hilo.miembro"
              unelevated
              no-caps
              dense
              color="primary"
              icon="check_circle"
              label="Aprobar pago"
              @click="registrarPago"
            />
          </q-card-section>

          <q-separator />

          <q-card-section class="conversacion">
            <div
              v-for="mensaje in hilo.mensajes"
              :key="mensaje._id"
              class="fila-burbuja"
              :class="mensaje.direccion === 'saliente' ? 'justify-end' : 'justify-start'"
            >
              <div class="burbuja" :class="`burbuja-${mensaje.direccion}`">
                <!-- El comprobante es el dato: se ve aqui, no detras de un enlace. -->
                <q-img
                  v-if="esImagen(mensaje)"
                  :src="urlArchivo(mensaje._id)"
                  class="comprobante cursor-pointer"
                  fit="contain"
                  @click="ampliado = urlArchivo(mensaje._id)"
                />
                <q-btn
                  v-else-if="mensaje.archivo"
                  flat
                  dense
                  no-caps
                  icon="description"
                  label="Ver archivo"
                  type="a"
                  :href="urlArchivo(mensaje._id)"
                  target="_blank"
                />
                <div v-if="mensaje.texto" class="texto-burbuja">{{ mensaje.texto }}</div>
                <div class="hora-burbuja">{{ formatearHora(mensaje.createdAt) }}</div>
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-pa-sm">
            <q-form class="row items-end q-col-gutter-sm" @submit.prevent="responder">
              <div class="col">
                <q-input
                  v-model="respuesta"
                  outlined
                  dense
                  autogrow
                  maxlength="1000"
                  placeholder="Escribe tu respuesta..."
                  :disable="enviando"
                />
              </div>
              <div class="col-auto">
                <q-btn
                  type="submit"
                  round
                  unelevated
                  color="primary"
                  icon="send"
                  :loading="enviando"
                  :disable="!respuesta.trim()"
                />
              </div>
            </q-form>
            <!-- Regla de Meta, no nuestra: fuera de las 24h solo entran plantillas. -->
            <div class="text-caption text-grey-7 q-mt-xs q-px-xs">
              Solo puedes responder dentro de las 24 horas siguientes a su mensaje.
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Comprobante a pantalla completa: los numeros de una transferencia se leen mal en miniatura. -->
    <q-dialog v-model="hayAmpliado">
      <q-card class="tarjeta-ampliada">
        <q-img :src="ampliado" fit="contain" class="imagen-ampliada" />
        <q-card-actions align="right">
          <q-btn v-close-popup flat no-caps label="Cerrar" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <FormularioPago
      v-model="pagoAbierto"
      :miembro="miembroDelHilo"
      modo-aprobacion
      @creado="alRegistrarPago"
    />
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';

import FormularioPago from 'components/FormularioPago.vue';
import { urlArchivoMensaje } from 'src/servicios/gimnasio.servicio.js';
import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Bandeja de WhatsApp. Un numero conectado a la Cloud API no tiene app de
 * WhatsApp detras: sin esta pantalla, el comprobante que manda un miembro no lo
 * ve nadie.
 *
 * Los mensajes llegan como una lista plana y se agrupan aqui POR TELEFONO: es lo
 * unico que siempre existe (quien escribe puede no ser aun un miembro).
 */

const gimnasio = useGimnasioStore();
const autenticacion = useAutenticacionStore();
const quasar = useQuasar();

const cargando = ref(false);
const enviando = ref(false);
const telefonoAbierto = ref(null);
const respuesta = ref('');
const ampliado = ref(null);
const pagoAbierto = ref(false);
const sedeFiltro = ref(null);

// El dueño ve todas las sedes y por eso filtra; a un sede_admin su rol ya lo
// acota a una sola, asi que el filtro no le aporta.
const esDueno = computed(() => autenticacion.usuario?.rol === ROLES.TENANT_OWNER);

const opcionesSede = computed(() => [
  { label: 'Todas las sedes', value: null },
  ...gimnasio.sedes.map((sede) => ({ label: sede.nombre, value: sede._id })),
]);
// Mensaje entrante del hilo contra el que se confirma el pago (de ahi salen el
// telefono y la sede al responder). Se captura al abrir el formulario porque
// recargar la bandeja despues puede rehacer el hilo.
const mensajeParaConfirmar = ref(null);

const FORMATO_HORA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatearHora(valor) {
  return valor ? FORMATO_HORA.format(new Date(valor)) : '';
}

/**
 * Agrupa la lista plana en hilos. El backend los manda del mas nuevo al mas
 * viejo; dentro del hilo se invierte para leerlo como una conversacion.
 */
const conversaciones = computed(() => {
  const porTelefono = new Map();

  for (const mensaje of gimnasio.mensajes) {
    const hilo = porTelefono.get(mensaje.telefono) ?? {
      telefono: mensaje.telefono,
      miembro: null,
      sede: null,
      mensajes: [],
      pendientes: 0,
      ultimo: mensaje,
    };
    hilo.mensajes.unshift(mensaje);
    hilo.miembro = hilo.miembro ?? mensaje.miembro;
    hilo.sede = hilo.sede ?? mensaje.sede;
    if (mensaje.direccion === 'entrante' && !mensaje.leido) hilo.pendientes += 1;
    porTelefono.set(mensaje.telefono, hilo);
  }

  return [...porTelefono.values()];
});

const hilo = computed(
  () => conversaciones.value.find((c) => c.telefono === telefonoAbierto.value) ?? null,
);
const enHilo = computed(() => Boolean(telefonoAbierto.value));
const miembroDelHilo = computed(() => hilo.value?.miembro ?? null);

const hayAmpliado = computed({
  get: () => Boolean(ampliado.value),
  set: (valor) => {
    if (!valor) ampliado.value = null;
  },
});

function titulo(conversacion) {
  const miembro = conversacion.miembro;
  return miembro ? `${miembro.nombres} ${miembro.apellidos}` : `+${conversacion.telefono}`;
}

function inicial(conversacion) {
  return titulo(conversacion).replace('+', '').charAt(0).toUpperCase();
}

function resumen(mensaje) {
  if (mensaje.texto) return mensaje.texto;
  return mensaje.tipo === 'imagen' ? 'Envio una imagen' : 'Envio un archivo';
}

function esImagen(mensaje) {
  return Boolean(mensaje.archivo) && (mensaje.mimeType ?? '').startsWith('image/');
}

function nombreSede(conversacion) {
  return conversacion.sede?.nombre ?? null;
}

const urlArchivo = urlArchivoMensaje;

function abrir(conversacion) {
  telefonoAbierto.value = conversacion.telefono;
  respuesta.value = '';

  // Abrir el hilo es leerlo: solo se marcan los de ESE hilo, no la bandeja entera.
  const sinLeer = conversacion.mensajes
    .filter((mensaje) => mensaje.direccion === 'entrante' && !mensaje.leido)
    .map((mensaje) => mensaje._id);

  if (sinLeer.length > 0) {
    gimnasio.marcarMensajesLeidos(sinLeer).catch(() => {});
  }
}

async function responder() {
  const texto = respuesta.value.trim();
  if (!texto || !hilo.value) return;

  // Se responde AL HILO: el backend saca el telefono del mensaje original.
  const ultimoEntrante = [...hilo.value.mensajes]
    .reverse()
    .find((mensaje) => mensaje.direccion === 'entrante');
  if (!ultimoEntrante) return;

  enviando.value = true;
  try {
    await gimnasio.responderMensaje({ mensaje: ultimoEntrante._id, texto });
    respuesta.value = '';
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo enviar',
    });
  } finally {
    enviando.value = false;
  }
}

/** El motivo de la bandeja: llega el comprobante y se registra el pago sin salir. */
function registrarPago() {
  // Se guarda el ultimo entrante del hilo AHORA: tras registrar se recarga la
  // bandeja y `hilo` puede cambiar. Con este mensaje se le confirma al miembro.
  mensajeParaConfirmar.value = hilo.value
    ? [...hilo.value.mensajes].reverse().find((m) => m.direccion === 'entrante')
    : null;
  pagoAbierto.value = true;
}

const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

/**
 * Tras registrar el pago desde el chat, se le confirma al miembro por WhatsApp
 * que quedo al dia y hasta cuando. Es texto libre, asi que solo entra dentro de
 * la ventana de 24h; como el miembro acaba de escribir, casi siempre lo esta.
 * Si Meta lo rechaza, el pago YA quedo registrado: solo se avisa que no se pudo
 * confirmar, no se deshace nada.
 */
async function alRegistrarPago(pago) {
  const original = mensajeParaConfirmar.value;
  mensajeParaConfirmar.value = null;

  if (!original || !pago?.periodoFin) {
    await cargar();
    return;
  }

  const nombre = original.miembro?.nombres ?? '';
  const gimnasioNombre = autenticacion.usuario?.tenantNombre ?? 'tu gimnasio';
  const hasta = FORMATO_FECHA_LARGA.format(new Date(pago.periodoFin));
  const texto =
    `¡Hola ${nombre}! ✅ Registramos tu pago. Tu mensualidad en ${gimnasioNombre} ` +
    `queda al día hasta el ${hasta}. ¡Gracias! 💪`;

  try {
    // responderMensaje ya recarga la bandeja y marca el hilo leido.
    await gimnasio.responderMensaje({ mensaje: original._id, texto });
    quasar.notify({ type: 'positive', message: 'Pago registrado y confirmado al miembro' });
  } catch {
    // El pago quedo bien; solo fallo el aviso (probable: fuera de las 24h).
    await cargar();
    quasar.notify({
      type: 'warning',
      message: 'Pago registrado. No se pudo enviar la confirmación por WhatsApp (quizá pasaron 24h).',
    });
  }
}

async function cargar() {
  cargando.value = true;
  try {
    await gimnasio.cargarMensajes(sedeFiltro.value ? { sede: sedeFiltro.value } : {});
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los mensajes' });
  } finally {
    cargando.value = false;
  }
}

// Al cambiar de sede se recarga y se cierra el hilo abierto (ya no está en la lista).
watch(sedeFiltro, () => {
  telefonoAbierto.value = null;
  cargar();
});

onMounted(() => {
  cargar();
  // Las sedes alimentan el filtro; solo el dueño las necesita.
  if (esDueno.value) gimnasio.cargarSedes().catch(() => {});
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

.estado-vacio {
  text-align: center;
  padding: 48px 16px;
  color: var(--q-secondary);
}

.lista-hilos {
  max-height: 70vh;
  overflow-y: auto;
}

.hilo-activo {
  background: rgba(206, 17, 38, 0.08);
  color: var(--q-primary);
}

.badge-sede {
  font-size: 0.62rem;
  vertical-align: middle;
}

.tarjeta-hilo {
  border-top: 3px solid var(--q-primary);
}

.cabecera-hilo {
  background: rgba(0, 0, 0, 0.02);
}

.conversacion {
  max-height: 52vh;
  overflow-y: auto;
  background: #f4f5f7;
}

.fila-burbuja {
  display: flex;
  margin-bottom: 8px;
}

.burbuja {
  max-width: 78%;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* Lo del gimnasio va a la derecha y con la banda de la marca. */
.burbuja-saliente {
  background: rgba(206, 17, 38, 0.08);
  border-right: 3px solid var(--q-primary);
}

.texto-burbuja {
  white-space: pre-wrap;
  word-break: break-word;
}

.hora-burbuja {
  font-size: 0.68rem;
  color: #667085;
  text-align: right;
  margin-top: 2px;
}

.comprobante {
  max-width: 260px;
  max-height: 320px;
  border-radius: 6px;
  margin-bottom: 6px;
}

.tarjeta-ampliada {
  width: 92vw;
  max-width: 720px;
}

.imagen-ampliada {
  max-height: 78vh;
}
</style>
