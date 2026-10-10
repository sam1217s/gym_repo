<template>
  <q-page padding class="pagina-panel">
    <!-- Franja del dia: saludo, la cifra que manda (ingresos del mes) y lo que
         esta pasando HOY en el gimnasio (entradas y ventas). -->
    <section class="franja">
      <div class="franja-principal">
        <div class="ceja ceja-clara">{{ saludo }} · {{ fechaDeHoy }}</div>
        <div class="etiqueta-cifra">Ingresos de {{ nombreMesActual }}</div>

        <q-skeleton v-if="cargando" type="text" width="240px" height="64px" dark />
        <template v-else>
          <div class="hero-cifra cifra-tabular">{{ totalMesLegible }}</div>
          <div class="linea-variacion" :class="claseVariacion">
            <q-icon v-if="iconoVariacion" :name="iconoVariacion" size="18px" />
            <span>{{ textoVariacion }}</span>
          </div>
        </template>
      </div>

      <div class="franja-hoy">
        <router-link :to="{ name: 'entradas' }" class="tile-hoy">
          <div class="tile-etiqueta"><q-icon name="fingerprint" size="18px" /> Entradas hoy</div>
          <div class="tile-cifra cifra-tabular">{{ hoy.entradas ?? '—' }}</div>
          <div class="tile-glosa">
            <template v-if="hoy.entradas === null">Sin datos de la puerta</template>
            <template v-else-if="hoy.negadas > 0">{{ hoy.negadas }} {{ plural(hoy.negadas, 'negada', 'negadas') }} en la puerta</template>
            <template v-else>Nadie rebotado en la puerta</template>
          </div>
        </router-link>

        <router-link :to="{ name: 'ventas' }" class="tile-hoy">
          <div class="tile-etiqueta"><q-icon name="point_of_sale" size="18px" /> Ventas hoy</div>
          <div class="tile-cifra cifra-tabular">{{ hoy.ventas === null ? '—' : pesos(hoy.ventas) }}</div>
          <div class="tile-glosa">
            <template v-if="hoy.ventas === null">Sin datos de ventas</template>
            <template v-else>{{ hoy.operaciones }} {{ plural(hoy.operaciones, 'venta', 'ventas') }} en el mostrador</template>
          </div>
        </router-link>
      </div>
    </section>

    <div class="row q-col-gutter-lg">
      <!-- Ingresos por sede (la grafica de siempre) -->
      <div class="col-12 col-md-7 columna">
        <q-card flat bordered class="tarjeta">
          <q-skeleton v-if="cargando" type="rect" height="200px" />
          <GraficaIngresos v-else :filas="ingresosPorSede" :nombre-mes="nombreMesActual" />
        </q-card>
      </div>

      <!-- A quien llamar hoy: con nombre, no solo un conteo -->
      <div class="col-12 col-md-5 columna">
        <q-card flat bordered class="tarjeta">
          <div class="row items-baseline justify-between">
            <div class="ceja">A quién llamar hoy</div>
            <div class="conteos-llamada">
              <span class="conteo conteo-vencido">{{ conteoMiembros.vencido }} vencidos</span>
              <span class="conteo conteo-por-vencer">{{ conteoMiembros.por_vencer }} por vencer</span>
            </div>
          </div>

          <q-skeleton v-if="cargandoLista" type="rect" height="180px" class="q-mt-md" />

          <p v-else-if="porLlamar.length === 0" class="sin-pendientes">
            Nadie vence en los próximos días.<br />
            <span class="text-grey-7">Todo el gimnasio está al día.</span>
          </p>

          <q-list v-else class="lista-llamar">
            <q-item v-for="fila in porLlamarVisibles" :key="fila.miembro._id" class="fila-llamar">
              <q-item-section avatar>
                <span class="banda-estado" :style="{ background: APARIENCIA_VENCIMIENTO[fila.estado].color }" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="nombre-llamar">{{ fila.miembro.nombres }} {{ fila.miembro.apellidos }}</q-item-label>
                <q-item-label caption :class="fila.estado === 'vencido' ? 'texto-vencido' : 'texto-por-vencer'">
                  {{ describirVencimiento(fila) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  round
                  flat
                  dense
                  class="boton-whatsapp-miembro"
                  type="a"
                  :href="enlaceWhatsapp(fila.miembro)"
                  target="_blank"
                  rel="noopener"
                  :aria-label="`Escribir a ${fila.miembro.nombres} por WhatsApp`"
                >
                  <IconoWhatsapp />
                  <q-tooltip>Escribirle por WhatsApp</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>

          <q-btn
            class="full-width boton-llamada"
            color="primary"
            outline
            no-caps
            icon-right="arrow_forward"
            :label="porLlamar.length > LIMITE_LISTA ? `Ver los ${porLlamar.length} en Miembros` : 'Ver miembros'"
            :to="{ name: 'miembros' }"
          />
          <div class="pie-tarjeta">
            <span><b class="cifra-tabular">{{ conteoMiembros.al_dia }}</b> al día</span>
            <span><b class="cifra-tabular">{{ conteoMiembros.sin_pagos }}</b> sin pagos</span>
          </div>
        </q-card>
      </div>

      <!-- Por atender (solo el dueño) y atajos a lo de todos los dias -->
      <div v-if="esDueno" class="col-12 col-md-5 columna">
        <q-card flat bordered class="tarjeta">
          <div class="ceja">Por atender</div>
          <div class="pila-atender">
            <router-link :to="{ name: 'mensajes' }" class="fila-atender">
              <span class="disco disco-chico" :style="{ borderColor: gimnasio.mensajesPendientes ? 'var(--q-primary)' : '#d0d5dd' }">
                <span class="titulo-display numero-disco-chico cifra-tabular">{{ gimnasio.mensajesPendientes }}</span>
              </span>
              <span class="texto-atender">
                <span class="etiqueta-atender">Mensajes de WhatsApp</span>
                <span class="glosa-atender">{{ gimnasio.mensajesPendientes ? 'Sin responder o sin revisar' : 'Bandeja al día' }}</span>
              </span>
              <q-icon name="chevron_right" class="flecha-atender" />
            </router-link>
            <router-link :to="{ name: 'reportes' }" class="fila-atender">
              <span class="disco disco-chico" :style="{ borderColor: gimnasio.reportesNoLeidos ? 'var(--q-negative)' : '#d0d5dd' }">
                <span class="titulo-display numero-disco-chico cifra-tabular">{{ gimnasio.reportesNoLeidos }}</span>
              </span>
              <span class="texto-atender">
                <span class="etiqueta-atender">Reportes de máquinas</span>
                <span class="glosa-atender">{{ gimnasio.reportesNoLeidos ? 'Daños o mantenimiento sin leer' : 'Ninguna máquina reportada' }}</span>
              </span>
              <q-icon name="chevron_right" class="flecha-atender" />
            </router-link>
          </div>
        </q-card>
      </div>

      <div :class="['col-12', esDueno ? 'col-md-7' : '', 'columna']">
        <q-card flat bordered class="tarjeta">
          <div class="ceja">Atajos</div>
          <div class="atajos">
            <router-link v-for="atajo in atajosVisibles" :key="atajo.titulo" :to="atajo.destino" class="atajo">
              <span class="atajo-icono"><q-icon :name="atajo.icono" size="24px" /></span>
              <span class="atajo-titulo">{{ atajo.titulo }}</span>
              <span class="atajo-glosa">{{ atajo.glosa }}</span>
            </router-link>
          </div>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import GraficaIngresos from 'src/components/GraficaIngresos.vue';
import IconoWhatsapp from 'src/components/IconoWhatsapp.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { APARIENCIA_VENCIMIENTO, ESTADOS_VENCIMIENTO, useVencimientos } from 'src/composables/useVencimientos.js';
import { listarAccesos, listarVentas } from 'src/servicios/gimnasio.servicio.js';
import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * El tablero del dia. Responde, en este orden: cuanto entro este mes (y si es
 * bueno o malo frente al anterior), que esta pasando hoy (entradas y ventas),
 * a QUIEN hay que llamar (con nombre y un clic a WhatsApp) y que hay pendiente.
 *
 * El alcance lo decide el backend: un sede_admin recibe solo su sede; el dueno,
 * el consolidado de todo el gimnasio.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();
const { usuario } = useAutenticacion();
const { vencimientos, cargar: cargarVencimientos, describirVencimiento } = useVencimientos();

const esDueno = computed(() => usuario.value?.rol === ROLES.TENANT_OWNER);
const cargando = computed(() => gimnasio.reportePanel === null);
const cargandoLista = ref(true);

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const FORMATO_MES = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const FORMATO_PORCENTAJE = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'never',
});

const ahora = new Date();
const nombreMesActual = FORMATO_MES.format(ahora);
const nombreMesAnterior = FORMATO_MES.format(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1));
const fechaDeHoy = FORMATO_FECHA_LARGA.format(ahora);

const saludo = computed(() => {
  const hora = ahora.getHours();
  const nombre = usuario.value?.nombres?.split(' ')[0] ?? '';
  const momento = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  return nombre ? `${momento}, ${nombre}` : momento;
});

const pesos = (valor) => `$${FORMATO_PESOS.format(valor ?? 0)}`;
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

// --- Ingresos del mes --------------------------------------------------------

const ingresosPorSede = computed(() => gimnasio.reportePanel?.ingresosPorSede ?? []);
const totalMesLegible = computed(() => pesos(gimnasio.reportePanel?.totalMes));

/** `null` cuando el mes anterior fue cero: no hay porcentaje que calcular. */
const variacion = computed(() => gimnasio.reportePanel?.variacion ?? null);

const textoVariacion = computed(() => {
  if (variacion.value === null) return `Sin ingresos en ${nombreMesAnterior}`;
  if (variacion.value === 0) return `Igual que en ${nombreMesAnterior}`;
  const verbo = variacion.value > 0 ? 'más' : 'menos';
  return `${FORMATO_PORCENTAJE.format(Math.abs(variacion.value))} ${verbo} que en ${nombreMesAnterior}`;
});

// `null` (no hay mes anterior) y `0` (no hubo cambio) van ambos sin flecha.
const iconoVariacion = computed(() => {
  if (!variacion.value) return null;
  return variacion.value > 0 ? 'trending_up' : 'trending_down';
});

const claseVariacion = computed(() => {
  if (!variacion.value) return 'variacion-neutra';
  return variacion.value > 0 ? 'variacion-buena' : 'variacion-mala';
});

// --- Hoy: entradas por la puerta y ventas del mostrador ------------------------

const hoy = reactive({ entradas: null, negadas: 0, ventas: null, operaciones: 0 });

async function cargarHoy() {
  const [accesos, ventas] = await Promise.allSettled([listarAccesos(), listarVentas()]);
  if (accesos.status === 'fulfilled') {
    hoy.entradas = accesos.value.resumen.permitidos;
    hoy.negadas = accesos.value.resumen.negados;
  }
  if (ventas.status === 'fulfilled') {
    hoy.ventas = ventas.value.resumen.total;
    hoy.operaciones = ventas.value.resumen.operaciones ?? ventas.value.ventas.length;
  }
}

// --- A quien llamar --------------------------------------------------------------

const conteoMiembros = computed(
  () => gimnasio.reportePanel?.miembros ?? { total: 0, al_dia: 0, por_vencer: 0, vencido: 0, sin_pagos: 0 },
);

const LIMITE_LISTA = 6;
const vence = (fila) => new Date(fila.ultimoPago?.periodoFin ?? 0).getTime();

/**
 * Primero los vencidos mas recientes (los que aun se recuperan con una llamada),
 * despues los que vencen antes. Los "sin pagos" no entran: no hay mensualidad
 * que renovar.
 */
const porLlamar = computed(() => {
  const vencidos = vencimientos.value
    .filter((fila) => fila.estado === ESTADOS_VENCIMIENTO.VENCIDO)
    .sort((a, b) => vence(b) - vence(a));
  const porVencer = vencimientos.value
    .filter((fila) => fila.estado === ESTADOS_VENCIMIENTO.POR_VENCER)
    .sort((a, b) => vence(a) - vence(b));
  return [...vencidos, ...porVencer];
});
const porLlamarVisibles = computed(() => porLlamar.value.slice(0, LIMITE_LISTA));

function enlaceWhatsapp(miembro) {
  const gimnasioNombre = usuario.value?.tenantNombre || 'Gym Barichara';
  const texto = `Hola ${miembro.nombres}, te escribimos de ${gimnasioNombre}.`;
  return `https://wa.me/${miembro.telefono}?text=${encodeURIComponent(texto)}`;
}

// --- Atajos ----------------------------------------------------------------------

const ATAJOS = [
  { titulo: 'Registrar pago', glosa: 'Desde la ficha del miembro', icono: 'payments', destino: { name: 'miembros' }, soloDueno: false },
  { titulo: 'Nuevo miembro', glosa: 'Alta con su primera mensualidad', icono: 'person_add', destino: { name: 'miembros' }, soloDueno: false },
  { titulo: 'Registrar venta', glosa: 'Mostrador de la sede', icono: 'point_of_sale', destino: { name: 'ventas' }, soloDueno: false },
  { titulo: 'Gastos', glosa: 'Arriendo, servicios, nómina', icono: 'account_balance_wallet', destino: { name: 'finanzas' }, soloDueno: false },
];
const atajosVisibles = computed(() => ATAJOS.filter((atajo) => !atajo.soloDueno || esDueno.value));

onMounted(async () => {
  cargarHoy();
  try {
    await Promise.all([gimnasio.cargarReportePanel(), cargarVencimientos()]);
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar el tablero' });
  } finally {
    cargandoLista.value = false;
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1400px;
  margin: 0 auto;
}

/* --- Franja del dia (oscura, como la portada publica) ------------------------- */
.franja {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
  padding: 26px 28px;
  border-radius: 14px;
  color: #fff;
  background:
    radial-gradient(ellipse 55% 120% at 85% 0%, rgba(245, 197, 24, 0.16), transparent 70%),
    #14161b;
  border-bottom: 4px solid var(--q-primary);
}
.ceja-clara {
  color: var(--q-primary);
}
.etiqueta-cifra {
  margin-top: 14px;
  font-size: 0.85rem;
  opacity: 0.7;
}
/* La cifra heroe va en la sans del cuerpo, NO en la display de la marca. */
.hero-cifra {
  font-size: clamp(2.6rem, 5vw, 3.6rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.linea-variacion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.84rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
}
.variacion-buena {
  color: #7be3a0;
}
.variacion-mala {
  color: #ff9b8f;
}
.variacion-neutra {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.franja-hoy {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.tile-hoy {
  min-width: 200px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px 18px;
  border-radius: 12px;
  border-left: 4px solid var(--q-primary);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  text-decoration: none;
  transition: background 0.2s ease, transform 0.2s ease;
}
.tile-hoy:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}
.tile-hoy:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
.tile-etiqueta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  opacity: 0.75;
}
.tile-cifra {
  margin-top: 6px;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
}
.tile-glosa {
  margin-top: 2px;
  font-size: 0.78rem;
  opacity: 0.6;
}

/* --- Tarjetas -------------------------------------------------------------- */

/* Las tarjetas de una fila igualan su altura (la columna estira). */
.columna {
  display: flex;
  flex-direction: column;
}
.tarjeta {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 12px;
}

/* --- A quien llamar ------------------------------------------------------------ */
.conteos-llamada {
  display: flex;
  gap: 10px;
  font-size: 0.78rem;
  font-weight: 600;
}
.conteo-vencido {
  color: var(--q-negative);
}
.conteo-por-vencer {
  color: var(--q-warning);
}
.lista-llamar {
  margin: 10px -8px 12px;
}
.fila-llamar {
  min-height: 52px;
  padding: 4px 8px;
  border-radius: 8px;
}
.fila-llamar:hover {
  background: #f6f7f9;
}
.fila-llamar :deep(.q-item__section--avatar) {
  min-width: 18px;
  padding-right: 10px;
}
.banda-estado {
  display: block;
  width: 4px;
  height: 32px;
  border-radius: 2px;
}
.nombre-llamar {
  font-weight: 600;
  color: #0b0b0b;
}
.texto-vencido {
  color: var(--q-negative) !important;
}
.texto-por-vencer {
  color: var(--q-warning) !important;
}
.boton-whatsapp-miembro {
  color: #1faa52;
  font-size: 20px;
}
.boton-llamada {
  margin-top: auto;
}
.sin-pendientes {
  margin: 20px 0 16px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #0b0b0b;
  line-height: 1.7;
}
.sin-pendientes span {
  font-weight: 400;
  font-size: 0.86rem;
}
.pie-tarjeta {
  display: flex;
  gap: 20px;
  margin-top: 12px;
  font-size: 0.8rem;
  color: #52514e;
}
.pie-tarjeta b {
  color: #0b0b0b;
  margin-right: 2px;
}

/* --- Por atender ---------------------------------------------------------------- */
.pila-atender {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}
.fila-atender {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  transition: background 0.2s ease;
}
.fila-atender:hover {
  background: #f6f7f9;
}
.disco-chico {
  width: 50px;
  height: 50px;
  border-width: 5px;
  flex-shrink: 0;
}
.numero-disco-chico {
  font-size: 1.2rem;
  color: #1b1e24;
}
.texto-atender {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.etiqueta-atender {
  font-weight: 600;
  color: #0b0b0b;
}
.glosa-atender {
  font-size: 0.78rem;
  color: #898781;
}
.flecha-atender {
  color: #b0b4ba;
  font-size: 22px;
}

/* --- Atajos ------------------------------------------------------------------------ */
.atajos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.atajo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e4e7ec;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
.atajo:hover {
  border-color: var(--q-primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
}
.atajo:focus-visible,
.fila-atender:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
.atajo-icono {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: #14161b;
  color: var(--q-primary);
}
.atajo-titulo {
  font-weight: 600;
  color: #0b0b0b;
}
.atajo-glosa {
  font-size: 0.76rem;
  color: #898781;
}

@media (max-width: 600px) {
  .franja {
    padding: 20px;
  }
  .tile-hoy {
    min-width: 140px;
  }
  .tile-cifra {
    font-size: 1.6rem;
  }
}
</style>
