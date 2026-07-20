<template>
  <q-page padding class="pagina-plataforma">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Plataforma</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Gimnasios</h1>
        <div class="text-caption text-grey-7">
          {{ plataforma.gimnasios.length }} dados de alta
        </div>
      </div>

      <q-btn
        color="primary"
        unelevated
        no-caps
        icon="add"
        label="Dar de alta un gimnasio"
        @click="dialogoAbierto = true"
      />
    </div>

    <!-- Los contadores son discos: la banda de color dice el estado, como en
         un disco de competicion dice el peso. -->
    <div class="fila-discos q-mb-lg">
      <div v-for="resumen in discosEstado" :key="resumen.estado" class="celda-disco">
        <div class="disco" :style="{ borderColor: resumen.color }">
          <span class="titulo-display numero-disco cifra-tabular">{{ resumen.total }}</span>
        </div>
        <div class="etiqueta-disco">{{ resumen.etiqueta }}</div>
      </div>
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="plataforma.gimnasios"
      :columns="COLUMNAS"
      :loading="plataforma.cargando"
      :pagination="{ rowsPerPage: 15 }"
      :hide-bottom="plataforma.gimnasios.length <= 15"
      no-data-label="Aun no hay gimnasios. Da de alta el primero."
    >
      <template #body-cell-gimnasio="props">
        <q-td :props="props">
          <div class="text-weight-medium">{{ props.row.nombre }}</div>
          <div class="text-caption text-grey-7">{{ props.row.slug }}</div>
        </q-td>
      </template>

      <template #body-cell-dueno="props">
        <q-td :props="props">
          <template v-if="props.row.dueno">
            <div>{{ props.row.dueno.nombreCompleto }}</div>
            <div class="text-caption text-grey-7">{{ props.row.dueno.email }}</div>
          </template>
          <span v-else class="text-grey-6">Sin dueño</span>
        </q-td>
      </template>

      <template #body-cell-estado="props">
        <q-td :props="props">
          <span class="chip-banda" :style="{ '--banda': APARIENCIA_ESTADO[props.row.estado].color }">
            {{ APARIENCIA_ESTADO[props.row.estado].etiqueta }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn
            v-if="props.row.estado !== ESTADOS_GIMNASIO.CANCELADO"
            flat
            dense
            no-caps
            size="sm"
            color="grey-8"
            icon="qr_code_2"
            label="Cobros"
            @click="abrirCobros(props.row)"
          />
          <q-btn
            v-if="puedeSuspender(props.row)"
            flat
            dense
            no-caps
            size="sm"
            color="warning"
            label="Suspender"
            @click="confirmarSuspension(props.row)"
          />
          <q-btn
            v-if="props.row.estado === ESTADOS_GIMNASIO.SUSPENDIDO"
            flat
            dense
            no-caps
            size="sm"
            color="positive"
            label="Reactivar"
            @click="confirmarReactivacion(props.row)"
          />
          <q-btn
            v-if="props.row.estado !== ESTADOS_GIMNASIO.CANCELADO"
            flat
            dense
            no-caps
            size="sm"
            color="negative"
            label="Cancelar"
            @click="confirmarCancelacion(props.row)"
          />
          <span v-if="props.row.estado === ESTADOS_GIMNASIO.CANCELADO" class="text-grey-6">—</span>
        </q-td>
      </template>
    </q-table>

    <FormularioOnboarding v-model="dialogoAbierto" />

    <!-- Config del cobro en linea (llaves Wompi del gimnasio). Lo hace el super_admin. -->
    <q-dialog v-model="dialogoCobros">
      <q-card class="tarjeta-cobros">
        <q-card-section>
          <div class="text-h6 titulo-display">Cobro en línea — {{ cobros.gimnasio?.nombre }}</div>
          <div class="text-caption text-grey-7">
            Llaves de Wompi <strong>del gimnasio</strong>: con ellas el miembro paga su mensualidad
            al Wompi del dueño. Los secretos no se muestran una vez guardados.
          </div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardarCobros">
          <q-card-section class="q-gutter-y-md">
            <span
              class="chip-banda"
              :style="{ '--banda': cobros.config.configurado ? 'var(--q-positive)' : 'var(--q-warning)' }"
            >
              {{ cobros.config.configurado ? 'Pago en línea activo' : 'Sin configurar' }}
            </span>

            <q-input
              v-model="cobros.formulario.llavePublica"
              label="Llave pública"
              hint="Empieza por pub_prod_ (o pub_test_ en pruebas)"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input
              v-model="cobros.formulario.secretoIntegridad"
              :type="cobros.verSecretos ? 'text' : 'password'"
              label="Secreto de integridad"
              outlined
              dense
              :rules="[reglaObligatorio]"
            >
              <template #append>
                <q-icon
                  :name="cobros.verSecretos ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="cobros.verSecretos = !cobros.verSecretos"
                />
              </template>
            </q-input>
            <q-input
              v-model="cobros.formulario.secretoEventos"
              :type="cobros.verSecretos ? 'text' : 'password'"
              label="Secreto de eventos"
              hint="El que separa un pago real de uno falso."
              outlined
              dense
              :rules="[reglaObligatorio]"
            />

            <div class="fila-webhook">
              <div>
                <div class="text-caption text-grey-7">URL de eventos a registrar en Wompi</div>
                <code class="url-webhook">{{ cobros.config.urlWebhook }}</code>
              </div>
              <q-btn flat dense round icon="content_copy" aria-label="Copiar" @click="copiar(cobros.config.urlWebhook)" />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Cerrar" :disable="cobros.guardando" @click="dialogoCobros = false" />
            <q-btn type="submit" color="primary" unelevated no-caps label="Guardar llaves" :loading="cobros.guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import FormularioOnboarding from 'src/components/FormularioOnboarding.vue';
import * as servicioPlataforma from 'src/servicios/plataforma.servicio.js';
import { ESTADOS_GIMNASIO, usePlataformaStore } from 'src/stores/plataforma.js';

/**
 * Panel del super_admin: los gimnasios-clientes de la plataforma, su estado y
 * las acciones sobre su ciclo de vida. La comprobacion real de permisos la
 * hace el backend; aqui solo se pinta.
 */

const plataforma = usePlataformaStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);

/** Color de la banda y nombre visible de cada estado. */
const APARIENCIA_ESTADO = {
  [ESTADOS_GIMNASIO.ACTIVO]: { etiqueta: 'Activo', plural: 'Activos', color: 'var(--q-positive)' },
  [ESTADOS_GIMNASIO.TRIAL]: { etiqueta: 'En prueba', plural: 'En prueba', color: 'var(--q-info)' },
  [ESTADOS_GIMNASIO.SUSPENDIDO]: { etiqueta: 'Suspendido', plural: 'Suspendidos', color: 'var(--q-warning)' },
  [ESTADOS_GIMNASIO.CANCELADO]: { etiqueta: 'Cancelado', plural: 'Cancelados', color: '#667085' },
};

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const COLUMNAS = [
  { name: 'gimnasio', label: 'Gimnasio', field: 'nombre', align: 'left', sortable: true },
  { name: 'nit', label: 'NIT', field: 'nit', align: 'left' },
  {
    name: 'plan',
    label: 'Plan',
    field: (fila) => fila.planPlataforma?.nombre ?? '—',
    align: 'left',
    sortable: true,
  },
  { name: 'sedes', label: 'Sedes', field: 'totalSedes', align: 'center', sortable: true },
  { name: 'dueno', label: 'Dueño', field: (fila) => fila.dueno?.email ?? '', align: 'left' },
  {
    name: 'alta',
    label: 'Alta',
    field: 'fechaRegistro',
    align: 'left',
    sortable: true,
    format: (valor) => (valor ? FORMATO_FECHA.format(new Date(valor)) : '—'),
  },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const discosEstado = computed(() =>
  [
    ESTADOS_GIMNASIO.ACTIVO,
    ESTADOS_GIMNASIO.TRIAL,
    ESTADOS_GIMNASIO.SUSPENDIDO,
    ESTADOS_GIMNASIO.CANCELADO,
  ].map((estado) => ({
    estado,
    etiqueta: APARIENCIA_ESTADO[estado].plural,
    color: APARIENCIA_ESTADO[estado].color,
    total: plataforma.conteosPorEstado[estado],
  })),
);

function puedeSuspender(gimnasio) {
  return (
    gimnasio.estado === ESTADOS_GIMNASIO.ACTIVO || gimnasio.estado === ESTADOS_GIMNASIO.TRIAL
  );
}

// --- Acciones con confirmacion ----------------------------------------------

function confirmarSuspension(gimnasio) {
  quasar
    .dialog({
      title: `Suspender ${gimnasio.nombre}`,
      message: 'Su gente no podra entrar al panel hasta que lo reactives.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'warning', unelevated: true, noCaps: true, label: 'Suspender' },
    })
    .onOk(() => ejecutar(() => plataforma.suspenderGimnasio(gimnasio._id), `${gimnasio.nombre} suspendido`));
}

function confirmarReactivacion(gimnasio) {
  quasar
    .dialog({
      title: `Reactivar ${gimnasio.nombre}`,
      message: 'Su gente vuelve a entrar de inmediato.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'positive', unelevated: true, noCaps: true, label: 'Reactivar' },
    })
    .onOk(() => ejecutar(() => plataforma.reactivarGimnasio(gimnasio._id), `${gimnasio.nombre} reactivado`));
}

function confirmarCancelacion(gimnasio) {
  quasar
    .dialog({
      title: `Cancelar ${gimnasio.nombre}`,
      message: 'Cancelar es definitivo: no se puede reactivar despues. Sus datos se conservan.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Cancelar definitivamente' },
    })
    .onOk(() => ejecutar(() => plataforma.cancelarGimnasio(gimnasio._id), `${gimnasio.nombre} cancelado`));
}

async function ejecutar(accion, mensajeExito) {
  try {
    await accion();
    quasar.notify({ type: 'positive', message: mensajeExito });
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo completar la operacion',
    });
  }
}

// --- Cobro en linea del gimnasio (llaves Wompi) -----------------------------

const dialogoCobros = ref(false);
const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';

const cobros = reactive({
  gimnasio: null,
  config: { configurado: false, llavePublica: null, urlWebhook: '' },
  formulario: { llavePublica: '', secretoIntegridad: '', secretoEventos: '' },
  verSecretos: false,
  guardando: false,
});

async function abrirCobros(gimnasio) {
  cobros.gimnasio = gimnasio;
  cobros.formulario = { llavePublica: '', secretoIntegridad: '', secretoEventos: '' };
  cobros.verSecretos = false;
  cobros.config = { configurado: false, llavePublica: null, urlWebhook: '' };
  dialogoCobros.value = true;
  try {
    cobros.config = await servicioPlataforma.obtenerCobros(gimnasio._id);
    // La llave publica no es secreta: se puede prellenar para editarla comoda.
    cobros.formulario.llavePublica = cobros.config.llavePublica ?? '';
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar la configuracion de cobros' });
  }
}

async function guardarCobros() {
  cobros.guardando = true;
  try {
    cobros.config = await servicioPlataforma.guardarCobros(cobros.gimnasio._id, { ...cobros.formulario });
    quasar.notify({ type: 'positive', message: 'Llaves guardadas' });
    dialogoCobros.value = false;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudieron guardar las llaves',
    });
  } finally {
    cobros.guardando = false;
  }
}

function copiar(texto) {
  navigator.clipboard?.writeText(texto);
  quasar.notify({ type: 'positive', message: 'URL copiada', timeout: 1200 });
}

onMounted(async () => {
  try {
    await plataforma.cargarGimnasios();
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudieron cargar los gimnasios' });
  }
});
</script>

<style scoped>
/* Las clases del sistema (ceja, discos, chip-banda) viven en css/app.scss. */
.pagina-plataforma {
  max-width: 1100px;
  margin: 0 auto;
}

.tarjeta-cobros {
  width: 100%;
  max-width: 520px;
  border-top: 4px solid var(--q-primary);
}

.fila-webhook {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: #f2f4f7;
  border-radius: 8px;
  padding: 8px 12px;
}

.url-webhook {
  word-break: break-all;
  font-size: 0.8rem;
}
</style>
