<template>
  <q-layout view="hHh lpR fFf" class="landing">
    <!-- Barra superior: marca a la izquierda, acceso de funcionarios a la derecha. -->
    <q-header :class="['barra', { 'barra-solida': conScroll }]">
      <q-toolbar class="barra-contenido">
        <a class="marca" href="#inicio" @click.prevent="irA('inicio')">
          <img src="/landing/logo-barichara.jpeg" alt="Logo Gimnasio Barichara" class="marca-logo" />
          <span class="marca-nombre">Gimnasio Barichara</span>
        </a>

        <q-space />

        <nav class="enlaces gt-sm">
          <a href="#servicios" @click.prevent="irA('servicios')">Servicios</a>
          <a href="#sedes" @click.prevent="irA('sedes')">Sedes</a>
          <a href="#pagos" @click.prevent="irA('pagos')">Pagos</a>
        </nav>

        <q-btn
          unelevated
          no-caps
          class="boton-dorado q-ml-md"
          icon="login"
          label="Iniciar sesión"
          :to="{ name: 'iniciar-sesion' }"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page>
        <!-- Portada -->
        <section id="inicio" class="portada">
          <div class="portada-velo" />
          <div class="portada-contenido">
            <div class="ceja">Barichara · Villanueva</div>
            <h1 class="portada-titulo">Gimnasio<br /><span>Barichara</span></h1>
            <p class="lema">Fuerza · Disciplina · Salud</p>
            <p class="portada-texto">
              Dos sedes para entrenar cerca de ti. Pesas libres, máquinas, zona funcional y un
              ambiente que te empuja a dar lo mejor.
            </p>
            <div class="portada-acciones">
              <q-btn
                unelevated
                no-caps
                size="lg"
                class="boton-dorado"
                label="Conoce nuestras sedes"
                icon-right="arrow_downward"
                @click="irA('sedes')"
              />
              <q-btn
                outline
                no-caps
                size="lg"
                class="boton-contorno"
                label="Servicios"
                @click="irA('servicios')"
              />
            </div>
          </div>
        </section>

        <!-- Servicios / caracteristicas -->
        <section id="servicios" class="seccion">
          <div class="contenedor">
            <div class="ceja ceja-oscura">Lo que encuentras</div>
            <h2 class="titulo-seccion">Todo para tu entrenamiento</h2>

            <div class="row q-col-gutter-lg q-mt-md">
              <div v-for="servicio in SERVICIOS" :key="servicio.titulo" class="col-12 col-sm-6 col-md-4">
                <article class="tarjeta-servicio">
                  <div class="icono-servicio">
                    <q-icon :name="servicio.icono" size="28px" />
                  </div>
                  <h3>{{ servicio.titulo }}</h3>
                  <p>{{ servicio.texto }}</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <!-- Frase del mural -->
        <section class="frase">
          <div class="contenedor">
            <q-icon name="format_quote" size="40px" class="frase-icono" />
            <p class="frase-texto">Lo único imposible es aquello que no intentas.</p>
            <p class="frase-firma">— En las paredes de nuestro gimnasio</p>
          </div>
        </section>

        <!-- Sedes -->
        <section id="sedes" class="seccion seccion-oscura">
          <div class="contenedor">
            <div class="ceja">Nuestras sedes</div>
            <h2 class="titulo-seccion titulo-claro">Dos sedes, un mismo equipo</h2>

            <article
              v-for="(sede, indice) in SEDES"
              :key="sede.nombre"
              :class="['sede', { 'sede-invertida': indice % 2 === 1 }]"
            >
              <div class="sede-info">
                <img :src="sede.logo" :alt="`Logo ${sede.nombre}`" class="sede-logo" />
                <h3 class="sede-nombre">{{ sede.nombre }}</h3>
                <p class="sede-texto">{{ sede.texto }}</p>
                <ul class="sede-puntos">
                  <li v-for="punto in sede.puntos" :key="punto">
                    <q-icon name="check_circle" size="18px" /> {{ punto }}
                  </li>
                </ul>
              </div>

              <div class="sede-galeria">
                <button
                  v-for="(foto, i) in sede.fotos"
                  :key="foto"
                  type="button"
                  :class="['foto', { 'foto-principal': i === 0 }]"
                  :aria-label="`Ampliar foto ${i + 1} de ${sede.nombre}`"
                  @click="ampliar(foto, sede.nombre)"
                >
                  <img :src="foto" :alt="`${sede.nombre} — foto ${i + 1}`" loading="lazy" />
                </button>
              </div>
            </article>
          </div>
        </section>

        <!-- Pagos -->
        <section id="pagos" class="seccion">
          <div class="contenedor">
            <div class="ceja ceja-oscura">Paga tu mensualidad</div>
            <h2 class="titulo-seccion">Fácil y sin filas</h2>

            <div class="row q-col-gutter-lg q-mt-md items-stretch">
              <div class="col-12 col-md-6">
                <div class="tarjeta-pago">
                  <h3>Medios de pago</h3>
                  <ul class="lista-pagos">
                    <li><q-icon name="bolt" /> <strong>Llave Bre-B:</strong> 1095701644</li>
                    <li><q-icon name="smartphone" /> <strong>Nequi:</strong> 315 804 4633</li>
                    <li>
                      <q-icon name="account_balance" /> <strong>Bancolombia Ahorros:</strong>
                      32207168407
                    </li>
                    <li><q-icon name="person" /> <strong>Titular:</strong> Diego López</li>
                    <li><q-icon name="payments" /> También en efectivo en recepción.</li>
                  </ul>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="tarjeta-pago tarjeta-whatsapp">
                  <h3>Recordatorios por WhatsApp</h3>
                  <p>
                    Te avisamos por WhatsApp antes de que venza tu mensualidad. Cuando pagues,
                    responde ese mismo chat con la foto del comprobante y lo registramos.
                  </p>
                  <p class="nota">
                    Al registrar tu pago recibes la confirmación con la fecha hasta la que quedas al
                    día.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Pie -->
        <footer class="pie">
          <div class="contenedor pie-contenido">
            <div class="pie-marca">
              <img src="/landing/logo-barichara.jpeg" alt="" class="pie-logo" />
              <div>
                <div class="pie-nombre">Gimnasio Barichara</div>
                <div class="pie-lema">Fuerza · Disciplina · Salud</div>
              </div>
            </div>
            <div class="pie-derecha">
              <router-link :to="{ name: 'iniciar-sesion' }" class="pie-acceso">
                Acceso funcionarios
              </router-link>
              <div class="pie-copy">© {{ anio }} Gimnasio Barichara · Sedes Barichara y Villanueva</div>
            </div>
          </div>
        </footer>
      </q-page>
    </q-page-container>

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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

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
    texto: 'Mancuernas, barras y discos para entrenar fuerza a tu ritmo.',
  },
  {
    icono: 'sports_gymnastics',
    titulo: 'Máquinas guiadas',
    texto: 'Equipos para trabajar cada grupo muscular con buena técnica.',
  },
  {
    icono: 'local_fire_department',
    titulo: 'Zona funcional',
    texto: 'Espacio abierto para entrenamiento funcional, circuitos y llanta.',
  },
  {
    icono: 'groups',
    titulo: 'Buen ambiente',
    texto: 'Una comunidad que entrena junta y se motiva todos los días.',
  },
  {
    icono: 'event_available',
    titulo: 'Planes por sede',
    texto: 'Mensualidades pensadas para cada sede, sin complicaciones.',
  },
  {
    icono: 'chat',
    titulo: 'Avisos por WhatsApp',
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

const anio = new Date().getFullYear();

// La barra se vuelve solida al bajar, para no perder legibilidad sobre el contenido.
const conScroll = ref(false);
function alHacerScroll() {
  conScroll.value = window.scrollY > 40;
}
onMounted(() => {
  alHacerScroll();
  window.addEventListener('scroll', alHacerScroll, { passive: true });
});
onBeforeUnmount(() => window.removeEventListener('scroll', alHacerScroll));

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

.contenedor {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 20px;
}

/* La portada sube BAJO la barra (transparente encima de la foto): sin esto,
   Quasar reserva el alto del header y la barra queda sobre el fondo claro. */
.landing :deep(.q-page-container) {
  padding-top: 0 !important;
}

/* --- Barra superior --- */
.barra {
  background: transparent;
  transition: background 0.25s ease, box-shadow 0.25s ease;
}
.barra-solida {
  background: rgba(13, 13, 13, 0.94);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.barra-contenido {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  min-height: 68px;
}
.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  text-decoration: none;
}
.marca-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
}
.marca-nombre {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 1.35rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.enlaces a {
  color: #fff;
  text-decoration: none;
  margin-left: 22px;
  font-weight: 500;
  opacity: 0.88;
}
.enlaces a:hover {
  color: var(--oro);
  opacity: 1;
}
.boton-dorado {
  background: var(--oro);
  color: var(--negro);
  font-weight: 700;
}
.boton-dorado:hover {
  background: var(--oro-hover);
}
.boton-contorno {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.7);
}

/* --- Portada --- */
.portada {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: url('/landing/barichara-2.jpeg') center / cover no-repeat;
  color: #fff;
}
.portada-velo {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.62) 55%, rgba(0, 0, 0, 0.35) 100%);
}
.portada-contenido {
  position: relative;
  max-width: 1160px;
  margin: 0 auto;
  padding: 120px 20px 80px;
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
.portada-titulo span {
  color: var(--oro);
}
.lema {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 1.3rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0 0 18px;
}
.portada-texto {
  max-width: 560px;
  font-size: 1.12rem;
  line-height: 1.6;
  opacity: 0.92;
}
.portada-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 28px;
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

/* Servicios */
.tarjeta-servicio {
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
  color: var(--gris);
  margin: 0;
  line-height: 1.55;
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

/* Frase */
.frase {
  background: var(--oro);
  color: var(--negro);
  text-align: center;
  padding: 64px 0;
}
.frase-icono {
  opacity: 0.6;
}
.frase-texto {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: clamp(1.8rem, 4.5vw, 2.8rem);
  line-height: 1.05;
  margin: 6px auto 10px;
  max-width: 820px;
}
.frase-firma {
  margin: 0;
  font-weight: 500;
  opacity: 0.75;
}

/* Sedes */
.sede {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 40px;
  align-items: center;
  margin-top: 56px;
}
.sede-invertida .sede-info {
  order: 2;
}
.sede-logo {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--oro);
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
.nota {
  color: var(--oro);
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

/* Pie */
.pie {
  background: var(--carbon);
  color: #fff;
  padding: 36px 0;
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

/* --- Movil --- */
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
@media (max-width: 600px) {
  .marca-nombre {
    font-size: 1.05rem;
  }
  .barra-contenido {
    padding: 0 8px;
  }
  .boton-dorado.q-ml-md {
    margin-left: 6px;
  }
  .pie-derecha {
    text-align: left;
  }
}
</style>
