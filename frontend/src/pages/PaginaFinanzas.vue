<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-md">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Finanzas</h1>
        <div class="text-caption text-grey-7">
          Lo que gasta cada sede y las obligaciones del gimnasio
        </div>
      </div>

      <div class="row q-gutter-sm items-center">
        <q-input v-model="mesDesde" type="month" outlined dense label="Desde" style="width: 150px" @update:model-value="cargar" />
        <q-input v-model="mesHasta" type="month" outlined dense label="Hasta" style="width: 150px" @update:model-value="cargar" />
      </div>
    </div>

    <q-tabs v-model="pestana" dense align="left" class="text-secondary q-mb-md" active-color="primary" indicator-color="primary" no-caps>
      <q-tab name="resumen" label="Resumen" />
      <q-tab name="gastos" label="Gastos" />
      <q-tab v-if="esDueno" name="deudas" label="Deudas" />
    </q-tabs>

    <q-tab-panels v-model="pestana" animated class="bg-transparent">
      <!-- RESUMEN: cada sede, lo general y el consolidado -->
      <q-tab-panel name="resumen" class="q-pa-none">
        <div v-if="resumen" class="row q-col-gutter-md">
          <div v-for="bloque in bloquesResumen" :key="bloque.clave" class="col-12 col-md-6">
            <q-card flat bordered :class="['tarjeta-bloque', { 'es-general': bloque.general }]">
              <q-card-section>
                <div class="row items-center justify-between">
                  <div class="ceja">{{ bloque.titulo }}</div>
                  <q-icon v-if="bloque.general" name="account_balance" color="primary" size="20px" />
                </div>
                <div class="cifra-heroe">${{ pesos(bloque.total) }}</div>

                <q-markup-table flat dense class="q-mt-sm tabla-categorias">
                  <tbody>
                    <tr v-for="cat in CATEGORIAS" :key="cat.valor">
                      <td class="text-grey-7">{{ cat.etiqueta }}</td>
                      <td class="text-right cifra-tabular">
                        ${{ pesos(bloque.porCategoria[cat.valor] || 0) }}
                      </td>
                    </tr>
                  </tbody>
                </q-markup-table>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-12">
            <q-card flat bordered class="tarjeta-total">
              <q-card-section class="row items-center justify-between">
                <div>
                  <div class="ceja">Total del periodo (todas las sedes + general)</div>
                  <div class="text-caption text-grey-7">{{ rangoLegible }}</div>
                </div>
                <div class="cifra-heroe">${{ pesos(resumen.total) }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- GASTOS: el libro de egresos -->
      <q-tab-panel name="gastos" class="q-pa-none">
        <div class="row justify-end q-mb-sm">
          <q-btn color="primary" unelevated no-caps icon="add" label="Nuevo gasto" @click="abrirGasto" />
        </div>

        <q-table
          flat
          bordered
          row-key="_id"
          :rows="gimnasio.gastos"
          :columns="columnasGasto"
          :loading="cargando"
          :pagination="{ rowsPerPage: 25, sortBy: 'fecha', descending: true }"
          no-data-label="Sin gastos en este periodo."
        >
          <template #body-cell-acciones="props">
            <q-td :props="props" class="text-right">
              <q-btn
                v-if="!props.row.deuda"
                round
                flat
                dense
                color="negative"
                icon="delete"
                @click="confirmarEliminar(props.row)"
              >
                <q-tooltip>Eliminar</q-tooltip>
              </q-btn>
              <q-badge v-else outline color="grey-7">abono</q-badge>
            </q-td>
          </template>
        </q-table>
      </q-tab-panel>

      <!-- DEUDAS: solo el dueño -->
      <q-tab-panel v-if="esDueno" name="deudas" class="q-pa-none">
        <div class="row justify-end q-mb-sm">
          <q-btn color="primary" unelevated no-caps icon="add" label="Nueva deuda" @click="abrirDeuda" />
        </div>

        <div v-if="gimnasio.deudas.length === 0" class="estado-vacio">
          <q-icon name="check_circle" size="42px" color="positive" />
          <div class="q-mt-sm">No hay deudas registradas.</div>
        </div>

        <div v-else class="row q-col-gutter-md">
          <div v-for="deuda in gimnasio.deudas" :key="deuda._id" class="col-12 col-md-6">
            <q-card flat bordered :class="['tarjeta-deuda', { saldada: deuda.saldada }]">
              <q-card-section>
                <div class="row items-start justify-between no-wrap">
                  <div>
                    <div class="text-weight-medium">{{ deuda.descripcion }}</div>
                    <div class="text-caption text-grey-7">
                      {{ deuda.acreedor || 'Sin acreedor' }} ·
                      {{ deuda.sede ? nombreSede(deuda.sede) : 'Gimnasio' }}
                    </div>
                  </div>
                  <q-badge v-if="deuda.saldada" color="positive">Saldada</q-badge>
                </div>

                <div class="row items-end justify-between q-mt-md">
                  <div>
                    <div class="ceja">Saldo pendiente</div>
                    <div class="cifra-heroe">${{ pesos(deuda.saldo) }}</div>
                  </div>
                  <div class="text-caption text-grey-7 text-right">
                    Pagado ${{ pesos(deuda.pagado) }}<br />
                    de ${{ pesos(deuda.montoTotal) }}
                  </div>
                </div>

                <q-linear-progress
                  :value="deuda.montoTotal ? deuda.pagado / deuda.montoTotal : 0"
                  size="8px"
                  rounded
                  color="positive"
                  track-color="grey-3"
                  class="q-mt-sm"
                />
              </q-card-section>

              <q-separator />

              <q-card-actions align="right">
                <q-btn flat dense no-caps color="negative" label="Archivar" @click="confirmarArchivar(deuda)" />
                <q-btn
                  v-if="!deuda.saldada"
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="payments"
                  label="Abonar"
                  @click="abrirAbono(deuda)"
                />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- Alta de gasto -->
    <q-dialog v-model="dialogoGasto" class="dialogo-form">
      <q-card class="tarjeta-form">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Nuevo gasto</div>
        </q-card-section>
        <q-separator />
        <q-form @submit.prevent="guardarGasto">
          <q-card-section class="q-gutter-y-md">
            <q-select
              v-model="formGasto.categoria"
              label="Categoria"
              outlined
              dense
              emit-value
              map-options
              :options="CATEGORIAS_ELEGIBLES"
              :rules="[reglaObligatorio]"
            />
            <q-select
              v-if="esDueno"
              v-model="formGasto.sede"
              label="Sede"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSedeConGeneral"
              hint="Deja 'Gimnasio (general)' para las obligaciones del dueño"
            />
            <q-input v-model="formGasto.concepto" label="Concepto" outlined dense :rules="[reglaObligatorio]" />
            <div class="row q-col-gutter-md">
              <q-input
                v-model.number="formGasto.monto"
                class="col-6"
                type="number"
                label="Monto"
                prefix="$"
                outlined
                dense
                :rules="[reglaMonto]"
              />
              <!-- Los gastos del gimnasio se llevan por MES completo, no por dia. -->
              <q-input
                v-model="formGasto.mes"
                class="col-6"
                type="month"
                label="Mes"
                hint="Cubre el mes completo"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoGasto = false" />
            <q-btn type="submit" color="primary" unelevated no-caps label="Registrar" :loading="guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- Alta de deuda -->
    <q-dialog v-model="dialogoDeuda" class="dialogo-form">
      <q-card class="tarjeta-form">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Nueva deuda</div>
        </q-card-section>
        <q-separator />
        <q-form @submit.prevent="guardarDeuda">
          <q-card-section class="q-gutter-y-md">
            <q-input v-model="formDeuda.descripcion" label="Descripcion" outlined dense :rules="[reglaObligatorio]" />
            <q-input v-model="formDeuda.acreedor" label="Acreedor (opcional)" outlined dense />
            <q-input
              v-model.number="formDeuda.montoTotal"
              type="number"
              label="Monto total"
              prefix="$"
              outlined
              dense
              :rules="[reglaMonto]"
            />
            <q-select
              v-model="formDeuda.sede"
              label="Sede"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSedeConGeneral"
              hint="Normalmente es del gimnasio entero"
            />
          </q-card-section>
          <q-separator />
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoDeuda = false" />
            <q-btn type="submit" color="primary" unelevated no-caps label="Registrar" :loading="guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Finanzas: los egresos de cada sede y del gimnasio, mas las deudas con saldo.
 * Un gasto sin sede es "general" (del dueño); el backend se lo fuerza a su sede
 * a un sede_admin, que ademas nunca ve los generales ni las deudas.
 */

const gimnasio = useGimnasioStore();
const autenticacion = useAutenticacionStore();
const quasar = useQuasar();

const esDueno = computed(() => autenticacion.usuario?.rol === ROLES.TENANT_OWNER);

const pestana = ref('resumen');
const cargando = ref(false);
const guardando = ref(false);
const dialogoGasto = ref(false);
const dialogoDeuda = ref(false);

const FORMATO = new Intl.NumberFormat('es-CO');
const pesos = (valor) => FORMATO.format(valor ?? 0);

/**
 * Todo el modulo trabaja por MES: los gastos del gimnasio (arriendo, servicios,
 * nomina, cuotas) cubren el mes completo, no un dia suelto. En la interfaz se
 * elige "2026-07" y hacia el backend viaja siempre un dia civil completo, que es
 * lo que espera `diaCivil` (un "2026-07" a secas lo leeria como medianoche UTC,
 * que en Bogota cae el mes anterior).
 */
function isoMes(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-07" -> "2026-07-01" */
const primerDiaDe = (mes) => `${mes}-01`;

/** "2026-07" -> "2026-07-31" (para que el rango incluya el mes entero). */
function ultimoDiaDe(mes) {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const dias = new Date(anio, numeroMes, 0).getDate();
  return `${mes}-${String(dias).padStart(2, '0')}`;
}

const hoy = new Date();
const mesDesde = ref(isoMes(hoy));
const mesHasta = ref(isoMes(hoy));

const CATEGORIAS = [
  { valor: 'arriendo', etiqueta: 'Arriendo' },
  { valor: 'servicios', etiqueta: 'Servicios' },
  { valor: 'empleados', etiqueta: 'Empleados' },
  { valor: 'deuda', etiqueta: 'Deudas' },
  { valor: 'otros', etiqueta: 'Otros' },
];
// Los abonos no se crean a mano: salen de la pestaña Deudas.
const CATEGORIAS_ELEGIBLES = CATEGORIAS.filter((c) => c.valor !== 'deuda').map((c) => ({
  label: c.etiqueta,
  value: c.valor,
}));

const resumen = computed(() => gimnasio.resumenFinanzas);

/** "julio 2026" si es un solo mes; "julio 2026 a septiembre 2026" si son varios. */
const rangoLegible = computed(() => {
  const nombre = (mes) =>
    new Date(`${mes}-01T00:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return mesDesde.value === mesHasta.value
    ? nombre(mesDesde.value)
    : `${nombre(mesDesde.value)} a ${nombre(mesHasta.value)}`;
});

/** Una tarjeta por sede y una para lo general. */
const bloquesResumen = computed(() => {
  if (!resumen.value) return [];
  const bloques = resumen.value.porSede.map((s) => ({
    clave: s.sede,
    titulo: s.sedeNombre,
    total: s.total,
    porCategoria: s.porCategoria,
    general: false,
  }));
  if (esDueno.value) {
    bloques.push({
      clave: 'general',
      titulo: 'Gimnasio (general)',
      total: resumen.value.general.total,
      porCategoria: resumen.value.general.porCategoria,
      general: true,
    });
  }
  return bloques;
});

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? 'Sede';
}

const opcionesSedeConGeneral = computed(() => [
  { label: 'Gimnasio (general)', value: null },
  ...gimnasio.sedes.filter((s) => s.activa).map((s) => ({ label: s.nombre, value: s._id })),
]);

const columnasGasto = [
  {
    name: 'fecha',
    label: 'Mes',
    field: 'fecha',
    align: 'left',
    sortable: true,
    // Se muestra el mes, no el dia: el gasto cubre el mes completo.
    format: (v) => new Date(v).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
  },
  {
    name: 'categoria',
    label: 'Categoria',
    field: 'categoria',
    align: 'left',
    sortable: true,
    format: (v) => CATEGORIAS.find((c) => c.valor === v)?.etiqueta ?? v,
  },
  {
    name: 'sede',
    label: 'Sede',
    field: (fila) => (fila.sede ? nombreSede(fila.sede) : 'General'),
    align: 'left',
  },
  { name: 'concepto', label: 'Concepto', field: 'concepto', align: 'left' },
  {
    name: 'monto',
    label: 'Monto',
    field: 'monto',
    align: 'right',
    sortable: true,
    format: (v) => `$${pesos(v)}`,
    classes: 'cifra-tabular',
  },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const reglaObligatorio = (v) => Boolean(String(v ?? '').trim()) || 'Este campo es obligatorio';
const reglaMonto = (v) => (typeof v === 'number' && v >= 0) || 'Monto invalido';

const formGasto = reactive({ categoria: null, sede: null, concepto: '', monto: null, mes: isoMes(hoy) });
const formDeuda = reactive({ descripcion: '', acreedor: '', montoTotal: null, sede: null });

function abrirGasto() {
  Object.assign(formGasto, {
    categoria: null,
    sede: null,
    concepto: '',
    monto: null,
    mes: isoMes(new Date()),
  });
  dialogoGasto.value = true;
}

function abrirDeuda() {
  Object.assign(formDeuda, { descripcion: '', acreedor: '', montoTotal: null, sede: null });
  dialogoDeuda.value = true;
}

async function guardarGasto() {
  guardando.value = true;
  try {
    await gimnasio.crearGasto({
      categoria: formGasto.categoria,
      concepto: formGasto.concepto,
      monto: formGasto.monto,
      // El mes elegido se guarda como su dia 1 (el backend espera un dia civil).
      fecha: primerDiaDe(formGasto.mes),
      ...(formGasto.sede ? { sede: formGasto.sede } : {}),
    });
    quasar.notify({ type: 'positive', message: 'Gasto registrado' });
    dialogoGasto.value = false;
    await cargar();
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo registrar' });
  } finally {
    guardando.value = false;
  }
}

async function guardarDeuda() {
  guardando.value = true;
  try {
    await gimnasio.crearDeuda({
      descripcion: formDeuda.descripcion,
      montoTotal: formDeuda.montoTotal,
      ...(formDeuda.acreedor ? { acreedor: formDeuda.acreedor } : {}),
      ...(formDeuda.sede ? { sede: formDeuda.sede } : {}),
    });
    quasar.notify({ type: 'positive', message: 'Deuda registrada' });
    dialogoDeuda.value = false;
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo registrar' });
  } finally {
    guardando.value = false;
  }
}

function abrirAbono(deuda) {
  quasar
    .dialog({
      title: `Abonar a ${deuda.descripcion}`,
      message: `Saldo pendiente: $${pesos(deuda.saldo)}. ¿Cuanto abonas?`,
      prompt: { model: '', type: 'number', isValid: (v) => Number(v) > 0 && Number(v) <= deuda.saldo },
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'primary', unelevated: true, noCaps: true, label: 'Abonar' },
    })
    .onOk(async (valor) => {
      try {
        await gimnasio.abonarDeuda(deuda._id, { monto: Number(valor) });
        quasar.notify({ type: 'positive', message: 'Abono registrado' });
        await cargar(); // el abono tambien es un gasto del periodo
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo abonar' });
      }
    });
}

function confirmarArchivar(deuda) {
  quasar
    .dialog({
      title: `Archivar ${deuda.descripcion}`,
      message: 'Dejara de aparecer. Los abonos ya registrados no se tocan.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Archivar' },
    })
    .onOk(async () => {
      try {
        await gimnasio.archivarDeuda(deuda._id);
        quasar.notify({ type: 'positive', message: 'Deuda archivada' });
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo archivar' });
      }
    });
}

function confirmarEliminar(gasto) {
  quasar
    .dialog({
      title: 'Eliminar gasto',
      message: `Se borrara "${gasto.concepto}" por $${pesos(gasto.monto)}.`,
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Eliminar' },
    })
    .onOk(async () => {
      try {
        await gimnasio.eliminarGasto(gasto._id);
        quasar.notify({ type: 'positive', message: 'Gasto eliminado' });
        await cargar();
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo eliminar' });
      }
    });
}

async function cargar() {
  cargando.value = true;
  try {
    // El rango va de mes completo a mes completo: del dia 1 del primero al
    // ultimo dia del segundo, para que ningun mes quede cortado.
    await gimnasio.cargarFinanzas({
      desde: primerDiaDe(mesDesde.value),
      hasta: ultimoDiaDe(mesHasta.value),
    });
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar las finanzas' });
  } finally {
    cargando.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    cargar(),
    gimnasio.cargarSedes().catch(() => {}),
    esDueno.value ? gimnasio.cargarDeudas().catch(() => {}) : Promise.resolve(),
  ]);
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.tarjeta-bloque {
  border-top: 4px solid var(--q-secondary);
  height: 100%;
}

.tarjeta-bloque.es-general {
  border-top-color: var(--q-primary);
}

.tarjeta-total {
  border-left: 4px solid var(--q-primary);
}

/* La cifra heroe va en la sans del cuerpo, nunca en Barlow Condensed. */
.cifra-heroe {
  font-size: 1.9rem;
  font-weight: 600;
  line-height: 1.15;
  margin-top: 2px;
}

.tabla-categorias :deep(td) {
  padding: 2px 0;
  font-size: 0.82rem;
}

.tarjeta-deuda {
  border-left: 4px solid var(--q-warning);
  height: 100%;
}

.tarjeta-deuda.saldada {
  border-left-color: var(--q-positive);
}

.estado-vacio {
  text-align: center;
  padding: 48px 16px;
  color: var(--q-secondary);
}

/* Los formularios de alta (gasto y deuda) llenan el ancho que Quasar permite en
   un dialogo, en vez de encogerse al tamaño del contenido. */
.tarjeta-form {
  width: 100%;
  max-width: 560px;
  border-top: 4px solid var(--q-primary);
}

/* En movil ocupa el 90% de la pantalla; se recorta el relleno del dialogo para
   que ese 90% quepa sin desbordar. */
@media (max-width: 599px) {
  .tarjeta-form {
    width: 90vw;
    max-width: 90vw;
  }

  .dialogo-form :deep(.q-dialog__inner--minimized) {
    padding: 12px;
  }
}
</style>
