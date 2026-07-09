import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import * as servicioPlataforma from 'src/servicios/plataforma.servicio.js';

/** Estados posibles de un gimnasio. Espejo de `ESTADOS_TENANT` del backend. */
export const ESTADOS_GIMNASIO = Object.freeze({
  TRIAL: 'trial',
  ACTIVO: 'activo',
  SUSPENDIDO: 'suspendido',
  CANCELADO: 'cancelado',
});

/**
 * Datos de la plataforma para el super_admin: gimnasios y planes.
 * No se persiste nada: es informacion viva que se pide al entrar al panel.
 */
export const usePlataformaStore = defineStore('plataforma', () => {
  const gimnasios = ref([]);
  const planes = ref([]);
  const cargando = ref(false);

  const conteosPorEstado = computed(() => {
    const conteos = {
      [ESTADOS_GIMNASIO.ACTIVO]: 0,
      [ESTADOS_GIMNASIO.TRIAL]: 0,
      [ESTADOS_GIMNASIO.SUSPENDIDO]: 0,
      [ESTADOS_GIMNASIO.CANCELADO]: 0,
    };
    for (const gimnasio of gimnasios.value) {
      if (gimnasio.estado in conteos) conteos[gimnasio.estado] += 1;
    }
    return conteos;
  });

  /** Planes que todavia admiten gimnasios nuevos. */
  const planesAsignables = computed(() => planes.value.filter((plan) => plan.activo));

  async function cargarGimnasios() {
    cargando.value = true;
    try {
      gimnasios.value = await servicioPlataforma.listarGimnasios();
    } finally {
      cargando.value = false;
    }
  }

  async function cargarPlanes() {
    planes.value = await servicioPlataforma.listarPlanes();
  }

  async function crearGimnasio(datos) {
    const creado = await servicioPlataforma.crearGimnasio(datos);
    // Se recarga la lista en vez de insertar a mano: el backend enriquece cada
    // fila con dueno y numero de sedes, y esa forma solo la conoce el.
    await cargarGimnasios();
    return creado;
  }

  async function suspenderGimnasio(id) {
    aplicarEstado(id, (await servicioPlataforma.suspenderGimnasio(id)).estado);
  }

  async function reactivarGimnasio(id) {
    aplicarEstado(id, (await servicioPlataforma.reactivarGimnasio(id)).estado);
  }

  async function cancelarGimnasio(id) {
    aplicarEstado(id, (await servicioPlataforma.cancelarGimnasio(id)).estado);
  }

  /**
   * El backend devuelve el tenant pelado al cambiar de estado; aqui solo se
   * actualiza el `estado` para no perder el dueno y las sedes ya cargados.
   */
  function aplicarEstado(id, estadoNuevo) {
    const gimnasio = gimnasios.value.find((candidato) => candidato._id === id);
    if (gimnasio) gimnasio.estado = estadoNuevo;
  }

  return {
    gimnasios,
    planes,
    cargando,
    conteosPorEstado,
    planesAsignables,
    cargarGimnasios,
    cargarPlanes,
    crearGimnasio,
    suspenderGimnasio,
    reactivarGimnasio,
    cancelarGimnasio,
  };
});
