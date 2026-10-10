import { computed, ref } from 'vue';

/**
 * Voz de la pantalla de la puerta, con la sintesis del propio navegador (Web
 * Speech API): sin servicios ni costos. Edge trae voces "Online (Natural)" (las
 * buenas: Salome y Gonzalo de Colombia, Dalia de Mexico...) que necesitan
 * internet; las locales de Windows suenan roboticas y quedan de respaldo.
 *
 * - La voz se elige en la propia ventana y se recuerda en ESTE PC.
 * - Si una voz en linea falla (sin internet), la misma frase se repite con la
 *   mejor voz local: la puerta nunca se queda muda.
 * - El navegador solo deja hablar tras un clic, salvo con
 *   `--autoplay-policy=no-user-gesture-required` (asi la abre el instalador).
 */

const CLAVE_ACTIVA = 'gymbarichara.puerta.voz';
const CLAVE_VOZ = 'gymbarichara.puerta.voz.nombre';
// Las que se ofrecen en el menu: las naturales de estos paises, y las locales.
const PAISES_MENU = ['es-CO', 'es-MX', 'es-US', 'es-ES'];

function leer(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento solo se pierde el recuerdo entre reinicios.
  }
}

const PAISES = { 'United States': 'Estados Unidos', Mexico: 'México', Spain: 'España' };

const esNatural = (voz) => /natural|online/i.test(voz.name);

/** Mas puntos = mejor voz por defecto para la puerta. */
function puntuar(voz) {
  let puntos = 0;
  if (voz.lang === 'es-CO') puntos += 4;
  else if (/^es-(MX|US|419)/.test(voz.lang)) puntos += 2;
  if (esNatural(voz)) puntos += 3;
  return puntos;
}

/** "Microsoft Salome Online (Natural) - Spanish (Colombia)" -> "Salome · Colombia". */
export function nombreCorto(voz) {
  const nombre = voz.name.replace(/^(Microsoft|Google)\s+/, '').split(/\s+(Online|-)/)[0];
  const pais = voz.name.match(/\(([^()]+)\)\s*$/)?.[1] ?? voz.lang;
  return `${nombre} · ${PAISES[pais] ?? pais}`;
}

export function useVoz() {
  const disponible = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const activa = ref(leer(CLAVE_ACTIVA) !== 'silenciada');
  const voces = ref([]);
  const nombreElegido = ref(leer(CLAVE_VOZ));

  const vozActual = computed(
    () =>
      voces.value.find((voz) => voz.name === nombreElegido.value) ??
      [...voces.value].sort((a, b) => puntuar(b) - puntuar(a))[0] ??
      null,
  );
  const mejorLocal = computed(() => [...voces.value].filter((voz) => voz.localService).sort((a, b) => puntuar(b) - puntuar(a))[0] ?? null);

  /** Para el menu: primero las naturales (Colombia arriba), luego las locales. */
  const opciones = computed(() =>
    voces.value
      .filter((voz) => PAISES_MENU.includes(voz.lang) && (esNatural(voz) || voz.localService))
      .sort((a, b) => puntuar(b) - puntuar(a) || a.name.localeCompare(b.name)),
  );

  function cargarVoces() {
    voces.value = window.speechSynthesis.getVoices().filter((voz) => voz.lang?.startsWith('es'));
  }

  if (disponible) {
    cargarVoces();
    // Las voces cargan asincronas (sobre todo las "Online"): se recargan al llegar.
    window.speechSynthesis.addEventListener('voiceschanged', cargarVoces);
  }

  function hablar(texto, voz, alFallar) {
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = voz?.lang ?? 'es-CO';
    if (voz) frase.voice = voz;
    frase.onerror = (evento) => {
      if (evento.error !== 'interrupted' && evento.error !== 'canceled') alFallar?.();
    };
    window.speechSynthesis.speak(frase);
  }

  function decir(texto, { aunqueSilenciada = false } = {}) {
    if (!disponible || !texto || (!activa.value && !aunqueSilenciada)) return;
    // Lo nuevo manda: si alguien pone el dedo mientras habla, se corta lo anterior.
    window.speechSynthesis.cancel();
    const voz = vozActual.value;
    const respaldo = mejorLocal.value;
    hablar(texto, voz, voz && !voz.localService && respaldo ? () => hablar(texto, respaldo) : null);
  }

  function alternar() {
    activa.value = !activa.value;
    guardar(CLAVE_ACTIVA, activa.value ? 'activa' : 'silenciada');
    if (activa.value) decir('Voz activada');
    else if (disponible) window.speechSynthesis.cancel();
  }

  /** Elige la voz (y la prueba en voz alta para que se oiga como quedara). */
  function elegir(voz) {
    nombreElegido.value = voz.name;
    guardar(CLAVE_VOZ, voz.name);
    if (!activa.value) {
      activa.value = true;
      guardar(CLAVE_ACTIVA, 'activa');
    }
    decir('¡Hola! Así sonará la puerta.');
  }

  return { disponible, activa, opciones, vozActual, decir, alternar, elegir };
}
