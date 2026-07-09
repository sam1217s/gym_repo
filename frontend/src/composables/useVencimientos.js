import { computed } from 'vue';

import { useGimnasioStore } from 'src/stores/gimnasio.js';

/** Espejo de `ESTADOS_VENCIMIENTO` del backend. */
export const ESTADOS_VENCIMIENTO = Object.freeze({
  AL_DIA: 'al_dia',
  POR_VENCER: 'por_vencer',
  VENCIDO: 'vencido',
  SIN_PAGOS: 'sin_pagos',
});

/**
 * Como se pinta cada estado: nombre visible y color de la banda de disco.
 * El rojo profundo es para lo vencido; "sin pagos" es neutro, no una alarma.
 */
export const APARIENCIA_VENCIMIENTO = Object.freeze({
  [ESTADOS_VENCIMIENTO.AL_DIA]: { etiqueta: 'Al dia', plural: 'Al dia', color: 'var(--q-positive)' },
  [ESTADOS_VENCIMIENTO.POR_VENCER]: { etiqueta: 'Por vencer', plural: 'Por vencer', color: 'var(--q-warning)' },
  [ESTADOS_VENCIMIENTO.VENCIDO]: { etiqueta: 'Vencido', plural: 'Vencidos', color: 'var(--q-negative)' },
  [ESTADOS_VENCIMIENTO.SIN_PAGOS]: { etiqueta: 'Sin pagos', plural: 'Sin pagos', color: '#667085' },
});

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * La vista de vencimientos lista para pintar: filas, conteos por estado y
 * formato de fechas. El estado NO se calcula aqui: viene derivado del backend,
 * que es la unica fuente de esa regla.
 */
export function useVencimientos() {
  const gimnasio = useGimnasioStore();

  const vencimientos = computed(() => gimnasio.vencimientos);
  const cargando = computed(() => gimnasio.cargando);

  const conteosPorEstado = computed(() => {
    const conteos = {
      [ESTADOS_VENCIMIENTO.AL_DIA]: 0,
      [ESTADOS_VENCIMIENTO.POR_VENCER]: 0,
      [ESTADOS_VENCIMIENTO.VENCIDO]: 0,
      [ESTADOS_VENCIMIENTO.SIN_PAGOS]: 0,
    };
    for (const fila of gimnasio.vencimientos) {
      if (fila.estado in conteos) conteos[fila.estado] += 1;
    }
    return conteos;
  });

  function formatearFecha(valor) {
    return valor ? FORMATO_FECHA.format(new Date(valor)) : '—';
  }

  /** "Vence en 2 dias" / "Vencio hace 5 dias", para la celda de vencimiento. */
  function describirVencimiento(fila) {
    if (!fila.ultimoPago) return 'Nunca ha pagado';

    const dias = Math.ceil(
      (new Date(fila.ultimoPago.periodoFin).getTime() - Date.now()) / MILISEGUNDOS_POR_DIA,
    );

    if (dias < 0) return `Vencio hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`;
    if (dias === 0) return 'Vence hoy';
    return `Vence en ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }

  return {
    vencimientos,
    cargando,
    conteosPorEstado,
    cargar: gimnasio.cargarVencimientos,
    formatearFecha,
    describirVencimiento,
  };
}
