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

        <template v-for="entrada in menuVisible" :key="entrada.clave">
          <!-- Enlace directo (Inicio, Finanzas, o un grupo al que le queda una sola opcion) -->
          <q-item
            v-if="entrada.tipo === 'enlace'"
            clickable
            :to="{ name: entrada.nombre }"
            exact
            class="enlace-nav q-mb-xs"
            active-class="enlace-activo"
            @click="alNavegar"
          >
            <q-item-section avatar class="relative-position">
              <q-icon :name="entrada.icono" />
              <q-badge v-if="pendientesDe(entrada.nombre) > 0" floating color="primary" rounded>
                {{ pendientesDe(entrada.nombre) }}
              </q-badge>
            </q-item-section>
            <q-item-section>{{ entrada.titulo }}</q-item-section>
            <!-- En modo mini (escritorio) el texto se oculta: el tooltip lo trae de vuelta. -->
            <q-tooltip v-if="miniActivo" anchor="center right" self="center left">
              {{ entrada.titulo }}
            </q-tooltip>
          </q-item>

          <!-- Grupo en modo mini: solo su icono (al pasar el mouse el menu se despliega). -->
          <q-item
            v-else-if="miniActivo"
            :class="['enlace-nav', 'q-mb-xs', { 'enlace-activo': grupoActivo(entrada) }]"
          >
            <q-item-section avatar class="relative-position">
              <q-icon :name="entrada.icono" />
              <q-badge v-if="pendientesDeGrupo(entrada) > 0" floating color="primary" rounded>
                {{ pendientesDeGrupo(entrada) }}
              </q-badge>
            </q-item-section>
          </q-item>

          <!-- Grupo desplegable: la categoria y, dentro, sus opciones. -->
          <q-expansion-item
            v-else
            v-model="gruposAbiertos[entrada.id]"
            :header-class="['enlace-nav', 'cabecera-grupo', { 'grupo-activo': grupoActivo(entrada) }]"
            class="q-mb-xs"
            expand-icon-class="icono-desplegar"
          >
            <template #header>
              <q-item-section avatar class="relative-position">
                <q-icon :name="entrada.icono" />
                <!-- Cerrado, el grupo muestra la suma de lo pendiente de sus opciones. -->
                <q-badge
                  v-if="!gruposAbiertos[entrada.id] && pendientesDeGrupo(entrada) > 0"
                  floating
                  color="primary"
                  rounded
                >
                  {{ pendientesDeGrupo(entrada) }}
                </q-badge>
              </q-item-section>
              <q-item-section>{{ entrada.titulo }}</q-item-section>
            </template>

            <div class="hijos-grupo">
              <q-item
                v-for="hijo in entrada.hijos"
                :key="hijo.nombre"
                clickable
                dense
                :to="{ name: hijo.nombre }"
                exact
                class="enlace-nav enlace-hijo"
                active-class="enlace-activo"
                @click="alNavegar"
              >
                <q-item-section avatar class="avatar-hijo">
                  <q-icon :name="hijo.icono" size="20px" />
                </q-item-section>
                <q-item-section>{{ hijo.titulo }}</q-item-section>
                <q-item-section v-if="pendientesDe(hijo.nombre) > 0" side>
                  <q-badge color="primary" rounded>{{ pendientesDe(hijo.nombre) }}</q-badge>
                </q-item-section>
              </q-item>
            </div>
          </q-expansion-item>
        </template>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import CampoTelefono from 'src/components/CampoTelefono.vue';
import { useAutenticacion } from 'src/composables/useAutenticacion.js';
import { ROLES, useAutenticacionStore } from 'src/stores/autenticacion.js';
import { comprobarSesion } from 'src/servicios/auth.servicio.js';
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

// El menu se agrupa por categorias para que sea corto. Cada opcion declara que
// roles pueden verla, igual que `meta.roles` en las rutas.
const DUENO = [ROLES.TENANT_OWNER];
const PERSONAL = [ROLES.TENANT_OWNER, ROLES.SEDE_ADMIN];

const MENU = [
  { tipo: 'enlace', nombre: 'panel', titulo: 'Inicio', icono: 'dashboard', roles: null },
  {
    tipo: 'grupo',
    id: 'miembros',
    titulo: 'Miembros',
    icono: 'groups',
    hijos: [
      { nombre: 'miembros', titulo: 'Miembros', icono: 'groups', roles: PERSONAL },
      { nombre: 'mensajes', titulo: 'Mensajes', icono: 'chat', roles: DUENO },
      { nombre: 'planes', titulo: 'Planes', icono: 'sell', roles: DUENO },
    ],
  },
  // La pantalla de la puerta (/acceso) no va en el menu: vive en el PC de la puerta,
  // en la ventana "GymBarichara Puerta" que deja el instalador.
  { tipo: 'enlace', nombre: 'entradas', titulo: 'Entradas', icono: 'login', roles: PERSONAL },
  {
    tipo: 'grupo',
    id: 'tienda',
    titulo: 'Tienda',
    icono: 'storefront',
    hijos: [
      { nombre: 'inventario', titulo: 'Inventario', icono: 'inventory_2', roles: PERSONAL },
      { nombre: 'ventas', titulo: 'Ventas', icono: 'point_of_sale', roles: PERSONAL },
    ],
  },
  {
    tipo: 'grupo',
    id: 'gimnasio',
    titulo: 'Gimnasio',
    icono: 'sports_gymnastics',
    hijos: [
      { nombre: 'maquinas', titulo: 'Máquinas', icono: 'fitness_center', roles: PERSONAL },
      { nombre: 'reportes', titulo: 'Reportes', icono: 'report_problem', roles: DUENO },
    ],
  },
  { tipo: 'enlace', nombre: 'finanzas', titulo: 'Finanzas', icono: 'account_balance_wallet', roles: PERSONAL },
  {
    tipo: 'grupo',
    id: 'administracion',
    titulo: 'Administración',
    icono: 'admin_panel_settings',
    hijos: [
      { nombre: 'sedes', titulo: 'Sedes', icono: 'store', roles: DUENO },
      { nombre: 'equipo', titulo: 'Equipo', icono: 'badge', roles: DUENO },
      { nombre: 'auditoria', titulo: 'Auditoría', icono: 'fact_check', roles: DUENO },
    ],
  },
];

const puedeVer = (opcion) => !opcion.roles || opcion.roles.includes(usuario.value?.rol);

/**
 * El menu que ve el usuario segun su rol. Un grupo sin opciones visibles
 * desaparece; uno al que le queda UNA sola se muestra como enlace directo (un
 * desplegable con un unico hijo es un clic de mas).
 */
const menuVisible = computed(() =>
  MENU.flatMap((entrada) => {
    if (entrada.tipo === 'enlace') return puedeVer(entrada) ? [{ ...entrada, clave: entrada.nombre }] : [];
    const hijos = entrada.hijos.filter(puedeVer);
    if (hijos.length === 0) return [];
    if (hijos.length === 1) return [{ ...hijos[0], tipo: 'enlace', clave: hijos[0].nombre }];
    return [{ ...entrada, hijos, clave: entrada.id }];
  }),
);

// El grupo de la pagina actual se abre solo (al entrar y al navegar).
const ruta = useRoute();
const gruposAbiertos = ref({});
const grupoActivo = (grupo) => grupo.hijos.some((hijo) => hijo.nombre === ruta.name);
watch(
  () => ruta.name,
  () => {
    for (const entrada of menuVisible.value) {
      if (entrada.tipo === 'grupo' && grupoActivo(entrada)) gruposAbiertos.value[entrada.id] = true;
    }
  },
  { immediate: true },
);

const etiquetaRol = computed(() => ETIQUETAS_ROL[usuario.value?.rol] ?? '');

// El titulo del header es el nombre del NEGOCIO; si no llega, cae a Gym Barichara.
const tituloNegocio = computed(() => usuario.value?.tenantNombre || 'Gym Barichara');

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

/** Lo pendiente de todas las opciones de un grupo (se ve aunque este cerrado). */
function pendientesDeGrupo(grupo) {
  return grupo.hijos.reduce((total, hijo) => total + pendientesDe(hijo.nombre), 0);
}

// Los badges se cuentan al montar el panel; cada pagina los baja a 0 al abrirse.
// Reportes es solo del dueño; la bandeja la atiende tambien el encargado de sede.
// Reportes y bandeja de mensajes son SOLO del dueño.
// Cada 30 s (con la pestana visible) se comprueba que la sesion siga viva: si
// alguien mas entro con esta cuenta, el aviso aparece sin esperar a un clic.
const MS_COMPROBAR_SESION = 30_000;
let temporizadorSesion = null;
onMounted(() => {
  temporizadorSesion = setInterval(() => {
    if (!document.hidden) comprobarSesion().catch(() => {});
  }, MS_COMPROBAR_SESION);
});
onBeforeUnmount(() => clearInterval(temporizadorSesion));

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

/* Grupos: la cabecera se ve como un enlace; si contiene la pagina actual, se
   marca con el texto en negrita (el fondo dorado queda para la opcion activa). */
:deep(.cabecera-grupo) {
  min-height: 46px;
  padding-left: 16px;
  padding-right: 8px;
}
:deep(.grupo-activo) {
  font-weight: 700;
}
:deep(.icono-desplegar) {
  color: var(--q-secondary);
  opacity: 0.55;
}
/* Las opciones de un grupo cuelgan de una linea guia, un poco hacia adentro. */
.hijos-grupo {
  margin: 2px 0 6px 27px;
  padding-left: 8px;
  border-left: 2px solid rgba(27, 30, 36, 0.12);
}
.enlace-hijo {
  min-height: 38px;
  margin-bottom: 2px;
  font-size: 0.92rem;
}
.avatar-hijo {
  min-width: 34px;
}
</style>
