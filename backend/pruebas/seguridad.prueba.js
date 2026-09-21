import { describe, expect, it } from 'vitest';

import { PLANTILLA_LOGIN, ROLES } from '../src/config/constantes.js';
import { avisarInicioSesionDueno } from '../src/servicios/seguridad.servicio.js';

/**
 * Aviso de seguridad al DUEÑO cuando inicia sesion. Lo critico: que SOLO le
 * llegue al dueño, que sea best-effort (nunca lanza) y que la geolocalizacion
 * ni se intente si el canal no esta habilitado (no tocar la red en vano).
 */

const DUENO = { rol: ROLES.TENANT_OWNER, nombres: 'Laura', telefono: '573001112233' };
const TENANT = { nombre: 'Gym Barichara' };

/** Proveedor de WhatsApp falso, habilitado, que registra lo enviado. */
function proveedorFalso() {
  const enviados = [];
  let opcionesRecibidas = null;
  const crearProveedor = (opciones) => {
    opcionesRecibidas = opciones;
    return { habilitado: true, enviar: async (p) => enviados.push(p) };
  };
  return { crearProveedor, enviados, opciones: () => opcionesRecibidas };
}

describe('Aviso de inicio de sesion al dueño', () => {
  it('envia al dueño con la plantilla de LOGIN y variables [nombre, fecha, ubicacion]', async () => {
    const falso = proveedorFalso();
    const r = await avisarInicioSesionDueno(
      { usuario: DUENO, tenant: TENANT, ip: '181.49.1.1' },
      { crearProveedor: falso.crearProveedor, geolocalizar: async () => 'Bogota, Colombia' },
    );

    expect(r.enviado).toBe(true);
    expect(falso.opciones().plantilla).toBe(PLANTILLA_LOGIN);
    expect(falso.enviados).toHaveLength(1);
    expect(falso.enviados[0].telefono).toBe('573001112233');
    expect(falso.enviados[0].variables[0]).toBe('Laura');
    expect(falso.enviados[0].variables[2]).toBe('Bogota, Colombia');
  });

  it('NO avisa a un administrador de sede (solo el dueño)', async () => {
    const admin = { rol: ROLES.SEDE_ADMIN, nombres: 'Carlos', telefono: '573009998877' };
    let creado = false;
    const r = await avisarInicioSesionDueno(
      { usuario: admin, tenant: TENANT, ip: '181.49.1.1' },
      {
        crearProveedor: () => {
          creado = true;
          return { habilitado: true, enviar: async () => {} };
        },
        geolocalizar: async () => 'X',
      },
    );

    expect(r).toEqual({ enviado: false, motivo: 'no_es_dueno' });
    expect(creado).toBe(false);
  });

  it('el dueño sin telefono no recibe aviso', async () => {
    const r = await avisarInicioSesionDueno(
      { usuario: { ...DUENO, telefono: undefined }, tenant: TENANT, ip: '181.49.1.1' },
      { crearProveedor: () => ({ habilitado: true, enviar: async () => {} }), geolocalizar: async () => 'X' },
    );
    expect(r).toEqual({ enviado: false, motivo: 'sin_telefono' });
  });

  it('sin canal habilitado no envia NI geolocaliza (no toca la red)', async () => {
    let geolocalizado = false;
    const r = await avisarInicioSesionDueno(
      { usuario: DUENO, tenant: TENANT, ip: '181.49.1.1' },
      {
        crearProveedor: () => ({ habilitado: false, enviar: async () => {} }),
        geolocalizar: async () => {
          geolocalizado = true;
          return 'X';
        },
      },
    );

    expect(r).toEqual({ enviado: false, motivo: 'proveedor_ninguno' });
    expect(geolocalizado).toBe(false);
  });

  it('si no se pudo ubicar la IP, usa "ubicacion desconocida"', async () => {
    const falso = proveedorFalso();
    await avisarInicioSesionDueno(
      { usuario: DUENO, tenant: TENANT, ip: '127.0.0.1' },
      { crearProveedor: falso.crearProveedor, geolocalizar: async () => null },
    );

    expect(falso.enviados[0].variables[2]).toBe('ubicacion desconocida');
  });

  it('es best-effort: si el envio falla, NO lanza', async () => {
    const r = await avisarInicioSesionDueno(
      { usuario: DUENO, tenant: TENANT, ip: '181.49.1.1' },
      {
        crearProveedor: () => ({
          habilitado: true,
          enviar: async () => {
            throw new Error('twilio 400');
          },
        }),
        geolocalizar: async () => 'Bogota',
      },
    );

    expect(r.enviado).toBe(false);
    expect(r.motivo).toBe('twilio 400');
  });
});
