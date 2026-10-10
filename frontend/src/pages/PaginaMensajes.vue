<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-md">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Mensajes</h1>
        <div class="text-caption text-grey-7 gt-xs">
          Todo lo que pasa por el WhatsApp del gimnasio: avisos, recibos y lo que responden los miembros.
        </div>
      </div>
      <div class="row items-center q-gutter-sm">
        <!-- Cada sede cobra una mensualidad distinta: el dueño filtra por sede.
             Un sede_admin no lo ve: su rol ya lo deja en una sola sede. -->
        <q-select
          v-if="esDueno"
          v-model="sedeFiltro"
          :options="opcionesSede"
          emit-value
          map-options
          dense
          outlined
          options-dense
          bg-color="white"
          label="Sede"
          style="min-width: 170px"
        />
        <q-btn flat dense round icon="refresh" color="grey-8" :loading="cargando" @click="cargar">
          <q-tooltip>Actualizar</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- La bandeja: lista de chats a la izquierda, conversacion a la derecha. -->
    <div class="bandeja" :class="{ 'bandeja-en-hilo': enHilo }">
      <!-- ===== Lista de conversaciones ===== -->
      <aside class="panel-lista">
        <div class="lista-cabecera">
          <q-input
            v-model="busquedaHilos"
            dense
            outlined
            rounded
            clearable
            placeholder="Buscar por nombre o telefono"
            class="buscador-hilos"
          >
            <template #prepend><q-icon name="search" size="20px" /></template>
          </q-input>

          <!-- Dos pestañas: la conversacion normal y los comprobantes por aprobar,
               para que un pago pendiente no se pierda entre tantos hilos. -->
          <div class="pastillas" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="pestana === 'mensajes'"
              :class="['pastilla', { activa: pestana === 'mensajes' }]"
              @click="pestana = 'mensajes'"
            >
              Mensajes
              <span v-if="noLeidosNormales" class="pastilla-cuenta">{{ noLeidosNormales }}</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="pestana === 'pendientes'"
              :class="['pastilla', { activa: pestana === 'pendientes' }]"
              @click="pestana = 'pendientes'"
            >
              Por confirmar pago
              <span v-if="conversacionesPendientes.length" class="pastilla-cuenta pastilla-alerta">
                {{ conversacionesPendientes.length }}
              </span>
            </button>
          </div>
        </div>

        <div class="lista-cuerpo">
          <div v-if="hilosFiltrados.length === 0 && !cargando" class="estado-vacio">
            <q-icon
              :name="pestana === 'pendientes' ? 'task_alt' : 'chat_bubble_outline'"
              size="40px"
              color="grey-5"
            />
            <div class="q-mt-sm text-weight-medium">
              <template v-if="busquedaHilos">Ningún chat coincide con la búsqueda.</template>
              <template v-else>{{ pestana === 'pendientes' ? 'No hay comprobantes por confirmar.' : 'Aún no hay mensajes.' }}</template>
            </div>
            <div v-if="!busquedaHilos" class="text-caption q-mt-xs">
              {{
                pestana === 'pendientes'
                  ? 'Cuando un miembro envíe la foto de su pago, aparece aquí hasta que lo apruebes.'
                  : 'Llegan aquí cuando alguien le escribe al WhatsApp del gimnasio.'
              }}
            </div>
          </div>

          <button
            v-for="conversacion in hilosFiltrados"
            :key="conversacion.telefono"
            type="button"
            :class="['fila-hilo', { activa: conversacion.telefono === telefonoAbierto, 'sin-leer': conversacion.pendientes }]"
            @click="abrir(conversacion)"
          >
            <span class="avatar-hilo" :style="{ backgroundColor: colorAvatar(conversacion) }">
              {{ inicial(conversacion) }}
            </span>
            <span class="fila-hilo-texto">
              <span class="fila-hilo-arriba">
                <span class="nombre-hilo">{{ titulo(conversacion) }}</span>
                <span class="hora-hilo">{{ horaCorta(conversacion.ultimo.createdAt) }}</span>
              </span>
              <span class="fila-hilo-abajo">
                <span class="vista-previa">
                  <q-icon v-if="iconoTipo(conversacion.ultimo)" :name="iconoTipo(conversacion.ultimo)" size="15px" />
                  <q-icon v-if="conversacion.ultimo.direccion === 'saliente'" name="done_all" size="15px" class="visto" />
                  {{ resumen(conversacion.ultimo) }}
                </span>
                <span v-if="conversacion.pendientes" class="cuenta-hilo">{{ conversacion.pendientes }}</span>
              </span>
              <span v-if="nombreSede(conversacion) || esPendiente(conversacion)" class="fila-hilo-etiquetas">
                <span v-if="nombreSede(conversacion)" class="etiqueta-sede">{{ nombreSede(conversacion) }}</span>
                <span v-if="esPendiente(conversacion)" class="etiqueta-comprobante">
                  <q-icon name="receipt_long" size="13px" /> Comprobante
                </span>
              </span>
            </span>
          </button>
        </div>
      </aside>

      <!-- ===== Conversacion ===== -->
      <section class="panel-hilo">
        <div v-if="!hilo" class="hilo-vacio">
          <span class="hilo-vacio-icono"><q-icon name="forum" size="44px" /></span>
          <div class="text-h6 q-mt-md">Selecciona una conversación</div>
          <div class="text-caption text-grey-7">
            Aquí ves el chat completo y puedes aprobar el pago de un comprobante sin salir.
          </div>
        </div>

        <template v-else>
          <header class="hilo-cabecera">
            <q-btn
              v-if="$q.screen.lt.md"
              flat
              dense
              round
              icon="arrow_back"
              aria-label="Volver a los chats"
              @click="telefonoAbierto = null"
            />
            <span class="avatar-hilo" :style="{ backgroundColor: colorAvatar(hilo) }">{{ inicial(hilo) }}</span>
            <div class="col hilo-cabecera-texto">
              <div class="nombre-hilo">{{ titulo(hilo) }}</div>
              <div class="text-caption text-grey-7 ellipsis">
                +{{ hilo.telefono }}
                <span v-if="nombreSede(hilo)"> · {{ nombreSede(hilo) }}</span>
                <span v-if="!hilo.miembro"> · sin miembro asociado</span>
              </div>
            </div>
            <q-btn
              flat
              round
              dense
              class="boton-abrir-wa"
              type="a"
              :href="`https://wa.me/${hilo.telefono}`"
              target="_blank"
              rel="noopener"
              aria-label="Abrir en WhatsApp"
            >
              <IconoWhatsapp />
              <q-tooltip>Abrir en WhatsApp</q-tooltip>
            </q-btn>
            <q-btn
              v-if="hilo.miembro"
              unelevated
              no-caps
              color="primary"
              text-color="dark"
              icon="check_circle"
              :label="$q.screen.gt.xs ? 'Aprobar pago' : undefined"
              :round="$q.screen.xs"
              class="boton-aprobar"
              aria-label="Aprobar pago"
              @click="registrarPago"
            >
              <q-tooltip v-if="$q.screen.xs">Aprobar pago</q-tooltip>
            </q-btn>
          </header>

          <div ref="contenedorConversacion" class="conversacion">
            <template v-for="(mensaje, indice) in hilo.mensajes" :key="mensaje._id">
              <!-- Separador cuando cambia el dia -->
              <div v-if="cambiaDeDia(hilo.mensajes, indice)" class="separador-dia">
                <span>{{ etiquetaDia(mensaje.createdAt) }}</span>
              </div>

              <div class="fila-burbuja" :class="mensaje.direccion === 'saliente' ? 'justify-end' : 'justify-start'">
                <div class="burbuja" :class="`burbuja-${mensaje.direccion}`">
                  <!-- Etiqueta del envio automatico (aviso, bienvenida, recibo):
                       asi se distingue de una respuesta escrita a mano. -->
                  <div v-if="etiquetaAuto(mensaje)" class="etiqueta-auto">
                    <q-icon :name="etiquetaAuto(mensaje).icono" size="13px" />
                    {{ etiquetaAuto(mensaje).texto }}
                  </div>
                  <!-- El archivo (imagen, video, audio o documento) se baja por
                       Axios (auto-refresco del token) a un object-URL y se pinta
                       segun su tipo; mientras carga se muestra un spinner. -->
                  <template v-if="tieneArchivo(mensaje)">
                    <template v-if="urlsArchivo[mensaje._id]">
                      <q-img
                        v-if="esImagen(mensaje)"
                        :src="urlsArchivo[mensaje._id]"
                        class="comprobante cursor-pointer"
                        fit="contain"
                        @click="ampliar(mensaje)"
                      />
                      <video v-else-if="esVideo(mensaje)" :src="urlsArchivo[mensaje._id]" class="comprobante" controls />
                      <audio v-else-if="esAudio(mensaje)" :src="urlsArchivo[mensaje._id]" class="audio-mensaje" controls />
                      <a v-else :href="urlsArchivo[mensaje._id]" target="_blank" rel="noopener" class="tarjeta-documento">
                        <q-icon name="picture_as_pdf" size="28px" />
                        <span>
                          <span class="documento-titulo">Documento</span>
                          <span class="documento-accion">Toca para abrir</span>
                        </span>
                      </a>
                    </template>
                    <div v-else class="comprobante-estado">
                      <q-spinner v-if="archivoCargando[mensaje._id]" color="primary" size="24px" />
                      <span v-else class="text-caption text-grey-7">No se pudo cargar el archivo</span>
                    </div>
                  </template>
                  <!-- Llego un archivo que no se pudo descargar (mensajes viejos o un
                       tipo sin adjunto): se avisa en vez de dejar la burbuja vacia. -->
                  <div v-else-if="mensaje.tipo !== 'texto'" class="text-caption text-grey-7 aviso-sin-archivo">
                    <q-icon name="attachment" size="16px" /> Envió un archivo que no se pudo mostrar
                  </div>
                  <div v-if="mensaje.texto" class="texto-burbuja">{{ mensaje.texto }}</div>
                  <div class="hora-burbuja">
                    {{ horaCorta(mensaje.createdAt, true) }}
                    <q-icon v-if="mensaje.direccion === 'saliente'" name="done_all" size="14px" />
                  </div>
                </div>
              </div>
            </template>
          </div>

          <footer class="redactor">
            <q-form class="redactor-forma" @submit.prevent="responder">
              <q-input
                v-model="respuesta"
                borderless
                dense
                autogrow
                maxlength="1000"
                placeholder="Escribe una respuesta…"
                class="redactor-campo"
                :disable="enviando"
                @keydown.enter.exact.prevent="responder"
              />
              <q-btn
                type="submit"
                round
                unelevated
                color="primary"
                text-color="dark"
                icon="send"
                :loading="enviando"
                :disable="!respuesta.trim()"
                aria-label="Enviar"
              />
            </q-form>
            <!-- Regla de Meta, no nuestra: fuera de las 24h solo entran plantillas. -->
            <div class="redactor-nota">
              Enter envía · Shift + Enter, salto de línea · Solo se puede responder dentro de las 24 h siguientes a su último mensaje.
            </div>
          </footer>
        </template>
      </section>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import FormularioPago from 'components/FormularioPago.vue';
import IconoWhatsapp from 'src/components/IconoWhatsapp.vue';
import { descargarArchivoMensaje } from 'src/servicios/gimnasio.servicio.js';
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
const ruta = useRoute();
const router = useRouter();

/**
 * El chat abierto vive en la URL (`?chat=<telefono>`): asi el boton Atras del
 * navegador o del celular CIERRA el chat (en vez de salir de Mensajes) y recargar
 * la pagina lo deja abierto. Abrir el primero apila una entrada en el historial;
 * cambiar de un chat a otro la reemplaza, para que un solo Atras lo cierre.
 */
const telefonoAbierto = computed({
  get: () => (typeof ruta.query.chat === 'string' ? ruta.query.chat : null),
  set: (telefono) => (telefono ? abrirEnRuta(telefono) : cerrarChat()),
});

function abrirEnRuta(telefono) {
  if (ruta.query.chat === telefono) return;
  const destino = { query: { ...ruta.query, chat: telefono } };
  if (ruta.query.chat) router.replace(destino);
  else router.push(destino);
}

function cerrarChat() {
  if (!ruta.query.chat) return;
  const { chat: _chat, ...resto } = ruta.query;
  const sinChat = router.resolve({ query: resto }).fullPath;
  // Si se llego al chat desde la bandeja, se "vuelve" (deja el historial limpio);
  // si se entro directo con ?chat= (recarga, enlace), solo se quita de la URL.
  if (window.history.state?.back === sinChat) router.back();
  else router.replace({ query: resto });
}

/** Esc cierra el chat, salvo que haya una ventana encima (que Esc cierra primero). */
function alPresionarTecla(evento) {
  if (evento.key !== 'Escape' || !telefonoAbierto.value) return;
  if (pagoAbierto.value || ampliado.value || document.querySelector('.q-dialog')) return;
  cerrarChat();
}
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

const FORMATO_SOLO_HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const FORMATO_DIA_CORTO = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const FORMATO_DIA_LARGO = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

const claveDia = (valor) => new Date(valor).toDateString();
function esHoy(valor) {
  return claveDia(valor) === new Date().toDateString();
}
function esAyer(valor) {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  return claveDia(valor) === ayer.toDateString();
}

/** En la lista: la hora si es de hoy, "Ayer", o la fecha corta. En la burbuja, siempre la hora. */
function horaCorta(valor, soloHora = false) {
  if (!valor) return '';
  if (soloHora || esHoy(valor)) return FORMATO_SOLO_HORA.format(new Date(valor));
  if (esAyer(valor)) return 'Ayer';
  return FORMATO_DIA_CORTO.format(new Date(valor));
}

/** Separador de dia dentro del hilo: "Hoy", "Ayer" o "martes, 7 de octubre". */
function etiquetaDia(valor) {
  if (esHoy(valor)) return 'Hoy';
  if (esAyer(valor)) return 'Ayer';
  const texto = FORMATO_DIA_LARGO.format(new Date(valor));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function cambiaDeDia(mensajes, indice) {
  return indice === 0 || claveDia(mensajes[indice].createdAt) !== claveDia(mensajes[indice - 1].createdAt);
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
      nombrePerfil: null,
      mensajes: [],
      pendientes: 0,
      ultimo: mensaje,
    };
    hilo.mensajes.unshift(mensaje);
    hilo.miembro = hilo.miembro ?? mensaje.miembro;
    hilo.sede = hilo.sede ?? mensaje.sede;
    // Nombre de WhatsApp del remitente (Twilio ProfileName): identifica el hilo
    // de quien aun no es miembro. Se toma el mas reciente que lo traiga.
    hilo.nombrePerfil = hilo.nombrePerfil ?? mensaje.nombrePerfil;
    if (mensaje.direccion === 'entrante' && !mensaje.leido) hilo.pendientes += 1;
    porTelefono.set(mensaje.telefono, hilo);
  }

  return [...porTelefono.values()];
});

// --- Pestañas: "Mensajes" vs "Por confirmar pago" ---------------------------
const pestana = ref('mensajes');

/** Ids de miembro con un comprobante por confirmar (los calcula el backend). */
const conjuntoPendientes = computed(() => new Set(gimnasio.comprobantesPendientes ?? []));

/** `true` si el hilo es de un miembro con comprobante por confirmar. */
function esPendiente(conversacion) {
  const id = conversacion.miembro?._id ?? conversacion.miembro;
  return Boolean(id) && conjuntoPendientes.value.has(String(id));
}

// Un hilo pendiente vive SOLO en su pestaña, para no perderlo entre los demas;
// al aprobar el pago el backend lo saca de pendientes y vuelve a "Mensajes".
const conversacionesPendientes = computed(() => conversaciones.value.filter(esPendiente));
const conversacionesNormales = computed(() =>
  conversaciones.value.filter((c) => !esPendiente(c)),
);
const conversacionesVisibles = computed(() =>
  pestana.value === 'pendientes' ? conversacionesPendientes.value : conversacionesNormales.value,
);

// Buscador de la lista: por nombre (miembro o perfil de WhatsApp) o por telefono.
const busquedaHilos = ref('');
const hilosFiltrados = computed(() => {
  const texto = (busquedaHilos.value ?? '').trim().toLowerCase();
  if (!texto) return conversacionesVisibles.value;
  return conversacionesVisibles.value.filter(
    (c) => titulo(c).toLowerCase().includes(texto) || String(c.telefono).includes(texto.replace(/\D/g, '') || texto),
  );
});

/** No leidos de la pestaña "Mensajes" (para su contador). */
const noLeidosNormales = computed(() =>
  conversacionesNormales.value.reduce((total, c) => total + (c.pendientes ? 1 : 0), 0),
);

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
  if (miembro) return `${miembro.nombres} ${miembro.apellidos}`;
  // Sin miembro: el nombre de WhatsApp del remitente, o el numero si no lo hay.
  return conversacion.nombrePerfil || `+${conversacion.telefono}`;
}

function inicial(conversacion) {
  return titulo(conversacion).replace('+', '').charAt(0).toUpperCase();
}

/**
 * Color estable del avatar por telefono (WhatsApp no expone la foto de perfil,
 * asi que se usa un avatar de inicial con color propio, como WhatsApp Web cuando
 * no hay foto). El mismo contacto tiene siempre el mismo color.
 */
const COLORES_AVATAR = [
  '#4a3aa7', '#eb6834', '#1f7a5a', '#b83280', '#2b6cb0',
  '#a15c00', '#5a3e2b', '#7048a8', '#0e7490', '#9b2226',
];

function colorAvatar(conversacion) {
  const clave = String(conversacion.telefono ?? '');
  let suma = 0;
  for (let i = 0; i < clave.length; i += 1) suma = (suma + clave.charCodeAt(i)) % COLORES_AVATAR.length;
  return COLORES_AVATAR[suma];
}

const RESUMEN_TIPO = {
  imagen: 'Envió una imagen',
  video: 'Envió un video',
  audio: 'Envió una nota de voz',
  documento: 'Envió un documento',
};

const ICONO_TIPO = { imagen: 'photo_camera', video: 'videocam', audio: 'mic', documento: 'description' };
function iconoTipo(mensaje) {
  return ICONO_TIPO[mensaje.tipo] ?? null;
}

function resumen(mensaje) {
  if (mensaje.texto) return mensaje.texto;
  return RESUMEN_TIPO[mensaje.tipo] ?? 'Envió un archivo';
}

// Etiqueta de los mensajes SALIENTES automaticos, para distinguirlos de una
// respuesta escrita a mano (que no lleva etiqueta).
const ETIQUETA_CATEGORIA = {
  aviso: { texto: 'Aviso de vencimiento', icono: 'schedule' },
  bienvenida: { texto: 'Bienvenida', icono: 'waving_hand' },
  recibo: { texto: 'Recibo de pago', icono: 'receipt_long' },
};

function etiquetaAuto(mensaje) {
  if (mensaje.direccion !== 'saliente') return null;
  return ETIQUETA_CATEGORIA[mensaje.categoria] ?? null;
}

// Un mensaje tiene archivo si viene de Cloudinary (`archivoPublicId`) o del disco
// heredado (`archivo`). Antes solo se miraba `archivo`, asi que los comprobantes
// nuevos (Cloudinary) salian como "no se pudo mostrar".
function tieneArchivo(mensaje) {
  return Boolean(mensaje.archivo || mensaje.archivoPublicId);
}

// El tipo de media se decide por el mimeType real, no por el `tipo` guardado:
// asi un sticker (image/webp) o una nota de voz (audio/ogg) se pintan solos.
function esArchivoDe(mensaje, prefijo) {
  return tieneArchivo(mensaje) && (mensaje.mimeType ?? '').startsWith(prefijo);
}
function esImagen(mensaje) {
  return esArchivoDe(mensaje, 'image/');
}
function esVideo(mensaje) {
  return esArchivoDe(mensaje, 'video/');
}
function esAudio(mensaje) {
  return esArchivoDe(mensaje, 'audio/');
}

function nombreSede(conversacion) {
  return conversacion.sede?.nombre ?? null;
}

// Comprobantes ya descargados (id del mensaje -> object-URL del blob) y cuales
// se estan bajando. Se bajan por Axios para heredar el auto-refresco del token.
const urlsArchivo = ref({});
const archivoCargando = ref({});

async function cargarArchivo(mensaje) {
  if (!tieneArchivo(mensaje) || urlsArchivo.value[mensaje._id] || archivoCargando.value[mensaje._id]) {
    return;
  }
  archivoCargando.value[mensaje._id] = true;
  try {
    const blob = await descargarArchivoMensaje(mensaje._id);
    urlsArchivo.value[mensaje._id] = URL.createObjectURL(blob);
  } catch {
    // Se queda sin URL: el template muestra el aviso de que no se pudo cargar.
  } finally {
    archivoCargando.value[mensaje._id] = false;
  }
}

function ampliar(mensaje) {
  ampliado.value = urlsArchivo.value[mensaje._id] ?? null;
}

// Al abrir (o refrescarse) un hilo, se bajan los archivos de sus mensajes.
watch(hilo, (actual) => {
  if (actual) actual.mensajes.forEach((mensaje) => cargarArchivo(mensaje));
});

// La conversacion se lee de abajo hacia arriba: al abrir un hilo (o al llegar un
// mensaje nuevo) se baja hasta el ultimo.
const contenedorConversacion = ref(null);
watch(
  () => [telefonoAbierto.value, hilo.value?.mensajes.length],
  async () => {
    await nextTick();
    const el = contenedorConversacion.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);

// Los object-URL viven en memoria del navegador: se liberan al salir; y se
// detiene el auto-refresco para no dejar un intervalo huerfano.
onBeforeUnmount(() => {
  Object.values(urlsArchivo.value).forEach((url) => URL.revokeObjectURL(url));
  if (temporizadorRefresco) clearInterval(temporizadorRefresco);
  window.removeEventListener('keydown', alPresionarTecla);
});

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

/**
 * Auto-refresco en tiempo (casi) real: se vuelve a consultar la bandeja cada
 * pocos segundos mientras la pantalla esta abierta. Es SILENCIOSO (no muestra el
 * spinner ni cierra el hilo abierto: `telefonoAbierto` no cambia, asi que el hilo
 * se mantiene) y se PAUSA cuando la pestana no esta visible, para no gastar red
 * ni bateria. Un fallo puntual no molesta: el siguiente tick reintenta.
 */
const INTERVALO_REFRESCO_MS = 10_000;
let temporizadorRefresco = null;

async function refrescarEnSilencio() {
  if (document.hidden || cargando.value) return;
  try {
    await gimnasio.cargarMensajes(sedeFiltro.value ? { sede: sedeFiltro.value } : {});
  } catch {
    // Silencioso a proposito.
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
  window.addEventListener('keydown', alPresionarTecla);
  // Auto-refresco: mantiene la bandeja al dia sin recargar la pagina.
  temporizadorRefresco = setInterval(refrescarEnSilencio, INTERVALO_REFRESCO_MS);
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

/* ===== Bandeja: dos paneles en una tarjeta, a todo el alto disponible ===== */
.bandeja {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  height: calc(100vh - 200px);
  min-height: 520px;
  border: 1px solid #e4e7ec;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
}

/* --- Lista --- */
.panel-lista {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-right: 1px solid #eceef1;
}
.lista-cabecera {
  padding: 14px 14px 10px;
  border-bottom: 1px solid #eceef1;
}
.pastillas {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.pastilla {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e4e7ec;
  border-radius: 999px;
  background: #fff;
  color: #3b3f46;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}
.pastilla.activa {
  background: #14161b;
  border-color: #14161b;
  color: #fff;
}
.pastilla:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
.pastilla-cuenta {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--q-primary);
  color: #14161b;
  font-size: 0.72rem;
  text-align: center;
}
.pastilla-alerta {
  background: var(--q-warning);
  color: #fff;
}
.lista-cuerpo {
  flex: 1;
  overflow-y: auto;
}

.fila-hilo {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid #f1f2f4;
  border-left: 3px solid transparent;
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}
.fila-hilo:hover {
  background: #f8f9fb;
}
.fila-hilo.activa {
  background: rgba(245, 197, 24, 0.14);
  border-left-color: var(--q-primary);
}
.fila-hilo:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: -2px;
}
.avatar-hilo {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: #fff;
  font-weight: 700;
  font-size: 1.05rem;
}
.fila-hilo-texto {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fila-hilo-arriba,
.fila-hilo-abajo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nombre-hilo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
  color: #0b0b0b;
}
.hora-hilo {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: #8a8f98;
}
.sin-leer .hora-hilo {
  color: #8a6d00;
  font-weight: 700;
}
.vista-previa {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.82rem;
  color: #6b7280;
}
.sin-leer .vista-previa {
  color: #1f2937;
  font-weight: 600;
}
.visto {
  color: #4fa3e0;
}
.cuenta-hilo {
  flex-shrink: 0;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--q-primary);
  color: #14161b;
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
}
.fila-hilo-etiquetas {
  display: flex;
  gap: 6px;
  margin-top: 3px;
}
.etiqueta-sede {
  padding: 1px 8px;
  border-radius: 999px;
  background: #f1f2f4;
  font-size: 0.68rem;
  font-weight: 600;
  color: #4b5058;
}
.etiqueta-comprobante {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(154, 112, 22, 0.14);
  font-size: 0.68rem;
  font-weight: 700;
  color: #7a5510;
}
.estado-vacio {
  text-align: center;
  padding: 48px 20px;
  color: #6b7280;
}

/* --- Conversacion --- */
.panel-hilo {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.hilo-vacio {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  background:
    radial-gradient(circle at 1px 1px, rgba(20, 22, 27, 0.06) 1px, transparent 0) 0 0 / 18px 18px,
    #fafafa;
}
.hilo-vacio-icono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #14161b;
  color: var(--q-primary);
}
.hilo-cabecera {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #eceef1;
  background: #fff;
}
.hilo-cabecera-texto {
  min-width: 0;
}
.boton-abrir-wa {
  color: #1faa52;
  font-size: 20px;
}
.boton-aprobar {
  border-radius: 10px;
  font-weight: 700;
}

.conversacion {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background:
    radial-gradient(circle at 1px 1px, rgba(20, 22, 27, 0.06) 1px, transparent 0) 0 0 / 18px 18px,
    #f4f2ec;
}
.separador-dia {
  display: flex;
  justify-content: center;
  margin: 10px 0 14px;
}
.separador-dia span {
  padding: 4px 12px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  font-size: 0.72rem;
  font-weight: 600;
  color: #4b5058;
}
.fila-burbuja {
  display: flex;
  margin-bottom: 6px;
}
.burbuja {
  max-width: min(78%, 560px);
  padding: 8px 10px 6px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.burbuja-entrante {
  border-top-left-radius: 3px;
}
/* Lo del gimnasio va a la derecha, en el dorado suave de la marca. */
.burbuja-saliente {
  background: #fff4cc;
  border-top-right-radius: 3px;
}
.etiqueta-auto {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #7a5f00;
  margin-bottom: 3px;
}
.texto-burbuja {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.92rem;
  line-height: 1.45;
}
.hora-burbuja {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 2px;
  font-size: 0.68rem;
  color: #8a8f98;
}
.burbuja-saliente .hora-burbuja .q-icon {
  color: #4fa3e0;
}
.tarjeta-documento {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 220px;
  margin-bottom: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: #b3261e;
  text-decoration: none;
}
.tarjeta-documento > span {
  display: flex;
  flex-direction: column;
}
.documento-titulo {
  font-weight: 700;
  color: #1f2937;
}
.documento-accion {
  font-size: 0.75rem;
  color: #6b7280;
}

/* --- Redactor --- */
.redactor {
  padding: 10px 14px 8px;
  border-top: 1px solid #eceef1;
  background: #fff;
}
.redactor-forma {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.redactor-campo {
  flex: 1;
  padding: 2px 16px;
  border-radius: 22px;
  background: #f1f2f4;
}
.redactor-nota {
  margin-top: 6px;
  padding: 0 6px;
  font-size: 0.7rem;
  color: #8a8f98;
}

/* --- Celular: un panel a la vez --- */
@media (max-width: 1023px) {
  .bandeja {
    grid-template-columns: minmax(0, 1fr);
    height: calc(100vh - 170px);
  }
  .bandeja .panel-hilo {
    display: none;
  }
  .bandeja-en-hilo .panel-lista {
    display: none;
  }
  .bandeja-en-hilo .panel-hilo {
    display: flex;
  }
}

.comprobante {
  max-width: 260px;
  max-height: 320px;
  border-radius: 6px;
  margin-bottom: 6px;
}

.audio-mensaje {
  width: 240px;
  max-width: 100%;
  margin-bottom: 6px;
}

.aviso-sin-archivo {
  display: flex;
  align-items: center;
  gap: 4px;
  font-style: italic;
}

/* Mientras el comprobante se baja (o si fallo): ocupa un hueco estable. */
.comprobante-estado {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 120px;
  margin-bottom: 6px;
  border: 1px dashed #c2c7d0;
  border-radius: 6px;
  background: #fafbfc;
}

.tarjeta-ampliada {
  width: 92vw;
  max-width: 720px;
}

.imagen-ampliada {
  max-height: 78vh;
}
</style>
