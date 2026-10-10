import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Conexion con el agente de la puerta (`agente-acceso/`), que corre en ESTE PC
 * con el lector de huella y expone un WebSocket solo en 127.0.0.1.
 *
 * El navegador no puede leer un lector USB; el agente si. Aqui solo se escucha lo
 * que dice (estado, accesos, pasos del enrolamiento) y se le piden cosas. Si el
 * agente no esta corriendo, `conectado` queda en false y se reintenta solo.
 *
 * `alMensaje(mensaje)` recibe todo lo que no es `estado` (eso ya queda en `estado`).
 */

const URL_AGENTE = 'ws://127.0.0.1:7788';
const MS_REINTENTO = 3000;

export function useAgenteAcceso(alMensaje = () => {}) {
  const conectado = ref(false);
  const estado = ref({ lector: false, servidor: false, puesto: null, huellas: 0 });

  let socket = null;
  let temporizador = null;
  let cerrado = false;

  function conectar() {
    if (cerrado) return;
    try {
      socket = new WebSocket(URL_AGENTE);
    } catch {
      programarReintento();
      return;
    }

    socket.onopen = () => {
      conectado.value = true;
    };
    socket.onclose = () => {
      conectado.value = false;
      programarReintento();
    };
    socket.onerror = () => socket?.close();
    socket.onmessage = (evento) => {
      let mensaje;
      try {
        mensaje = JSON.parse(evento.data);
      } catch {
        return;
      }
      if (mensaje.tipo === 'estado') {
        const { tipo: _tipo, ...resto } = mensaje;
        estado.value = resto;
      } else {
        alMensaje(mensaje);
      }
    };
  }

  function programarReintento() {
    if (cerrado) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(conectar, MS_REINTENTO);
  }

  function enviar(mensaje) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(mensaje));
      return true;
    }
    return false;
  }

  onMounted(conectar);
  onBeforeUnmount(() => {
    cerrado = true;
    clearTimeout(temporizador);
    socket?.close();
  });

  return { conectado, estado, enviar };
}
