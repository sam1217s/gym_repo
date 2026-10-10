<template>
  <q-layout view="hHh lpR fFf" class="landing">
    <!-- Barra superior: una capsula de vidrio flotante. La linea dorada de la base
         marca cuanto de la pagina llevas recorrido, y el enlace subrayado, en que
         seccion estas. Se esconde al bajar y reaparece al subir. -->
    <q-header :class="['barra', { 'barra-solida': conScroll, 'barra-oculta': barraOculta }]">
      <div class="barra-capsula">
        <q-toolbar class="barra-contenido">
          <a class="marca" href="#inicio" @click.prevent="irA('inicio')">
            <span class="marca-medalla">
              <img src="/landing/logo-barichara.jpeg" alt="Logo Gym Barichara" class="marca-logo" />
            </span>
            <span class="marca-texto">
              <span class="marca-nombre">Gym Barichara</span>
              <span class="marca-sedes">Barichara · Villanueva</span>
            </span>
          </a>

          <q-space />

          <nav class="enlaces gt-sm" aria-label="Secciones de la página">
            <a
              v-for="enlace in ENLACES_NAV"
              :key="enlace.id"
              :href="`#${enlace.id}`"
              :class="{ activo: seccionActiva === enlace.id }"
              :aria-current="seccionActiva === enlace.id ? 'location' : undefined"
              @click.prevent="irA(enlace.id)"
            >
              {{ enlace.texto }}
            </a>
          </nav>

          <q-btn
            unelevated
            no-caps
            class="boton-dorado boton-entrar"
            icon-right="login"
            :dense="$q.screen.lt.sm"
            :label="$q.screen.lt.sm ? 'Entrar' : 'Iniciar sesión'"
            :to="{ name: 'iniciar-sesion' }"
          />

          <!-- En celular no caben los enlaces: van en un menu. -->
          <q-btn flat round dense icon="menu" color="white" class="lt-md q-ml-xs" aria-label="Abrir menú de secciones">
            <q-menu dark anchor="bottom right" self="top right" :offset="[0, 12]" class="bg-dark">
              <q-list style="min-width: 190px">
                <q-item
                  v-for="enlace in ENLACES_NAV"
                  :key="enlace.id"
                  v-close-popup
                  clickable
                  :active="seccionActiva === enlace.id"
                  active-class="text-primary"
                  @click="irA(enlace.id)"
                >
                  <q-item-section avatar><q-icon :name="enlace.icono" /></q-item-section>
                  <q-item-section>{{ enlace.texto }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-toolbar>
        <div class="barra-progreso" :style="{ transform: `scaleX(${progreso})` }" />
      </div>
    </q-header>

    <q-page-container>
      <q-page>
        <!-- Portada -->
        <section id="inicio" :class="['portada', 'pantalla', { 'portada-sin-3d': sin3d }]">
          <!-- Capas de atras hacia adelante: la foto de la sede (textura tenue), el foco
               de luz, la barra 3D y el velo que asegura la lectura del texto. -->
          <div class="portada-foto" />
          <div class="portada-foco" />
          <BarraOlimpica3D v-if="!sin3d" @sin-webgl="sin3d = true" />
          <div class="portada-velo" />
          <div class="portada-contenido">
            <div class="ceja">Barichara · Villanueva</div>
            <!-- Se escribe y se borra en bucle. El texto completo va en aria-label para
                 que un lector de pantalla no lea letra por letra. -->
            <h1 class="portada-titulo" aria-label="Gym Barichara">
              <span aria-hidden="true">{{ lineaUno }}<span v-if="escribiendoLineaUno" class="cursor" /></span><br />
              <span class="oro" aria-hidden="true">{{ lineaDos }}<span v-if="!escribiendoLineaUno" class="cursor" /></span>
            </h1>
            <!-- Cada valor es una "placa" con su banda dorada, como los discos de la barra. -->
            <ul class="lema" aria-label="Fuerza, Disciplina, Salud">
              <li v-for="(valor, i) in VALORES" :key="valor.texto" :style="{ '--i': i }">
                <q-icon :name="valor.icono" class="lema-icono" />
                <span>{{ valor.texto }}</span>
              </li>
            </ul>
            <p class="portada-texto">
              Dos sedes para entrenar cerca de ti. Pesas libres, máquinas, zona funcional y un
              ambiente que te empuja a dar lo mejor.
            </p>
          </div>

          <!-- Cintas cruzadas al pie de la portada, como cinta de tarima: se ven sin
               hacer scroll. -->
          <div class="cintas" aria-hidden="true">
            <div class="cinta cinta-negra">
              <div class="cinta-pista cinta-reversa">
                <span v-for="n in 2" :key="n">{{ TEXTO_CINTA }}</span>
              </div>
            </div>
            <div class="cinta cinta-oro">
              <div class="cinta-pista">
                <span v-for="n in 2" :key="n">{{ TEXTO_CINTA }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Servicios / caracteristicas -->
        <section id="servicios" class="seccion seccion-servicios pantalla">
          <div class="contenedor contenedor-capas">
            <div v-paralaje="-0.12" class="palabra-fondo palabra-oscura" aria-hidden="true">Entrena</div>
            <div v-revelar class="ceja ceja-oscura">Lo que encuentras</div>
            <h2 v-revelar="1" class="titulo-seccion">Todo para tu entrenamiento</h2>

            <div class="row q-col-gutter-md q-mt-md">
              <div
                v-for="(servicio, i) in SERVICIOS"
                :key="servicio.titulo"
                v-revelar="i + 1"
                class="col-6 col-md-4"
              >
                <article v-inclinar class="tarjeta-servicio">
                  <div class="servicio-texto">
                    <div class="icono-servicio">
                      <q-icon :name="servicio.icono" size="28px" />
                    </div>
                    <h3>{{ servicio.titulo }}</h3>
                    <p>{{ servicio.texto }}</p>
                  </div>
                  <AnimacionServicio :tipo="servicio.animacion" class="servicio-animacion" />
                </article>
              </div>
            </div>
          </div>
        </section>

        <!-- Frase del mural -->
        <section class="frase pantalla">
          <div class="contenedor frase-contenido">
            <div class="frase-disco">
              <DiscoGirando3D />
              <div class="frase-sombra" />
            </div>
            <div v-revelar class="frase-cita">
              <q-icon name="format_quote" size="40px" class="frase-icono" />
              <p class="frase-texto">Lo único imposible es aquello que no intentas.</p>
            </div>
          </div>
        </section>

        <!-- Sedes -->
        <section id="sedes" class="seccion-oscura">
          <div
            v-for="(sede, indice) in SEDES"
            :key="sede.nombre"
            class="seccion pantalla pantalla-sede"
          >
          <div class="contenedor">
            <div v-revelar class="ceja">Nuestras sedes · {{ indice + 1 }} de {{ SEDES.length }}</div>
            <h2 v-revelar="1" class="titulo-seccion titulo-claro">
              {{ indice === 0 ? 'Dos sedes, un mismo equipo' : 'Y en Villanueva' }}
            </h2>

            <article
              :class="['sede', { 'sede-invertida': indice % 2 === 1, 'sede-dos-fotos': sede.fotos.length === 2, 'sede-tres-fotos': sede.fotos.length === 3 }]"
            >
              <div v-paralaje="0.18" class="palabra-fondo palabra-sede" aria-hidden="true">
                {{ sede.nombre.replace('Sede ', '') }}
              </div>
              <div v-revelar:[ladoTexto(indice)] class="sede-info">
                <!-- El logo es una medalla: gira sobre su eje al pasar el mouse. -->
                <div class="medalla">
                  <img :src="sede.logo" :alt="`Logo ${sede.nombre}`" class="sede-logo" />
                </div>
                <h3 class="sede-nombre">{{ sede.nombre }}</h3>
                <p class="sede-texto">{{ sede.texto }}</p>
                <ul class="sede-puntos">
                  <li v-for="punto in sede.puntos" :key="punto">
                    <q-icon name="check_circle" size="18px" /> {{ punto }}
                  </li>
                </ul>
              </div>

              <div v-revelar:[ladoGaleria(indice)] class="sede-galeria">
                <button
                  v-for="(foto, i) in sede.fotos"
                  :key="foto"
                  type="button"
                  v-inclinar
                  :class="['foto', { 'foto-principal': i === 0 }]"
                  :aria-label="`Ampliar foto ${i + 1} de ${sede.nombre}`"
                  @click="ampliar(foto, sede.nombre)"
                >
                  <img :src="foto" :alt="`${sede.nombre} — foto ${i + 1}`" loading="lazy" />
                </button>
              </div>
            </article>
          </div>
          </div>
        </section>

        <!-- Pagos -->
        <section id="pagos" class="seccion pantalla">
          <div class="contenedor">
            <div v-revelar class="ceja ceja-oscura">Paga tu mensualidad</div>
            <h2 v-revelar="1" class="titulo-seccion">Fácil y sin filas</h2>

            <div class="row q-col-gutter-lg q-mt-md items-stretch">
              <div v-revelar="2" class="col-12 col-md-6">
                <div v-inclinar class="tarjeta-pago">
                  <h3>Medios de pago</h3>
                  <!-- Sin numeros de cuenta a proposito: la portada es publica. Los datos
                       para transferir le llegan al miembro en el aviso de WhatsApp. -->
                  <ul class="lista-pagos">
                    <li><q-icon name="bolt" /> <strong>Llave Bre-B</strong></li>
                    <li><q-icon name="smartphone" /> <strong>Nequi</strong></li>
                    <li><q-icon name="account_balance" /> <strong>Transferencia Bancolombia</strong></li>
                    <li><q-icon name="payments" /> <strong>Efectivo</strong> en recepción</li>
                  </ul>
                  <p class="nota-pago">
                    Los datos para transferir te llegan en el aviso de WhatsApp, o pídelos en
                    recepción.
                  </p>
                </div>
              </div>
              <div v-revelar="3" class="col-12 col-md-6">
                <div v-inclinar class="tarjeta-pago tarjeta-whatsapp">
                  <h3>Recordatorios por WhatsApp</h3>
                  <p>
                    Te avisamos por WhatsApp antes de que venza tu mensualidad. Cuando pagues,
                    responde ese mismo chat con la foto del comprobante y lo registramos.
                  </p>
                  <p class="nota">
                    Al registrar tu pago recibes la confirmación con la fecha hasta la que quedas al
                    día.
                  </p>
                  <!-- El flujo real, en tres mensajes: aviso, comprobante, confirmacion. -->
                  <div class="chat" aria-hidden="true">
                    <div class="burbuja burbuja-gym" style="--n: 0">
                      Hola Ana, tu mensualidad vence el <strong>30 de octubre</strong>.
                    </div>
                    <div class="burbuja burbuja-tu" style="--n: 1">
                      <q-icon name="image" size="18px" /> comprobante.jpg
                    </div>
                    <div class="burbuja burbuja-gym" style="--n: 2">
                      <q-icon name="check_circle" size="16px" class="text-positive" /> Pago registrado. Quedas al
                      día hasta el <strong>30 de noviembre</strong>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Pie -->
        <footer class="pie">
          <div v-paralaje="-0.08" class="pie-gigante" aria-hidden="true">Gym Barichara</div>

          <!-- Contacto: todo se atiende por WhatsApp. -->
          <div id="contacto" class="contenedor contacto">
            <div>
              <div class="ceja">Contacto</div>
              <h2 class="titulo-seccion titulo-claro">¿Tienes dudas? Escríbenos</h2>
              <p class="contacto-texto">
                Planes, precios y todo lo de nuestras sedes: escríbenos por WhatsApp y te respondemos.
              </p>
            </div>
            <a class="boton-whatsapp" :href="ENLACE_WHATSAPP" target="_blank" rel="noopener">
              <IconoWhatsapp class="boton-whatsapp-icono" />
              <span>
                <span class="boton-whatsapp-accion">Escribir por WhatsApp</span>
                <span class="boton-whatsapp-numero cifra-tabular">{{ TELEFONO_VISIBLE }}</span>
              </span>
            </a>
          </div>

          <div class="contenedor pie-contenido">
            <div class="pie-marca">
              <img src="/landing/logo-barichara.jpeg" alt="" class="pie-logo" />
              <div>
                <div class="pie-nombre">Gym Barichara</div>
                <div class="pie-lema">Fuerza · Disciplina · Salud</div>
              </div>
            </div>
            <div class="pie-derecha">
              <router-link :to="{ name: 'iniciar-sesion' }" class="pie-acceso">
                Acceso funcionarios
              </router-link>
              <div class="pie-copy">© {{ anio }} Gym Barichara · Sedes Barichara y Villanueva</div>
            </div>
          </div>
        </footer>
      </q-page>
    </q-page-container>

    <!-- Boton flotante de WhatsApp: siempre a mano, en la esquina. -->
    <a
      :class="['whatsapp-flotante', { 'whatsapp-flotante-oculto': enPie }]"
      :href="ENLACE_WHATSAPP"
      target="_blank"
      rel="noopener"
      aria-label="Escríbenos por WhatsApp"
    >
      <IconoWhatsapp />
      <q-tooltip anchor="center left" self="center right" :offset="[10, 0]">Escríbenos</q-tooltip>
    </a>

    <!-- Foto ampliada -->
    <q-dialog v-model="hayAmpliada">
      <div class="visor">
        <img :src="ampliada?.src" :alt="ampliada?.alt" />
        <q-btn v-close-popup round flat icon="close" color="white" class="visor-cerrar" />
      </div>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';

// La escena 3D (three.js) llega en su propio archivo: el texto de la portada se
// pinta al instante y la barra aparece en cuanto descarga.
const BarraOlimpica3D = defineAsyncComponent(() => import('src/components/BarraOlimpica3D.vue'));
const DiscoGirando3D = defineAsyncComponent(() => import('src/components/DiscoGirando3D.vue'));

import AnimacionServicio from 'src/components/AnimacionServicio.vue';
import IconoWhatsapp from 'src/components/IconoWhatsapp.vue';

/** Contacto del gimnasio: WhatsApp, con un primer mensaje ya escrito. */
const TELEFONO_WHATSAPP = '573158044633';
const TELEFONO_VISIBLE = '+57 315 804 4633';
const ENLACE_WHATSAPP = `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(
  'Hola, quiero información sobre Gym Barichara',
)}`;

/**
 * Pagina publica del gimnasio (la portada de la URL). Muestra que es el gimnasio,
 * sus servicios, sus dos sedes con fotos y como pagar. El boton "Iniciar sesión"
 * es para los funcionarios: lleva al login del panel.
 *
 * Usa la paleta del LOGO (negro + dorado), no la del panel: es la cara publica
 * de la marca. Las imagenes viven en `public/landing/`.
 */

const SERVICIOS = [
  {
    icono: 'fitness_center',
    titulo: 'Pesas libres',
    animacion: 'pesas',
    texto: 'Mancuernas, barras y discos para entrenar fuerza a tu ritmo.',
  },
  {
    icono: 'sports_gymnastics',
    titulo: 'Máquinas guiadas',
    animacion: 'maquinas',
    texto: 'Equipos para trabajar cada grupo muscular con buena técnica.',
  },
  {
    icono: 'local_fire_department',
    titulo: 'Zona funcional',
    animacion: 'funcional',
    texto: 'Espacio abierto para entrenamiento funcional, circuitos y llanta.',
  },
  {
    icono: 'groups',
    titulo: 'Buen ambiente',
    animacion: 'ambiente',
    texto: 'Una comunidad que entrena junta y se motiva todos los días.',
  },
  {
    icono: 'event_available',
    titulo: 'Planes por sede',
    animacion: 'planes',
    texto: 'Mensualidades pensadas para cada sede, sin complicaciones.',
  },
  {
    icono: 'chat',
    titulo: 'Avisos por WhatsApp',
    animacion: 'whatsapp',
    texto: 'Te recordamos tu vencimiento y confirmamos tus pagos por chat.',
  },
];

const SEDES = [
  {
    nombre: 'Sede Barichara',
    logo: '/landing/logo-barichara.jpeg',
    texto:
      'En una casona de arquitectura colonial, con el techo de madera y caña típico del pueblo. Un espacio amplio, fresco y lleno de carácter para entrenar.',
    puntos: ['Máquinas y pesas libres', 'Recepción con productos', 'Espejos y buena iluminación'],
    fotos: ['/landing/barichara-2.jpeg', '/landing/barichara-1.jpeg'],
  },
  {
    nombre: 'Sede Villanueva',
    logo: '/landing/logo-villanueva.jpeg',
    texto:
      'Un espacio grande de estilo industrial, con zona de pesas libres, máquinas y área funcional. Ideal para entrenar en grupo o por tu cuenta.',
    puntos: ['Amplia zona de pesas', 'Área funcional', 'Ambiente de comunidad'],
    fotos: ['/landing/villanueva-2.jpeg', '/landing/villanueva-1.jpeg', '/landing/villanueva-3.jpeg'],
  },
];

const VALORES = [
  { texto: 'Fuerza', icono: 'fitness_center' },
  { texto: 'Disciplina', icono: 'event_repeat' },
  { texto: 'Salud', icono: 'favorite' },
];

const anio = new Date().getFullYear();

const TEXTO_CINTA = 'Fuerza ◆ Disciplina ◆ Salud ◆ Barichara ◆ Villanueva ◆ '.repeat(3);

/**
 * Paralaje: capas de fondo (las palabras gigantes) que se desplazan a otra
 * velocidad que el contenido al hacer scroll, para dar profundidad. El valor es
 * la fraccion del desplazamiento (negativo = en contra). Un solo listener de
 * scroll, con requestAnimationFrame, para todas las capas.
 */
const capasParalaje = new Map();
let paralajePendiente = false;
function moverCapas() {
  paralajePendiente = false;
  const centro = window.innerHeight / 2;
  for (const [el, factor] of capasParalaje) {
    const caja = el.parentElement.getBoundingClientRect();
    el.style.setProperty('--paralaje', `${((caja.top + caja.height / 2 - centro) * factor).toFixed(1)}px`);
  }
}
function pedirMoverCapas() {
  if (paralajePendiente || capasParalaje.size === 0) return;
  paralajePendiente = true;
  requestAnimationFrame(moverCapas);
}
const vParalaje = {
  mounted(el, { value }) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    capasParalaje.set(el, Number(value) || 0.1);
    pedirMoverCapas();
  },
  beforeUnmount(el) {
    capasParalaje.delete(el);
  },
};

// Sin WebGL, la portada vuelve a su foto de fondo a plena intensidad.
const sin3d = ref(false);

/**
 * Inclinacion 3D al pasar el mouse: la tarjeta se ladea hacia el puntero y un
 * brillo dorado la recorre. Solo con mouse real y si no se pidio menos movimiento.
 */
const conMovimiento = () =>
  window.matchMedia?.('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Entrada en perspectiva al aparecer en pantalla: el elemento llega inclinado
 * desde el fondo y se asienta, como una placa que se monta. El valor es su orden
 * dentro del grupo (escalona la entrada); el argumento, de que lado llega
 * (`izquierda` / `derecha`; sin argumento, sube desde abajo). Una sola vez.
 */
const observadorRevelar =
  typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) {
            if (!entrada.isIntersecting) continue;
            entrada.target.classList.add('revelado');
            observadorRevelar.unobserve(entrada.target);
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
      );

const vRevelar = {
  mounted(el, { value, arg }) {
    if (!observadorRevelar || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('revelar', arg ? `revelar-${arg}` : 'revelar-abajo');
    el.style.setProperty('--orden', value ?? 0);
    observadorRevelar.observe(el);
  },
  beforeUnmount(el) {
    observadorRevelar?.unobserve(el);
  },
};

// En las sedes, texto y galeria llegan desde lados opuestos (y se alternan).
const ladoTexto = (indice) => (indice % 2 ? 'derecha' : 'izquierda');
const ladoGaleria = (indice) => (indice % 2 ? 'izquierda' : 'derecha');

const vInclinar = {
  mounted(el) {
    if (!conMovimiento()) return;
    el.classList.add('inclinable');
    el._alMover = (evento) => {
      const caja = el.getBoundingClientRect();
      const x = (evento.clientX - caja.left) / caja.width;
      const y = (evento.clientY - caja.top) / caja.height;
      el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
      el.style.setProperty('--bx', `${x * 100}%`);
      el.style.setProperty('--by', `${y * 100}%`);
    };
    el._alSalir = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    };
    el.addEventListener('pointermove', el._alMover);
    el.addEventListener('pointerleave', el._alSalir);
  },
  beforeUnmount(el) {
    el.removeEventListener('pointermove', el._alMover);
    el.removeEventListener('pointerleave', el._alSalir);
  },
};

// En el pie ya esta el boton grande de WhatsApp: el flotante sobra y taparia el
// final de la pagina, asi que se esconde mientras el pie esta en pantalla.
const enPie = ref(false);
let observadorPie = null;

const ENLACES_NAV = [
  { id: 'inicio', texto: 'Inicio', icono: 'home' },
  { id: 'servicios', texto: 'Servicios', icono: 'fitness_center' },
  { id: 'sedes', texto: 'Sedes', icono: 'place' },
  { id: 'pagos', texto: 'Pagos', icono: 'payments' },
  { id: 'contacto', texto: 'Contacto', icono: 'chat' },
];

// La barra se vuelve solida al bajar, para no perder legibilidad sobre el contenido.
const conScroll = ref(false);
// Cuanto de la pagina se ha recorrido (0 a 1) y en que seccion se esta.
const progreso = ref(0);
const seccionActiva = ref('inicio');

function actualizarUbicacion() {
  const recorrido = document.documentElement.scrollHeight - window.innerHeight;
  progreso.value = recorrido > 0 ? Math.min(window.scrollY / recorrido, 1) : 0;

  // La activa es la ultima seccion cuyo inicio ya paso el 40 % de la pantalla.
  const linea = window.innerHeight * 0.4;
  let activa = ENLACES_NAV[0].id;
  for (const { id } of ENLACES_NAV) {
    const seccion = document.getElementById(id);
    if (seccion && seccion.getBoundingClientRect().top <= linea) activa = id;
  }
  seccionActiva.value = activa;
}
/**
 * Barra que se esconde al bajar y vuelve al subir: deja toda la pantalla al
 * contenido mientras se lee, y esta a mano en cuanto se sube. Arriba del todo
 * siempre se ve.
 *
 * La direccion se mide contra donde EMPEZO el gesto de scroll, no contra el
 * ultimo evento: al saltar de pantalla en pantalla el navegador a veces se pasa
 * y rebota hacia atras para asentarse, y ese rebote no es "subir".
 */
const barraOculta = ref(false);
const UMBRAL_DIRECCION = 30;
const ALTURA_SIEMPRE_VISIBLE = 120;
const MS_FIN_GESTO = 160;
let inicioGesto = 0;
let temporizadorGesto = null;

function decidirBarra() {
  const y = window.scrollY;
  const recorrido = y - inicioGesto;
  if (y < ALTURA_SIEMPRE_VISIBLE) barraOculta.value = false;
  else if (recorrido > UMBRAL_DIRECCION) barraOculta.value = true;
  else if (recorrido < -UMBRAL_DIRECCION) barraOculta.value = false;

  // Cuando el scroll se detiene, ahi empieza el proximo gesto.
  clearTimeout(temporizadorGesto);
  temporizadorGesto = setTimeout(() => {
    inicioGesto = window.scrollY;
  }, MS_FIN_GESTO);
}

function alHacerScroll() {
  conScroll.value = window.scrollY > 40;
  decidirBarra();
  actualizarUbicacion();
  pedirMoverCapas();
}
onMounted(() => {
  // El salto de pantalla en pantalla (scroll-snap) vive en <html>: se activa
  // solo en esta pagina y lo aplica el CSS unicamente en computador.
  document.documentElement.classList.add('portada-pantallas');
  const pie = document.querySelector('.pie');
  if (pie && typeof IntersectionObserver !== 'undefined') {
    observadorPie = new IntersectionObserver(([entrada]) => {
      enPie.value = entrada.isIntersecting;
    });
    observadorPie.observe(pie);
  }
  alHacerScroll();
  window.addEventListener('scroll', alHacerScroll, { passive: true });
  iniciarMaquinaEscribir();
});
onBeforeUnmount(() => {
  document.documentElement.classList.remove('portada-pantallas');
  observadorPie?.disconnect();
  window.removeEventListener('scroll', alHacerScroll);
  clearTimeout(temporizadorTitulo);
  clearTimeout(temporizadorGesto);
});

// Titulo tipo maquina de escribir: escribe "Gym" + "Barichara", espera, borra y repite.
const TITULO_UNO = 'Gym';
const TITULO_DOS = 'Barichara';
const TOTAL_LETRAS = TITULO_UNO.length + TITULO_DOS.length;
const MS_ESCRIBIR = 130;
const MS_BORRAR = 60;
const MS_PAUSA_ESCRITO = 2600;
const MS_PAUSA_BORRADO = 700;

const letras = ref(TOTAL_LETRAS);
let borrando = false;
let temporizadorTitulo = null;

const lineaUno = computed(() => TITULO_UNO.slice(0, letras.value));
const lineaDos = computed(() => TITULO_DOS.slice(0, Math.max(0, letras.value - TITULO_UNO.length)));
const escribiendoLineaUno = computed(() => letras.value <= TITULO_UNO.length);

function pasoTitulo() {
  let espera = borrando ? MS_BORRAR : MS_ESCRIBIR;
  if (borrando) {
    letras.value -= 1;
    if (letras.value === 0) {
      borrando = false;
      espera = MS_PAUSA_BORRADO;
    }
  } else {
    letras.value += 1;
    if (letras.value === TOTAL_LETRAS) {
      borrando = true;
      espera = MS_PAUSA_ESCRITO;
    }
  }
  temporizadorTitulo = setTimeout(pasoTitulo, espera);
}

function iniciarMaquinaEscribir() {
  // Quien pidio menos movimiento ve el titulo fijo y completo.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  // Arranca escrito (se ve el nombre al cargar) y empieza a borrar tras la pausa.
  borrando = true;
  temporizadorTitulo = setTimeout(pasoTitulo, MS_PAUSA_ESCRITO);
}

function irA(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const ampliada = ref(null);
const hayAmpliada = computed({
  get: () => Boolean(ampliada.value),
  set: (valor) => {
    if (!valor) ampliada.value = null;
  },
});
function ampliar(src, sede) {
  ampliada.value = { src, alt: `Foto ampliada — ${sede}` };
}
</script>

<style scoped>
.landing {
  --oro: #f5c518;
  --oro-hover: #ffd43b;
  --negro: #0d0d0d;
  --carbon: #171717;
  --gris: #6b6b6b;
  --claro: #f6f5f1;
  background: var(--claro);
  color: var(--negro);
}

.landing {
  /* Ancho util de la pagina y su margen lateral, que crece con la pantalla. */
  --ancho-max: 1680px;
  --margen-lateral: clamp(16px, 4vw, 56px);
}
.contenedor {
  max-width: var(--ancho-max);
  margin: 0 auto;
  padding: 0 var(--margen-lateral);
}

/* La portada sube BAJO la barra (transparente encima de la foto): sin esto,
   Quasar reserva el alto del header y la barra queda sobre el fondo claro. */
.landing :deep(.q-page-container) {
  padding-top: 0 !important;
}

/* --- Barra superior: capsula de vidrio flotante --- */
.barra {
  background: transparent;
  padding: 10px var(--margen-lateral) 0;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.barra-oculta {
  transform: translateY(-120%);
}
/* Oculta, su sombra asomaria como una franja gris en el borde de arriba. Doble
   clase para ganarle a `.barra-solida .barra-capsula`, que va mas abajo. */
.barra.barra-oculta .barra-capsula {
  box-shadow: none;
}
.barra-capsula {
  position: relative;
  overflow: hidden;
  max-width: calc(var(--ancho-max) - 2 * var(--margen-lateral));
  margin: 0 auto;
  border-radius: 14px;
  background: rgba(13, 13, 13, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}
.barra-solida .barra-capsula {
  background: rgba(13, 13, 13, 0.84);
  border-color: rgba(245, 197, 24, 0.2);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}
.barra-contenido {
  min-height: 60px;
  padding: 0 10px 0 12px;
}
/* Linea dorada de progreso en la base de la capsula. */
.barra-progreso {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, #b8900f, var(--oro));
  transform-origin: left center;
  transition: transform 0.15s linear;
}

.marca {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  text-decoration: none;
}
.marca-medalla {
  display: inline-block;
  border-radius: 50%;
  perspective: 400px;
}
.marca-logo {
  display: block;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow:
    0 0 0 2px var(--oro),
    0 0 16px rgba(245, 197, 24, 0.35);
  transition: transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.marca:hover .marca-logo {
  transform: rotateY(360deg);
}
.marca-texto {
  display: flex;
  flex-direction: column;
  line-height: 1;
}
.marca-nombre {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 1.35rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.marca-sedes {
  margin-top: 3px;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 600;
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--oro);
  opacity: 0.85;
}
.enlaces {
  display: flex;
  align-items: center;
  gap: 28px;
  margin-right: 22px;
}
.enlaces a {
  position: relative;
  padding: 6px 0;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  transition: color 0.2s ease;
}
.enlaces a::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 2px;
  border-radius: 2px;
  background: var(--oro);
  transform: scaleX(0);
  transition: transform 0.25s ease;
}
.enlaces a:hover,
.enlaces a.activo {
  color: #fff;
}
.enlaces a:hover::after,
.enlaces a.activo::after {
  transform: scaleX(1);
}
.enlaces a:focus-visible,
.marca:focus-visible {
  outline: 2px solid var(--oro);
  outline-offset: 4px;
  border-radius: 4px;
}
.boton-entrar {
  border-radius: 10px;
  padding: 4px 16px;
}
.boton-dorado {
  background: var(--oro);
  color: var(--negro);
  font-weight: 700;
}
.boton-dorado:hover {
  background: var(--oro-hover);
}

/* --- Portada: escenario oscuro, foco dorado y la barra 3D --- */
.portada {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  align-items: center;
  overflow: hidden;
  background: #0a0a0a;
  color: #fff;
}
.portada-foto {
  position: absolute;
  inset: 0;
  background: url('/landing/barichara-2.jpeg') center / cover no-repeat;
  filter: grayscale(1) contrast(1.1);
  opacity: 0.12;
}
.portada-foco {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 55% 60% at 70% 42%, rgba(245, 197, 24, 0.2), transparent 70%),
    radial-gradient(ellipse 80% 50% at 70% 100%, rgba(245, 197, 24, 0.08), transparent 70%);
  pointer-events: none;
}
.portada-velo {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, rgba(10, 10, 10, 0.92) 0%, rgba(10, 10, 10, 0.55) 38%, transparent 62%),
    linear-gradient(0deg, rgba(10, 10, 10, 0.9) 0%, transparent 22%);
  pointer-events: none;
}
/* Sin WebGL: la foto vuelve a ser el fondo, con el velo de siempre. */
.portada-sin-3d .portada-foto {
  filter: none;
  opacity: 1;
}
.portada-sin-3d .portada-velo {
  background: linear-gradient(100deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.62) 55%, rgba(0, 0, 0, 0.35) 100%);
}
.portada-contenido {
  max-width: var(--ancho-max);
  position: relative;
  z-index: 1;
  pointer-events: none;

  /* Centrado en el espacio libre: debajo del encabezado (72 px de padding) y
     encima de las cintas (104 px de margen). */
  margin: 0 auto 104px;
  padding: 72px var(--margen-lateral) 0;
  width: 100%;
}
.ceja {
  display: inline-block;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--oro);
  font-size: 0.95rem;
  border-left: 4px solid var(--oro);
  padding-left: 10px;
}
.ceja-oscura {
  color: #8a6d00;
  border-color: var(--oro);
}
.portada-titulo {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: clamp(3rem, 9vw, 6.2rem);
  line-height: 0.92;
  margin: 18px 0 10px;
  letter-spacing: 0.01em;
}
.portada-titulo {
  /* Reserva las dos lineas para que el contenido de abajo no salte al borrar. */
  min-height: 1.84em;
}
.portada-titulo .oro {
  color: var(--oro);
}
.cursor {
  display: inline-block;
  width: 0.08em;
  height: 0.8em;
  margin-left: 0.06em;
  background: var(--oro);
  vertical-align: baseline;
  animation: parpadeo 0.9s steps(1) infinite;
}
@keyframes parpadeo {
  50% {
    opacity: 0;
  }
}
.lema {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 4px 0 22px;
}
.lema li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px 7px 12px;
  border-left: 4px solid var(--oro);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(4px);
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  /* Entran una tras otra, como se cargan los discos en la barra. */
  opacity: 0;
  animation: entrar-valor 0.5s ease-out forwards;
  animation-delay: calc(0.25s + var(--i) * 0.18s);
  transition:
    background 0.2s,
    transform 0.2s;
}
.lema li:hover {
  background: rgba(245, 197, 24, 0.18);
  transform: translateY(-2px);
}
.lema-icono {
  color: var(--oro);
  font-size: 1.1rem;
}
@keyframes entrar-valor {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 600px) {
  /* En movil las tres placas caben en una sola fila. */
  .lema {
    gap: 6px;
  }
  .lema li {
    gap: 5px;
    padding: 6px 9px 6px 7px;
    border-left-width: 3px;
    font-size: 0.92rem;
    letter-spacing: 0.08em;
  }
  .lema-icono {
    font-size: 0.95rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lema li {
    opacity: 1;
    animation: none;
  }
}
.portada-contenido .lema {
  pointer-events: auto;
}
.portada-texto {
  max-width: 520px;
  font-size: 1.12rem;
  line-height: 1.6;
  opacity: 0.92;
}

/* --- Secciones --- */
.seccion {
  padding: 88px 0;
  /* Al saltar desde el menu, que la barra fija no tape el titulo. */
  scroll-margin-top: 68px;
}
.seccion-oscura {
  background: var(--negro);
  color: #fff;
}
.titulo-seccion {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1;
  margin: 12px 0 8px;
}
.titulo-claro {
  color: #fff;
}

/* Cintas cruzadas */
.cintas {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  bottom: 0;
  height: 104px;
  perspective: 900px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0.85;
  /* Los extremos se desvanecen en vez de cortarse contra el borde. */
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
}
.cinta {
  position: absolute;
  left: -6%;
  right: -6%;
  top: 50%;
  padding: 7px 0;
  white-space: nowrap;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
}
.cinta-oro {
  z-index: 1;
  background: var(--oro);
  color: var(--negro);
  transform: translateY(-50%) rotateX(14deg) rotateZ(-2.5deg);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.5);
  /* Desenfoque leve, como fuera del plano de foco de la camara. */
  filter: blur(0.6px);
}
.cinta-negra {
  background: #1b1b1b;
  color: transparent;
  -webkit-text-stroke: 1px rgba(245, 197, 24, 0.75);
  transform: translateY(-50%) translateZ(-80px) rotateZ(3deg);
  filter: blur(1.6px);
  opacity: 0.8;
}
.cinta-pista {
  display: inline-flex;
  animation: deslizar-cinta 40s linear infinite;
}
.cinta-reversa {
  animation-direction: reverse;
  animation-duration: 55s;
}
@keyframes deslizar-cinta {
  to {
    transform: translateX(-50%);
  }
}

/* Palabras gigantes de fondo (capas con paralaje, ver `vParalaje`) */
.contenedor-capas {
  position: relative;
}
.palabra-fondo {
  position: absolute;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  line-height: 0.8;
  color: transparent;
  transform: translate3d(0, var(--paralaje, 0px), 0);
  will-change: transform;
}
.palabra-oscura {
  top: -40px;
  right: 0;
  font-size: clamp(5rem, 16vw, 15rem);
  -webkit-text-stroke: 2px rgba(13, 13, 13, 0.07);
}
.palabra-sede {
  z-index: 0;
  bottom: -0.06em;
  left: -0.04em;
  font-size: clamp(4rem, 9.5vw, 8.6rem);
  -webkit-text-stroke: 2px rgba(245, 197, 24, 0.2);
}
/* En la sede invertida el texto va a la derecha: la palabra tambien. */
.sede-invertida .palabra-sede {
  left: auto;
  right: -0.04em;
}
.sede > :not(.palabra-sede) {
  position: relative;
  z-index: 1;
}

/* Servicios */
.seccion-servicios {
  overflow: hidden;
}
/* Seis tarjetas en 3 columnas: con el ancho completo quedaban estiradas. Se
   limita para que cada tarjeta mantenga una proporcion comoda (~370 px). */
.seccion-servicios .contenedor-capas {
  max-width: calc(1180px + 2 * var(--margen-lateral));
}
.seccion-servicios .row {
  position: relative;
}
.tarjeta-servicio {
  position: relative;
  overflow: hidden;
  height: 100%;
  background: #fff;
  border-radius: 14px;
  padding: 26px 24px;
  border-top: 4px solid var(--oro);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
}
.tarjeta-servicio h3 {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 14px 0 6px;
  line-height: 1.2;
}
.tarjeta-servicio p {
  position: relative;
  color: var(--gris);
  margin: 0;
  line-height: 1.55;
}
/* Texto a la izquierda, ilustracion animada a la derecha. */
.tarjeta-servicio {
  display: grid;
  grid-template-columns: 1fr 110px;
  align-items: center;
  gap: 14px;
}
.servicio-texto {
  display: flex;
  flex-direction: column;
  align-self: stretch;
}
.servicio-animacion {
  width: 110px;
  height: 110px;
}
.tarjeta-servicio.inclinable .servicio-animacion {
  transform: translateZ(36px);
}
.icono-servicio {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--negro);
  color: var(--oro);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Entrada en perspectiva (ver `vRevelar`) */
.revelar {
  opacity: 0;
  transition:
    opacity 0.7s ease,
    transform 0.95s cubic-bezier(0.2, 0.8, 0.2, 1);
  transition-delay: calc(var(--orden, 0) * 90ms);
}
.revelar-abajo {
  transform: perspective(1100px) translate3d(0, 56px, -140px) rotateX(18deg);
  transform-origin: 50% 100%;
}
.revelar-izquierda {
  transform: perspective(1100px) translate3d(-70px, 0, -160px) rotateY(20deg);
  transform-origin: 0 50%;
}
.revelar-derecha {
  transform: perspective(1100px) translate3d(70px, 0, -160px) rotateY(-20deg);
  transform-origin: 100% 50%;
}
.revelar.revelado {
  opacity: 1;
  transform: none;
}

/* Inclinacion 3D (solo con mouse; ver `vInclinar`) */
.inclinable {
  position: relative;
  transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transform-style: preserve-3d;
  transition: transform 0.18s ease-out, box-shadow 0.25s ease;
  will-change: transform;
}
.inclinable::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at var(--bx, 50%) var(--by, 50%), rgba(245, 197, 24, 0.22), transparent 55%);
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}
.inclinable:hover::after {
  opacity: 1;
}
.tarjeta-servicio.inclinable:hover {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.14);
}
.tarjeta-servicio.inclinable .icono-servicio {
  transform: translateZ(28px);
}

/* Frase: el disco de 25 kg gira de canto sobre la franja dorada */
.frase {
  background:
    radial-gradient(ellipse 45% 90% at 22% 50%, rgba(255, 255, 255, 0.35), transparent 70%),
    var(--oro);
  color: var(--negro);
  padding: 40px 0;
  overflow: hidden;
}
.frase-contenido {
  display: grid;
  grid-template-columns: minmax(220px, 340px) 1fr;
  align-items: center;
  gap: 32px;
}
.frase-disco {
  position: relative;
  height: 320px;
}
.frase-sombra {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 6px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.35), transparent 70%);
  filter: blur(2px);
}
.frase-cita {
  text-align: left;
}
.frase-icono {
  opacity: 0.6;
}
.frase-texto {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: clamp(1.9rem, 4.6vw, 3.4rem);
  line-height: 1;
  margin: 6px 0 10px;
  max-width: 680px;
}

/* Sedes */
.sede {
  position: relative;
  /* Franja al pie reservada para el nombre gigante de la sede. */
  padding-bottom: clamp(3.6rem, 7.6vw, 6.8rem);
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 40px;
  align-items: center;
  margin-top: 56px;
}
.sede-invertida .sede-info {
  order: 2;
}
.medalla {
  display: inline-block;
  border-radius: 50%;
  perspective: 600px;
}
.sede-logo {
  display: block;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--oro);
  box-shadow:
    0 0 0 3px #7a5f00,
    0 10px 24px rgba(245, 197, 24, 0.25);
  transition: transform 1.1s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sede:hover .sede-logo {
  transform: rotateY(360deg);
}
/* Profundidad en la galeria: las fotos son capas sobre un mismo plano. */
.sede-galeria {
  perspective: 1400px;
}
.foto {
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.45);
}
.sede-nombre {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 2.2rem;
  color: var(--oro);
  margin: 16px 0 8px;
  line-height: 1;
}
.sede-texto {
  line-height: 1.65;
  opacity: 0.88;
}
.sede-puntos {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
}
.sede-puntos li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sede-puntos .q-icon {
  color: var(--oro);
}
.sede-galeria {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.foto {
  padding: 0;
  border: 0;
  cursor: zoom-in;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background: var(--carbon);
}
.foto-principal {
  grid-column: 1 / -1;
  aspect-ratio: 16 / 9;
}
/* Si la ultima foto quedaria sola en su fila, ocupa el ancho entero (sin hueco). */
.foto:not(.foto-principal):last-child:nth-child(even) {
  grid-column: 1 / -1;
  aspect-ratio: 16 / 9;
}
.foto img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}
.foto:hover img {
  transform: scale(1.04);
}
.foto:focus-visible {
  outline: 3px solid var(--oro);
  outline-offset: 2px;
}

/* Pagos */
.tarjeta-pago {
  height: 100%;
  background: #fff;
  border-radius: 14px;
  padding: 28px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
}
.tarjeta-pago h3 {
  line-height: 1.05;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 1.6rem;
  margin: 0 0 14px;
}
.tarjeta-whatsapp {
  background: var(--negro);
  color: #fff;
  border-top: 4px solid var(--oro);
}
.tarjeta-whatsapp p {
  line-height: 1.6;
  opacity: 0.9;
}
/* Burbujas de chat en capas: cada mensaje flota a otra profundidad. */
.chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
  transform-style: preserve-3d;
}
.burbuja {
  max-width: 82%;
  padding: 9px 13px;
  border-radius: 12px;
  font-size: 0.88rem;
  line-height: 1.4;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
  transform: translateZ(calc(6px + var(--n) * 5px));
  opacity: 0;
  animation: llegar-burbuja 0.5s ease-out forwards;
  animation-delay: calc(0.6s + var(--n) * 0.7s);
  animation-play-state: paused;
}
.revelado .burbuja,
.chat-visible .burbuja {
  animation-play-state: running;
}
.burbuja-gym {
  align-self: flex-start;
  background: #24262b;
  border-top-left-radius: 3px;
}
.burbuja-tu {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #1f5c3d;
  border-top-right-radius: 3px;
}
@keyframes llegar-burbuja {
  from {
    opacity: 0;
    translate: 0 14px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .burbuja {
    opacity: 1;
    animation: none;
  }
}
.nota {
  color: var(--oro);
}
.nota-pago {
  margin: 16px 0 0;
  color: #5b6170;
  font-size: 0.92rem;
}
.lista-pagos {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lista-pagos li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;
}
.lista-pagos li:last-child {
  border-bottom: 0;
}
.lista-pagos .q-icon {
  color: #8a6d00;
  font-size: 20px;
}
.tarjeta-pago.inclinable .lista-pagos .q-icon {
  transform: translateZ(14px);
}
.tarjeta-pago.inclinable:hover {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
}

/* Contacto (dentro del pie) */
.contacto {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  flex-wrap: wrap;
  padding-top: 12px;
  padding-bottom: 36px;
  margin-bottom: 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.contacto .titulo-seccion {
  margin-bottom: 6px;
}
.contacto-texto {
  margin: 0;
  max-width: 520px;
  opacity: 0.8;
  line-height: 1.55;
}
.boton-whatsapp {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 14px 26px 14px 20px;
  border-radius: 14px;
  background: #25d366;
  color: #0b2e17;
  text-decoration: none;
  box-shadow: 0 12px 28px rgba(37, 211, 102, 0.28);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.boton-whatsapp:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(37, 211, 102, 0.38);
}
.boton-whatsapp:focus-visible {
  outline: 3px solid var(--oro);
  outline-offset: 3px;
}
.boton-whatsapp-icono {
  font-size: 34px;
}
.boton-whatsapp > span {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.boton-whatsapp-accion {
  font-weight: 700;
  font-size: 1.05rem;
}
.boton-whatsapp-numero {
  font-size: 0.92rem;
  opacity: 0.85;
}

/* Boton flotante de WhatsApp */
.whatsapp-flotante {
  position: fixed;
  z-index: 2100;
  right: 22px;
  bottom: 22px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #25d366;
  color: #fff;
  font-size: 32px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease;
}
.whatsapp-flotante:hover {
  transform: scale(1.08);
}
.whatsapp-flotante {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.whatsapp-flotante-oculto {
  opacity: 0;
  transform: scale(0.6);
  pointer-events: none;
}
.whatsapp-flotante:focus-visible {
  outline: 3px solid var(--oro);
  outline-offset: 3px;
}
/* Una onda que se expande de vez en cuando: avisa que esta ahi sin estorbar. */
.whatsapp-flotante::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #25d366;
  z-index: -1;
  animation: onda-whatsapp 3.2s ease-out infinite;
}
@keyframes onda-whatsapp {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  60%,
  100% {
    transform: scale(1.7);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .whatsapp-flotante::before {
    animation: none;
    opacity: 0;
  }
}
@media (max-width: 600px) {
  .whatsapp-flotante {
    right: 14px;
    bottom: 14px;
    width: 54px;
    height: 54px;
    font-size: 28px;
  }
  .boton-whatsapp {
    width: 100%;
    justify-content: center;
  }
  .contenedor.contacto {
    padding-bottom: 32px;
  }
}

/* Pie */
.pie {
  position: relative;
  overflow: hidden;
  background: var(--carbon);
  color: #fff;
  padding: 0 0 36px;
  border-top: 6px solid var(--oro);
}
.pie-gigante {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 800;
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
  font-size: 13.5vw;
  line-height: 0.85;
  padding-top: 0.12em;
  margin-bottom: 18px;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(245, 197, 24, 0.35);
  background: linear-gradient(180deg, rgba(245, 197, 24, 0.22), transparent 85%);
  -webkit-background-clip: text;
  background-clip: text;
  transform: translate3d(0, var(--paralaje, 0px), 0);
}
.pie-contenido {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.pie-marca {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pie-logo {
  width: 52px;
  height: 52px;
  border-radius: 50%;
}
.pie-nombre {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 1.3rem;
}
.pie-lema {
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7;
}
.pie-derecha {
  text-align: right;
}
.pie-acceso {
  color: var(--oro);
  font-weight: 600;
  text-decoration: none;
}
.pie-copy {
  font-size: 0.85rem;
  opacity: 0.6;
  margin-top: 4px;
}

/* Visor */
.visor {
  position: relative;
  max-width: 92vw;
  max-height: 88vh;
}
.visor img {
  max-width: 92vw;
  max-height: 88vh;
  border-radius: 10px;
  display: block;
}
.visor-cerrar {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.55);
}

/* --- Computador: una seccion = una pantalla, y se salta de una a otra --- */
@media (min-width: 1024px) and (min-height: 640px) {
  :global(html.portada-pantallas) {
    scroll-snap-type: y mandatory;
  }
  .pantalla {
    box-sizing: border-box;
    height: 100vh;
    height: 100svh;
    min-height: 0;
    /* Igual arriba y abajo: el contenido queda centrado. No hace falta reservar
       el alto del encabezado, que se esconde al bajar. */
    padding: 40px 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    scroll-snap-align: start;
    scroll-margin-top: 0;
    overflow: hidden;
  }
  .pantalla > .contenedor {
    width: 100%;
  }
  .portada.pantalla {
    padding: 0;
    flex-direction: row;
  }
  .pie {
    scroll-snap-align: end;
  }

  /* Servicios: tarjetas mas compactas para que entren las dos filas. */
  .seccion-servicios .tarjeta-servicio {
    min-height: min(28vh, 250px);
    padding: 28px 22px 28px 26px;
  }
  .seccion-servicios .tarjeta-servicio h3 {
    margin: 18px 0 6px;
    font-size: 1.35rem;
  }
  .seccion-servicios .icono-servicio {
    width: 60px;
    height: 60px;
  }
  .seccion-servicios .icono-servicio .q-icon {
    font-size: 32px !important;
  }

  /* Frase: el disco crece y manda en la pantalla dorada. */
  .frase-contenido {
    grid-template-columns: minmax(300px, 520px) 1fr;
    gap: 48px;
  }
  .frase-disco {
    height: min(62vh, 560px);
  }
  .frase-texto {
    font-size: clamp(2.6rem, 4.4vw, 4.4rem);
  }

  /* Sede: la galeria se ajusta al alto disponible en lugar de a su ancho. */
  .pantalla-sede .titulo-seccion {
    margin-bottom: 0;
  }
  .pantalla-sede .sede {
    margin-top: 22px;
    padding-bottom: clamp(3rem, 6vw, 5.2rem);
  }
  .pantalla-sede .sede-galeria {
    height: min(52vh, 520px);
    grid-template-rows: 1.5fr 1fr;
  }
  .pantalla-sede .sede-galeria > .foto:nth-child(n) {
    aspect-ratio: auto;
    height: 100%;
    min-height: 0;
  }
  .pantalla-sede .palabra-sede {
    font-size: clamp(3.6rem, 7.6vw, 7rem);
  }
  /* Con solo 2 fotos apiladas, cada una quedaba baja: la galeria crece y el
     nombre gigante pasa al hueco bajo el texto (que se alinea arriba). */
  .pantalla-sede .sede-dos-fotos,
  .pantalla-sede .sede-tres-fotos {
    align-items: start;
    padding-bottom: 0;
  }
  .pantalla-sede .sede-dos-fotos .sede-galeria,
  .pantalla-sede .sede-tres-fotos .sede-galeria {
    height: min(64vh, 660px);
    grid-template-rows: 1fr 1fr;
  }
  /* Dos fotos: una al lado de la otra, a todo el alto de la galeria. */
  .pantalla-sede .sede-dos-fotos {
    grid-template-columns: 1fr 1.6fr;
  }
  .pantalla-sede .sede-dos-fotos .sede-galeria {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr;
  }
  .pantalla-sede .sede-dos-fotos .sede-galeria > .foto:nth-child(n) {
    grid-column: auto;
    grid-row: 1;
  }
  /* Tres fotos: una grande al frente y dos apiladas al lado. */
  .pantalla-sede .sede-tres-fotos .sede-galeria {
    grid-template-columns: 2fr 1fr;
  }
  .pantalla-sede .sede-tres-fotos .sede-galeria > .foto.foto-principal {
    grid-column: 1;
    grid-row: 1 / span 2;
  }
  /* En la sede invertida la galeria va primero: le toca la columna ancha. */
  .pantalla-sede .sede-invertida {
    grid-template-columns: 1.6fr 1fr;
  }
}

/* --- Movil --- */
@media (max-width: 760px) {
  .cintas {
    height: 80px;
  }
  .portada-contenido {
    margin-bottom: 50px;
  }
  .cinta {
    font-size: 1rem;
    padding: 6px 0;
  }
  .palabra-oscura {
    top: -10px;
  }
  .sede {
    padding-bottom: 0;
  }
  .palabra-sede {
    bottom: auto;
    top: -0.35em;
    font-size: 4.6rem;
  }
  .frase-contenido {
    grid-template-columns: 1fr;
    gap: 0;
    text-align: center;
  }
  .frase-disco {
    height: 220px;
    max-width: 260px;
    width: 100%;
    margin: 0 auto;
  }
  .frase-cita {
    text-align: center;
  }
  .frase-texto {
    margin: 6px auto 10px;
  }
}
@media (max-width: 900px) {
  .sede {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .sede-invertida .sede-info {
    order: 0;
  }
  .seccion {
    padding: 64px 0;
  }
}
@media (max-width: 759px) {
  .portada {
    align-items: flex-end;
  }
  .portada-contenido {
    padding-top: 46vh;
    padding-bottom: 48px;
  }
  .portada-foco {
    background: radial-gradient(ellipse 90% 40% at 50% 28%, rgba(245, 197, 24, 0.2), transparent 70%);
  }
  .portada-velo {
    background: linear-gradient(0deg, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.7) 45%, transparent 62%);
  }
}
@media (max-width: 600px) {
  .barra {
    padding: 8px 8px 0;
  }
  .marca {
    gap: 9px;
  }
  .marca-nombre {
    font-size: 1.05rem;
  }
  .marca-sedes {
    font-size: 0.56rem;
    letter-spacing: 0.16em;
  }
  .marca-logo {
    width: 36px;
    height: 36px;
  }
  .seccion {
    padding: 52px 0;
  }
  .contenedor {
    padding: 0 16px;
  }
  /* Servicios en dos columnas: seis tarjetas a una columna eran un scroll eterno. */
  .tarjeta-servicio {
    padding: 16px 14px;
    border-radius: 12px;
  }
  .tarjeta-servicio h3 {
    font-size: 1rem;
    margin: 10px 0 4px;
  }
  .tarjeta-servicio p {
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .icono-servicio {
    width: 40px;
    height: 40px;
  }
  .icono-servicio .q-icon {
    font-size: 22px !important;
  }
  .tarjeta-servicio {
    display: block;
  }
  .servicio-animacion {
    position: absolute;
    top: 10px;
    right: 8px;
    width: 58px;
    height: 58px;
  }
  .sede-logo {
    width: 72px;
    height: 72px;
  }
  .sede-galeria {
    gap: 8px;
  }
  .tarjeta-pago {
    padding: 22px 20px;
  }
  .tarjeta-pago h3 {
    font-size: 1.4rem;
  }
  .barra-contenido {
    min-height: 54px;
    padding: 0 4px 0 8px;
  }
  .boton-entrar {
    padding: 2px 10px;
    font-size: 0.85rem;
  }
  .pie-derecha {
    text-align: left;
  }
}
</style>
