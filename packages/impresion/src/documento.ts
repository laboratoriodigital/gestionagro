/**
 * Un recibo como una lista de bloques, y su codificación a ESC/POS para 58 mm (PARQUEADERO §6.2 y
 * §7.3). Quien arma el recibo (el parqueadero, la Tienda) produce bloques; este archivo los vuelve
 * bytes con el codificador `@point-of-sale/receipt-printer-encoder` y el perfil `pos-5890`.
 *
 * El codificador pesa unos 29 KB con gzip: se importa al codificar el primer trabajo, no al abrir
 * la caja, para que no cuente en el JS inicial (HU-Q3.1, presupuesto de 80 KB).
 */
import { filtrarControl, simplificarTipografia, transliterar } from './texto.ts';

/** Las páginas de códigos de la página de prueba (§7.7) y `transliterar` si ninguna se lee bien. */
export type PaginaDeCodigos = 'cp850' | 'windows1252' | 'cp858' | 'transliterar';

export type Bloque =
  | {
      readonly tipo: 'texto';
      readonly texto: string;
      readonly alinear?: 'izquierda' | 'centro' | 'derecha';
      readonly negrita?: boolean;
      /** Doble de alto y de ancho: la mitad de columnas. */
      readonly grande?: boolean;
      /** Solo para la página de prueba: imprime esta línea con otra página de códigos. */
      readonly paginaDeCodigos?: PaginaDeCodigos;
    }
  /** Texto a la izquierda y a la derecha en la misma línea: «Placa ABC123      Carro». */
  | { readonly tipo: 'par'; readonly izquierda: string; readonly derecha: string }
  | { readonly tipo: 'regla' }
  | {
      readonly tipo: 'qr';
      readonly valor: string;
      /** Si se omite, el de los ajustes. */
      readonly modo?: 'nativo' | 'imagen';
    }
  | { readonly tipo: 'espacio'; readonly lineas: number };

export interface AjustesDeImpresion {
  readonly paginaDeCodigos: PaginaDeCodigos;
  readonly qr: 'nativo' | 'imagen';
  /** 32 en la fuente A de una térmica de 58 mm. */
  readonly columnas: number;
  /** Líneas en blanco al final para rasgar: la PT-210 no corta. */
  readonly avanceFinal: number;
}

export const AJUSTES_POR_DEFECTO: AjustesDeImpresion = {
  paginaDeCodigos: 'cp850',
  qr: 'nativo',
  columnas: 32,
  avanceFinal: 3,
};

/** Ancho de la cabeza térmica de 58 mm, en puntos (§6.2). */
export const PUNTOS_DE_ANCHO = 384;

/** El texto como se va a imprimir: sin bytes de control y sin lo que la página no tiene. */
export function prepararTexto(texto: string, pagina: PaginaDeCodigos): string {
  const limpio = filtrarControl(texto);
  return pagina === 'transliterar' ? transliterar(limpio) : simplificarTipografia(limpio);
}

/** «Placa ABC123» y «Carro» en una línea de `columnas`; si no caben, en dos. */
export function lineaPar(izquierda: string, derecha: string, columnas: number): string[] {
  const hueco = columnas - izquierda.length - derecha.length;
  if (hueco >= 1) return [izquierda + ' '.repeat(hueco) + derecha];
  return [izquierda, ' '.repeat(Math.max(0, columnas - derecha.length)) + derecha];
}

const CODIGO_DEL_ENCODER = {
  cp850: 'cp850',
  windows1252: 'windows1252',
  cp858: 'cp858',
  // ASCII es igual en todas; cp437 es la 0 de la tabla del perfil.
  transliterar: 'cp437',
} as const;

const ALINEAR = { izquierda: 'left', centro: 'center', derecha: 'right' } as const;

/**
 * Lo mínimo de `ImageData` para Node y workerd, que no la tienen. El codificador reconoce la
 * imagen por el nombre de su clase, y un minificador lo cambia: en el navegador se usa la de verdad.
 */
class ImageDataMinima {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
Object.defineProperty(ImageDataMinima, 'name', { value: 'ImageData' });

/**
 * El QR como imagen en blanco y negro, para la impresora que no entiende `GS ( k`. Ancho múltiplo
 * de 8 (cada byte son 8 puntos) y unos 28 mm (§6.2), con la zona en blanco de 4 módulos.
 */
async function qrComoImagen(valor: string): Promise<{ width: number; height: number }> {
  const { generate, correction } = await import('lean-qr/nano');
  const qr = generate(valor, { minCorrectionLevel: correction.L });
  const modulos = qr.size + 8;
  const escala = Math.max(2, Math.min(6, Math.floor(224 / modulos)));
  const lado = Math.ceil((modulos * escala) / 8) * 8;
  const datos = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const mx = Math.floor(x / escala) - 4;
      const my = Math.floor(y / escala) - 4;
      if (mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.get(mx, my)) {
        const i = (y * lado + x) * 4;
        datos[i] = 0;
        datos[i + 1] = 0;
        datos[i + 2] = 0;
      }
    }
  }
  const Clase = globalThis.ImageData ?? ImageDataMinima;
  return new Clase(datos, lado, lado);
}

/** Los bloques en bytes ESC/POS. Determinista: los mismos bloques dan los mismos bytes (§15.1). */
export async function codificar(
  bloques: readonly Bloque[],
  ajustes: AjustesDeImpresion = AJUSTES_POR_DEFECTO,
): Promise<Uint8Array> {
  const { default: Codificador } = await import('@point-of-sale/receipt-printer-encoder');
  const e = new Codificador({
    printerModel: 'pos-5890',
    columns: ajustes.columnas,
    feedAfterBlock: false,
    errors: 'relaxed',
  });
  const pagina = ajustes.paginaDeCodigos;
  e.initialize().codepage(CODIGO_DEL_ENCODER[pagina]);

  for (const b of bloques) {
    switch (b.tipo) {
      case 'texto': {
        const propia = b.paginaDeCodigos ?? pagina;
        if (propia !== pagina) e.codepage(CODIGO_DEL_ENCODER[propia]);
        e.align(ALINEAR[b.alinear ?? 'izquierda']);
        if (b.negrita) e.bold(true);
        if (b.grande) e.size(2, 2);
        for (const linea of prepararTexto(b.texto, propia).split('\n')) e.line(linea);
        if (b.grande) e.size(1, 1);
        if (b.negrita) e.bold(false);
        e.align('left');
        if (propia !== pagina) e.codepage(CODIGO_DEL_ENCODER[pagina]);
        break;
      }
      case 'par':
        for (const l of lineaPar(
          prepararTexto(b.izquierda, pagina),
          prepararTexto(b.derecha, pagina),
          ajustes.columnas,
        )) {
          e.line(l);
        }
        break;
      case 'regla':
        e.line('-'.repeat(ajustes.columnas));
        break;
      case 'qr': {
        e.align('center');
        if ((b.modo ?? ajustes.qr) === 'nativo') {
          e.qrcode(b.valor, { model: 2, size: 6, errorlevel: 'l' });
        } else {
          const imagen = await qrComoImagen(b.valor);
          e.image(
            imagen as unknown as globalThis.ImageData,
            imagen.width,
            imagen.height,
            'threshold',
          );
        }
        e.newline();
        e.align('left');
        break;
      }
      case 'espacio':
        e.newline(b.lineas);
        break;
    }
  }
  e.newline(ajustes.avanceFinal);
  return e.encode();
}
