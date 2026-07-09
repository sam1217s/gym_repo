const NOMBRE = 'baileys';

/**
 * Baileys (WhatsApp Web sobre websocket). NO IMPLEMENTADO a proposito.
 *
 * A diferencia de los otros proveedores, Baileys no es una llamada HTTP: exige
 * una dependencia pesada, un emparejamiento por codigo QR y una sesion viva y
 * persistida por gimnasio. Eso es infraestructura, no una credencial, y elegir
 * el proveedor de produccion sigue siendo una decision abierta del proyecto
 * (ver FASE.md). Se prefiere fallar aqui, ruidosamente, antes que instalar la
 * dependencia y fingir que el canal existe.
 *
 * El cron atrapa esta excepcion por tenant: un gimnasio mal configurado no
 * tumba el aviso de los demas.
 */
export function crearProveedorBaileys() {
  throw new Error(
    `El proveedor "${NOMBRE}" todavia no esta implementado. ` +
      'Requiere la dependencia @whiskeysockets/baileys y una sesion emparejada por QR ' +
      'para cada gimnasio. Usa "cloud_api", "n8n" o "ninguno" mientras tanto.',
  );
}
