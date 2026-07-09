import { defineStore } from 'pinia';
import { ref } from 'vue';

import * as servicioGimnasio from 'src/servicios/gimnasio.servicio.js';

/**
 * Datos operativos del gimnasio en sesion: sedes, staff, planes de membresia
 * y la vista de vencimientos (miembros + estado derivado). No se persiste
 * nada: se pide al entrar a cada pantalla. El backend ya acota el alcance por
 * rol, asi que un sede_admin recibe aqui solo lo de su sede.
 */
export const useGimnasioStore = defineStore('gimnasio', () => {
  const sedes = ref([]);
  const usuarios = ref([]);
  const planesMembresia = ref([]);

  /** Filas `{ miembro, ultimoPago, estado }` que pinta la pantalla de miembros. */
  const vencimientos = ref([]);

  /** `{ ingresosPorSede, totalMes, miembros }` que pinta el dashboard. */
  const reportePanel = ref(null);

  const cargando = ref(false);

  // --- Sedes -----------------------------------------------------------------

  async function cargarSedes() {
    sedes.value = await servicioGimnasio.listarSedes();
  }

  async function crearSede(datos) {
    const creada = await servicioGimnasio.crearSede(datos);
    sedes.value.push(creada);
    return creada;
  }

  async function actualizarSede(id, datos) {
    const actualizada = await servicioGimnasio.actualizarSede(id, datos);
    reemplazar(sedes, actualizada);
    return actualizada;
  }

  // --- Usuarios ----------------------------------------------------------------

  async function cargarUsuarios() {
    usuarios.value = await servicioGimnasio.listarUsuarios();
  }

  async function crearUsuario(datos) {
    const creado = await servicioGimnasio.crearUsuario(datos);
    usuarios.value.push(creado);
    return creado;
  }

  async function actualizarUsuario(id, datos) {
    const actualizado = await servicioGimnasio.actualizarUsuario(id, datos);
    reemplazar(usuarios, actualizado);
    return actualizado;
  }

  // --- Planes de membresia ----------------------------------------------------------

  async function cargarPlanesMembresia() {
    planesMembresia.value = await servicioGimnasio.listarPlanesMembresia();
  }

  async function crearPlanMembresia(datos) {
    const creado = await servicioGimnasio.crearPlanMembresia(datos);
    planesMembresia.value.push(creado);
    return creado;
  }

  async function actualizarPlanMembresia(id, datos) {
    const actualizado = await servicioGimnasio.actualizarPlanMembresia(id, datos);
    reemplazar(planesMembresia, actualizado);
    return actualizado;
  }

  async function archivarPlanMembresia(id) {
    const archivado = await servicioGimnasio.archivarPlanMembresia(id);
    reemplazar(planesMembresia, archivado);
    return archivado;
  }

  // --- Miembros, pagos y vencimientos ----------------------------------------------

  async function cargarVencimientos() {
    cargando.value = true;
    try {
      vencimientos.value = await servicioGimnasio.listarVencimientos();
    } finally {
      cargando.value = false;
    }
  }

  async function crearMiembro(datos) {
    const creado = await servicioGimnasio.crearMiembro(datos);
    // Recargar mantiene el orden y el estado derivado que calcula el backend.
    await cargarVencimientos();
    return creado;
  }

  async function actualizarMiembro(id, datos) {
    const actualizado = await servicioGimnasio.actualizarMiembro(id, datos);
    await cargarVencimientos();
    return actualizado;
  }

  async function registrarPago(datos) {
    const pago = await servicioGimnasio.registrarPago(datos);
    await cargarVencimientos();
    return pago;
  }

  // --- Reportes ----------------------------------------------------------------

  async function cargarReportePanel() {
    reportePanel.value = await servicioGimnasio.obtenerReportePanel();
  }

  function reemplazar(lista, elemento) {
    const indice = lista.value.findIndex((candidato) => candidato._id === elemento._id);
    if (indice !== -1) lista.value.splice(indice, 1, elemento);
  }

  return {
    sedes,
    usuarios,
    planesMembresia,
    vencimientos,
    reportePanel,
    cargando,
    cargarSedes,
    crearSede,
    actualizarSede,
    cargarUsuarios,
    crearUsuario,
    actualizarUsuario,
    cargarPlanesMembresia,
    crearPlanMembresia,
    actualizarPlanMembresia,
    archivarPlanMembresia,
    cargarVencimientos,
    crearMiembro,
    actualizarMiembro,
    registrarPago,
    cargarReportePanel,
  };
});
