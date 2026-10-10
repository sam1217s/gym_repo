<template>
  <div ref="contenedor" class="escena" aria-hidden="true" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as THREE from 'three';

import { facilRebote, montarEscena } from './escenas/motor3d.js';
import { CARGA, crearBarra, crearMagnesio, crearMateriales, moverMagnesio } from './escenas/piezas.js';

/**
 * Barra olimpica cargada, en 3D y en tiempo real: la firma de la portada.
 *
 * Coreografia en bucle, como una serie en la tarima: los discos se deslizan
 * sobre las mangas uno por uno, del mas pesado (adentro) al seguro (afuera); la
 * barra se sostiene cargada; luego se descarga en orden inverso (seguro, disco
 * chico, discos grandes), queda vacia un instante y vuelve a empezar. Todo el
 * tiempo gira despacio sobre su eje, sigue al mouse y se inclina con el scroll.
 * El polvo de magnesio flota bajo el foco.
 *
 * Con `prefers-reduced-motion` se pinta quieta y ya cargada. Si el navegador no
 * tiene WebGL, emite `sin-webgl` y la portada se queda con su foto.
 */

const emit = defineEmits(['sin-webgl']);
const contenedor = ref(null);

const MS_ENTRADA_DISCO = 750;
const MS_ENTRE_DISCOS = 230;
const MS_ANTES_DE_CARGAR = 350;
const MS_CARGADA = 4000;
const MS_SALIDA_DISCO = 600;
const MS_ENTRE_SALIDAS = 200;
const MS_VACIA = 900;

const ULTIMO_ORDEN = CARGA.length - 1;
const FIN_CARGA = MS_ANTES_DE_CARGAR + ULTIMO_ORDEN * MS_ENTRE_DISCOS + MS_ENTRADA_DISCO;
const INICIO_DESCARGA = FIN_CARGA + MS_CARGADA;
const FIN_DESCARGA = INICIO_DESCARGA + ULTIMO_ORDEN * MS_ENTRE_SALIDAS + MS_SALIDA_DISCO;
const MS_CICLO = FIN_DESCARGA + MS_VACIA;

const acotar = (valor) => Math.min(Math.max(valor, 0), 1);

/**
 * Cuanto esta montada una pieza en este instante del ciclo: 0 = fuera de la
 * manga, 1 = asentada contra el tope. Al cargar rebota al asentarse; al
 * descargar acelera hacia afuera (sale primero la de afuera, el seguro).
 */
function montajeEn(msCiclo, orden) {
  if (msCiclo < INICIO_DESCARGA) {
    return facilRebote(acotar((msCiclo - MS_ANTES_DE_CARGAR - orden * MS_ENTRE_DISCOS) / MS_ENTRADA_DISCO));
  }
  const salida = acotar((msCiclo - INICIO_DESCARGA - (ULTIMO_ORDEN - orden) * MS_ENTRE_SALIDAS) / MS_SALIDA_DISCO);
  return 1 - salida ** 3;
}

let motor = null;
const puntero = { x: 0, y: 0 };
function alMoverPuntero(evento) {
  puntero.x = (evento.clientX / window.innerWidth) * 2 - 1;
  puntero.y = (evento.clientY / window.innerHeight) * 2 - 1;
}

function preparar(escena, { camara, reducido }) {
  // Foco calido desde arriba-derecha y contraluz frio: escenario de tarima.
  const foco = new THREE.SpotLight(0xffe2a0, 220, 40, Math.PI / 5, 0.6, 1.6);
  foco.position.set(4, 9, 6);
  escena.add(foco, foco.target);
  const contraluz = new THREE.DirectionalLight(0x9db7ff, 1.6);
  contraluz.position.set(-6, 2, -6);
  escena.add(contraluz, new THREE.AmbientLight(0xffffff, 0.12));

  const conjunto = new THREE.Group();
  const { barra, piezas } = crearBarra(crearMateriales());
  conjunto.add(barra);
  escena.add(conjunto);

  const magnesio = crearMagnesio();
  escena.add(magnesio);

  // Escritorio: a la derecha del texto. Movil: arriba, mas chica y mas de frente.
  const composicion = { x: 0, y: 0, escala: 1, giroY: -0.5 };
  const inclinacion = { x: 0, y: 0 };
  let giro = 0;

  return {
    ajustar(ancho) {
      const esMovil = ancho < 760;
      Object.assign(
        composicion,
        esMovil ? { x: 0, y: 2.0, escala: 0.42, giroY: -0.22 } : { x: 2.9, y: 0.15, escala: 0.72, giroY: -0.5 },
      );
      camara.position.set(0, 0.6, esMovil ? 17 : 15);
      camara.lookAt(0, 0, 0);
    },

    dibujar(ms, t) {
      const scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);

      // Carga y descarga en bucle (o todo cargado si no hay animacion).
      const msCiclo = ms % MS_CICLO;
      for (const pieza of piezas) {
        const { destino, origen, orden } = pieza.userData;
        const montaje = reducido ? 1 : montajeEn(msCiclo, orden);
        pieza.position.x = origen + (destino - origen) * montaje;
        pieza.visible = montaje > 0.001;
      }

      if (!reducido) {
        giro += 0.0035;
        inclinacion.x += (puntero.y * 0.12 - inclinacion.x) * 0.05;
        inclinacion.y += (puntero.x * 0.22 - inclinacion.y) * 0.05;
        moverMagnesio(magnesio, t);
      }
      barra.rotation.x = giro;

      const flotar = reducido ? 0 : Math.sin(t * 0.9) * 0.08;
      conjunto.scale.setScalar(composicion.escala);
      conjunto.position.set(composicion.x, composicion.y + flotar - scroll * 1.6, 0);
      conjunto.rotation.set(
        0.28 + inclinacion.x + scroll * 0.25,
        composicion.giroY + inclinacion.y + scroll * 0.5,
        0.2,
      );
    },
  };
}

onMounted(() => {
  motor = montarEscena(contenedor.value, { preparar });
  if (!motor) {
    emit('sin-webgl');
    return;
  }
  window.addEventListener('pointermove', alMoverPuntero, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', alMoverPuntero);
  motor?.destruir();
});
</script>

<style scoped>
.escena {
  position: absolute;
  inset: 0;
}
.escena :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
