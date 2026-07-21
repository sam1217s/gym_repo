<template>
  <q-page padding class="pagina-panel">
    <div class="row items-end justify-between q-mb-lg">
      <div>
        <div class="ceja">Mi gimnasio</div>
        <h1 class="titulo-display titulo-pagina q-my-none">Inventario</h1>
        <div class="text-caption text-grey-7">Productos y existencias, por sede</div>
      </div>

      <div class="row q-gutter-sm">
        <q-btn color="primary" outline no-caps icon="point_of_sale" label="Vender producto" @click="abrirVenta" />
        <q-btn color="primary" unelevated no-caps icon="add" label="Nuevo producto" @click="abrirCreacion" />
      </div>
    </div>

    <q-table
      flat
      bordered
      row-key="_id"
      :rows="gimnasio.inventario"
      :columns="columnasResponsivas"
      :pagination="{ rowsPerPage: 20 }"
      :hide-bottom="gimnasio.inventario.length <= 20"
      no-data-label="Aun no hay productos. Agrega el primero."
    >
      <template #body-cell-cantidad="props">
        <q-td :props="props" class="text-right">
          <span class="chip-banda cifra-tabular" :style="{ '--banda': props.row.cantidad === 0 ? 'var(--q-negative)' : 'var(--q-positive)' }">
            {{ props.row.cantidad }}
          </span>
        </q-td>
      </template>

      <template #body-cell-acciones="props">
        <q-td :props="props" class="text-right">
          <q-btn round flat dense color="primary" icon="point_of_sale" :disable="props.row.cantidad === 0" @click="vender(props.row)">
            <q-tooltip>{{ props.row.cantidad === 0 ? 'Sin existencias' : 'Vender' }}</q-tooltip>
          </q-btn>
          <q-btn round flat dense color="positive" icon="add_circle" @click="ajustar(props.row, 1)">
            <q-tooltip>Entrada de stock</q-tooltip>
          </q-btn>
          <q-btn round flat dense color="warning" icon="remove_circle" @click="ajustar(props.row, -1)">
            <q-tooltip>Salida (merma o ajuste)</q-tooltip>
          </q-btn>
          <q-btn round flat dense color="grey-8" icon="edit" @click="abrirEdicion(props.row)">
            <q-tooltip>Editar</q-tooltip>
          </q-btn>
          <q-btn round flat dense color="negative" icon="archive" @click="confirmarArchivado(props.row)">
            <q-tooltip>Archivar</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Venta desde buscador: encuentra el producto por nombre y lo vende. -->
    <q-dialog v-model="dialogoVenta">
      <q-card class="tarjeta-producto">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">Vender producto</div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="confirmarVenta">
          <q-card-section class="q-gutter-y-md">
            <q-select
              v-model="ventaProducto"
              label="Buscar producto"
              hint="Escribe para filtrar por nombre"
              outlined
              dense
              use-input
              input-debounce="0"
              :options="opcionesVenta"
              option-label="nombre"
              :rules="[(v) => !!v || 'Elige un producto']"
              @filter="filtrarProductos"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.nombre }}</q-item-label>
                    <q-item-label caption>
                      {{ nombreSede(scope.opt.sede) }} · {{ scope.opt.cantidad }} en stock
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side class="cifra-tabular">
                    ${{ FORMATO_PESOS.format(scope.opt.precio) }}
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-grey">Sin productos con existencias</q-item-section>
                </q-item>
              </template>
            </q-select>

            <div v-if="ventaProducto" class="resumen-venta q-gutter-y-sm">
              <div class="text-caption text-grey-7">
                {{ nombreSede(ventaProducto.sede) }} · {{ ventaProducto.cantidad }} disponibles ·
                ${{ FORMATO_PESOS.format(ventaProducto.precio) }} c/u
              </div>
              <q-input
                v-model.number="ventaCantidad"
                type="number"
                label="Cantidad a vender"
                outlined
                dense
                autofocus
                :rules="[reglaCantidadVenta]"
              />
              <div class="total-venta">
                Total: <span class="cifra-tabular">${{ FORMATO_PESOS.format(totalVenta) }}</span>
              </div>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="vendiendo" @click="dialogoVenta = false" />
            <q-btn
              type="submit"
              color="primary"
              unelevated
              no-caps
              label="Registrar venta"
              :loading="vendiendo"
              :disable="!ventaProducto"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <q-dialog v-model="dialogoAbierto">
      <q-card class="tarjeta-producto">
        <q-card-section class="q-pb-sm">
          <div class="text-h6 titulo-display">{{ editando ? 'Editar producto' : 'Nuevo producto' }}</div>
        </q-card-section>

        <q-separator />

        <q-form @submit.prevent="guardar">
          <q-card-section class="q-gutter-y-md">
            <q-input v-model="formulario.nombre" label="Nombre del producto" outlined dense :rules="[reglaObligatorio]" />

            <q-select
              v-if="!editando && sedesVisibles"
              v-model="formulario.sede"
              label="Sede"
              outlined
              dense
              emit-value
              map-options
              :options="opcionesSede"
              :rules="[reglaObligatorio]"
            />

            <div class="row q-col-gutter-md">
              <q-input
                v-if="!editando"
                v-model.number="formulario.cantidad"
                class="col-6"
                type="number"
                label="Existencias iniciales"
                outlined
                dense
              />
              <q-input
                v-model.number="formulario.precio"
                :class="editando ? 'col-12' : 'col-6'"
                type="number"
                label="Precio de venta"
                prefix="$"
                outlined
                dense
                :rules="[reglaPrecio]"
              />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right" class="q-pa-md">
            <q-btn flat no-caps label="Descartar" :disable="guardando" @click="dialogoAbierto = false" />
            <q-btn type="submit" color="primary" unelevated no-caps :label="editando ? 'Guardar' : 'Crear'" :loading="guardando" />
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
import { useAutenticacionStore } from 'src/stores/autenticacion.js';
import { useGimnasioStore } from 'src/stores/gimnasio.js';

/**
 * Inventario del gimnasio, por sede. El backend acota por sede segun el rol:
 * un sede_admin solo ve y toca lo de la suya, asi que aqui no hay que filtrar.
 */

const gimnasio = useGimnasioStore();
const autenticacion = useAutenticacionStore();
const quasar = useQuasar();

const dialogoAbierto = ref(false);
const editando = ref(false);
const guardando = ref(false);
const productoActivo = ref(null);

// Venta desde el buscador.
const dialogoVenta = ref(false);
const ventaProducto = ref(null);
const ventaCantidad = ref(1);
const vendiendo = ref(false);
const opcionesVenta = ref([]);

const FORMATO_PESOS = new Intl.NumberFormat('es-CO');

// El dueno elige sede; al sede_admin se la fuerza el backend, asi no la muestra.
const sedesVisibles = computed(() => autenticacion.usuario?.rol === ROLES.TENANT_OWNER);

function nombreSede(sedeId) {
  return gimnasio.sedes.find((sede) => sede._id === sedeId)?.nombre ?? '—';
}

const COLUMNAS = [
  { name: 'nombre', label: 'Producto', field: 'nombre', align: 'left', sortable: true },
  { name: 'sede', label: 'Sede', field: (fila) => nombreSede(fila.sede), align: 'left' },
  { name: 'cantidad', label: 'Existencias', field: 'cantidad', align: 'right', sortable: true },
  {
    name: 'precio',
    label: 'Precio',
    field: 'precio',
    align: 'right',
    format: (valor) => `$${FORMATO_PESOS.format(valor ?? 0)}`,
    classes: 'cifra-tabular',
  },
  { name: 'acciones', label: '', field: '_id', align: 'right' },
];

const columnasResponsivas = useColumnasResponsive(COLUMNAS);

const opcionesSede = computed(() =>
  gimnasio.sedes.filter((sede) => sede.activa).map((sede) => ({ label: sede.nombre, value: sede._id })),
);

const reglaObligatorio = (valor) => Boolean(String(valor ?? '').trim()) || 'Este campo es obligatorio';
const reglaPrecio = (valor) => (Number(valor) >= 0 && valor !== null && valor !== '') || 'Indica el precio de venta';

// --- Venta desde el buscador ---------------------------------------------------

// Solo se puede vender lo que tiene existencias.
const productosVendibles = computed(() => gimnasio.inventario.filter((p) => p.cantidad > 0));

const totalVenta = computed(() =>
  ventaProducto.value ? ventaProducto.value.precio * (ventaCantidad.value || 0) : 0,
);

const reglaCantidadVenta = (valor) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) return 'Cantidad invalida';
  if (ventaProducto.value && n > ventaProducto.value.cantidad) {
    return `Solo hay ${ventaProducto.value.cantidad} en existencia`;
  }
  return true;
};

/** Filtro del q-select: acota por nombre a medida que se escribe. */
function filtrarProductos(texto, update) {
  update(() => {
    const needle = texto.toLowerCase();
    opcionesVenta.value = productosVendibles.value.filter((p) =>
      p.nombre.toLowerCase().includes(needle),
    );
  });
}

function abrirVenta() {
  ventaProducto.value = null;
  ventaCantidad.value = 1;
  opcionesVenta.value = productosVendibles.value;
  dialogoVenta.value = true;
}

async function confirmarVenta() {
  if (!ventaProducto.value) return;
  vendiendo.value = true;
  try {
    const cantidad = Math.floor(Number(ventaCantidad.value));
    await gimnasio.registrarVenta(ventaProducto.value._id, cantidad);
    quasar.notify({
      type: 'positive',
      message: `Venta registrada: ${cantidad} × ${ventaProducto.value.nombre} = $${FORMATO_PESOS.format(ventaProducto.value.precio * cantidad)}`,
    });
    dialogoVenta.value = false;
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo registrar la venta' });
  } finally {
    vendiendo.value = false;
  }
}

const formulario = reactive({ nombre: '', sede: null, cantidad: 0, precio: null });

function abrirCreacion() {
  editando.value = false;
  productoActivo.value = null;
  Object.assign(formulario, { nombre: '', sede: null, cantidad: 0, precio: null });
  dialogoAbierto.value = true;
}

function abrirEdicion(producto) {
  editando.value = true;
  productoActivo.value = producto;
  Object.assign(formulario, {
    nombre: producto.nombre,
    sede: producto.sede,
    cantidad: producto.cantidad,
    precio: producto.precio ?? null,
  });
  dialogoAbierto.value = true;
}

async function guardar() {
  guardando.value = true;
  try {
    if (editando.value) {
      await gimnasio.actualizarProducto(productoActivo.value._id, {
        nombre: formulario.nombre,
        precio: formulario.precio,
      });
      quasar.notify({ type: 'positive', message: 'Producto actualizado' });
    } else {
      await gimnasio.crearProducto({
        nombre: formulario.nombre,
        cantidad: formulario.cantidad ?? 0,
        precio: formulario.precio,
        ...(formulario.sede ? { sede: formulario.sede } : {}),
      });
      quasar.notify({ type: 'positive', message: 'Producto agregado' });
    }
    dialogoAbierto.value = false;
  } catch (error) {
    quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo guardar' });
  } finally {
    guardando.value = false;
  }
}

/** Vende N unidades: descuenta stock y registra el ingreso del dia. */
function vender(producto) {
  quasar
    .dialog({
      title: `Vender — ${producto.nombre}`,
      message: `Precio: $${FORMATO_PESOS.format(producto.precio)} c/u · Existencias: ${producto.cantidad}. ¿Cuántas unidades?`,
      prompt: { model: '1', type: 'number', isValid: (v) => Number(v) > 0 && Number(v) <= producto.cantidad },
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'primary', unelevated: true, noCaps: true, label: 'Registrar venta' },
    })
    .onOk(async (valor) => {
      const cantidad = Math.floor(Number(valor));
      try {
        await gimnasio.registrarVenta(producto._id, cantidad);
        quasar.notify({
          type: 'positive',
          message: `Venta registrada: ${cantidad} × ${producto.nombre} = $${FORMATO_PESOS.format(producto.precio * cantidad)}`,
        });
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo registrar la venta' });
      }
    });
}

/** `signo` = +1 (entrada) o -1 (salida). Pregunta cuantas unidades. */
function ajustar(producto, signo) {
  quasar
    .dialog({
      title: signo > 0 ? `Entrada de stock — ${producto.nombre}` : `Salida de stock — ${producto.nombre}`,
      message: `Existencias actuales: ${producto.cantidad}. ¿Cuántas unidades?`,
      prompt: { model: '1', type: 'number', isValid: (v) => Number(v) > 0 },
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'primary', unelevated: true, noCaps: true, label: signo > 0 ? 'Sumar' : 'Restar' },
    })
    .onOk(async (valor) => {
      try {
        await gimnasio.ajustarStock(producto._id, signo * Math.abs(Number(valor)));
        quasar.notify({ type: 'positive', message: 'Existencias actualizadas' });
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo ajustar' });
      }
    });
}

function confirmarArchivado(producto) {
  quasar
    .dialog({
      title: `Archivar ${producto.nombre}`,
      message: 'Dejara de aparecer en el inventario. No se borra el historial.',
      cancel: { flat: true, noCaps: true, label: 'Volver' },
      ok: { color: 'negative', unelevated: true, noCaps: true, label: 'Archivar' },
    })
    .onOk(async () => {
      try {
        await gimnasio.archivarProducto(producto._id);
        quasar.notify({ type: 'positive', message: 'Producto archivado' });
      } catch (error) {
        quasar.notify({ type: 'negative', message: error.response?.data?.error?.mensaje ?? 'No se pudo archivar' });
      }
    });
}

onMounted(async () => {
  try {
    await Promise.all([gimnasio.cargarInventario(), gimnasio.cargarSedes()]);
  } catch {
    quasar.notify({ type: 'negative', message: 'No se pudo cargar el inventario' });
  }
});
</script>

<style scoped>
.pagina-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.tarjeta-producto {
  width: 100%;
  max-width: 480px;
  border-top: 4px solid var(--q-primary);
}

.total-venta {
  font-size: 1.25rem;
  font-weight: 600;
  text-align: right;
  color: var(--q-secondary);
}
</style>
