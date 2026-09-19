import { z } from 'zod';

/** Piezas Zod compartidas por varios recursos. */

export const idMongo = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador invalido');

/** Identificador del gimnasio en la URL/login. Lo comparten plataforma y registro publico. */
export const slugValido = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Minimo 3 caracteres')
  .regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones');

export const esquemaIdParam = {
  params: z.object({ id: idMongo }),
};

/** Formato internacional sin '+' ni espacios, listo para WhatsApp: "573001234567". */
export const telefonoWhatsApp = z
  .string()
  .trim()
  .regex(/^\d{10,15}$/, 'Telefono en formato internacional, ej: 573001234567');

/**
 * Cedula (documento de identidad) OPCIONAL. Solo digitos. Un string vacio del
 * formulario se trata como "no la dio" (`undefined`), para no guardar cadenas
 * vacias que el indice parcial contaria como cedula. Sirve como alternativa al
 * correo para iniciar sesion, y es unica por gimnasio.
 */
export const cedulaOpcional = z
  .string()
  .trim()
  .transform((valor) => valor || undefined)
  .refine((valor) => valor === undefined || /^\d{4,15}$/.test(valor), {
    message: 'La cedula debe ser numerica (4 a 15 digitos)',
  })
  .optional();

/**
 * Telefono OPCIONAL en internacional (con o sin '+'). Un string vacio se trata
 * como "no lo dio" (`undefined`), para no guardar cadenas vacias que el indice
 * parcial contaria. El servicio lo normaliza a `+E164` al guardar.
 */
export const telefonoOpcional = z
  .string()
  .trim()
  .transform((valor) => valor || undefined)
  .refine((valor) => valor === undefined || /^\+?\d{7,15}$/.test(valor), {
    message: 'Telefono en formato internacional, ej: +573001234567',
  })
  .optional();

/** Correo OPCIONAL. Un string vacio se trata como "no lo dio" (`undefined`). */
export const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .transform((valor) => valor || undefined)
  .refine((valor) => valor === undefined || /.+@.+\..+/.test(valor), { message: 'Email invalido' })
  .optional();

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una fecha sin hora es un DIA CIVIL, no un instante.
 *
 * `new Date('2026-07-09')` (y por tanto `z.coerce.date()`) devuelve medianoche
 * UTC, que en Bogota es el 8 de julio a las 19:00. Cualquier aritmetica de
 * calendario posterior —sumar un mes, por ejemplo— caeria un dia antes.
 * Aqui se ancla a medianoche LOCAL, que es lo que quiso decir quien escribio
 * "9 de julio" en el formulario.
 */
export const diaCivil = z
  .union([z.date(), z.string()])
  .transform((valor) => {
    if (valor instanceof Date) return valor;

    if (SOLO_FECHA.test(valor)) {
      const [anio, mes, dia] = valor.split('-').map(Number);
      return new Date(anio, mes - 1, dia);
    }

    return new Date(valor);
  })
  .refine((fecha) => !Number.isNaN(fecha.getTime()), { message: 'Fecha invalida' });
