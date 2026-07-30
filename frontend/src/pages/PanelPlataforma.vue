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
      :columns="columnasResponsivas"
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
          <q-btn round flat dense color="secondary" icon="edit" @click="abrirEdicion(props.row)">
            <q-tooltip>Editar datos del gimnasio</q-tooltip>
          </q-btn>
          <q-btn
            v-if="props.row.estado !== ESTADOS_GIMNASIO.CANCELADO"
            round
            flat
            dense
            color="primary"
            icon="credit_card"
            @click="abrirCobros(props.row)"
          >
            <q-tooltip>Configurar cobro en línea (Wompi)</q-tooltip>
          </q-btn>
          <q-btn
            v-if="props.row.estado !== ESTADOS_GIMNASIO.CANCELADO"
            round
            flat
            dense
            color="positive"
            icon="chat"
            @click="abrirWhatsapp(props.row)"
          >
            <q-tooltip>Configurar avisos por WhatsApp</q-tooltip>
          </q-btn>
          <q-btn
            v-if="puedeSuspender(props.row)"
            round
            flat
            dense
            color="warning"
            icon="pause_circle"
            @click="confirmarSuspension(props.row)"
          >
            <q-tooltip>Suspender</q-tooltip>
          </q-btn>
          <q-btn
            v-if="props.row.estado === ESTADOS_GIMNASIO.SUSPENDIDO"
            round
            flat
            dense
            color="positive"
            icon="play_circle"
            @click="confirmarReactivacion(props.row)"
          >
            <q-tooltip>Reactivar</q-tooltip>
          </q-btn>
          <q-btn
            v-if="props.row.estado !== ESTADOS_GIMNASIO.CANCELADO"
            round
            flat
            dense
            color="negative"
            icon="cancel"
            @click="confirmarCancelacion(props.row)"
          >
            <q-tooltip>Cancelar (definitivo)</q-tooltip>
          </q-btn>
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

    <!-- Canal de WhatsApp del gimnasio (avisos de vencimiento) -->
    <q-dialog v-model="dialogoWhatsapp">
      <q-card class="tarjeta-cobros">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">WhatsApp — {{ whatsapp.gimnasio?.nombre }}</div>
          <div class="text-caption text-grey-7">
            Con esto salen los avisos de vencimiento a los miembros
          </div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardarWhatsapp">
          <q-card-section class="q-gutter-y-md">
            <span
              class="chip-banda"
              :style="{ '--banda': whatsapp.config.configurado ? 'var(--q-positive)' : 'var(--q-warning)' }"
            >
              {{ whatsapp.config.configurado ? 'Avisos activos' : 'Sin configurar' }}
            </span>

            <q-select
              v-model="whatsapp.formulario.proveedor"
              label="Proveedor"
              outlined
              dense
              emit-value
              map-options
              :options="OPCIONES_PROVEEDOR"
            />

            <template v-if="whatsapp.formulario.proveedor === 'cloud_api'">
              <q-input
                v-model="whatsapp.formulario.idTelefono"
                label="Phone number ID"
                hint="El ID del numero en Meta (no el telefono)"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
              <q-input
                v-model="whatsapp.formulario.token"
                :type="whatsapp.verToken ? 'text' : 'password'"
                label="Token permanente"
                :hint="
                  whatsapp.config.configurado
                    ? 'Ya hay uno guardado. Dejalo vacio para conservarlo.'
                    : 'Se guarda en el servidor y no se vuelve a mostrar'
                "
                outlined
                dense
                :rules="whatsapp.config.configurado ? [] : [reglaObligatorio]"
              >
                <template #append>
                  <q-icon
                    :name="whatsapp.verToken ? 'visibility_off' : 'visibility'"
                    class="cursor-pointer"
                    @click="whatsapp.verToken = !whatsapp.verToken"
                  />
                </template>
              </q-input>

              <div class="aviso-plantilla">
                Este gimnasio debe tener aprobada en SU cuenta de Meta la plantilla
                <strong>{{ whatsapp.config.plantilla?.nombre }}</strong>
                ({{ whatsapp.config.plantilla?.idioma }}) con 3 variables: nombre, gimnasio y fecha.
              </div>

              <!-- Recibir es una configuracion aparte de enviar: sin el secreto
                   de la app no se puede verificar la firma de Meta, y sin firma
                   no se acepta ningun mensaje entrante. -->
              <q-separator />
              <div class="row items-center q-gutter-sm">
                <span class="text-weight-medium">Bandeja de entrada</span>
                <span
                  class="chip-banda"
                  :style="{
                    '--banda': whatsapp.config.recibeMensajes
                      ? 'var(--q-positive)'
                      : 'var(--q-warning)',
                  }"
                >
                  {{ whatsapp.config.recibeMensajes ? 'Recibe mensajes' : 'No recibe' }}
                </span>
              </div>

              <q-input
                v-model="whatsapp.formulario.secretoApp"
                type="password"
                label="Clave secreta de la app (App Secret)"
                :hint="
                  whatsapp.config.recibeMensajes
                    ? 'Ya hay una guardada. Dejala vacia para conservarla.'
                    : 'Meta > Configuracion de la app > Basica. Sin esto no se reciben mensajes.'
                "
                outlined
                dense
              />

              <q-input
                :model-value="whatsapp.config.urlWebhookEntrante"
                label="URL de devolucion de llamada"
                hint="Pegala en Meta > WhatsApp > Configuracion > Webhooks"
                outlined
                dense
                readonly
              />
              <q-input
                :model-value="whatsapp.config.tokenVerificacion"
                label="Token de verificacion"
                hint="El mismo campo de Meta, junto a la URL"
                outlined
                dense
                readonly
              />
            </template>

            <q-input
              v-else-if="whatsapp.formulario.proveedor === 'n8n'"
              v-model="whatsapp.formulario.urlWebhook"
              label="URL del webhook de n8n"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />

            <div v-else class="text-caption text-grey-7">
              Con "ninguno" el gimnasio no envia avisos por WhatsApp.
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Cerrar" :disable="whatsapp.guardando" @click="dialogoWhatsapp = false" />
            <q-btn type="submit" color="primary" unelevated no-caps label="Guardar" :loading="whatsapp.guardando" />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <!-- Editar datos basicos del gimnasio (no el estado ni los secretos) -->
    <q-dialog v-model="dialogoEdicion">
      <q-card class="tarjeta-cobros">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Editar gimnasio</div>
          <div class="text-caption text-grey-7">
            Nombre, NIT, identificador y plan. El estado se cambia con los otros botones.
          </div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardarEdicion">
          <q-card-section class="q-gutter-y-md">
            <q-input
              v-model="edicion.nombre"
              label="Nombre del gimnasio"
              outlined
              dense
              :rules="[reglaObligatorio]"
            />
            <q-input v-model="edicion.nit" label="NIT" outlined dense :rules="[reglaObligatorio]" />
            <q-input
              v-model="edicion.slug"
              label="Identificador (slug)"
              hint="Con el que sus usuarios eligen gimnasio al entrar. Solo minusculas, numeros y guiones."
              outlined
              dense
              :rules="[reglaObligatorio, reglaSlug]"
            />
            <q-select
              v-model="edicion.planPlataforma"
              label="Plan de plataforma"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesPlanEdicion"
              :rules="[reglaObligatorio]"
            />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Cerrar" :disable="edicion.guardando" @click="dialogoEdicion = false" />
            <q-btn type="submit" color="primary" unelevated no-caps label="Guardar cambios" :loading="edicion.guardando" />
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
import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';
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

// En movil, la columna de acciones va primero (ver el composable).
const columnasResponsivas = useColumnasResponsive(COLUMNAS);

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

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaSlug = (valor) =>
  /^[a-z0-9-]+$/.test(String(valor ?? '')) || 'Solo minusculas, numeros y guiones';

// --- Editar datos del gimnasio ----------------------------------------------

const dialogoEdicion = ref(false);
const edicion = reactive({
  id: null,
  nombre: '',
  nit: '',
  slug: '',
  planPlataforma: null,
  guardando: false,
});

// Todos los planes (incluidos archivados) para no perder el que ya tiene el gym.
const opcionesPlanEdicion = computed(() =>
  plataforma.planes.map((plan) => ({
    label: `${plan.nombre}${plan.activo ? '' : ' (archivado)'}`,
    value: plan._id,
  })),
);

function abrirEdicion(gimnasio) {
  edicion.id = gimnasio._id;
  edicion.nombre = gimnasio.nombre;
  edicion.nit = gimnasio.nit;
  edicion.slug = gimnasio.slug;
  edicion.planPlataforma = gimnasio.planPlataforma?._id ?? gimnasio.planPlataforma ?? null;
  dialogoEdicion.value = true;
  if (plataforma.planes.length === 0) plataforma.cargarPlanes().catch(() => {});
}

async function guardarEdicion() {
  edicion.guardando = true;
  try {
    await plataforma.actualizarGimnasio(edicion.id, {
      nombre: edicion.nombre,
      nit: edicion.nit,
      slug: edicion.slug,
      planPlataforma: edicion.planPlataforma,
    });
    quasar.notify({ type: 'positive', message: 'Gimnasio actualizado' });
    dialogoEdicion.value = false;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo actualizar el gimnasio',
    });
  } finally {
    edicion.guardando = false;
  }
}

// --- Cobro en linea del gimnasio (llaves Wompi) -----------------------------

const dialogoCobros = ref(false);

const cobros = reactive({
  gimnasio: null,
  config: { configurado: false, llavePublica: null, urlWebhook: '' },
  formulario: { llavePublica: '', secretoIntegridad: '', secretoEventos: '' },
  verSecretos: false,
  guardando: false,
});

// --- Canal de WhatsApp del gimnasio -------------------------------------------

// `baileys` no se ofrece: no esta implementado y dejaria el canal roto.
const OPCIONES_PROVEEDOR = [
  { label: 'Ninguno (sin avisos)', value: 'ninguno' },
  { label: 'WhatsApp Cloud API (Meta)', value: 'cloud_api' },
  { label: 'n8n (webhook propio)', value: 'n8n' },
];

const dialogoWhatsapp = ref(false);

const CONFIG_VACIA = {
  proveedor: 'ninguno',
  configurado: false,
  idTelefono: null,
  plantilla: null,
  recibeMensajes: false,
  urlWebhookEntrante: '',
  tokenVerificacion: '',
};
const FORMULARIO_VACIO = {
  proveedor: 'ninguno',
  idTelefono: '',
  token: '',
  secretoApp: '',
  urlWebhook: '',
};

const whatsapp = reactive({
  gimnasio: null,
  config: { ...CONFIG_VACIA },
  formulario: { ...FORMULARIO_VACIO },
  verToken: false,
  guardando: false,
});

async function abrirWhatsapp(gimnasio) {
  whatsapp.gimnasio = gimnasio;
  whatsapp.formulario = { ...FORMULARIO_VACIO };
  whatsapp.verToken = false;
  whatsapp.config = { ...CONFIG_VACIA };
  dialogoWhatsapp.value = true;

  try {
    whatsapp.config = await servicioPlataforma.obtenerWhatsapp(gimnasio._id);
    // El token es secreto y no vuelve: se deja vacio y hay que reescribirlo si
    // se cambia algo. Lo demas son identificadores y se prellenan.
    whatsapp.formulario.proveedor = whatsapp.config.proveedor;
    whatsapp.formulario.idTelefono = whatsapp.config.idTelefono ?? '';
    whatsapp.formulario.urlWebhook = whatsapp.config.urlWebhook ?? '';
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar la configuracion de WhatsApp' });
  }
}

async function guardarWhatsapp() {
  whatsapp.guardando = true;
  try {
    const { proveedor, idTelefono, token, secretoApp, urlWebhook } = whatsapp.formulario;
    // Los secretos vacios NO se mandan: el backend conserva los que ya tiene.
    const datos =
      proveedor === 'cloud_api'
        ? {
            proveedor,
            idTelefono,
            ...(token ? { token } : {}),
            ...(secretoApp ? { secretoApp } : {}),
          }
        : proveedor === 'n8n'
          ? { proveedor, urlWebhook }
          : { proveedor };

    whatsapp.config = await servicioPlataforma.guardarWhatsapp(whatsapp.gimnasio._id, datos);
    whatsapp.formulario.token = '';
    whatsapp.formulario.secretoApp = '';
    quasar.notify({ type: 'positive', message: 'WhatsApp configurado' });
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar',
    });
  } finally {
    whatsapp.guardando = false;
  }
}

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
  max-width: 1400px;
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

.aviso-plantilla {
  font-size: 0.8rem;
  line-height: 1.45;
  color: #7a5b12;
  background: #fff8ec;
  border-left: 3px solid var(--q-warning);
  border-radius: 4px;
  padding: 8px 12px;
}
</style>
