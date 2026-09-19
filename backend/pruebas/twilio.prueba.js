import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLANTILLA_BIENVENIDA, PLANTILLA_VENCIMIENTO } from '../src/config/constantes.js';
import {
  aWhatsapp,
  construirCuerpo,
  crearProveedorTwilio,
} from '../src/proveedores/twilio.proveedor.js';

/**
 * Proveedor WhatsApp Twilio. Como el resto de proveedores, NO se prueba contra
 * la red de Twilio: se verifica la forma del cuerpo del POST (que es un Content
 * Template, no texto libre), la normalizacion del numero y que un fallo de red
 * se propague como error.
 */

const CREDENCIALES = {
  accountSid: 'AC123',
  authToken: 'tok_abc',
  numero: '+14155238886',
  plantillas: { vencimiento: 'HXvence', bienvenida: 'HXbienve' },
};

describe('aWhatsapp (normalizacion del numero)', () => {
  it('antepone whatsapp:+ a un numero internacional sin +', () => {
    expect(aWhatsapp('573001112233')).toBe('whatsapp:+573001112233');
  });
  it('respeta el + y el prefijo whatsapp: si ya vienen', () => {
    expect(aWhatsapp('+14155238886')).toBe('whatsapp:+14155238886');
    expect(aWhatsapp('whatsapp:+14155238886')).toBe('whatsapp:+14155238886');
  });
});

describe('construirCuerpo (forma del mensaje a Twilio)', () => {
  it('arma From/To con whatsapp:+, el ContentSid y las variables numeradas', () => {
    const cuerpo = construirCuerpo({
      telefono: '573001112233',
      variables: ['Carlos', 'GlowUp', '28 de febrero', '70.000'],
      from: '+14155238886',
      contentSid: 'HXvence',
    });

    expect(cuerpo.get('From')).toBe('whatsapp:+14155238886');
    expect(cuerpo.get('To')).toBe('whatsapp:+573001112233');
    expect(cuerpo.get('ContentSid')).toBe('HXvence');
    expect(JSON.parse(cuerpo.get('ContentVariables'))).toEqual({
      1: 'Carlos',
      2: 'GlowUp',
      3: '28 de febrero',
      4: '70.000',
    });
  });
});

describe('crearProveedorTwilio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exige las credenciales accountSid, authToken y numero', () => {
    expect(() => crearProveedorTwilio({})).toThrow();
    expect(() => crearProveedorTwilio({ accountSid: 'AC1' })).toThrow();
    expect(() => crearProveedorTwilio({ accountSid: 'AC1', authToken: 't' })).toThrow();
  });

  it('lanza si la plantilla pedida no tiene Content SID cargado', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);

    // Credenciales sin el SID de recibo; se pide la de RECIBO por defecto? No:
    // se pide la de vencimiento por defecto, que si esta. Forzamos una sin SID.
    const proveedor = crearProveedorTwilio(
      { accountSid: 'AC1', authToken: 't', numero: '+1', plantillas: {} },
      { plantilla: PLANTILLA_VENCIMIENTO },
    );

    await expect(proveedor.enviar({ telefono: '57300', variables: [] })).rejects.toThrow(
      /Content SID/,
    );
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('hace POST con Basic Auth y el ContentSid de la plantilla elegida', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchFalso);

    const proveedor = crearProveedorTwilio(CREDENCIALES, { plantilla: PLANTILLA_BIENVENIDA });
    await proveedor.enviar({ telefono: '573001112233', variables: ['Ana', 'GlowUp'] });

    expect(fetchFalso).toHaveBeenCalledOnce();
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toContain('/Accounts/AC123/Messages.json');
    expect(opciones.headers.Authorization).toBe(
      `Basic ${Buffer.from('AC123:tok_abc').toString('base64')}`,
    );

    const cuerpo = opciones.body; // URLSearchParams
    expect(cuerpo.get('ContentSid')).toBe('HXbienve');
    expect(cuerpo.get('To')).toBe('whatsapp:+573001112233');
    expect(JSON.parse(cuerpo.get('ContentVariables'))).toEqual({ 1: 'Ana', 2: 'GlowUp' });
  });

  it('si Twilio responde con error, lanza (el aviso se reintentara)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const proveedor = crearProveedorTwilio(CREDENCIALES);
    await expect(
      proveedor.enviar({ telefono: '573001112233', variables: ['Ana', 'GlowUp', 'x', 'y'] }),
    ).rejects.toThrow(/401/);
  });
});
