import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ejecutarConTenant, ejecutarSinTenant } from '../src/contexto/contextoTenant.js';
import { obtenerModelo } from '../src/modelos/indice.js';
import { rutaArchivo } from '../src/servicios/mensajes.servicio.js';
import { limpiarColecciones } from './configuracion.js';

/**
 * Como se sirve el archivo de un mensaje de la bandeja. Lo critico: Cloudinary
 * bloquea por defecto la ENTREGA de PDF (su URL firmada responde 401), asi que
 * los PDF tienen que ir por la descarga privada; las imagenes siguen por la URL
 * firmada. Cloudinary se simula: las pruebas no tocan la red.
 */

vi.mock('../src/almacenamiento/cloudinary.js', () => ({
  subirComprobante: vi.fn(),
  borrarComprobante: vi.fn(),
  urlFirmada: vi.fn((publicId) => `firmada:${publicId}`),
  urlDescargaPrivada: vi.fn((publicId, { formato }) => `privada:${publicId}.${formato}`),
}));

async function crearMensaje(datos) {
  const tenant = await ejecutarSinTenant(() =>
    obtenerModelo('Tenant').create({ nombre: 'GymArchivos', nit: '900444', slug: 'gymarchivos' }),
  );
  const mensaje = await ejecutarConTenant(tenant._id, () =>
    obtenerModelo('MensajeWhatsapp').create({
      telefono: '573001112233',
      direccion: 'entrante',
      archivoTipoRecurso: 'image',
      ...datos,
    }),
  );
  return { tenant, mensaje };
}

beforeEach(limpiarColecciones);

describe('Archivo de un mensaje de WhatsApp', () => {
  it('un PDF se sirve por la descarga privada, con su tipo', async () => {
    const { tenant, mensaje } = await crearMensaje({
      tipo: 'documento',
      mimeType: 'application/pdf',
      archivoPublicId: 'gymsaas/comprobantes/t/SM1',
    });

    const resultado = await ejecutarConTenant(tenant._id, () => rutaArchivo(mensaje._id));

    expect(resultado).toEqual({ redireccion: 'privada:gymsaas/comprobantes/t/SM1.pdf', mimeType: 'application/pdf' });
  });

  it('una imagen sigue por la URL firmada', async () => {
    const { tenant, mensaje } = await crearMensaje({
      tipo: 'imagen',
      mimeType: 'image/jpeg',
      archivoPublicId: 'gymsaas/comprobantes/t/SM2',
    });

    const resultado = await ejecutarConTenant(tenant._id, () => rutaArchivo(mensaje._id));

    expect(resultado).toEqual({ redireccion: 'firmada:gymsaas/comprobantes/t/SM2', mimeType: 'image/jpeg' });
  });

  it('un mensaje sin archivo responde 404', async () => {
    const { tenant, mensaje } = await crearMensaje({ tipo: 'documento', mimeType: 'application/pdf' });

    await expect(ejecutarConTenant(tenant._id, () => rutaArchivo(mensaje._id))).rejects.toMatchObject({ estado: 404 });
  });
});
