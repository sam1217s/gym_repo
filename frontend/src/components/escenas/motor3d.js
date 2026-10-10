import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Lo comun a toda escena 3D de la portada: renderer con fondo transparente,
 * reflejos de estudio (RoomEnvironment), camara, ajuste al tamano del
 * contenedor, bucle que se PAUSA cuando la escena no esta en pantalla o la
 * pestana esta oculta, y limpieza completa de la GPU al desmontar.
 *
 * Cada escena solo describe lo suyo:
 *   montarEscena(el, {
 *     preparar(escena, { camara, reducido }) -> { ajustar(ancho, alto), dibujar(ahora, t) }
 *   })
 *
 * Con `prefers-reduced-motion` no hay bucle: se dibuja un cuadro al montar y al
 * cambiar de tamano. Devuelve `null` si el navegador no tiene WebGL.
 */
export function montarEscena(el, { preparar, fov = 30, exposicion = 1.05, reflejos = 0.55 }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }

  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposicion;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = reflejos;

  const camara = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const { ajustar, dibujar } = preparar(escena, { camara, reducido });

  const inicio = performance.now();
  const pintar = (ahora) => {
    dibujar(ahora - inicio, (ahora - inicio) / 1000);
    renderer.render(escena, camara);
  };

  function alCambiarTamano() {
    const ancho = el.clientWidth;
    const alto = el.clientHeight;
    if (!ancho || !alto) return;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    ajustar(ancho, alto);
    camara.updateProjectionMatrix();
    if (reducido) pintar(performance.now());
  }

  let visible = true;
  let cuadro = null;
  const bucle = (ahora) => {
    cuadro = requestAnimationFrame(bucle);
    if (visible && !document.hidden) pintar(ahora);
  };

  const observadorTamano = new ResizeObserver(alCambiarTamano);
  observadorTamano.observe(el);
  const observadorVisible = new IntersectionObserver(([entrada]) => {
    visible = entrada.isIntersecting;
  });
  observadorVisible.observe(el);
  alCambiarTamano();

  if (reducido) pintar(performance.now());
  else cuadro = requestAnimationFrame(bucle);

  return {
    destruir() {
      cancelAnimationFrame(cuadro);
      observadorTamano.disconnect();
      observadorVisible.disconnect();
      escena.traverse((objeto) => {
        objeto.geometry?.dispose();
        const lista = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
        for (const material of lista) {
          if (!material) continue;
          for (const valor of Object.values(material)) if (valor?.isTexture) valor.dispose();
          material.dispose();
        }
      });
      escena.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Rebote suave al final (los discos "asientan" contra el tope). */
export const facilRebote = (t) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/** Cuanto de un elemento ya paso por la pantalla: 0 al asomar abajo, 1 al salir arriba. */
export function progresoEnPantalla(el) {
  const caja = el.getBoundingClientRect();
  const recorrido = window.innerHeight + caja.height;
  return Math.min(Math.max((window.innerHeight - caja.top) / recorrido, 0), 1);
}
