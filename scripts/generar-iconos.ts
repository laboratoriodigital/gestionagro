/**
 * `node scripts/generar-iconos.ts`: genera los íconos PNG del cuaderno (HU-E3.1, CA4) sin
 * dependencias: una hoja blanca sobre el verde de la marca. Determinista: la misma entrada da
 * los mismos bytes, y una prueba exige que los archivos del repositorio sean los generados (P2).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { RAIZ } from './lib/repo.ts';

const VERDE = [0x1f, 0x6b, 0x3a] as const;
const BLANCO = [0xff, 0xff, 0xff] as const;

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = (TABLA_CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** PNG RGB de `lado`×`lado`; `pintar(x, y)` devuelve el color de cada píxel. */
export function png(
  lado: number,
  pintar: (x: number, y: number) => readonly [number, number, number],
): Buffer {
  const filas = Buffer.alloc(lado * (1 + lado * 3));
  for (let y = 0; y < lado; y++) {
    const inicio = y * (1 + lado * 3);
    filas[inicio] = 0; // sin filtro
    for (let x = 0; x < lado; x++) {
      const [r, g, b] = pintar(x, y);
      filas.set([r, g, b], inicio + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, sin entrelazado
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(filas, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Hoja: intersección de dos círculos, inclinada 45°. `escala` < 1 la achica para la zona
 * segura de los íconos «maskable» (el sistema puede recortar hasta el 20 % del borde).
 */
export function hoja(lado: number, escala: number) {
  const c = lado / 2;
  const r = lado * 0.56 * escala;
  const d = r * 0.62;
  return (x: number, y: number) => {
    const u = (x + 0.5 - c + (y + 0.5 - c)) / Math.SQRT2;
    const v = (x + 0.5 - c - (y + 0.5 - c)) / Math.SQRT2;
    const dentro = (v - d) ** 2 + u ** 2 <= r * r && (v + d) ** 2 + u ** 2 <= r * r;
    const nervio = Math.abs(v) < lado * 0.012 && Math.abs(u) < r * 0.75;
    return dentro && !nervio ? BLANCO : VERDE;
  };
}

export const ICONOS = [
  { archivo: 'icono-192.png', lado: 192, escala: 1 },
  { archivo: 'icono-512.png', lado: 512, escala: 1 },
  { archivo: 'icono-maskable-512.png', lado: 512, escala: 0.72 },
] as const;

export const CARPETA_ICONOS = join(RAIZ, 'apps', 'cuaderno', 'public', 'iconos');

export function generar(): Map<string, Buffer> {
  return new Map(ICONOS.map((i) => [i.archivo, png(i.lado, hoja(i.lado, i.escala))]));
}

if (process.argv[1]?.endsWith('generar-iconos.ts')) {
  mkdirSync(CARPETA_ICONOS, { recursive: true });
  for (const [archivo, datos] of generar()) {
    writeFileSync(join(CARPETA_ICONOS, archivo), datos);
    console.log(`✅ ${archivo} (${datos.length} bytes)`);
  }
}
