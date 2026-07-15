import { PLAN_SUSCRIPCION_NOMBRE } from '../config/constantes.js';
import { entorno } from '../config/entorno.js';
import { enviarCorreoVerificacion } from '../correos/verificacion.correo.js';
import { obtenerModelo } from '../modelos/indice.js';
import { ErrorApi } from '../utilidades/ErrorApi.js';
import { firmarTokenVerificacion } from '../utilidades/token.js';
import { crearGimnasio } from './onboarding.servicio.js';

/**
 * Registro publico: cualquiera da de alta su propio gimnasio desde la web, sin
 * sesion. A diferencia del onboarding del super_admin:
 *   - el plan es el unico que existe (`Estandar`); nadie lo elige;
 *   - el dueno eligio su propia clave, asi que no la cambia al entrar;
 *   - NO puede iniciar sesion hasta confirmar el correo.
 *
 * `enviarCorreo` se inyecta para que las pruebas no toquen nodemailer.
 */

export async function obtenerPlanDeSuscripcion() {
  const PlanPlataforma = obtenerModelo('PlanPlataforma');
  const plan = await PlanPlataforma.findOne({ nombre: PLAN_SUSCRIPCION_NOMBRE, activo: true });

  if (!plan) {
    // Config del sistema, no error del usuario: el seed deberia haberlo creado.
    throw ErrorApi.solicitudInvalida(
      'El registro no esta disponible ahora mismo. Contacta a soporte.',
    );
  }
  return plan;
}

export async function registrarGimnasioPublico(datos, { enviarCorreo = enviarCorreoVerificacion } = {}) {
  const plan = await obtenerPlanDeSuscripcion();

  const resultado = await crearGimnasio(
    { gimnasio: datos.gimnasio, dueno: datos.dueno, sede: datos.sede },
    { planId: plan._id, emailVerificado: false, debeCambiarContrasena: false },
  );

  const token = firmarTokenVerificacion(resultado.dueno);
  const enlace = `${entorno.ORIGEN_FRONTEND}/verificar-email?token=${token}`;

  // El correo se manda DESPUES de que el gimnasio quedo creado. Si el envio
  // falla, la cuenta existe pero sin verificar: el dueno puede pedir un reenvio
  // (o reintentar el registro), en vez de perder todo lo tecleado.
  await enviarCorreo({ dueno: resultado.dueno, tenant: resultado.tenant, enlace });

  return resultado;
}
