import mongoose from 'mongoose';
import {
  ErrorSinContextoTenant,
  exigirTenantActual,
  omiteAislamiento,
} from '../../contexto/contextoTenant.js';

/**
 * Plugin de Mongoose que aisla automaticamente una coleccion por tenant.
 *
 * Se aplica SOLO a los esquemas de negocio (Sede, PlanMembresia, Miembro, Pago,
 * Notificacion). Las colecciones de plataforma (Tenant, PlanPlataforma, Usuario)
 * NO lo usan: viven por encima de los tenants.
 *
 * Lo que hace:
 *   - anade el campo `tenant`, obligatorio, indexado e inmutable;
 *   - inyecta `{ tenant }` en el filtro de toda consulta;
 *   - antepone `{ $match: { tenant } }` a todo pipeline de agregacion;
 *   - asigna el `tenant` del contexto al guardar o insertar;
 *   - lanza si no hay contexto de tenant.
 *
 * LIMITES QUE EL PLUGIN NO PUEDE CUBRIR (responsabilidad de quien escribe la query):
 *   - `$lookup` hacia otra coleccion tenant-scoped NO dispara el plugin de la
 *     coleccion destino. Todo `$lookup` debe llevar su propio `$match` de tenant
 *     en el sub-pipeline.
 *   - `Model.bulkWrite()` no esta cubierto. Si lo necesitas, filtra a mano.
 */

/**
 * Operaciones de consulta interceptadas. Cubren tambien las que Mongoose traduce
 * internamente: `findById` -> `findOne`, `findByIdAndUpdate` -> `findOneAndUpdate`.
 */
const OPERACIONES_CONSULTA = [
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'countDocuments',
  'distinct',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];

/**
 * `estimatedDocumentCount()` no acepta filtro: cuenta la coleccion entera.
 * En una coleccion tenant-scoped eso siempre es una fuga de datos, asi que se
 * prohibe en vez de devolver un numero silenciosamente incorrecto.
 */
const OPERACION_PROHIBIDA = 'estimatedDocumentCount';

export function aislamientoTenant(schema) {
  schema.add({
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Todo documento tenant-scoped debe tener tenant'],
      index: true,
      immutable: true, // un documento nunca cambia de tenant
    },
  });

  // Marca de introspeccion: permite a las pruebas y a los scripts saber si un
  // modelo esta aislado sin inspeccionar los hooks.
  schema.statics.estaAislado = () => true;

  schema.pre(OPERACIONES_CONSULTA, { query: true, document: false }, function () {
    if (this.getOptions()?.omitirAislamiento === true) return;
    if (omiteAislamiento()) return;

    // `where` sobreescribe cualquier `tenant` que viniera en el filtro: el
    // contexto siempre gana sobre lo que mande el cliente.
    this.where({ tenant: exigirTenantActual(this.op) });
  });

  schema.pre(OPERACION_PROHIBIDA, function () {
    throw new Error(
      `${OPERACION_PROHIBIDA}() esta prohibido en colecciones tenant-scoped ` +
        'porque ignora el filtro de tenant. Usa countDocuments().',
    );
  });

  schema.pre('aggregate', function () {
    if (this.options?.omitirAislamiento === true) return;
    if (omiteAislamiento()) return;

    this.pipeline().unshift({ $match: { tenant: exigirTenantActual('aggregate') } });
  });

  /**
   * El tenant se asigna en `pre('validate')`, no en `pre('save')`.
   *
   * Mongoose corre la validacion ANTES de los hooks de `save`, asi que hacerlo
   * en `save` llegaria tarde: `required: true` sobre `tenant` ya habria fallado.
   * Se registra tambien en `save` por si alguien guarda con `validateBeforeSave: false`.
   */
  const asignarTenant = function () {
    if (!this.isNew) return;
    if (omiteAislamiento()) return; // el tenant debe venir explicito; `required` lo verifica

    this.tenant = exigirTenantActual('save');
  };

  schema.pre('validate', asignarTenant);
  schema.pre('save', asignarTenant);

  schema.pre('insertMany', function (siguiente, documentos) {
    try {
      if (omiteAislamiento()) return siguiente();

      const tenantId = exigirTenantActual('insertMany');
      for (const documento of documentos) {
        documento.tenant = tenantId;
      }
      return siguiente();
    } catch (error) {
      return siguiente(error);
    }
  });
}

export { ErrorSinContextoTenant };
