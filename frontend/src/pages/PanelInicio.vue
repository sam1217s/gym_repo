<template>
  <q-page padding class="pagina-panel">
    <!-- El super_admin no pertenece a ningun gimnasio y los reportes son
         tenant-scoped: para el, esta pantalla es una puerta, no un panel. -->
    <section v-if="esSuperAdmin" class="portada-plataforma">
      <div class="ceja">Plataforma</div>
      <h1 class="titulo-display titulo-pagina q-my-none">Hola, {{ usuario?.nombres }}</h1>
      <p class="text-body2 text-grey-7 q-mt-sm q-mb-lg">
        Los reportes viven dentro de cada gimnasio. Tu trabajo es la plataforma.
      </p>
      <q-btn
        color="primary"
        unelevated
        no-caps
        icon-right="arrow_forward"
        label="Ir a los gimnasios"
        :to="{ name: 'plataforma' }"
      />
    </section>

    <template v-else>
      <!-- El titular: cuanto entro, y contra que se compara. -->
      <header class="titular">
        <div class="ceja">Este mes · {{ nombreMesActual }}</div>

        <div v-if="cargando" class="q-mt-sm">
          <q-skeleton type="text" width="240px" height="56px" />
        </div>

        <template v-else>
          <div class="hero-cifra">{{ totalMesLegible }}</div>
          <div class="linea-variacion" :class="claseVariacion">
            <q-icon v-if="iconoVariacion" :name="iconoVariacion" size="18px" />
            <span>{{ textoVariacion }}</span>
          </div>
        </template>

        <div class="banda-marca" />
      </header>

      <div class="row q-col-gutter-lg">
        <div class="col-12 col-md-7 columna">
          <q-card flat bordered class="tarjeta">
            <q-skeleton v-if="cargando" type="rect" height="200px" />
            <GraficaIngresos v-else :filas="ingresosPorSede" :nombre-mes="nombreMesActual" />
          </q-card>
        </div>

        <div class="col-12 col-md-5 columna">
          <q-card flat bordered class="tarjeta">
            <div class="ceja">Requieren llamada</div>

            <q-skeleton v-if="cargando" type="rect" height="140px" class="q-mt-md" />

            <template v-else>
              <!-- Los dos estados accionables van arriba y grandes; los otros dos,
                   que no piden nada de nadie, quedan como pie de tarjeta. -->
              <p v-if="sinPendientes" class="sin-pendientes">
                Nadie vence en los proximos dias.<br />
                <span class="text-grey-7">Todo el gimnasio esta al dia.</span>
              </p>

              <div v-else class="pila-pendientes">
                <div
                  v-for="pendiente in pendientes"
                  :key="pendiente.estado"
                  class="fila-pendiente"
                >
                  <div class="disco disco-chico" :style="{ borderColor: pendiente.color }">
                    <span class="titulo-display numero-disco-chico cifra-tabular">
                      {{ pendiente.total }}
                    </span>
                  </div>
                  <div>
                    <div class="etiqueta-pendiente">{{ pendiente.etiqueta }}</div>
                    <div class="glosa-pendiente">{{ pendiente.glosa }}</div>
                  </div>
                </div>
              </div>

              <q-btn
                class="full-width boton-llamada"
                color="primary"
                outline
                no-caps
                icon-right="arrow_forward"
                label="Ver miembros"
                :to="{ name: 'miembros' }"
              />

              <q-separator class="q-my-md" />

              <div class="pie-tarjeta">
                <span v-for="quieto in quietos" :key="quieto.estado" class="dato-quieto">
                  <span class="cifra-tabular text-weight-bold">{{ quieto.total }}</span>
                  {{ quieto.etiqueta }}
                </span>
              </div>
            </template>
          </q-card>
        </div>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted } from 'vue';

import GraficaIngresos from 'src/components/GraficaIngresos.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * El panel del dia a dia. Responde dos preguntas, en ese orden: cuanto entro
 * este mes (y si eso es bueno o malo, comparado con el anterior), y a quien
 * hay que llamar hoy.
 *
 * El alcance lo decide el backend: un sede_admin recibe solo su sede; el dueno,
 * el consolidado de todo el gimnasio.
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();
const { usuario } = useAutenticacion();

const esSuperAdmin = computed(() => usuario.value?.rol === ROLES.SUPER_ADMIN);
const cargando = computed(() => gimnasio.reportePanel === null);

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const FORMATO_MES = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const FORMATO_PORCENTAJE = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'never',
});

const ahora = new Date();
const nombreMesActual = FORMATO_MES.format(ahora);
const nombreMesAnterior = FORMATO_MES.format(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1));

const ingresosPorSede = computed(() => gimnasio.reportePanel?.ingresosPorSede ?? []);
const totalMesLegible = computed(
  () => `$${FORMATO_PESOS.format(gimnasio.reportePanel?.totalMes ?? 0)}`,
);

/** `null` cuando el mes anterior fue cero: no hay porcentaje que calcular. */
const variacion = computed(() => gimnasio.reportePanel?.variacion ?? null);

const textoVariacion = computed(() => {
  if (variacion.value === null) return `Sin ingresos en ${nombreMesAnterior}`;
  if (variacion.value === 0) return `Igual que en ${nombreMesAnterior}`;

  const verbo = variacion.value > 0 ? 'mas' : 'menos';
  return `${FORMATO_PORCENTAJE.format(Math.abs(variacion.value))} ${verbo} que en ${nombreMesAnterior}`;
});

// `null` (no hay mes anterior) y `0` (no hubo cambio) van ambos sin flecha.
const iconoVariacion = computed(() => {
  if (!variacion.value) return null;
  return variacion.value > 0 ? 'arrow_upward' : 'arrow_downward';
});

const claseVariacion = computed(() => {
  if (!variacion.value) return 'variacion-neutra';
  return variacion.value > 0 ? 'variacion-buena' : 'variacion-mala';
});

const conteoMiembros = computed(
  () =>
    gimnasio.reportePanel?.miembros ?? {
      total: 0,
      al_dia: 0,
      por_vencer: 0,
      vencido: 0,
      sin_pagos: 0,
    },
);

/**
 * La jerarquia real: dos estados piden una accion hoy, los otros dos solo
 * informan. Pintarlos a todos iguales seria decir que valen lo mismo.
 */
const PENDIENTES = [
  {
    estado: 'vencido',
    etiqueta: 'Vencidos',
    glosa: 'Su mensualidad ya se acabo',
    color: 'var(--q-negative)',
  },
  {
    estado: 'por_vencer',
    etiqueta: 'Por vencer',
    glosa: 'Vencen en los proximos 3 dias',
    color: 'var(--q-warning)',
  },
];

const QUIETOS = [
  { estado: 'al_dia', etiqueta: 'al dia' },
  { estado: 'sin_pagos', etiqueta: 'sin pagos' },
];

const pendientes = computed(() =>
  PENDIENTES.map((definicion) => ({
    ...definicion,
    total: conteoMiembros.value[definicion.estado] ?? 0,
  })),
);

const quietos = computed(() =>
  QUIETOS.map((definicion) => ({
    ...definicion,
    total: conteoMiembros.value[definicion.estado] ?? 0,
  })),
);

const sinPendientes = computed(() => pendientes.value.every((fila) => fila.total === 0));

onMounted(async () => {
  if (esSuperAdmin.value) return;

  try {
    await gimnasio.cargarReportePanel();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar el reporte' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.portada-plataforma {
  padding-top: 24px;
}

/* --- El titular ------------------------------------------------------------ */

.titular {
  margin-bottom: 32px;
}

/**
 * La cifra heroe va en la sans del cuerpo, NO en la display de la marca: una
 * cara condensada en un numero de 3rem se lee como decoracion. La marca entra
 * por la ceja y por la banda de abajo.
 */
.hero-cifra {
  font-size: 3.25rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: #0b0b0b;
  margin-top: 2px;
}

.linea-variacion {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-size: 0.86rem;
  font-weight: 600;
}

.variacion-buena {
  color: #006300;
}

.variacion-mala {
  color: #8f1d14;
}

.variacion-neutra {
  color: #898781;
  font-weight: 500;
}

/* La banda del disco: la firma de la marca, bajo la cifra que manda. */
.banda-marca {
  margin-top: 18px;
  height: 3px;
  width: 72px;
  background: var(--q-primary);
  border-radius: 2px;
}

/* --- Tarjetas -------------------------------------------------------------- */

/**
 * Las dos tarjetas igualan altura: la columna estira y la tarjeta crece dentro.
 * Un `height: 100%` no basta, porque el gutter de Quasar mete padding en la
 * columna y el porcentaje se mide contra su caja de contenido.
 */
.columna {
  display: flex;
  flex-direction: column;
}

.tarjeta {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 4px;
}

/* Empuja el boton y el pie al fondo cuando la tarjeta estira. */
.boton-llamada {
  margin-top: auto;
}

/* --- Requieren llamada ------------------------------------------------------ */

.pila-pendientes {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 18px;
}

.fila-pendiente {
  display: flex;
  align-items: center;
  gap: 14px;
}

.disco-chico {
  width: 54px;
  height: 54px;
  border-width: 5px;
  flex-shrink: 0;
}

.numero-disco-chico {
  font-size: 1.25rem;
  color: #1b1e24;
}

.etiqueta-pendiente {
  font-weight: 600;
  color: #0b0b0b;
  line-height: 1.3;
}

.glosa-pendiente {
  font-size: 0.78rem;
  color: #898781;
}

.sin-pendientes {
  margin: 20px 0 0;
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
  font-size: 0.8rem;
  color: #52514e;
}

.dato-quieto .text-weight-bold {
  color: #0b0b0b;
  margin-right: 3px;
}
</style>
