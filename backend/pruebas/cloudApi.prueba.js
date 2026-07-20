import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANTILLA_VENCIMIENTO } from '../src/config/constantes.js';
import { construirCuerpo, crearProveedorCloudApi } from '../src/proveedores/cloudApi.proveedor.js';

/**
 * Proveedor WhatsApp Cloud API. Como el resto de proveedores, NO se prueba
 * contra la red de Meta: se verifica la forma del cuerpo del POST (que es una
 * PLANTILLA, no texto libre) y que un fallo de red se propague como error.
 */

const CREDENCIALES = { idTelefono: '123456', token: 'tok_abc' };

describe('construirCuerpo (forma del mensaje a Meta)', () => {
  it('arma una plantilla con nombre, idioma y las variables como parametros del body', () => {
    const cuerpo = construirCuerpo({
      telefono: '573001112233',
      variables: ['Carlos', 'GlowUp', '28 de febrero'],
      plantilla: PLANTILLA_VENCIMIENTO,
    });

    expect(cuerpo).toEqual({
      messaging_product: 'whatsapp',
      to: '573001112233',
      type: 'template',
      template: {
        name: 'aviso_vencimiento',
        language: { code: 'es_CO' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Carlos' },
              { type: 'text', text: 'GlowUp' },
              { type: 'text', text: '28 de febrero' },
            ],
          },
        ],
      },
    });
  });

  it('NUNCA envia texto libre: el tipo es siempre template', () => {
    const cuerpo = construirCuerpo({ telefono: '57300', variables: [], plantilla: PLANTILLA_VENCIMIENTO });
    expect(cuerpo.type).toBe('template');
    expect(cuerpo.text).toBeUndefined();
  });
});

describe('crearProveedorCloudApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exige las credenciales idTelefono y token', () => {
    expect(() => crearProveedorCloudApi({})).toThrow();
    expect(() => crearProveedorCloudApi({ idTelefono: '1' })).toThrow();
  });

  it('hace POST con la plantilla al endpoint de graph, con el token en la cabecera', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchFalso);

    const proveedor = crearProveedorCloudApi(CREDENCIALES);
    await proveedor.enviar({ telefono: '573001112233', variables: ['Ana', 'GlowUp', '1 de marzo'] });

    expect(fetchFalso).toHaveBeenCalledOnce();
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toContain('/123456/messages');
    expect(opciones.headers.Authorization).toBe('Bearer tok_abc');

    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.type).toBe('template');
    expect(cuerpo.template.name).toBe('aviso_vencimiento');
    expect(cuerpo.template.components[0].parameters.map((p) => p.text)).toEqual([
      'Ana',
      'GlowUp',
      '1 de marzo',
    ]);
  });

  it('si Meta responde con error, lanza (el aviso se reintentara)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const proveedor = crearProveedorCloudApi(CREDENCIALES);
    await expect(
      proveedor.enviar({ telefono: '573001112233', variables: ['Ana', 'GlowUp', '1 de marzo'] }),
    ).rejects.toThrow(/401/);
  });
});
