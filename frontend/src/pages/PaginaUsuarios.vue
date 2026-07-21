<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Equipo</h1>
        <div class="text-caption text-grey-7">Quien administra cada sede</div>
      </div>

      <q-btn
        color="primary"
        unelevated
        no-caps
        icon="person_add"
        label="Nuevo administrador de sede"
        @click="abrirCreacion"
      />
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.usuarios"
      :columns="columnasResponsivas"
      :pagination="{ rowsPerPage: 15 }"
      :hide-bottom="gimnasio.usuarios.length <= 15"
    >
      <template #body-cell-usuario="props">
        <q-td :props="props">
          <div class="text-weight-medium">{{ props.row.nombres }} {{ props.row.apellidos }}</div>
          <div class="text-caption text-grey-7">{{ props.row.email }}</div>
        </q-td>
      </template>

      <template #body-cell-rol="props">
        <q-td :props="props">
          <span
            class="chip-banda"
            :style="{ '--banda': props.row.rol === ROLES.TENANT_OWNER ? 'var(--q-info)' : '#667085' }"
          >
            {{ ETIQUETAS_ROL[props.row.rol] ?? props.row.rol }}
          </span>
        </q-td>
      </template>

      <template #body-cell-estado="props">
        <q-td :props="props">
          <span
            class="chip-banda"
            :style="{ '--banda': props.row.activo ? 'var(--q-positive)' : 'var(--q-negative)' }"
          >
            {{ props.row.activo ? 'Activo' : 'Desactivado' }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <template v-if="props.row.rol === ROLES.SEDE_ADMIN">
            <q-btn round flat dense color="grey-8" icon="edit" @click="abrirEdicion(props.row)">
              <q-tooltip>Editar</q-tooltip>
            </q-btn>
            <q-btn
              round
              flat
              dense
              :color="props.row.activo ? 'negative' : 'positive'"
              :icon="props.row.activo ? 'block' : 'check_circle'"
              @click="confirmarCambioActivo(props.row)"
            >
              <q-tooltip>{{ props.row.activo ? 'Desactivar' : 'Reactivar' }}</q-tooltip>
            </q-btn>
          </template>
          <span v-else class="text-grey-6">—</span>
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="dialogoAbierto">
      <q-card class="tarjeta-usuario">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">
            {{ editando ? 'Editar administrador' : 'Nuevo administrador de sede' }}
          </div>
          <div v-if="!editando" class="text-caption text-grey-7">
            Entra con la contraseña inicial y el sistema le exige cambiarla.
          </div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardar">
          <q-card-section class="q-gutter-y-sm">
            <div class="row q-col-gutter-md">
              <q-input
                v-model="formulario.nombres"
                class="col-6"
                label="Nombres"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
              <q-input
                v-model="formulario.apellidos"
                class="col-6"
                label="Apellidos"
                outlined
                dense
                :rules="[reglaObligatorio]"
              />
            </div>

            <q-input
              v-if="!editando"
              v-model="formulario.email"
              type="email"
              label="Correo electronico"
              outlined
              dense
              :rules="[reglaObligatorio, reglaEmail]"
            />

            <q-input
              v-if="!editando"
              v-model="formulario.cedula"
              label="Cedula (opcional)"
              hint="Podra entrar con su cedula ademas del correo"
              outlined
              dense
              :rules="[reglaCedulaOpcional]"
            />

            <q-input
              v-if="!editando"
              v-model="formulario.contrasenaInicial"
              :type="contrasenaVisible ? 'text' : 'password'"
              label="Contraseña inicial"
              outlined
              dense
              :rules="[reglaObligatorio, reglaContrasena]"
            >
              <template #append>
                <q-icon
                  :name="contrasenaVisible ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="contrasenaVisible = !contrasenaVisible"
                />
              </template>
            </q-input>

            <q-select
              v-model="formulario.sede"
              label="Sede a su cargo"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSede"
              :rules="[reglaObligatorio]"
            />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoAbierto = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              :label="editando ? 'Guardar cambios' : 'Crear administrador'"
              :loading="guardando"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, reactive, ref } from 'vue';

import { useColumnasResponsive } from 'src/composables/useColumnasResponsive.js';

import { ROLES } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Staff del gimnasio. Solo la ve el dueno; el backend ademas solo le deja
 * administrar `sede_admin` (a si mismo se administra por /auth).
 */

const gimnasio = useGimnasioStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);
const editando = ref(false);
const guardando = ref(false);
const contrasenaVisible = ref(false);
const usuarioActivo = ref(null);

const ETIQUETAS_ROL = {
  [ROLES.TENANT_OWNER]: 'Dueño',
  [ROLES.SEDE_ADMIN]: 'Admin de sede',
};

const COLUMNAS = [
  { name: 'usuario', label: 'Usuario', field: 'nombres', align: 'left', sortable: true },
  { name: 'rol', label: 'Rol', field: 'rol', align: 'left', sortable: true },
  { name: 'sede', label: 'Sede', field: (fila) => nombreSede(fila.sede), align: 'left' },
  { name: 'estado', label: 'Estado', field: 'activo', align: 'left', sortable: true },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

// En movil, la columna de acciones va primero (ver el composable).
const columnasResponsivas = useColumnasResponsive(COLUMNAS);

const opcionesSede = computed(() =>
  gimnasio.sedes
    .filter((sede) => sede.activa)
    .map((sede) => ({ label: sede.nombre, value: sede._id })),
);

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaEmail = (valor) => /.+@.+\..+/.test(valor) || 'Email invalido';
// Vacia es válida (opcional); si viene, debe ser numérica.
const reglaCedulaOpcional = (valor) =>
  !String(valor ?? '').trim() || /^\d{4,15}$/.test(valor) || 'Cedula numerica (4 a 15 digitos)';
const reglaContrasena = (valor) =>
  (valor.length >= 8 && /[a-z]/.test(valor) && /[A-Z]/.test(valor) && /\d/.test(valor)) ||
  'Minimo 8 caracteres, con mayuscula, minuscula y numero';

const formulario = reactive({
  nombres: '',
  apellidos: '',
  email: '',
  cedula: '',
  contrasenaInicial: '',
  sede: null,
});

function nombreSede(sedeId) {
  if (!sedeId) return 'Todas';
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? '—';
}

function abrirCreacion() {
  editando.value = false;
  usuarioActivo.value = null;
  contrasenaVisible.value = false;
  Object.assign(formulario, { nombres: '', apellidos: '', email: '', cedula: '', contrasenaInicial: '', sede: null });
  dialogoAbierto.value = true;
}

function abrirEdicion(usuario) {
  editando.value = true;
  usuarioActivo.value = usuario;
  Object.assign(formulario, {
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    email: usuario.email,
    contrasenaInicial: '',
    sede: usuario.sede,
  });
  dialogoAbierto.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    if (editando.value) {
      await gimnasio.actualizarUsuario(usuarioActivo.value._id, {
        nombres: formulario.nombres,
        apellidos: formulario.apellidos,
        sede: formulario.sede,
      });
      quasar.notify({ type: 'positive', message: 'Administrador actualizado' });
    } else {
      await gimnasio.crearUsuario({
        nombres: formulario.nombres,
        apellidos: formulario.apellidos,
        email: formulario.email,
        // Solo se manda si la escribieron; el backend la trata como opcional.
        ...(formulario.cedula.trim() ? { cedula: formulario.cedula.trim() } : {}),
        contrasenaInicial: formulario.contrasenaInicial,
        sede: formulario.sede,
      });
      quasar.notify({
        type: 'positive',
        message: 'Administrador creado',
        caption: 'Deberá cambiar su contraseña al entrar',
      });
    }

    dialogoAbierto.value = false;
  } catch (error) {
    quasar.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar el usuario',
    });
  } finally {
    guardando.value = false;
  }
}

function confirmarCambioActivo(usuario) {
  const desactivar = usuario.activo;

  quasar
    .dialog({
      title: `${desactivar ? 'Desactivar' : 'Reactivar'} a ${usuario.nombres}`,
      message: desactivar
        ? 'Pierde el acceso de inmediato, incluida la sesion que tenga abierta.'
        : 'Recupera el acceso con su misma contraseña.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: {
        color: desactivar ? 'negative' : 'positive',
        unelevated: true,
        noCaps: true,
        label: desactivar ? 'Desactivar' : 'Reactivar',
      },
    })
    .onOk(async () => {
      try {
        await gimnasio.actualizarUsuario(usuario._id, { activo: !desactivar });
        quasar.notify({
          type: 'positive',
          message: `${usuario.nombres} ${desactivar ? 'desactivado' : 'reactivado'}`,
        });
      } catch (error) {
        quasar.notify({
          type: 'negative',
          message: error.response?.data?.error?.mensaje ?? 'No se pudo completar la operacion',
        });
      }
    });
}

onMounted(async () => {
  try {
    await Promise.all([gimnasio.cargarUsuarios(), gimnasio.cargarSedes()]);
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar el equipo' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.tarjeta-usuario {
  width: 100%;
  max-width: 480px;
  border-top: 4px solid var(--q-primary);
}
</style>
