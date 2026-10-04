/**
 * `node scripts/generar-iconos.ts`: genera la marca de CultivoPro desde la hoja de
 * `content/marca.json` (P2), sin dependencias y de forma determinista: la misma entrada da los
 * mismos bytes, y una prueba exige que los archivos del repositorio sean los generados.
 *
 * - Íconos del cuaderno (HU-E3.1, CA4): la hoja blanca sobre el verde de la marca, en PNG.
 * - Marca (cultivopro.co/marca/ y el favicon): la hoja sola y el ícono, en SVG y PNG con
 *   transparencia, y el logo con el nombre en SVG. El PNG del logo lleva texto, y el texto lo
 *   dibuja un navegador: sale de `scripts/exportar-logo.ts`, aparte.
 *
 * La hoja es un trazo SVG con curvas. Aquí se aplana en polígonos y se rellena por filas, con
 * cuatro subfilas por píxel y la cobertura horizontal exacta: bordes suaves sin depender de un
 * navegador ni de la máquina.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import marca from '../content/marca.json' with { type: 'json' };
import { RAIZ } from './lib/repo.ts';

type Rgb = readonly [number, number, number];
const VERDE: Rgb = [0x1f, 0x6b, 0x3a];
const BLANCO: Rgb = [0xff, 0xff, 0xff];
const VERDE_HEX = '#1f6b3a';

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

/** PNG de `ancho`×`alto`; `pintar(x, y)` da RGB o RGBA según `canales` (3 o 4). */
function pngDe(
  ancho: number,
  alto: number,
  canales: 3 | 4,
  pintar: (x: number, y: number) => readonly number[],
): Buffer {
  const fila = 1 + ancho * canales;
  const filas = Buffer.alloc(alto * fila);
  for (let y = 0; y < alto; y++) {
    filas[y * fila] = 0; // sin filtro
    for (let x = 0; x < ancho; x++) filas.set(pintar(x, y), y * fila + 1 + x * canales);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  // 8 bits; tipo 2 = RGB, 6 = RGBA; sin entrelazado.
  ihdr.set([8, canales === 3 ? 2 : 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(filas, { level: 9 })),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG RGB cuadrado; se conserva para los íconos del cuaderno. */
export function png(lado: number, pintar: (x: number, y: number) => Rgb): Buffer {
  return pngDe(lado, lado, 3, pintar);
}

// ── La hoja: del trazo SVG a polígonos ─────────────────────────────────────────────────────

type Punto = readonly [number, number];
/** Cada subtrazo cerrado, como lista de puntos. */
type Figura = Punto[][];

const PASOS_DE_CURVA = 32;

/** Lee un trazo con M, L, C y Z (mayúscula absoluta, minúscula relativa) y aplana las curvas. */
export function figuraDe(d: string): Figura {
  const fichas = d.match(/[MmLlCcZz]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const figura: Figura = [];
  let actual: Punto[] = [];
  let x = 0;
  let y = 0;
  let orden = '';
  let i = 0;
  const numero = () => Number(fichas[i++]);
  while (i < fichas.length) {
    const ficha = fichas[i] ?? '';
    if (/[A-Za-z]/.test(ficha)) {
      orden = ficha;
      i++;
      if (orden === 'Z' || orden === 'z') {
        if (actual.length > 0) figura.push(actual);
        actual = [];
      }
      continue;
    }
    const relativo = orden === orden.toLowerCase();
    const bx = relativo ? x : 0;
    const by = relativo ? y : 0;
    if (orden === 'M' || orden === 'm') {
      if (actual.length > 0) figura.push(actual);
      x = bx + numero();
      y = by + numero();
      actual = [[x, y]];
      // Pares que siguen a un M se leen como L.
      orden = relativo ? 'l' : 'L';
    } else if (orden === 'L' || orden === 'l') {
      x = bx + numero();
      y = by + numero();
      actual.push([x, y]);
    } else if (orden === 'C' || orden === 'c') {
      const [x1, y1, x2, y2, x3, y3] = [
        bx + numero(),
        by + numero(),
        bx + numero(),
        by + numero(),
        bx + numero(),
        by + numero(),
      ];
      const [x0, y0] = [x, y];
      for (let k = 1; k <= PASOS_DE_CURVA; k++) {
        const t = k / PASOS_DE_CURVA;
        const u = 1 - t;
        actual.push([
          u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      [x, y] = [x3, y3];
    } else {
      throw new Error(`Orden de trazo no soportada: ${orden}`);
    }
  }
  if (actual.length > 0) figura.push(actual);
  return figura;
}

export function cajaDe(figura: Figura) {
  const xs = figura.flat().map((p) => p[0]);
  const ys = figura.flat().map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { x0, y0, ancho: x1 - x0, alto: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** La hoja centrada en un cuadro de `lado`, ocupando `tamano` del lado. */
function colocar(figura: Figura, lado: number, tamano: number) {
  const caja = cajaDe(figura);
  const escala = (lado * tamano) / Math.max(caja.ancho, caja.alto);
  const tx = lado / 2 - caja.cx * escala;
  const ty = lado / 2 - caja.cy * escala;
  return {
    escala,
    tx,
    ty,
    figura: figura.map((poligono) =>
      poligono.map(([px, py]) => [px * escala + tx, py * escala + ty] as const),
    ),
  };
}

const SUBFILAS = 4;

/** Cuánto de cada píxel cubre la figura (0 a 1), con la regla «nonzero» de SVG. */
export function cobertura(figura: Figura, ancho: number, alto: number): Float64Array {
  const cubre = new Float64Array(ancho * alto);
  const aristas = figura.flatMap((poligono) =>
    poligono.map((p, k) => [p, poligono[(k + 1) % poligono.length] as Punto] as const),
  );
  for (let s = 0; s < alto * SUBFILAS; s++) {
    const yy = (s + 0.5) / SUBFILAS;
    const fila = Math.floor(yy);
    const cruces: { x: number; giro: number }[] = [];
    for (const [[ax, ay], [bx, by]] of aristas) {
      if (ay === by || yy < Math.min(ay, by) || yy >= Math.max(ay, by)) continue;
      cruces.push({ x: ax + ((yy - ay) * (bx - ax)) / (by - ay), giro: by > ay ? 1 : -1 });
    }
    cruces.sort((a, b) => a.x - b.x);
    let giro = 0;
    for (let k = 0; k < cruces.length - 1; k++) {
      giro += cruces[k]?.giro ?? 0;
      if (giro === 0) continue;
      const desde = Math.max(0, cruces[k]?.x ?? 0);
      const hasta = Math.min(ancho, cruces[k + 1]?.x ?? 0);
      for (let px = Math.floor(desde); px < Math.ceil(hasta); px++) {
        const tramo = Math.min(hasta, px + 1) - Math.max(desde, px);
        if (tramo > 0)
          cubre[fila * ancho + px] = (cubre[fila * ancho + px] ?? 0) + tramo / SUBFILAS;
      }
    }
  }
  return cubre;
}

const mezcla = (fondo: Rgb, frente: Rgb, t: number): Rgb =>
  fondo.map((c, k) => Math.round(c + ((frente[k] ?? 0) - c) * Math.min(1, t))) as unknown as Rgb;

/** Un cuadrado con las esquinas redondeadas, como polígono. */
function cuadradoRedondeado(lado: number, radio: number): Figura {
  const puntos: Punto[] = [];
  const esquinas: [number, number, number][] = [
    [lado - radio, radio, -90],
    [lado - radio, lado - radio, 0],
    [radio, lado - radio, 90],
    [radio, radio, 180],
  ];
  for (const [cx, cy, inicio] of esquinas) {
    for (let k = 0; k <= 16; k++) {
      const a = ((inicio + (90 * k) / 16) * Math.PI) / 180;
      puntos.push([cx + radio * Math.cos(a), cy + radio * Math.sin(a)]);
    }
  }
  return [puntos];
}

const HOJA = figuraDe(marca.hoja.d);
/** Cuánto del lado ocupa la hoja en un ícono; el «maskable» la achica (zona segura del 80 %). */
const TAMANO_EN_ICONO = 0.62;

/** Ícono del cuaderno: hoja blanca sobre verde, cuadrado (el sistema le pone la forma). */
function icono(lado: number, escala: number): Buffer {
  const { figura } = colocar(HOJA, lado, TAMANO_EN_ICONO * escala);
  const cubre = cobertura(figura, lado, lado);
  return png(lado, (x, y) => mezcla(VERDE, BLANCO, cubre[y * lado + x] ?? 0));
}

/** La hoja verde sobre transparente. */
function hojaTransparente(lado: number): Buffer {
  const { figura } = colocar(HOJA, lado, 0.9);
  const cubre = cobertura(figura, lado, lado);
  return pngDe(lado, lado, 4, (x, y) => [
    ...VERDE,
    Math.round(255 * Math.min(1, cubre[y * lado + x] ?? 0)),
  ]);
}

/** El ícono de la marca: cuadrado verde redondeado, hoja blanca, transparente afuera. */
function iconoRedondeado(lado: number): Buffer {
  const fondo = cobertura(cuadradoRedondeado(lado, (lado * 5) / 24), lado, lado);
  const { figura } = colocar(HOJA, lado, TAMANO_EN_ICONO);
  const hoja = cobertura(figura, lado, lado);
  return pngDe(lado, lado, 4, (x, y) => {
    const i = y * lado + x;
    return [...mezcla(VERDE, BLANCO, hoja[i] ?? 0), Math.round(255 * Math.min(1, fondo[i] ?? 0))];
  });
}

// ── SVG: la hoja tal cual, puesta en su lugar con una transformación ─────────────────────────

const cifra = (x: number) => Number(x.toFixed(3)).toString();

/** La hoja como `<path>`, centrada en un cuadro de `lado` unidades, desplazada `dx`. */
function pathDeHoja(lado: number, tamano: number, color: string, dx = 0): string {
  const { escala, tx, ty } = colocar(HOJA, lado, tamano);
  return `<path fill="${color}" transform="translate(${cifra(tx + dx)} ${cifra(ty)}) scale(${cifra(escala)})" d="${marca.hoja.d}" />`;
}

const comentario =
  '<!-- Generado por scripts/generar-iconos.ts desde content/marca.json. No editar a mano. -->';

const svgIcono = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <title>${marca.nombre}</title>
  ${comentario}
  <rect width="24" height="24" rx="5" fill="${VERDE_HEX}" />
  ${pathDeHoja(24, TAMANO_EN_ICONO, '#fff')}
</svg>
`;

const svgHoja = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512">
  <title>${marca.nombre}</title>
  ${comentario}
  ${pathDeHoja(24, 0.9, VERDE_HEX)}
</svg>
`;

/** Logo: la hoja y el nombre. El texto usa la letra del sistema; para imprenta, a curvas. */
const svgLogo = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 156 28" width="780" height="140">
  <title>${marca.nombre}</title>
  ${comentario}
  ${pathDeHoja(28, 0.7, color)}
  <text x="32" y="20.5" fill="${color}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" font-size="18" font-weight="800" letter-spacing="-0.2">${marca.nombre}</text>
</svg>
`;

export const ICONOS = [
  { archivo: 'icono-192.png', lado: 192, escala: 1 },
  { archivo: 'icono-512.png', lado: 512, escala: 1 },
  { archivo: 'icono-maskable-512.png', lado: 512, escala: 0.72 },
] as const;

export const CARPETA_ICONOS = join(RAIZ, 'apps', 'cuaderno', 'public', 'iconos');
const PUBLICO = join('apps', 'sitio', 'public');

/** Todo lo que se genera, con su ruta relativa a la raíz del repositorio. */
export function generar(): Map<string, Buffer> {
  const archivos = new Map<string, Buffer>(
    ICONOS.map((i) => [
      join('apps', 'cuaderno', 'public', 'iconos', i.archivo),
      icono(i.lado, i.escala),
    ]),
  );
  archivos.set(join(PUBLICO, 'favicon.svg'), Buffer.from(svgIcono()));
  archivos.set(join(PUBLICO, 'marca', 'cultivopro-icono.svg'), Buffer.from(svgIcono()));
  archivos.set(join(PUBLICO, 'marca', 'cultivopro-icono-512.png'), iconoRedondeado(512));
  archivos.set(join(PUBLICO, 'marca', 'cultivopro-hoja.svg'), Buffer.from(svgHoja()));
  archivos.set(join(PUBLICO, 'marca', 'cultivopro-hoja-512.png'), hojaTransparente(512));
  archivos.set(join(PUBLICO, 'marca', 'cultivopro-logo.svg'), Buffer.from(svgLogo(VERDE_HEX)));
  archivos.set(join(PUBLICO, 'marca', 'cultivopro-logo-blanco.svg'), Buffer.from(svgLogo('#fff')));
  return archivos;
}

if (process.argv[1]?.endsWith('generar-iconos.ts')) {
  for (const [ruta, datos] of generar()) {
    mkdirSync(dirname(join(RAIZ, ruta)), { recursive: true });
    writeFileSync(join(RAIZ, ruta), datos);
    console.log(`✅ ${ruta} (${datos.length} bytes)`);
  }
}
