import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RECIBO_ENSAYO_UNO } from './ensayo-uno.fixture.ts';
import {
  AJUSTES_POR_DEFECTO,
  ajustesDesdeRespuestas,
  codificar,
  crearCola,
  crearImpresoraDePrueba,
  filtrarControl,
  lineaPar,
  paginaDePrueba,
  type Trabajo,
  transliterar,
} from './index.ts';

const ESC = 0x1b;
const GS = 0x1d;

function contiene(bytes: Uint8Array, aguja: readonly number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - aguja.length; i++) {
    for (let j = 0; j < aguja.length; j++) if (bytes[i + j] !== aguja[j]) continue outer;
    return true;
  }
  return false;
}

function hex(bytes: Uint8Array): string {
  const lineas: string[] = [];
  for (let i = 0; i < bytes.length; i += 32) {
    lineas.push(
      Array.from(bytes.subarray(i, i + 32), (b) => b.toString(16).padStart(2, '0')).join(' '),
    );
  }
  return `${lineas.join('\n')}\n`;
}

const trabajo = (id: string): Trabajo => ({ id, formato: 'escpos', bytes: new Uint8Array([1, 2]) });

describe('el texto que viene de una persona', () => {
  it('sale sin bytes de control: ESC, GS y los demás', () => {
    expect(filtrarControl('nota\x1b@ con\x1dV0 y\x00 fin\x7f\x9b')).toBe('nota@ conV0 y fin');
    expect(filtrarControl('a\r\nb\rc\td')).toBe('a\nb\nc d');
  });

  it('una nota con ESC o GS da los mismos bytes que sin ellos', async () => {
    const con = await codificar([{ tipo: 'texto', texto: 'Rayón\x1b@\x1dV\x00 puerta' }]);
    const sin = await codificar([{ tipo: 'texto', texto: 'Rayón@V puerta' }]);
    expect(con).toEqual(sin);
  });

  it('transliterar deja solo ASCII imprimible', () => {
    expect(transliterar('áéíóú ñÑ ¿¡ $')).toBe('aeiou nN ?! $');
    expect(transliterar('Ü – “x” … 🚗')).toBe('U - "x" ... ?');
  });
});

describe('codificar', () => {
  it('ñ sale como la página de códigos la tiene', async () => {
    const cp850 = await codificar([{ tipo: 'texto', texto: 'ñ' }]);
    expect(contiene(cp850, [ESC, 0x74, 2])).toBe(true);
    expect(contiene(cp850, [0xa4])).toBe(true);
    const w1252 = await codificar([{ tipo: 'texto', texto: 'ñ' }], {
      ...AJUSTES_POR_DEFECTO,
      paginaDeCodigos: 'windows1252',
    });
    expect(contiene(w1252, [ESC, 0x74, 16])).toBe(true);
    expect(contiene(w1252, [0xf1])).toBe(true);
  });

  it('el QR nativo usa GS ( k y el de imagen GS v 0', async () => {
    const nativo = await codificar([{ tipo: 'qr', valor: 'https://x.co/a' }]);
    expect(contiene(nativo, [GS, 0x28, 0x6b])).toBe(true);
    expect(nativo.length).toBeLessThan(200);
    const imagen = await codificar([{ tipo: 'qr', valor: 'https://x.co/a', modo: 'imagen' }]);
    expect(contiene(imagen, [GS, 0x76, 0x30])).toBe(true);
    expect(imagen.length).toBeLessThan(8_000);
  });

  it('lineaPar llena la línea, o parte en dos si no cabe', () => {
    expect(lineaPar('Placa ABC123', 'Carro', 32)).toEqual([`Placa ABC123${' '.repeat(15)}Carro`]);
    expect(lineaPar('x'.repeat(30), 'Carro', 32)).toEqual([
      'x'.repeat(30),
      `${' '.repeat(27)}Carro`,
    ]);
  });

  it('el recibo de Ensayo Uno da sus bytes de referencia', async () => {
    const archivo = join(import.meta.dirname, '..', 'referencia', 'recibo-ensayo-uno.hex');
    const bytes = await codificar(RECIBO_ENSAYO_UNO);
    if (process.env['ACTUALIZAR_REFERENCIA'] === '1') writeFileSync(archivo, hex(bytes));
    expect(hex(bytes)).toBe(readFileSync(archivo, 'utf8'));
    // Un recibo de texto de 1 a 2 KB sale en 1 o 2 segundos por BLE (§7.4).
    expect(bytes.length).toBeLessThan(2_048);
  });
});

describe('la página de prueba', () => {
  it('lleva la regla, las cuatro líneas y los dos QR', async () => {
    const bloques = paginaDePrueba('06/10/2026', 'https://x.co/p');
    const bytes = await codificar(bloques);
    for (const n of [2, 16, 19]) expect(contiene(bytes, [ESC, 0x74, n])).toBe(true);
    expect(contiene(bytes, [GS, 0x28, 0x6b])).toBe(true);
    expect(contiene(bytes, [GS, 0x76, 0x30])).toBe(true);
    const texto = new TextDecoder('latin1').decode(bytes);
    expect(texto).toContain('12345678901234567890123456789012');
    expect(texto).toContain('4) Sin tildes: El tenia mas anos');
    // Ninguna línea pasa de 32: la de «Sin tildes:» es la más larga.
    expect('4) Sin tildes: El tenia mas anos'.length).toBeLessThanOrEqual(32);
  });

  it('las respuestas se vuelven ajustes; ninguna línea legible translitera', () => {
    expect(
      ajustesDesdeRespuestas({
        lineaLegible: 2,
        qrNativoLee: false,
        qrImagenLee: true,
        reglaCabe: true,
      }),
    ).toEqual({ paginaDeCodigos: 'windows1252', qr: 'imagen', columnas: 32 });
    expect(
      ajustesDesdeRespuestas({
        lineaLegible: null,
        qrNativoLee: true,
        qrImagenLee: true,
        reglaCabe: true,
      }).paginaDeCodigos,
    ).toBe('transliterar');
    expect(
      ajustesDesdeRespuestas({
        lineaLegible: 1,
        qrNativoLee: false,
        qrImagenLee: false,
        reglaCabe: true,
      }).qr,
    ).toBeNull();
  });
});

describe('la cola', () => {
  it('imprime uno a la vez y en orden', async () => {
    const orden: string[] = [];
    let enCurso = 0;
    const impresora = crearImpresoraDePrueba();
    const imprimir = impresora.imprimir.bind(impresora);
    impresora.imprimir = async (t) => {
      enCurso++;
      expect(enCurso).toBe(1);
      await new Promise((r) => setTimeout(r, t.id === 'a' ? 20 : 1));
      orden.push(t.id);
      enCurso--;
      return imprimir(t);
    };
    const cola = crearCola(impresora);
    const resultados = await Promise.all(['a', 'b', 'c'].map((id) => cola.imprimir(trabajo(id))));
    expect(orden).toEqual(['a', 'b', 'c']);
    expect(resultados.every((r) => r.ok)).toBe(true);
    expect(cola.enEspera()).toBe(0);
  });

  it('el que falla llega a alFallar con su motivo y no frena al siguiente', async () => {
    const pendientes: string[] = [];
    const impresora = crearImpresoraDePrueba({
      fallar: (t) =>
        t.id === 'b'
          ? { ok: false, motivo: 'fuera_de_alcance', detalle: 'NetworkError' }
          : undefined,
    });
    const cola = crearCola(impresora, {
      alFallar: (t, r) => {
        pendientes.push(`${t.id}:${r.motivo}`);
        throw new Error('la base no respondió');
      },
    });
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((id) => cola.imprimir(trabajo(id))));
    expect([a?.ok, b?.ok, c?.ok]).toEqual([true, false, true]);
    expect(pendientes).toEqual(['b:fuera_de_alcance']);
    expect(impresora.recibidos.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('un adaptador que lanza o no responde da un resultado, nunca una excepción', async () => {
    vi.useFakeTimers();
    try {
      const lanza = crearImpresoraDePrueba();
      lanza.imprimir = async () => {
        throw new TypeError('roto');
      };
      expect(await crearCola(lanza).imprimir(trabajo('x'))).toMatchObject({
        ok: false,
        motivo: 'no_soportado',
      });
      const muda = crearImpresoraDePrueba();
      muda.imprimir = () => new Promise<never>(() => undefined);
      const pendiente = crearCola(muda, { msMaximo: 5_000 }).imprimir(trabajo('y'));
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await pendiente).toMatchObject({ ok: false, motivo: 'tiempo' });
    } finally {
      vi.useRealTimers();
    }
  });
});
