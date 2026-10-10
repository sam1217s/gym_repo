<template>
  <div ref="contenedor" class="escena-disco" aria-hidden="true" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import * as THREE from 'three';

import { montarEscena, progresoEnPantalla } from './escenas/motor3d.js';
import { CARGA, crearDisco, crearMateriales } from './escenas/piezas.js';

/**
 * Un disco de 25 kg girando de canto, como una moneda, sobre la franja dorada de
 * la frase. Es el MISMO disco que va cargado en la barra de la portada. El scroll
 * le suma vueltas: al bajar por la pagina, el disco rueda.
 *
 * Si el navegador no tiene WebGL, no se pinta nada y la franja queda como antes.
 */

const contenedor = ref(null);
let motor = null;

function preparar(escena, { camara, reducido }) {
  const luzClave = new THREE.DirectionalLight(0xffffff, 2.4);
  luzClave.position.set(-3, 4, 6);
  const luzCalida = new THREE.PointLight(0xffd76a, 30, 20);
  luzCalida.position.set(4, -2, 4);
  escena.add(luzClave, luzCalida, new THREE.AmbientLight(0xffffff, 0.35));

  const disco = crearDisco(CARGA[0], crearMateriales());
  const soporte = new THREE.Group();
  soporte.add(disco);
  escena.add(soporte);

  return {
    ajustar() {
      camara.position.set(0, 0, 5.6);
      camara.lookAt(0, 0, 0);
    },

    dibujar(_ms, t) {
      const scroll = progresoEnPantalla(contenedor.value);
      // De frente (cara hacia la camara) mas el giro: lento solo y rapido con el scroll.
      const giro = reducido ? 0.35 : t * 0.55 + scroll * Math.PI * 2;
      disco.rotation.set(0, -Math.PI / 2 + giro, 0);
      soporte.rotation.set(0.12, 0, reducido ? 0 : Math.sin(t * 0.7) * 0.05);
      soporte.position.y = reducido ? 0 : Math.sin(t * 1.1) * 0.08;
    },
  };
}

onMounted(() => {
  motor = montarEscena(contenedor.value, { preparar, reflejos: 0.8, exposicion: 1.1 });
});

onBeforeUnmount(() => motor?.destruir());
</script>

<style scoped>
.escena-disco {
  position: relative;
  width: 100%;
  height: 100%;
}
.escena-disco :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
