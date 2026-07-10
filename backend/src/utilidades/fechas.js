/**
 * Cortes de mes.
 *
 * OJO: todo esto usa la hora local del PROCESO, no la zona horaria del tenant
 * (`tenant.config.zonaHoraria`). Es deuda conocida y esta anotada en FASE.md:
 * con el servidor en UTC, un gimnasio en Bogota vería mal los bordes del mes.
 */

/** `new Date(2026, -1, 1)` cae en diciembre de 2025: el mes negativo hace rollover solo. */
export function inicioDeMes(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

export function inicioDeMesAnterior(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
}

export function inicioDeMesSiguiente(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
}

/** `2026-07`, para construir referencias legibles y estables. */
export function claveDeMes(fecha = new Date()) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}`;
}

export function sumarDias(fecha, dias) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}
