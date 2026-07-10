import { describe, expect, it } from 'vitest';

import { sumarMeses } from '../src/utilidades/fechas.js';

/**
 * `sumarMeses` es la aritmetica de la que cuelga el vencimiento de toda
 * mensualidad. Un mes no son 30 dias, y `setMonth()` a secas desborda.
 */

/** `2026-01-31` como fecha local, sin que la zona horaria mueva el dia. */
const enFecha = (anio, mes, dia) => new Date(anio, mes - 1, dia);
const comoTexto = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

describe('sumarMeses', () => {
  it('cae en el mismo dia del mes siguiente', () => {
    expect(comoTexto(sumarMeses(enFecha(2026, 7, 9), 1))).toBe('2026-08-09');
  });

  it('recorta al ultimo dia cuando el destino no tiene ese dia', () => {
    // 31 de enero + 1 mes = 28 de febrero, no el 2 ni el 3 de marzo.
    expect(comoTexto(sumarMeses(enFecha(2026, 1, 31), 1))).toBe('2026-02-28');
    expect(comoTexto(sumarMeses(enFecha(2026, 3, 31), 1))).toBe('2026-04-30');
    expect(comoTexto(sumarMeses(enFecha(2026, 5, 31), 1))).toBe('2026-06-30');
  });

  it('respeta los años bisiestos', () => {
    expect(comoTexto(sumarMeses(enFecha(2028, 1, 31), 1))).toBe('2028-02-29');
    expect(comoTexto(sumarMeses(enFecha(2028, 1, 29), 1))).toBe('2028-02-29');
  });

  it('cruza el fin de año', () => {
    expect(comoTexto(sumarMeses(enFecha(2026, 12, 15), 1))).toBe('2027-01-15');
    expect(comoTexto(sumarMeses(enFecha(2026, 11, 30), 3))).toBe('2027-02-28');
  });

  it('suma varios meses de golpe (trimestral)', () => {
    expect(comoTexto(sumarMeses(enFecha(2026, 7, 9), 3))).toBe('2026-10-09');
    expect(comoTexto(sumarMeses(enFecha(2026, 11, 30), 12))).toBe('2027-11-30');
  });

  it('resta meses con valores negativos', () => {
    expect(comoTexto(sumarMeses(enFecha(2026, 3, 31), -1))).toBe('2026-02-28');
    expect(comoTexto(sumarMeses(enFecha(2026, 1, 15), -1))).toBe('2025-12-15');
  });

  it('conserva la hora del dia', () => {
    const inicio = new Date(2026, 0, 15, 18, 30, 0);
    const fin = sumarMeses(inicio, 1);

    expect(fin.getHours()).toBe(18);
    expect(fin.getMinutes()).toBe(30);
  });

  it('no muta la fecha que recibe', () => {
    const inicio = enFecha(2026, 1, 31);
    sumarMeses(inicio, 1);

    expect(comoTexto(inicio)).toBe('2026-01-31');
  });
});
