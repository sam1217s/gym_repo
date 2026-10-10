<template>
  <!-- Ilustracion animada de cada servicio de la portada (en lugar de un GIF):
       SVG + CSS, liviana, nitida a cualquier tamano y con los colores de la marca. -->
  <svg class="animacion" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <!-- Pesas libres: press con barra cargada -->
    <template v-if="tipo === 'pesas'">
      <ellipse class="pesas-sombra" cx="60" cy="106" rx="36" ry="5" fill="#000" opacity="0.12" />
      <g class="pesas-barra">
        <rect x="10" y="56" width="100" height="5" rx="2.5" :fill="ACERO" />
        <rect x="18" y="38" width="11" height="41" rx="3" :fill="TINTA" />
        <rect x="19.6" y="40" width="7.8" height="37" rx="2" fill="none" :stroke="ORO" stroke-width="1.6" />
        <rect x="30" y="45" width="6" height="27" rx="2" :fill="TINTA" />
        <rect x="91" y="38" width="11" height="41" rx="3" :fill="TINTA" />
        <rect x="92.6" y="40" width="7.8" height="37" rx="2" fill="none" :stroke="ORO" stroke-width="1.6" />
        <rect x="84" y="45" width="6" height="27" rx="2" :fill="TINTA" />
      </g>
      <g class="pesas-lineas" :stroke="ORO" stroke-width="2" stroke-linecap="round">
        <line x1="46" y1="88" x2="46" y2="96" />
        <line x1="60" y1="86" x2="60" y2="98" />
        <line x1="74" y1="88" x2="74" y2="96" />
      </g>
    </template>

    <!-- Maquinas guiadas: polea, pila de placas y agarre -->
    <template v-else-if="tipo === 'maquinas'">
      <defs>
        <clipPath :id="`cable-${uid}`"><rect x="0" y="22" width="120" height="98" /></clipPath>
      </defs>
      <rect x="14" y="104" width="92" height="5" rx="2" :fill="TINTA" opacity="0.2" />
      <rect x="18" y="14" width="6" height="92" rx="2" :fill="TINTA" />
      <g :clip-path="`url(#cable-${uid})`">
        <g class="maquina-pila">
          <line x1="41" y1="-20" x2="41" y2="62" :stroke="ACERO" stroke-width="2" />
          <rect x="30" y="62" width="22" height="7" rx="1.5" :fill="TINTA" />
          <rect x="30" y="70" width="22" height="7" rx="1.5" :fill="TINTA" />
          <rect x="50" y="64" width="6" height="3" rx="1" :fill="ORO" />
        </g>
        <g class="maquina-agarre">
          <line x1="94" y1="-20" x2="94" y2="58" :stroke="ACERO" stroke-width="2" />
          <rect x="86" y="58" width="16" height="5" rx="2.5" :fill="ORO" />
        </g>
      </g>
      <rect x="30" y="78" width="22" height="7" rx="1.5" :fill="TINTA" />
      <rect x="30" y="86" width="22" height="7" rx="1.5" :fill="TINTA" />
      <rect x="30" y="94" width="22" height="7" rx="1.5" :fill="TINTA" />
      <rect x="18" y="14" width="80" height="6" rx="2" :fill="TINTA" />
      <g class="maquina-polea">
        <circle cx="94" cy="22" r="8" :fill="TINTA" />
        <circle cx="94" cy="22" r="5.5" fill="none" :stroke="ORO" stroke-width="1.6" />
        <line x1="94" y1="16.5" x2="94" y2="27.5" :stroke="ORO" stroke-width="1.4" />
        <line x1="88.5" y1="22" x2="99.5" y2="22" :stroke="ORO" stroke-width="1.4" />
      </g>
    </template>

    <!-- Zona funcional: kettlebell en swing -->
    <template v-else-if="tipo === 'funcional'">
      <rect x="20" y="108" width="80" height="4" rx="2" :fill="TINTA" opacity="0.2" />
      <circle cx="60" cy="14" r="4" :fill="TINTA" />
      <g class="funcional-pendulo">
        <line x1="60" y1="14" x2="60" y2="58" :stroke="ACERO" stroke-width="3" stroke-linecap="round" />
        <path d="M48 66 Q48 52 60 52 Q72 52 72 66" fill="none" :stroke="TINTA" stroke-width="5" stroke-linecap="round" />
        <circle cx="60" cy="80" r="18" :fill="TINTA" />
        <path d="M44 84 Q60 92 76 84" fill="none" :stroke="ORO" stroke-width="2.4" stroke-linecap="round" />
      </g>
    </template>

    <!-- Buen ambiente: comunidad que entrena junta -->
    <template v-else-if="tipo === 'ambiente'">
      <g class="ambiente-persona p1">
        <circle cx="30" cy="58" r="10" :fill="TINTA" />
        <path d="M14 98 Q14 74 30 74 Q46 74 46 98 Z" :fill="TINTA" />
      </g>
      <g class="ambiente-persona p3">
        <circle cx="90" cy="58" r="10" :fill="TINTA" />
        <path d="M74 98 Q74 74 90 74 Q106 74 106 98 Z" :fill="TINTA" />
      </g>
      <g class="ambiente-persona p2">
        <circle cx="60" cy="52" r="12" :fill="ORO" />
        <path d="M41 98 Q41 70 60 70 Q79 70 79 98 Z" :fill="ORO" />
      </g>
      <path
        class="ambiente-corazon"
        d="M60 34 C52 27 46 22 46 16 C46 11 50 8 54 8 C57 8 59 10 60 12 C61 10 63 8 66 8 C70 8 74 11 74 16 C74 22 68 27 60 34 Z"
        :fill="ORO"
      />
      <rect x="10" y="100" width="100" height="4" rx="2" :fill="TINTA" opacity="0.2" />
    </template>

    <!-- Planes por sede: calendario con el dia pagado marcado -->
    <template v-else-if="tipo === 'planes'">
      <rect x="18" y="22" width="84" height="80" rx="9" fill="#fff" :stroke="TINTA" stroke-width="3" />
      <path d="M18 31 Q18 22 27 22 L93 22 Q102 22 102 31 L102 40 L18 40 Z" :fill="TINTA" />
      <rect x="36" y="14" width="5" height="14" rx="2.5" :fill="ORO" />
      <rect x="79" y="14" width="5" height="14" rx="2.5" :fill="ORO" />
      <g :fill="TINTA" opacity="0.18">
        <rect x="28" y="48" width="12" height="10" rx="2" />
        <rect x="46" y="48" width="12" height="10" rx="2" />
        <rect x="64" y="48" width="12" height="10" rx="2" />
        <rect x="82" y="48" width="12" height="10" rx="2" />
        <rect x="28" y="64" width="12" height="10" rx="2" />
        <rect x="46" y="64" width="12" height="10" rx="2" />
        <rect x="82" y="64" width="12" height="10" rx="2" />
        <rect x="28" y="80" width="12" height="10" rx="2" />
        <rect x="46" y="80" width="12" height="10" rx="2" />
        <rect x="64" y="80" width="12" height="10" rx="2" />
        <rect x="82" y="80" width="12" height="10" rx="2" />
      </g>
      <rect class="planes-dia" x="62" y="62" width="16" height="14" rx="3" :fill="ORO" />
      <path
        class="planes-check"
        d="M65 69 L69 73 L76 65"
        fill="none"
        :stroke="TINTA"
        stroke-width="2.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>

    <!-- Avisos por WhatsApp: aviso, comprobante y confirmacion -->
    <template v-else-if="tipo === 'whatsapp'">
      <g class="chat-burbuja b1">
        <rect x="10" y="16" width="62" height="22" rx="8" fill="#e9e7e1" />
        <rect x="18" y="24" width="34" height="3" rx="1.5" :fill="TINTA" opacity="0.5" />
        <rect x="18" y="30" width="22" height="3" rx="1.5" :fill="TINTA" opacity="0.35" />
      </g>
      <g class="chat-burbuja b2">
        <rect x="52" y="46" width="58" height="26" rx="8" :fill="ORO" />
        <rect x="59" y="52" width="16" height="14" rx="2" :fill="TINTA" opacity="0.85" />
        <path d="M60 64 L65 58 L69 62 L72 59 L74 64 Z" :fill="ORO" />
        <rect x="80" y="56" width="22" height="3" rx="1.5" :fill="TINTA" opacity="0.6" />
      </g>
      <g class="chat-burbuja b3">
        <rect x="10" y="80" width="70" height="24" rx="8" :fill="TINTA" />
        <rect x="18" y="88" width="32" height="3" rx="1.5" fill="#fff" opacity="0.7" />
        <path d="M58 92 L61 95 L66 89 M63 95 L68 89" fill="none" :stroke="ORO" stroke-width="2" stroke-linecap="round" />
      </g>
    </template>
  </svg>
</template>

<script setup>
/**
 * `tipo`: pesas | maquinas | funcional | ambiente | planes | whatsapp.
 * Con `prefers-reduced-motion` se ven quietas (la ilustracion completa).
 */
defineProps({
  tipo: { type: String, required: true },
});

const TINTA = '#0d0d0d';
const ORO = '#f5c518';
const ACERO = '#b9bdc3';

// Id unico por instancia para el clipPath (puede haber varias en la pagina).
const uid = Math.random().toString(36).slice(2, 8);
</script>

<style scoped>
.animacion {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.animacion * {
  transform-box: fill-box;
  transform-origin: center;
}

/* Pesas */
.pesas-barra {
  animation: pesas-press 1.8s ease-in-out infinite alternate;
}
.pesas-sombra {
  animation: pesas-sombra 1.8s ease-in-out infinite alternate;
}
.pesas-lineas {
  animation: pesas-lineas 1.8s ease-in-out infinite alternate;
}
@keyframes pesas-press {
  from {
    transform: translateY(14px);
  }
  to {
    transform: translateY(-22px);
  }
}
@keyframes pesas-sombra {
  from {
    transform: scaleX(1);
    opacity: 0.16;
  }
  to {
    transform: scaleX(0.6);
    opacity: 0.06;
  }
}
@keyframes pesas-lineas {
  0%,
  40% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

/* Maquinas */
.maquina-pila {
  animation: maquina-sube 2s ease-in-out infinite alternate;
}
.maquina-agarre {
  animation: maquina-tira 2s ease-in-out infinite alternate;
}
.maquina-polea {
  animation: maquina-gira 2s ease-in-out infinite alternate;
}
@keyframes maquina-sube {
  to {
    transform: translateY(-20px);
  }
}
@keyframes maquina-tira {
  to {
    transform: translateY(20px);
  }
}
@keyframes maquina-gira {
  to {
    transform: rotate(240deg);
  }
}

/* Funcional: el pendulo gira desde el punto de agarre, no desde su centro. */
.funcional-pendulo {
  transform-box: view-box;
  transform-origin: 60px 14px;
  animation: funcional-swing 1.5s ease-in-out infinite alternate;
}
@keyframes funcional-swing {
  from {
    transform: rotate(-38deg);
  }
  to {
    transform: rotate(38deg);
  }
}

/* Ambiente */
.ambiente-persona {
  animation: ambiente-salto 1.6s ease-in-out infinite;
}
.ambiente-persona.p2 {
  animation-delay: 0.2s;
}
.ambiente-persona.p3 {
  animation-delay: 0.4s;
}
.ambiente-corazon {
  animation: ambiente-latido 1.6s ease-in-out infinite;
}
@keyframes ambiente-salto {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-9px);
  }
}
@keyframes ambiente-latido {
  0%,
  100% {
    transform: scale(0.85);
  }
  20% {
    transform: scale(1.15);
  }
  40% {
    transform: scale(0.95);
  }
  55% {
    transform: scale(1.08);
  }
}

/* Planes */
.planes-dia {
  animation: planes-dia 3s ease-in-out infinite;
}
.planes-check {
  stroke-dasharray: 20;
  animation: planes-check 3s ease-in-out infinite;
}
@keyframes planes-dia {
  0%,
  15% {
    opacity: 0;
    transform: scale(0.6);
  }
  30%,
  85% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1);
  }
}
@keyframes planes-check {
  0%,
  30% {
    stroke-dashoffset: 20;
    opacity: 1;
  }
  50%,
  85% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

/* WhatsApp: las tres burbujas llegan en orden y se reinicia el hilo. */
.chat-burbuja {
  opacity: 0;
  animation: chat-llega 4.5s ease-out infinite;
}
.chat-burbuja.b2 {
  animation-name: chat-llega-2;
}
.chat-burbuja.b3 {
  animation-name: chat-llega-3;
}
@keyframes chat-llega {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.85);
  }
  8%,
  88% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}
@keyframes chat-llega-2 {
  0%,
  25% {
    opacity: 0;
    transform: translateY(8px) scale(0.85);
  }
  33%,
  88% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}
@keyframes chat-llega-3 {
  0%,
  50% {
    opacity: 0;
    transform: translateY(8px) scale(0.85);
  }
  58%,
  88% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animacion * {
    animation: none !important;
  }
  .chat-burbuja,
  .planes-dia {
    opacity: 1;
  }
}
</style>
