import bcrypt from 'bcryptjs';
import { RONDAS_BCRYPT } from '../config/constantes.js';

export function cifrarContrasena(contrasenaPlana) {
  return bcrypt.hash(contrasenaPlana, RONDAS_BCRYPT);
}

export function verificarContrasena(contrasenaPlana, hashGuardado) {
  return bcrypt.compare(contrasenaPlana, hashGuardado);
}
