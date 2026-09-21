<template>
  <!-- Selector de pais y numero como dos controles contiguos: la bandera queda a
       la IZQUIERDA sin encimarse con el numero. -->
  <div class="campo-telefono row no-wrap items-start">
    <q-select
      v-model="pais"
      :options="PAISES"
      dense
      outlined
      options-dense
      hide-dropdown-icon
      class="selector-pais"
      @update:model-value="emitir"
    >
      <template #selected>
        <span class="fila-pais">
          <span class="bandera" v-html="pais.bandera"></span>
          <span class="cifra-tabular">+{{ pais.indicativo }}</span>
        </span>
      </template>
      <template #option="scope">
        <q-item v-bind="scope.itemProps">
          <q-item-section avatar>
            <span class="bandera" v-html="scope.opt.bandera"></span>
          </q-item-section>
          <q-item-section>{{ scope.opt.label }}</q-item-section>
          <q-item-section side class="cifra-tabular">+{{ scope.opt.indicativo }}</q-item-section>
        </q-item>
      </template>
    </q-select>

    <q-input
      v-model="local"
      :label="label"
      :hint="hintEfectivo"
      outlined
      dense
      inputmode="numeric"
      :maxlength="maxLocal"
      class="col numero"
      :rules="[reglaLocal]"
      @update:model-value="alEscribir"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

/**
 * Campo de telefono con selector de pais. El usuario escribe SOLO el numero
 * local (sin indicativo); el componente antepone el indicativo del pais y emite
 * el numero completo en formato internacional sin '+' (ej. "573001234567"), que
 * es lo que guarda el backend y usa WhatsApp. Colombia va seleccionado por
 * defecto.
 */

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Telefono (WhatsApp)' },
  hint: { type: String, default: '' },
  // Si es opcional, un campo vacio es valido (para formularios de edicion).
  opcional: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

// Banderas como SVG en linea (no emoji): asi se ven igual en Windows y en movil.
const PAISES = [
  {
    label: 'Colombia',
    indicativo: '57',
    // Los celulares en Colombia tienen 10 digitos (empiezan por 3).
    digitos: 10,
    bandera:
      '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#FCD116"/><rect y="1" width="3" height="0.5" fill="#003893"/><rect y="1.5" width="3" height="0.5" fill="#CE1126"/></svg>',
  },
  {
    label: 'Mexico',
    indicativo: '52',
    bandera:
      '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#006847"/><rect x="2" width="1" height="2" fill="#CE1126"/></svg>',
  },
  {
    label: 'Argentina',
    indicativo: '54',
    bandera:
      '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#74ACDF"/><rect y="0.667" width="3" height="0.666" fill="#fff"/></svg>',
  },
  {
    label: 'Peru',
    indicativo: '51',
    bandera:
      '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#D91023"/><rect x="2" width="1" height="2" fill="#D91023"/></svg>',
  },
  {
    label: 'Venezuela',
    indicativo: '58',
    bandera:
      '<svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#CF142B"/><rect width="3" height="2" fill="#00247D"/><rect width="3" height="1" fill="#FFCC00"/></svg>',
  },
  {
    label: 'Espana',
    indicativo: '34',
    bandera:
      '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/></svg>',
  },
  {
    label: 'Estados Unidos',
    indicativo: '1',
    bandera:
      '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#B22234"/><rect y="0.31" width="3" height="0.31" fill="#fff"/><rect y="0.92" width="3" height="0.31" fill="#fff"/><rect y="1.54" width="3" height="0.31" fill="#fff"/><rect width="1.2" height="1.08" fill="#3C3B6E"/></svg>',
  },
];

const COLOMBIA = PAISES[0];

const pais = ref(COLOMBIA);
const local = ref('');

/** Descompone un numero internacional en pais + numero local. */
function descomponer(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return { pais: COLOMBIA, local: '' };

  // El indicativo mas largo que encaje gana (evita que "1" tape a "57", etc.).
  const candidatos = [...PAISES].sort((a, b) => b.indicativo.length - a.indicativo.length);
  const encontrado = candidatos.find((p) => digitos.startsWith(p.indicativo));
  if (encontrado) return { pais: encontrado, local: digitos.slice(encontrado.indicativo.length) };

  // Sin coincidencia: se deja como esta bajo Colombia, para que sea editable.
  return { pais: COLOMBIA, local: digitos };
}

/** Vuelve a componer el numero completo y lo emite hacia el formulario. */
function emitir() {
  const numero = local.value ? `${pais.value.indicativo}${local.value}` : '';
  emit('update:modelValue', numero);
}

function alEscribir(valor) {
  // Solo digitos en el numero local.
  const limpio = String(valor ?? '').replace(/\D/g, '');
  if (limpio !== valor) local.value = limpio;
  emitir();
}

// Tope de digitos al escribir: para paises con largo fijo (Colombia: 10) no deja
// pasarse; el resto se acota al maximo internacional razonable.
const maxLocal = computed(() => pais.value.digitos ?? 14);

// Sugerencia bajo el campo si el padre no puso una: "10 digitos" para Colombia.
const hintEfectivo = computed(() => {
  if (props.hint) return props.hint;
  return pais.value.digitos ? `${pais.value.digitos} digitos` : '';
});

const reglaLocal = (valor) => {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return props.opcional || 'El telefono es obligatorio';

  // Paises con largo fijo (Colombia: 10 digitos): se exige exacto.
  if (pais.value.digitos && digitos.length !== pais.value.digitos) {
    return `El numero en ${pais.value.label} debe tener ${pais.value.digitos} digitos`;
  }

  const completo = `${pais.value.indicativo}${digitos}`;
  return (completo.length >= 10 && completo.length <= 15) || 'Numero de telefono invalido';
};

// Sincroniza cuando el formulario cambia desde fuera (abrir edicion, limpiar).
watch(
  () => props.modelValue,
  (valor) => {
    const compuesto = local.value ? `${pais.value.indicativo}${local.value}` : '';
    if (valor === compuesto) return; // el cambio salio de aqui: no repetir
    const desc = descomponer(valor);
    pais.value = desc.pais;
    local.value = desc.local;
  },
  { immediate: true },
);
</script>

<style scoped>
.campo-telefono {
  gap: 6px;
}

/* Compacto a proposito: la bandera y el indicativo caben justos, para dejarle
   el mayor ancho posible al numero (importa en moviles de 350px). */
.selector-pais {
  width: 82px;
  flex: 0 0 82px;
}

/* Une visualmente los dos controles: el selector redondea solo a la izquierda
   y el numero solo a la derecha, con los bordes internos pegados. */
.selector-pais :deep(.q-field__control) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  padding: 0 8px;
}

/* Sin flecha ni relleno de sobra: el contenido manda el ancho. */
.selector-pais :deep(.q-field__native) {
  padding: 0;
  min-width: 0;
}

.numero :deep(.q-field__control) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.selector-pais :deep(.q-field__control)::after {
  border-right-width: 0;
}

.fila-pais {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.bandera {
  display: inline-flex;
  width: 22px;
  height: 15px;
  flex: 0 0 22px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.bandera :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
