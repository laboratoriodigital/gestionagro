/**
 * HU-T13.1 y HU-T13.3: lo que escribe el comercio, leído como hostname, y los registros que crea en
 * su proveedor. Cada caso malo es su control negativo (P5).
 */
import { describe, expect, it } from 'vitest';
import {
  DESTINO_DEL_CNAME,
  leerDominio,
  nombreRelativo,
  REDIRIGIR_LA_RAIZ,
  registrableDe,
  registrosDelDominio,
} from './dominios.ts';

describe('leer lo que escribe el comercio', () => {
  it('quita el esquema, la ruta, el puerto y las mayúsculas', () => {
    expect(leerDominio('  HTTPS://WWW.MiTienda.co/productos?x=1 ')).toEqual({
      ok: true,
      hostname: 'www.mitienda.co',
      raiz: false,
      registrable: 'mitienda.co',
    });
    expect(leerDominio('www.mitienda.co.')).toMatchObject({
      ok: true,
      hostname: 'www.mitienda.co',
    });
  });

  it('sabe dónde está la raíz de un .com.co', () => {
    expect(leerDominio('mitienda.com.co')).toMatchObject({ ok: true, raiz: true });
    expect(leerDominio('www.mitienda.com.co')).toMatchObject({
      ok: true,
      raiz: false,
      registrable: 'mitienda.com.co',
    });
    expect(registrableDe('tienda.ventas.mitienda.co')).toBe('mitienda.co');
  });

  it('los acentos van en punycode', () => {
    expect(leerDominio('www.cañas.co')).toMatchObject({
      ok: true,
      hostname: 'www.xn--caas-hqa.co',
    });
  });

  it('❌ una IP, un nombre sin punto, un segundo nivel solo o la plataforma no se conectan', () => {
    for (const malo of ['', 'mitienda', '10.0.0.1', 'com.co', 'www.mi_tienda.co', '-a.co']) {
      expect(leerDominio(malo).ok, malo).toBe(false);
    }
    expect(leerDominio('tienda.laboratorio-digital.app')).toEqual({
      ok: false,
      motivo: expect.stringMatching(/ya es de la plataforma/),
    });
    expect(leerDominio('laboratorio-digital.com').ok).toBe(false);
  });
});

describe('los registros, en palabras (TIENDA §4.2 paso 3)', () => {
  const validacion = {
    propiedad: { nombre: '_cf-custom-hostname.www.mitienda.co', valor: 'p-1' },
    certificado: [{ nombre: '_acme-challenge.www.mitienda.co', valor: 'a-1' }],
  };

  it('los TXT primero y el CNAME de último, con el nombre como lo piden los proveedores', () => {
    expect(
      registrosDelDominio('www.mitienda.co', validacion).map((r) => [r.tipo, r.nombre, r.valor]),
    ).toEqual([
      ['TXT', '_cf-custom-hostname.www', 'p-1'],
      ['TXT', '_acme-challenge.www', 'a-1'],
      ['CNAME', 'www', DESTINO_DEL_CNAME],
    ]);
  });

  it('la raíz lleva su CNAME en «@», con la nota del ALIAS (HU-T13.3)', () => {
    const [cname] = registrosDelDominio('mitienda.co', {
      propiedad: null,
      certificado: [],
    });
    expect(cname).toMatchObject({ tipo: 'CNAME', nombre: '@', completo: 'mitienda.co' });
    expect(cname?.paraQue).toMatch(/ALIAS o ANAME/);
    expect(nombreRelativo('otro.example', 'mitienda.co')).toBe('otro.example');
  });

  it('❌ CA2: ninguna instrucción pide mover el dominio o su DNS a la plataforma', () => {
    const todo = REDIRIGIR_LA_RAIZ.map((r) => r.pasos)
      .join(' ')
      .toLowerCase();
    expect(todo).not.toMatch(/transfer|nameserver|servidores de nombres|mover tu dominio/);
  });
});
