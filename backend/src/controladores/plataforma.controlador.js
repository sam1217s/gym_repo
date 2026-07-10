import * as servicioFacturacion from '../servicios/facturacionPlataforma.servicio.js';
import * as servicioOnboarding from '../servicios/onboarding.servicio.js';
import * as servicioPlanes from '../servicios/planesPlataforma.servicio.js';
import * as servicioTenants from '../servicios/tenants.servicio.js';
import { manejadorAsync } from '../utilidades/manejadorAsync.js';
import { responderCreado, responderOk } from '../utilidades/respuesta.js';

/**
 * Capa HTTP de la plataforma. Lee la peticion, delega y responde; cero logica
 * de negocio. Todas estas rutas ya pasaron por `requiereSuperAdmin`.
 */

// --- Planes de plataforma ---------------------------------------------------

export const listarPlanes = manejadorAsync(async (_peticion, respuesta) =>
  responderOk(respuesta, await servicioPlanes.listarPlanes()),
);

export const obtenerPlan = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPlanes.obtenerPlan(peticion.params.id)),
);

export const crearPlan = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioPlanes.crearPlan(peticion.body)),
);

export const actualizarPlan = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPlanes.actualizarPlan(peticion.params.id, peticion.body)),
);

export const archivarPlan = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioPlanes.archivarPlan(peticion.params.id)),
);

// --- Tenants ------------------------------------------------------------------

export const listarTenants = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioTenants.listarTenants(peticion.query)),
);

export const obtenerTenant = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioTenants.obtenerTenant(peticion.params.id)),
);

export const crearGimnasio = manejadorAsync(async (peticion, respuesta) =>
  responderCreado(respuesta, await servicioOnboarding.crearGimnasio(peticion.body)),
);

export const suspenderTenant = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioTenants.suspenderTenant(peticion.params.id)),
);

export const reactivarTenant = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioTenants.reactivarTenant(peticion.params.id)),
);

export const cancelarTenant = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioTenants.cancelarTenant(peticion.params.id)),
);

/** Historico de facturacion de un gimnasio, visto desde la plataforma. */
export const facturasDeTenant = manejadorAsync(async (peticion, respuesta) =>
  responderOk(respuesta, await servicioFacturacion.listarFacturasDeTenant(peticion.params.id)),
);
