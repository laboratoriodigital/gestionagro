/**
 * El diálogo de impresión del sistema (PARQUEADERO §7.5, HU-Q2.5): el recibo en HTML a 48 mm, por
 * `window.print()`. En Windows, la PT-210 por USB con el driver POS58; con el acceso directo de
 * Chrome con `--kiosk-printing`, sin ver el diálogo en cada recibo. Sirve también para una
 * impresora común. Es respaldo, no camino: el texto sale como imagen, más lento que ESC/POS.
 *
 * - El HTML sale de los mismos bloques que los bytes ESC/POS: otra salida del mismo recibo, no
 *   otra plantilla (CA3). Cada línea dice lo mismo que en la térmica, a las mismas columnas.
 * - Sin estilos en línea: la CSP de quien imprime no los deja (`style-src 'self'`). Las clases de
 *   `CLASES_DE_LA_HOJA` las pinta su hoja de estilos.
 * - La hoja se agrega a la página solo mientras imprime: en pantalla no se ve, y al imprimir es lo
 *   único. Con la clase en `<html>`, otra impresión de la página (una hoja carta) no la lleva.
 */
import type { EstadoImpresora, Impresora, Resultado, Trabajo, Vinculo } from './contrato.ts';
import {
  AJUSTES_POR_DEFECTO,
  type AjustesDeImpresion,
  type Bloque,
  lineaPar,
  prepararTexto,
} from './documento.ts';

/** Las clases que la hoja de estilos de quien imprime tiene que pintar. */
export const CLASES_DE_LA_HOJA = {
  /** En `<html>` mientras se imprime: todo lo demás de la página se oculta. */
  imprimiendo: 'imprimiendo-hoja-58',
  /** El contenedor que se agrega a `<body>`; oculto en pantalla. */
  trabajo: 'impresion-del-sistema',
  /** La hoja de 48 mm, con `l` (línea), `c` (centro), `d` (derecha), `n` (negrita), `g` (grande). */
  hoja: 'hoja-58',
  qr: 'qr',
} as const;

const ENTIDADES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ENTIDADES[c] ?? c);

/** El QR como un trazo SVG, con la zona en blanco de 4 módulos: se lee igual que el impreso. */
async function qrSvg(valor: string): Promise<string> {
  const { generate, correction } = await import('lean-qr/nano');
  const qr = generate(valor, { minCorrectionLevel: correction.L });
  const lado = qr.size + 8;
  let trazo = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.get(x, y)) trazo += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  }
  return `<svg class="${CLASES_DE_LA_HOJA.qr}" viewBox="0 0 ${lado} ${lado}" role="img" aria-label="Código QR" shape-rendering="crispEdges"><rect width="${lado}" height="${lado}" fill="#fff"/><path d="${trazo}" fill="#000"/></svg>`;
}

/**
 * Los bloques en una hoja HTML de 48 mm: las mismas líneas que `codificar` manda a la térmica,
 * con la misma preparación del texto. Determinista: los mismos bloques dan el mismo HTML.
 */
export async function htmlDeBloques(
  bloques: readonly Bloque[],
  ajustes: AjustesDeImpresion = AJUSTES_POR_DEFECTO,
): Promise<string> {
  const col = ajustes.columnas;
  const pagina = ajustes.paginaDeCodigos;
  const filas: string[] = [];
  const linea = (texto: string, clases: readonly string[] = []) => {
    const clase = ['l', ...clases].join(' ');
    filas.push(`<div class="${clase}">${texto ? escapar(texto) : '&nbsp;'}</div>`);
  };
  for (const b of bloques) {
    switch (b.tipo) {
      case 'texto': {
        const clases = [
          ...(b.alinear === 'centro' ? ['c'] : b.alinear === 'derecha' ? ['d'] : []),
          ...(b.negrita ? ['n'] : []),
          ...(b.grande ? ['g'] : []),
        ];
        for (const l of prepararTexto(b.texto, b.paginaDeCodigos ?? pagina).split('\n')) {
          linea(l, clases);
        }
        break;
      }
      case 'par':
        for (const l of lineaPar(
          prepararTexto(b.izquierda, pagina),
          prepararTexto(b.derecha, pagina),
          col,
        )) {
          linea(l);
        }
        break;
      case 'regla':
        linea('-'.repeat(col));
        break;
      case 'qr':
        filas.push(await qrSvg(b.valor));
        break;
      case 'espacio':
        for (let i = 0; i < b.lineas; i++) linea('');
        break;
    }
  }
  return `<div class="${CLASES_DE_LA_HOJA.hoja}" data-columnas="${col}">${filas.join('')}</div>`;
}

/** El texto de una hoja, línea por línea, como lo leería quien la mira: para las pruebas. */
export function lineasDeHoja(html: string): string[] {
  const desescapar = (t: string) =>
    t
      .replaceAll('&nbsp;', '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
  return [...html.matchAll(/<div class="l[^"]*">(.*?)<\/div>|<svg /g)].map((m) =>
    m[1] === undefined ? '[QR]' : desescapar(m[1]),
  );
}

/** Lo mínimo de la ventana que usa el adaptador. */
export interface VentanaParaImprimir {
  readonly document: Pick<
    Document,
    'createElement' | 'body' | 'documentElement' | 'querySelectorAll'
  >;
  print(): void;
  addEventListener(tipo: 'afterprint', oyente: () => void, o?: { once: boolean }): void;
}

export interface OpcionesSistema {
  readonly ventana: VentanaParaImprimir;
  /** Se recibe, como en los demás adaptadores (P8). */
  readonly reloj: () => number;
}

export const VINCULO_DEL_SISTEMA: Vinculo = {
  camino: 'sistema',
  nombre: 'Diálogo de impresión del equipo',
  id: 'sistema',
};

export function crearImpresoraSistema(o: OpcionesSistema): Impresora & { diagnostico(): string } {
  const reloj = o.reloj;
  const doc = o.ventana.document;
  let estado: EstadoImpresora = 'sin_vincular';
  let trabajos = 0;
  let ultimo = 'ninguno';

  /** Quita la hoja y la clase. También la que quedó si `afterprint` nunca llegó. */
  const limpiar = () => {
    for (const viejo of doc.querySelectorAll(`.${CLASES_DE_LA_HOJA.trabajo}`)) viejo.remove();
    doc.documentElement.classList.remove(CLASES_DE_LA_HOJA.imprimiendo);
  };

  return {
    camino: 'sistema',
    async vincular() {
      estado = 'conectada';
      return VINCULO_DEL_SISTEMA;
    },
    // No hay conexión que abrir: el sistema tiene su impresora.
    async reconectar() {
      estado = 'conectada';
      return true;
    },
    async imprimir(t: Trabajo): Promise<Resultado> {
      if (t.formato !== 'html') {
        return {
          ok: false,
          motivo: 'no_soportado',
          detalle: 'El diálogo de impresión del equipo imprime HTML, no ESC/POS',
        };
      }
      const inicio = reloj();
      limpiar();
      const hoja = doc.createElement('div');
      hoja.className = CLASES_DE_LA_HOJA.trabajo;
      hoja.innerHTML = t.html;
      doc.body.append(hoja);
      doc.documentElement.classList.add(CLASES_DE_LA_HOJA.imprimiendo);
      // En Chrome, `print()` espera a que se cierre el diálogo y `afterprint` llega antes de volver.
      o.ventana.addEventListener('afterprint', limpiar, { once: true });
      trabajos += 1;
      try {
        o.ventana.print();
      } catch (e) {
        limpiar();
        ultimo = `falló: ${String(e)}`;
        return {
          ok: false,
          motivo: 'no_soportado',
          detalle: `El navegador no abrió el diálogo de impresión: ${String(e)}`,
        };
      }
      ultimo = `${t.html.length} caracteres de HTML`;
      return { ok: true, bytes: t.html.length, ms: reloj() - inicio, papel: 'desconocido' };
    },
    estado: () => estado,
    diagnostico: () =>
      `Impresora: diálogo de impresión del equipo · trabajos en esta sesión: ${trabajos} · último: ${ultimo}`,
  };
}
