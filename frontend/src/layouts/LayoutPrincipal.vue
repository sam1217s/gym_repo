<template>
  <q-layout view="hHh lpR fFf">
    <!-- Tinta con la banda de disco roja debajo: la firma visual de la marca. -->
    <q-header class="encabezado-marca bg-secondary text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="alternarMenu" />

        <!-- Titulo: el NEGOCIO manda (nombre del gimnasio); GymSaaS queda como
             ceja discreta. El super_admin ve la plataforma. -->
        <q-toolbar-title class="columna-titulo">
          <div class="ceja-marca">Gym Barichara · Panel</div>
          <div class="titulo-display titulo-negocio">{{ tituloNegocio }}</div>
        </q-toolbar-title>

        <!-- La identidad y el cierre de sesion se guardan tras el avatar: asi el
             header no se satura en movil. -->
        <q-btn flat round dense icon="account_circle" aria-label="Cuenta">
          <q-menu anchor="bottom right" self="top right">
            <div class="tarjeta-cuenta">
              <div class="text-weight-medium">{{ usuario?.nombreCompleto }}</div>
              <div class="text-caption text-grey-7">{{ usuario?.email }}</div>
              <q-badge outline color="primary" class="q-mt-xs">{{ etiquetaRol }}</q-badge>
            </div>
            <q-separator />
            <q-list>
              <q-item v-close-popup clickable @click="abrirDialogoTelefono">
                <q-item-section avatar>
                  <q-icon name="smartphone" color="primary" />
                </q-item-section>
                <q-item-section>Mi telefono</q-item-section>
              </q-item>
              <q-item v-close-popup clickable @click="cerrarSesion">
                <q-item-section avatar>
                  <q-icon name="logout" color="primary" />
                </q-item-section>
                <q-item-section>Cerrar sesion</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- En escritorio descansa minimizado (solo iconos) y se despliega al pasar
         el mouse; `mini-to-overlay` hace que se despliegue ENCIMA del panel, sin
         empujar el contenido. En movil sigue siendo un overlay normal. -->
    <q-drawer
      v-model="menuAbierto"
      show-if-above
      bordered
      mini-to-overlay
      :width="252"
      :mini="miniActivo"
      :mini-width="64"
      class="drawer-nav"
      @mouseenter="sobreMenu = true"
      @mouseleave="sobreMenu = false"
    >
      <q-list padding class="q-px-sm">
        <q-item-label v-if="!miniActivo" header class="etiqueta-nav">Navegacion</q-item-label>

        <q-item
          v-for="enlace in enlacesVisibles"
          :key="enlace.nombre"
          clickable
          :to="{ name: enlace.nombre }"
          exact
          class="enlace-nav q-mb-xs"
          active-class="enlace-activo"
          @click="alNavegar"
        >
          <q-item-section avatar class="relative-position">
            <q-icon :name="enlace.icono" />
            <q-badge v-if="pendientesDe(enlace.nombre) > 0" floating color="primary" rounded>
              {{ pendientesDe(enlace.nombre) }}
            </q-badge>
          </q-item-section>
          <q-item-section>{{ enlace.titulo }}</q-item-section>

          <!-- En modo mini (escritorio) el texto se oculta: el tooltip lo trae de vuelta. -->
          <q-tooltip v-if="miniActivo" anchor="center right" self="center left">
            {{ enlace.titulo }}
          </q-tooltip>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Cada usuario fija su propio telefono para poder entrar por codigo (OTP). -->
    <q-dialog v-model="dialogoTelefono">
      <q-card style="min-width: 320px; max-width: 92vw">
        <q-card-section class="q-pb-none">
          <div class="text-h6 titulo-display">Mi telefono</div>
          <div class="text-caption text-grey-7">
            Con el podras entrar con un codigo por SMS o WhatsApp.
          </div>
        </q-card-section>
        <q-form @submit.prevent="guardarTelefono">
          <q-card-section>
            <CampoTelefono v-model="telefonoNuevo" label="Tu telefono" />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Cerrar" :disable="guardandoTelefono" @click="dialogoTelefono = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              label="Guardar"
              :loading="guardandoTelefono"
              :disable="!telefonoNuevo"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed, onMounted, ref } from 'vue';

import CampoTelefono from 'src/components/CampoTelefono.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

const { usuario, cerrarSesion } = useAutenticacion();
const autenticacion = useAutenticacionStore();
const $q = useQuasar();
const gimnasio = useGimnasioStore();

// --- "Mi telefono": el usuario fija su propio numero para entrar por OTP ---
const dialogoTelefono = ref(false);
const telefonoNuevo = ref('');
const guardandoTelefono = ref(false);

function abrirDialogoTelefono() {
  telefonoNuevo.value = usuario.value?.telefono ?? '';
  dialogoTelefono.value = true;
}

async function guardarTelefono() {
  guardandoTelefono.value = true;
  try {
    await autenticacion.actualizarTelefono(telefonoNuevo.value);
    $q.notify({ type: 'positive', message: 'Telefono actualizado' });
    dialogoTelefono.value = false;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar el telefono',
    });
  } finally {
    guardandoTelefono.value = false;
  }
}

const menuAbierto = ref(false);

/**
 * En escritorio el drawer descansa minimizado (solo iconos) y se despliega solo
 * con pasar el mouse por encima. `mini` es el estado en REPOSO (lo fija el boton
 * hamburguesa o navegar a una opcion) y `sobreMenu` lo desplaza mientras el
 * puntero esta dentro. Nada de esto aplica en movil, donde el drawer es un
 * overlay que se abre y se cierra entero.
 *
 * Se usan mouseenter/mouseleave (no mouseover/mouseout) porque estos ultimos
 * vuelven a dispararse al pasar de un hijo a otro y el menu parpadearia.
 */
const mini = ref(true);
const sobreMenu = ref(false);
const miniActivo = computed(() => mini.value && !sobreMenu.value && $q.screen.gt.sm);

const ETIQUETAS_ROL = {
  [ROLES.TENANT_OWNER]: 'Dueno',
  [ROLES.SEDE_ADMIN]: 'Sede',
};

// Cada enlace declara que roles pueden verlo, igual que `meta.roles` en las rutas.
const ENLACES = [
  { nombre: 'panel', titulo: 'Inicio', icono: 'dashboard', roles: null },
  {
    nombre: 'miembros',
    titulo: 'Miembros',
    icono: 'groups',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'inventario',
    titulo: 'Inventario',
    icono: 'inventory_2',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'ventas',
    titulo: 'Ventas',
    icono: 'point_of_sale',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'maquinas',
    titulo: 'Maquinas',
    icono: 'fitness_center',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  {
    nombre: 'finanzas',
    titulo: 'Finanzas',
    icono: 'account_balance_wallet',
    roles: [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN],
  },
  { nombre: 'mensajes', titulo: 'Mensajes', icono: 'chat', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'reportes', titulo: 'Reportes', icono: 'report_problem', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'auditoria', titulo: 'Auditoria', icono: 'fact_check', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'sedes', titulo: 'Sedes', icono: 'store', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'equipo', titulo: 'Equipo', icono: 'badge', roles: [ROLES.TENANT_OWNER] },
  { nombre: 'planes', titulo: 'Planes', icono: 'sell', roles: [ROLES.TENANT_OWNER] },
];

const etiquetaRol = computed(() => ETIQUETAS_ROL[usuario.value?.rol] ?? '');

// El titulo del header es el nombre del NEGOCIO; si no llega, cae a Gym Barichara.
const tituloNegocio = computed(() => usuario.value?.tenantNombre || 'Gym Barichara');

const enlacesVisibles = computed(() =>
  ENLACES.filter((enlace) => !enlace.roles || enlace.roles.includes(usuario.value?.rol)),
);

// El boton hamburguesa: en movil abre/cierra el overlay; en escritorio FIJA el
// menu abierto (deja de recogerse al quitar el mouse) o lo devuelve al modo
// "se despliega al pasar por encima".
function alternarMenu() {
  if ($q.screen.lt.md) {
    menuAbierto.value = !menuAbierto.value;
  } else {
    mini.value = !mini.value;
  }
}

// Al elegir una opcion: en movil se cierra el overlay; en escritorio el menu se
// minimiza a solo iconos (con su tooltip), para dejarle mas espacio al panel.
function alNavegar() {
  if ($q.screen.lt.md) {
    menuAbierto.value = false;
  } else {
    mini.value = true;
  }
}

/** Contador del enlace: lo que esta sin atender. 0 = sin badge. */
function pendientesDe(nombre) {
  if (nombre === 'reportes') return gimnasio.reportesNoLeidos;
  if (nombre === 'mensajes') return gimnasio.mensajesPendientes;
  return 0;
}

// Los badges se cuentan al montar el panel; cada pagina los baja a 0 al abrirse.
// Reportes es solo del dueño; la bandeja la atiende tambien el encargado de sede.
// Reportes y bandeja de mensajes son SOLO del dueño.
onMounted(() => {
  if (usuario.value?.rol === ROLES.TENANT_OWNER) {
    gimnasio.contarReportesNoLeidos().catch(() => {});
    gimnasio.contarMensajesPendientes().catch(() => {});
  }
});
</script>

<style scoped>
.encabezado-marca {
  border-bottom: 3px solid var(--q-primary);
}

.columna-titulo {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.1;
  min-width: 0; /* deja que el nombre largo se recorte en vez de empujar */
}

.ceja-marca {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.65;
}

.titulo-negocio {
  font-size: 1.35rem;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tarjeta-cuenta {
  padding: 12px 16px;
  min-width: 200px;
  max-width: 260px;
}

.etiqueta-nav {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--q-secondary);
  opacity: 0.7;
}

/* Enlaces con forma de pastilla; el activo lleva la banda de disco roja. */
.enlace-nav {
  border-radius: 10px;
  min-height: 46px;
  color: var(--q-secondary);
}

.enlace-nav:hover {
  background: rgba(0, 0, 0, 0.04);
}

.enlace-activo {
  background: rgba(245, 197, 24, 0.18);
  color: var(--color-primario-texto);
  font-weight: 600;
}

.enlace-activo :deep(.q-icon) {
  color: var(--color-primario-texto);
}
</style>
