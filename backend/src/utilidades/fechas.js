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

/**
 * Suma meses de CALENDARIO, cayendo en el mismo dia del mes.
 *
 * El dia se recorta al ultimo del mes destino cuando no existe: una mensualidad
 * que empieza el 31 de enero vence el 28 de febrero, no el 3 de marzo. Hacerlo
 * con `setMonth()` a secas desborda al mes siguiente, y el miembro pagaria por
 * un periodo que no compro.
 *
 * Acepta meses negativos, para retroceder.
 */
export function sumarMeses(fecha, meses) {
  const base = new Date(fecha);
  const diaDeseado = base.getDate();

  const resultado = new Date(base);
  // Se ancla al dia 1 antes de mover el mes, o `setMonth` desbordaria solo.
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() + meses);

  const ultimoDiaDelMes = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(diaDeseado, ultimoDiaDelMes));

  return resultado;
}
