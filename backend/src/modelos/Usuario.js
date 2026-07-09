import mongoose from 'mongoose';
import { LISTA_ROLES, ROLES } from '../config/constantes.js';

/**
 * NIVEL PLATAFORMA (no tenant-scoped).
 *
 * Usuario es quien inicia sesion en el panel. NO lleva el plugin de aislamiento
 * a proposito: el login ocurre ANTES de que exista contexto de tenant, asi que
 * la busqueda por email tiene que poder correr sin filtro. El aislamiento de
 * esta coleccion se hace a mano, en `servicios/usuarios.servicio.js`.
 *
 * Un `super_admin` tiene `tenant: null` y `sede: null`.
 * Un `sede_admin` tiene ambos.
 */
const esquemaUsuario = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    nombres: { type: String, required: true, trim: true },
    apellidos: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    // `select: false` para que ningun `find()` distraido lo arrastre a una respuesta.
    contrasenaHash: { type: String, required: true, select: false },

    rol: { type: String, enum: LISTA_ROLES, required: true, index: true },
    sede: { type: mongoose.Schema.Types.ObjectId, ref: 'Sede', default: null },
    activo: { type: Boolean, default: true },
    ultimoAcceso: { type: Date, default: null },

    /** Fuerza el cambio de clave en el primer acceso (usuarios creados por un admin). */
    debeCambiarContrasena: { type: Boolean, default: true },

    /**
     * Invalida todos los refresh tokens emitidos antes de incrementarla.
     * Sube al cerrar sesion y al cambiar la contrasena. Es lo que permite
     * revocar sesiones sin guardar los tokens en la base de datos.
     */
    versionToken: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/**
 * El email es unico DENTRO de cada tenant, no globalmente: dos gimnasios
 * distintos pueden tener un recepcionista con el mismo correo.
 * Para los `super_admin` (tenant: null) el indice sigue funcionando, porque
 * MongoDB trata `null` como un valor mas.
 */
esquemaUsuario.index({ tenant: 1, email: 1 }, { unique: true });

esquemaUsuario.virtual('nombreCompleto').get(function () {
  return `${this.nombres} ${this.apellidos}`.trim();
});

esquemaUsuario.methods.esSuperAdmin = function () {
  return this.rol === ROLES.SUPER_ADMIN;
};

esquemaUsuario.set('toJSON', {
  virtuals: true,
  transform(_documento, objeto) {
    delete objeto.contrasenaHash;
    return objeto;
  },
});

export const esquema = esquemaUsuario;
export const nombreModelo = 'Usuario';
