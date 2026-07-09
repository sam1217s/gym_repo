/**
 * Forma unica de las respuestas de la API: `{ ok, data, error }`.
 * Las tres claves existen siempre, para que el frontend nunca tenga que
 * preguntar si una propiedad esta definida.
 */

export function responderOk(respuesta, data = null, estado = 200) {
  return respuesta.status(estado).json({ ok: true, data, error: null });
}

export function responderCreado(respuesta, data) {
  return responderOk(respuesta, data, 201);
}

export function responderError(respuesta, estado, mensaje, detalles = null) {
  return respuesta.status(estado).json({
    ok: false,
    data: null,
    error: { mensaje, detalles },
  });
}
