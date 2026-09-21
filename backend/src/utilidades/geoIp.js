/**
 * Ubicacion aproximada a partir de una IP, para el aviso de seguridad de inicio
 * de sesion. Es BEST-EFFORT: si el servicio no responde, la IP es privada o algo
 * falla, devuelve `null` y el aviso sale con "ubicacion desconocida".
 *
 * Usa el endpoint gratuito de ip-api.com (sin llave). La precision es a nivel de
 * ciudad y depende del IP (una VPN o los datos moviles pueden desviarla): sirve
 * como pista de seguridad, no como una localizacion exacta.
 */

const TIEMPO_LIMITE_MS = 4000;

/** IPs que no tiene sentido geolocalizar (localhost / redes privadas). */
function esIpLocal(ip) {
  if (!ip) return true;
  const limpia = ip.replace(/^::ffff:/, ''); // IPv4 mapeada en IPv6
  return (
    limpia === '127.0.0.1' ||
    limpia === '::1' ||
    limpia.startsWith('10.') ||
    limpia.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(limpia) ||
    limpia === 'localhost'
  );
}

/**
 * @param {string} ip
 * @returns {Promise<string|null>} "Ciudad, Pais" o `null` si no se pudo ubicar.
 */
export async function ubicarIp(ip) {
  if (esIpLocal(ip)) return null;

  const limpia = String(ip).replace(/^::ffff:/, '');

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(limpia)}?fields=status,country,regionName,city&lang=es`;
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_LIMITE_MS) });
    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    if (datos.status !== 'success') return null;

    const partes = [datos.city, datos.regionName, datos.country].filter(Boolean);
    return partes.length ? partes.join(', ') : null;
  } catch {
    return null;
  }
}
