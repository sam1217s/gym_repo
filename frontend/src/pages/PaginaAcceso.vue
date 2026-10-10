<template>
  <div class="kiosco" :class="`kiosco-${aviso?.tono ?? 'reposo'}`">
    <header class="kiosco-cabecera">
      <div>
        <div class="ceja-kiosco">Gym Barichara</div>
        <div class="titulo-display sede-kiosco">{{ estado.puesto?.sedeNombre || 'Control de acceso' }}</div>
      </div>
      <div class="reloj cifra-tabular">{{ hora }}</div>
    </header>

    <div class="kiosco-cuerpo" :class="{ 'con-lista': mostrarLista }">
    <main class="kiosco-centro">
      <transition name="aparecer" mode="out-in">
        <!-- Equipo nuevo: se vincula aqui mismo, con la sesion del dueño -->
        <VincularEquipo v-if="necesitaVincular" key="vincular" :vincular="vincularAgente" />

        <!-- Resultado del ultimo intento -->
        <div v-else-if="aviso" :key="aviso.clave" class="aviso">
          <q-icon :name="aviso.icono" class="aviso-icono" />
          <div class="titulo-display aviso-ceja">{{ aviso.ceja }}</div>
          <div class="aviso-titulo">{{ aviso.titulo }}</div>
          <div class="aviso-detalle">{{ aviso.detalle }}</div>
        </div>

        <!-- Lector apagado desde esta misma ventana -->
        <div v-else-if="conectado && estado.pausado" key="pausado" class="aviso">
          <q-icon name="power_settings_new" class="aviso-icono" />
          <div class="aviso-titulo">Lector apagado</div>
          <div class="aviso-detalle">Nadie puede entrar con huella hasta que lo enciendas abajo.</div>
        </div>

        <!-- En reposo: invitacion a poner el dedo -->
        <div v-else key="reposo" class="aviso">
          <q-icon name="fingerprint" class="aviso-icono huella-reposo" />
          <div class="aviso-titulo">{{ textoReposo }}</div>
          <div class="aviso-detalle">{{ detalleReposo }}</div>
        </div>
      </transition>
    </main>

    <!-- Quien paso hoy por esta puerta (lo trae el agente; la ventana no tiene sesion) -->
    <aside v-if="mostrarLista" class="lista-entradas">
      <div class="lista-cabecera">
        <div class="titulo-display lista-titulo">Hoy en esta puerta</div>
        <div class="lista-resumen cifra-tabular">
          <span><b>{{ entradas.resumen.permitidos }}</b> entraron</span>
          <span><b>{{ entradas.resumen.negados }}</b> negados</span>
        </div>
      </div>
      <div v-if="!entradas.accesos.length" class="lista-vacia">Aun no ha entrado nadie hoy.</div>
      <ul v-else class="lista-filas">
        <li v-for="acceso in entradas.accesos" :key="acceso._id" class="fila-entrada" :class="`fila-${acceso.resultado}`">
          <span class="fila-hora cifra-tabular">{{ horaCorta(acceso.createdAt) }}</span>
          <span class="fila-nombre">{{ acceso.nombreMiembro || 'Sin identificar' }}</span>
          <span class="fila-motivo">{{ motivoCorto(acceso) }}</span>
        </li>
      </ul>
    </aside>
    </div>

    <footer class="kiosco-pie">
      <span class="indicador" :class="{ activo: conectado }">Agente</span>
      <span class="indicador" :class="{ activo: conectado && estado.lector }">Lector</span>
      <span class="indicador" :class="{ activo: conectado && estado.servidor }">Servidor</span>
      <span v-if="conectado && estado.puesto" class="text-caption">{{ estado.huellas }} huellas cargadas</span>
      <q-space />
      <template v-if="conectado">
        <q-btn
          flat
          dense
          no-caps
          color="white"
          :icon="estado.pausado ? 'play_arrow' : 'power_settings_new'"
          :label="estado.pausado ? 'Encender lector' : 'Apagar lector'"
          @click="alternarLector"
        />
        <q-btn flat dense no-caps color="white" icon="refresh" label="Reconectar" :loading="reconectando" @click="reconectar" />
      </template>
      <!-- Voz: silenciar o elegir cual (se prueba al tocarla) -->
      <q-btn-dropdown
        v-if="voz.disponible"
        flat
        dense
        no-caps
        color="white"
        :icon="voz.activa.value ? 'volume_up' : 'volume_off'"
        :label="voz.activa.value ? 'Voz' : 'Sin voz'"
      >
        <q-list dense class="menu-voces">
          <q-item v-close-popup clickable @click="voz.alternar">
            <q-item-section avatar><q-icon :name="voz.activa.value ? 'volume_off' : 'volume_up'" /></q-item-section>
            <q-item-section>{{ voz.activa.value ? 'Silenciar la puerta' : 'Activar la voz' }}</q-item-section>
          </q-item>
          <q-separator />
          <q-item-label header>Elige la voz (toca para escucharla)</q-item-label>
          <q-item
            v-for="opcion in voz.opciones.value"
            :key="opcion.name"
            clickable
            :active="voz.vozActual.value?.name === opcion.name"
            active-class="voz-elegida"
            @click="voz.elegir(opcion)"
          >
            <q-item-section>{{ nombreCorto(opcion) }}</q-item-section>
            <q-item-section side>
              <span class="text-caption">{{ opcion.localService ? 'Básica' : 'Natural' }}</span>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
      <q-btn flat dense round color="white" :icon="enPantallaCompleta ? 'fullscreen_exit' : 'fullscreen'" @click="alternarPantallaCompleta" />
    </footer>
  </div>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import VincularEquipo from 'src/components/VincularEquipo.vue';
import { useAgenteAcceso } from 'src/composables/useAgenteAcceso.js';
import { nombreCorto, useVoz } from 'src/composables/useVoz.js';

/**
 * Pantalla de la PUERTA, en el PC de cada sede. No tiene sesion ni habla con el
 * backend: solo escucha al agente local, que identifica la huella y le pregunta
 * al servidor. Muestra el resultado unos segundos y vuelve al reposo.
 *
 * Los colores son los de las bandas de disco: verde entra, ambar entra con
 * aviso, rojo no entra.
 */

const MS_AVISO = 6000;

const aviso = ref(null);
let temporizadorAviso = null;

const quasar = useQuasar();
const voz = useVoz();
const { conectado, estado, enviar } = useAgenteAcceso(alMensajeAgente);

// --- Entradas de hoy y controles del lector ---------------------------------

const entradas = ref({ accesos: [], resumen: { total: 0, permitidos: 0, negados: 0 } });
const mostrarLista = computed(() => conectado.value && Boolean(estado.value.puesto) && !necesitaVincular.value);

const MOTIVOS_CORTOS = {
  al_dia: 'Al dia',
  por_vencer: 'Por vencer',
  en_gracia: 'En gracia',
  vencido: 'Vencido',
  sin_pagos: 'Sin plan',
};
function motivoCorto(acceso) {
  if (acceso.motivo === 'vencido' && acceso.diasVencido) return `Vencido ${acceso.diasVencido} d`;
  return MOTIVOS_CORTOS[acceso.motivo] ?? 'No activo';
}
const horaCorta = (valor) =>
  new Date(valor).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Apagar deja la puerta sin huella: se confirma, para que no pase por un toque accidental. */
function alternarLector() {
  if (estado.value.pausado) {
    enviar({ tipo: 'reanudar' });
    return;
  }
  quasar
    .dialog({
      title: 'Apagar el lector',
      message: 'Mientras este apagado nadie podra entrar con huella.',
      cancel: { flat: true, noCaps: true, label: 'Cancelar' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Apagar' },
    })
    .onOk(() => enviar({ tipo: 'pausar' }));
}

const reconectando = ref(false);
function reconectar() {
  reconectando.value = true;
  enviar({ tipo: 'reconectar' });
  // El agente avisa el nuevo estado; el spinner es solo para que se note el clic.
  setTimeout(() => {
    reconectando.value = false;
  }, 3000);
}
watch(
  () => estado.value.lector,
  (abierto) => {
    if (abierto) reconectando.value = false;
  },
);

// Sin token (equipo recien instalado) o con uno que el servidor ya no acepta.
const necesitaVincular = computed(
  () => conectado.value && estado.value.servidor && (estado.value.vinculado === false || estado.value.tokenRechazado === true),
);

const MS_ESPERA_VINCULO = 20_000;
let vinculoPendiente = null;

/** Le pasa el token al agente y espera a que lo pruebe contra el servidor y lo guarde. */
function vincularAgente(token) {
  return new Promise((resolver, rechazar) => {
    if (!enviar({ tipo: 'vincular', token })) {
      rechazar(new Error('El agente de la puerta no esta conectado'));
      return;
    }
    const temporizador = setTimeout(() => {
      vinculoPendiente = null;
      rechazar(new Error('El agente no respondio. Intenta de nuevo.'));
    }, MS_ESPERA_VINCULO);
    vinculoPendiente = {
      resolver: (valor) => (clearTimeout(temporizador), resolver(valor)),
      rechazar: (causa) => (clearTimeout(temporizador), rechazar(causa)),
    };
  });
}

// Se confirma desde aqui y no desde el componente: al vincularse, el agente avisa
// su nuevo estado y el formulario se desmonta antes de que llegue la respuesta.
function confirmarVinculo(puesto) {
  mostrar({ tono: 'permitido', icono: 'check_circle', ceja: 'Equipo vinculado', titulo: puesto.nombre, detalle: `${puesto.sedeNombre}. Ya se puede usar el lector.` });
}

const textoReposo = computed(() => {
  if (!conectado.value) return 'Iniciando control de acceso…';
  if (!estado.value.lector) return 'Lector de huella desconectado';
  if (!estado.value.servidor) return 'Sin conexion con el servidor';
  if (!estado.value.puesto) return 'Conectando la puerta…';
  return 'Pon tu dedo en el lector';
});

const detalleReposo = computed(() => {
  if (!conectado.value) return 'Si no cambia, revisa que el agente de acceso este encendido.';
  if (!estado.value.lector) return 'Conecta el lector USB. Mientras tanto, acercate a recepcion.';
  if (!estado.value.servidor) return 'Revisa el internet de este equipo. Se reconecta solo.';
  if (!estado.value.puesto) return 'Un momento.';
  return 'Apoyalo plano hasta que la pantalla cambie.';
});

function fechaLarga(valor) {
  return new Date(valor).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

const plural = (n, palabra) => `${n} ${palabra}${n === 1 ? '' : 's'}`;

/** Traduce la respuesta del servidor a lo que ve la persona en la puerta. */
function describirAcceso(resultado) {
  const nombre = resultado.miembro?.nombres ?? '';

  switch (resultado.motivo) {
    case 'al_dia':
      return { tono: 'permitido', icono: 'check_circle', ceja: 'Acceso permitido', titulo: `¡Hola, ${nombre}!`, detalle: `Tu mensualidad esta al dia hasta el ${fechaLarga(resultado.vence)}. ¡Buen entreno!` };
    case 'por_vencer':
      return {
        tono: 'permitido',
        icono: 'check_circle',
        ceja: 'Acceso permitido',
        titulo: `¡Hola, ${nombre}!`,
        detalle:
          resultado.diasRestantes === 0
            ? 'Tu mensualidad vence HOY. Recuerda renovarla.'
            : `Tu mensualidad vence en ${plural(resultado.diasRestantes, 'dia')}. Recuerda renovarla.`,
      };
    case 'en_gracia':
      return {
        tono: 'gracia',
        icono: 'warning',
        ceja: 'Acceso permitido',
        titulo: `¡Hola, ${nombre}!`,
        detalle: `Tu mensualidad vencio hace ${plural(resultado.diasVencido, 'dia')}. Renuevala hoy para no perder el acceso.`,
      };
    case 'vencido':
      return {
        tono: 'negado',
        icono: 'block',
        ceja: 'No puedes ingresar',
        titulo: `${nombre}, tu mensualidad vencio`,
        detalle: `Lleva ${plural(resultado.diasVencido, 'dia')} vencida. Te invitamos a renovarla en recepcion para seguir entrenando.`,
      };
    case 'sin_pagos':
      return { tono: 'negado', icono: 'block', ceja: 'No puedes ingresar', titulo: `${nombre}, no tienes una mensualidad activa`, detalle: 'Acercate a recepcion para activarla.' };
    default:
      return { tono: 'negado', icono: 'block', ceja: 'No puedes ingresar', titulo: 'No encontramos un registro activo', detalle: 'Acercate a recepcion.' };
  }
}

/**
 * Lo que DICE la puerta. Corto (se oye de pie, con ruido) y neutro: "te damos la
 * bienvenida" en vez de bienvenido/a, porque el sistema no sabe el genero.
 */
function fraseDeAcceso(resultado) {
  const nombre = (resultado.miembro?.nombres ?? '').split(' ')[0];
  // Siempre arranca con el saludo y el nombre, entre o no.
  const hola = nombre ? `¡Hola, ${nombre}!` : '¡Hola!';
  switch (resultado.motivo) {
    case 'al_dia':
      return `${hola} Te damos la bienvenida.`;
    case 'por_vencer':
      return `${hola} Te damos la bienvenida. Recuerda renovar tu mensualidad.`;
    case 'en_gracia':
      return `${hola} Tu mensualidad venció. Renuévala hoy.`;
    case 'vencido':
      return `${hola} Tu mensualidad está vencida. Acércate a recepción.`;
    case 'sin_pagos':
      return `${hola} No tienes una mensualidad activa. Acércate a recepción.`;
    default:
      return `${hola} Acércate a recepción, por favor.`;
  }
}

function mostrar(datos) {
  aviso.value = { ...datos, clave: Date.now() };
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    aviso.value = null;
  }, MS_AVISO);
}

function alMensajeAgente(mensaje) {
  if (mensaje.tipo === 'entradas') {
    const { tipo: _tipo, ...resto } = mensaje;
    entradas.value = resto;
  } else if (mensaje.tipo === 'vinculado') {
    confirmarVinculo(mensaje.puesto);
    vinculoPendiente?.resolver(mensaje.puesto);
    vinculoPendiente = null;
  } else if (mensaje.tipo === 'vinculacion_error') {
    vinculoPendiente?.rechazar(new Error(mensaje.mensaje));
    vinculoPendiente = null;
  } else if (mensaje.tipo === 'acceso') {
    mostrar(describirAcceso(mensaje.resultado));
    voz.decir(fraseDeAcceso(mensaje.resultado));
  } else if (mensaje.tipo === 'no_reconocida') {
    mostrar({ tono: 'gracia', icono: 'fingerprint', ceja: 'Intenta de nuevo', titulo: 'No reconocimos tu huella', detalle: 'Ponla otra vez, bien plana. Si sigue fallando, acercate a recepcion.' });
    voz.decir('¡Hola! No reconocimos tu huella. Intenta de nuevo.');
  } else if (mensaje.tipo === 'sin_puesto') {
    mostrar({ tono: 'gracia', icono: 'settings', ceja: 'Puerta sin vincular', titulo: 'Esta puerta aun no esta activa', detalle: 'Acercate a recepcion.' });
  } else if (mensaje.tipo === 'error') {
    mostrar({ tono: 'gracia', icono: 'wifi_off', ceja: 'Un momento', titulo: 'No pudimos verificar', detalle: mensaje.mensaje });
    voz.decir('¡Hola! Un momento, no pudimos verificar. Acércate a recepción.');
  }
}

// --- Reloj y pantalla completa -----------------------------------------------

const hora = ref('');
let temporizadorReloj = null;
const actualizarHora = () => {
  hora.value = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const enPantallaCompleta = ref(false);
function alternarPantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}
const alCambiarPantalla = () => {
  enPantallaCompleta.value = Boolean(document.fullscreenElement);
};

onMounted(() => {
  actualizarHora();
  temporizadorReloj = setInterval(actualizarHora, 10_000);
  document.addEventListener('fullscreenchange', alCambiarPantalla);
});

onBeforeUnmount(() => {
  clearInterval(temporizadorReloj);
  clearTimeout(temporizadorAviso);
  document.removeEventListener('fullscreenchange', alCambiarPantalla);
});
</script>

<style scoped>
.kiosco {
  --fondo: #14171f;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #fff;
  background: var(--fondo);
  border-top: 10px solid var(--q-primary);
  transition: background 0.35s ease;
}

.kiosco-permitido {
  --fondo: #145c36;
}
.kiosco-gracia {
  --fondo: #7a5510;
}
.kiosco-negado {
  --fondo: #7d1a12;
}

.kiosco-cabecera {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 32px;
}

.ceja-kiosco {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.7;
}

.sede-kiosco {
  font-size: 2rem;
  line-height: 1.1;
}

.reloj {
  font-size: 2.5rem;
  font-weight: 600;
  opacity: 0.9;
}

.kiosco-cuerpo {
  flex: 1;
  display: flex;
  min-height: 0;
}

.kiosco-centro {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
}

.aviso {
  max-width: 900px;
}

.aviso-icono {
  font-size: clamp(96px, 16vw, 180px);
}

.huella-reposo {
  opacity: 0.85;
  animation: pulso 2s ease-in-out infinite;
}

.aviso-ceja {
  margin-top: 8px;
  font-size: clamp(1.4rem, 3vw, 2.2rem);
  letter-spacing: 0.06em;
  opacity: 0.85;
}

.aviso-titulo {
  margin-top: 4px;
  font-size: clamp(2.2rem, 6vw, 4.5rem);
  font-weight: 700;
  line-height: 1.1;
}

.aviso-detalle {
  margin-top: 16px;
  font-size: clamp(1.1rem, 2.4vw, 1.8rem);
  opacity: 0.9;
}

/* Lista de entradas: columna a la derecha en pantallas anchas; en angostas no cabe
   junto al mensaje grande (que es lo que importa en la puerta) y se oculta. */
.lista-entradas {
  width: 360px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.22);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  max-height: calc(100vh - 10px - 104px - 52px);
}

.lista-cabecera {
  padding: 18px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.lista-titulo {
  font-size: 1.3rem;
  letter-spacing: 0.04em;
}

.lista-resumen {
  display: flex;
  gap: 16px;
  margin-top: 4px;
  font-size: 0.9rem;
  opacity: 0.85;
}

.lista-vacia {
  padding: 20px;
  opacity: 0.7;
}

.lista-filas {
  list-style: none;
  margin: 0;
  padding: 6px 0;
  overflow-y: auto;
}

.fila-entrada {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px 20px 9px 16px;
  border-left: 4px solid transparent;
  font-size: 0.95rem;
}
.fila-permitido {
  border-left-color: #2ecc71;
}
.fila-negado {
  border-left-color: #e5533d;
}

.fila-hora {
  opacity: 0.7;
}

.fila-nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.fila-motivo {
  font-size: 0.8rem;
  opacity: 0.75;
}

@media (max-width: 1023px) {
  .lista-entradas {
    display: none;
  }
}

.menu-voces {
  min-width: 260px;
  max-height: 60vh;
}
.voz-elegida {
  font-weight: 700;
  color: var(--q-primary);
}

.kiosco-pie {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 32px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 0.85rem;
}

.indicador {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 0.6;
}
.indicador::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #8f1d14;
}
.indicador.activo {
  opacity: 1;
}
.indicador.activo::before {
  background: #2ecc71;
}

.aparecer-enter-active,
.aparecer-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.aparecer-enter-from,
.aparecer-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@keyframes pulso {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
