import { base64url, firmarCertificado } from '@ed1/firma';
import {
  conFirma,
  emitidoEn,
  enlaceCompleto,
  enlaceCorto,
  mensajeAFirmar,
  type Recibo,
} from '@ed1/parqueadero-recibos';
import { verifyAsync } from '@noble/ed25519';
import { describe, expect, it } from 'vitest';
import { vistaDelEnlace } from './vista.ts';

const RECIBO: Recibo = {
  clase: 'entrada',
  numero: 'A-000123',
  sede: {
    nombre: 'Parqueadero Ensayo Dos',
    nit: '800123456-7',
    direccion: 'Carrera 10 # 20-30 Local 4',
    ciudad: 'Tunja',
    telefono: '+57 310 000 0000',
    poliza: null,
  },
  placa: 'ABC123',
  vehiculo: 'carro',
  entrada: Date.UTC(2026, 9, 6, 23, 5),
  estado: [],
  tarifa: {
    modo: 'minuto',
    valor: 230,
    fraccion_min: null,
    gracia_min: 5,
    tope_dia: null,
    plena: null,
    nocturna: null,
    tope_minuto: 230,
  },
  salida: null,
  pie: null,
  responsabilidad: null,
  prueba: true,
};

const fragmento = (enlace: string) => enlace.slice(enlace.indexOf('#'));

describe('la página del recibo /r/ (HU-Q4.2)', () => {
  it('la forma completa muestra el recibo como copia digital, con la marca de prueba', async () => {
    const v = await vistaDelEnlace(fragmento(await enlaceCompleto(RECIBO)));
    expect(v).toMatchObject({ es: 'completa', titulo: 'Recibo de entrada A-000123', prueba: true });
    if (v.es !== 'completa') throw new Error(v.es);
    expect(v.hoja).toMatchObject({ placa: 'ABC123', vehiculo: 'Carro', numero: 'A-000123' });
    expect(v.filas).toContainEqual(['Entró', '06/10/2026 18:05']);
    expect(v.notas).toEqual(['Copia digital del recibo.']);
    expect(v.sello).toBeNull();
  });

  it('la forma corta muestra número, placa y hora, y explica cómo pedir la completa', async () => {
    const v = await vistaDelEnlace(fragmento(enlaceCorto(RECIBO)));
    expect(v).toMatchObject({
      es: 'corta',
      titulo: 'Recibo A-000123',
      filas: [
        ['Placa', 'ABC123 · Carro'],
        ['Entrada', '06/10/2026 18:05'],
      ],
    });
  });

  it('un fragmento alterado, vacío o de otra versión no muestra un recibo a medias (CA3 ❌)', async () => {
    const bueno = fragmento(await enlaceCompleto(RECIBO));
    const alterado = `${bueno.slice(0, 20)}${bueno[20] === 'A' ? 'B' : 'A'}${bueno.slice(21)}`;
    for (const f of [alterado, '', '#', '#2.abc', '#1.%E0%A4%A', '#c.A-1.ABC123.c.1']) {
      expect(await vistaDelEnlace(f), f).toMatchObject({
        es: 'ilegible',
        titulo: 'No pudimos leer este recibo',
      });
    }
  });
});

async function par() {
  const p = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const x = base64url(new Uint8Array(await crypto.subtle.exportKey('raw', p.publicKey)));
  const huella = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  return {
    x,
    kid: base64url(huella).slice(0, 16),
    firmar: async (m: Uint8Array<ArrayBuffer>) =>
      new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, p.privateKey, m)),
  };
}

/** Como en la página: @noble/ed25519. */
const verificar = async (
  publica: Uint8Array<ArrayBuffer>,
  mensaje: Uint8Array<ArrayBuffer>,
  firma: Uint8Array<ArrayBuffer>,
) => verifyAsync(firma, mensaje, publica);

async function firmado(hasta = emitidoEn(RECIBO) + 30 * 86_400) {
  const celda = await par();
  const caja = await par();
  const certificado = await firmarCertificado(
    {
      kid: celda.kid,
      llave: caja.x,
      org: '0199b8a0-0000-7000-8000-0000000000a2',
      serie: 'A',
      hasta,
    },
    celda.firmar,
  );
  const enlace = await enlaceCompleto(RECIBO);
  return {
    frag: fragmento(conFirma(enlace, await caja.firmar(mensajeAFirmar(enlace)), certificado)),
    llaves: [{ kid: celda.kid, x: celda.x }],
  };
}

describe('el recibo firmado en /r/ (HU-Q8.2 CA2, CA4)', () => {
  it('verificado: en verde, con el parqueadero y la caja', async () => {
    const { frag, llaves } = await firmado();
    const v = await vistaDelEnlace(frag, llaves, verificar);
    expect(v).toMatchObject({
      es: 'completa',
      sello: {
        tono: 'verificado',
        texto: 'Verificado: emitido por Parqueadero Ensayo Dos desde la caja A',
      },
      notas: [],
    });
  });

  it('emitido con el certificado vencido: en ámbar', async () => {
    const { frag, llaves } = await firmado(emitidoEn(RECIBO) - 60);
    const v = await vistaDelEnlace(frag, llaves, verificar);
    expect(v).toMatchObject({
      sello: { tono: 'vencido', texto: 'Emitido con un certificado vencido' },
    });
  });

  it('sin las llaves de la celda en la página: copia digital, sin alarma', async () => {
    const { frag } = await firmado();
    const v = await vistaDelEnlace(frag);
    expect(v).toMatchObject({ sello: null, notas: ['Copia digital del recibo.'] });
  });

  it('❌ un carácter cambiado de la firma o el certificado: «Este recibo fue modificado», en rojo', async () => {
    const { frag, llaves } = await firmado();
    const partes = frag.split('.');
    // En el certificado, después del kid de la celda (cambiarlo da una celda desconocida).
    for (const [i, j] of [
      [2, 10],
      [3, 40],
    ] as const) {
      const parte = partes[i] ?? '';
      const otra = `${parte.slice(0, j)}${parte[j] === 'Q' ? 'R' : 'Q'}${parte.slice(j + 1)}`;
      const alterado = partes.toSpliced(i, 1, otra).join('.');
      expect(await vistaDelEnlace(alterado, llaves, verificar)).toMatchObject({
        sello: { tono: 'modificado', texto: 'Este recibo fue modificado' },
      });
    }
  });

  it('❌ un enlace de M0, sin firma, sigue abriendo igual', async () => {
    const { llaves } = await firmado();
    const v = await vistaDelEnlace(fragmento(await enlaceCompleto(RECIBO)), llaves, verificar);
    expect(v).toMatchObject({ es: 'completa', sello: null, notas: ['Copia digital del recibo.'] });
  });
});
