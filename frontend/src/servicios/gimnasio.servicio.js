import { api } from 'boot/axios';

/**
 * Capa de acceso a la API del gimnasio (sedes, usuarios, planes de membresia,
 * miembros, pagos y vencimientos). El alcance real lo decide el backend segun
 * el rol; aqui solo se transporta.
 */

// --- Sedes -------------------------------------------------------------------

export async function listarSedes() {
  const { data: respuesta } = await api.get('/sedes');
  return respuesta.data;
}

export async function crearSede(datos) {
  const { data: respuesta } = await api.post('/sedes', datos);
  return respuesta.data;
}

export async function actualizarSede(id, datos) {
  const { data: respuesta } = await api.patch(`/sedes/${id}`, datos);
  return respuesta.data;
}

// --- Inventario (por sede) -----------------------------------------------------

export async function listarInventario() {
  const { data: respuesta } = await api.get('/inventario');
  return respuesta.data;
}

export async function crearProducto(datos) {
  const { data: respuesta } = await api.post('/inventario', datos);
  return respuesta.data;
}

export async function actualizarProducto(id, datos) {
  const { data: respuesta } = await api.patch(`/inventario/${id}`, datos);
  return respuesta.data;
}

export async function ajustarStock(id, delta) {
  const { data: respuesta } = await api.patch(`/inventario/${id}/ajuste`, { delta });
  return respuesta.data;
}

export async function archivarProducto(id) {
  const { data: respuesta } = await api.delete(`/inventario/${id}`);
  return respuesta.data;
}

// --- Usuarios (staff) ----------------------------------------------------------

export async function listarUsuarios() {
  const { data: respuesta } = await api.get('/usuarios');
  return respuesta.data;
}

export async function crearUsuario(datos) {
  const { data: respuesta } = await api.post('/usuarios', datos);
  return respuesta.data;
}

export async function actualizarUsuario(id, datos) {
  const { data: respuesta } = await api.patch(`/usuarios/${id}`, datos);
  return respuesta.data;
}

// --- Planes de membresia -------------------------------------------------------

export async function listarPlanesMembresia() {
  const { data: respuesta } = await api.get('/planes-membresia');
  return respuesta.data;
}

export async function crearPlanMembresia(datos) {
  const { data: respuesta } = await api.post('/planes-membresia', datos);
  return respuesta.data;
}

export async function actualizarPlanMembresia(id, datos) {
  const { data: respuesta } = await api.patch(`/planes-membresia/${id}`, datos);
  return respuesta.data;
}

export async function archivarPlanMembresia(id) {
  const { data: respuesta } = await api.delete(`/planes-membresia/${id}`);
  return respuesta.data;
}

// --- Miembros ------------------------------------------------------------------

export async function crearMiembro(datos) {
  const { data: respuesta } = await api.post('/miembros', datos);
  return respuesta.data;
}

export async function actualizarMiembro(id, datos) {
  const { data: respuesta } = await api.patch(`/miembros/${id}`, datos);
  return respuesta.data;
}

// --- Pagos y vencimientos --------------------------------------------------------

export async function registrarPago(datos) {
  const { data: respuesta } = await api.post('/pagos', datos);
  return respuesta.data;
}

/** Cada fila es `{ miembro, ultimoPago, estado }`; el estado lo deriva el backend. */
export async function listarVencimientos() {
  const { data: respuesta } = await api.get('/vencimientos');
  return respuesta.data;
}

// --- Reportes ------------------------------------------------------------------

/** `{ ingresosPorSede: [{ sede, sedeNombre, efectivo, transferencia, total }], totalMes, miembros }`. */
export async function obtenerReportePanel() {
  const { data: respuesta } = await api.get('/reportes');
  return respuesta.data;
}
