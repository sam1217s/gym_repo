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
  const inventario = ref([]);
  const ventas = ref([]);
  const resumenVentas = ref({ total: 0, unidades: 0, operaciones: 0 });
  const maquinas = ref([]);
  const reportesMaquina = ref([]);
  const reportesNoLeidos = ref(0);
  const auditoria = ref([]);

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

  // --- Inventario (por sede) -------------------------------------------------

  async function cargarInventario() {
    inventario.value = await servicioGimnasio.listarInventario();
  }

  async function crearProducto(datos) {
    const creado = await servicioGimnasio.crearProducto(datos);
    inventario.value.push(creado);
    return creado;
  }

  async function actualizarProducto(id, datos) {
    const actualizado = await servicioGimnasio.actualizarProducto(id, datos);
    reemplazar(inventario, actualizado);
    return actualizado;
  }

  async function ajustarStock(id, delta) {
    const actualizado = await servicioGimnasio.ajustarStock(id, delta);
    reemplazar(inventario, actualizado);
    return actualizado;
  }

  async function archivarProducto(id) {
    const archivado = await servicioGimnasio.archivarProducto(id);
    // Archivar lo saca de la lista visible (solo mostramos activos).
    inventario.value = inventario.value.filter((producto) => producto._id !== id);
    return archivado;
  }

  // --- Ventas de productos (por sede) ----------------------------------------

  async function cargarVentas(params) {
    const datos = await servicioGimnasio.listarVentas(params);
    ventas.value = datos.ventas;
    resumenVentas.value = datos.resumen;
    return datos;
  }

  async function registrarVenta(productoId, cantidad) {
    const { venta, producto } = await servicioGimnasio.registrarVenta(productoId, cantidad);
    // Refleja el nuevo stock en la lista de inventario sin recargar todo.
    reemplazar(inventario, producto);
    return venta;
  }

  // --- Maquinas (por sede) ---------------------------------------------------

  async function cargarMaquinas() {
    maquinas.value = await servicioGimnasio.listarMaquinas();
  }

  async function crearMaquina(datos) {
    const creada = await servicioGimnasio.crearMaquina(datos);
    maquinas.value.push(creada);
    return creada;
  }

  async function actualizarMaquina(id, datos) {
    const actualizada = await servicioGimnasio.actualizarMaquina(id, datos);
    reemplazar(maquinas, actualizada);
    return actualizada;
  }

  async function archivarMaquina(id) {
    const archivada = await servicioGimnasio.archivarMaquina(id);
    // Archivar la saca de la lista visible (solo mostramos activas).
    maquinas.value = maquinas.value.filter((maquina) => maquina._id !== id);
    return archivada;
  }

  // --- Reportes de maquinas (dueño) ------------------------------------------

  async function cargarReportesMaquina() {
    const datos = await servicioGimnasio.listarReportesMaquina();
    reportesMaquina.value = datos.reportes;
    reportesNoLeidos.value = datos.noLeidos;
    return datos;
  }

  async function contarReportesNoLeidos() {
    reportesNoLeidos.value = await servicioGimnasio.contarReportesNoLeidos();
    return reportesNoLeidos.value;
  }

  async function marcarReportesLeidos() {
    await servicioGimnasio.marcarReportesLeidos();
    reportesNoLeidos.value = 0;
    // Refleja el estado leido en la lista ya cargada.
    reportesMaquina.value = reportesMaquina.value.map((r) => ({ ...r, leido: true }));
  }

  // --- Auditoria (bitacora del dueño) ----------------------------------------

  async function cargarAuditoria() {
    auditoria.value = await servicioGimnasio.listarAuditoria();
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
    inventario,
    ventas,
    resumenVentas,
    maquinas,
    reportesMaquina,
    reportesNoLeidos,
    auditoria,
    vencimientos,
    reportePanel,
    cargando,
    cargarInventario,
    crearProducto,
    actualizarProducto,
    ajustarStock,
    archivarProducto,
    cargarVentas,
    registrarVenta,
    cargarMaquinas,
    crearMaquina,
    actualizarMaquina,
    archivarMaquina,
    cargarReportesMaquina,
    contarReportesNoLeidos,
    marcarReportesLeidos,
    cargarAuditoria,
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
