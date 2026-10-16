/**
 * Publicar y las versiones sin la pantalla (HU-T10.4): dónde se arregla cada falla de la compuerta
 * y cómo se dice cada versión. Puras, para probarlas sin navegador.
 */

export interface VersionDelPanel {
  version: number;
  estado: 'en_cola' | 'horneando' | 'lista' | 'publicada' | 'reemplazada' | 'fallida';
  /** «Tú», «Otra persona del equipo» o «La tienda». */
  autor: string;
  /** La que hace la tienda sola cuando cambian las existencias. */
  automatica: boolean;
  pedida: string;
  publicada: string | null;
  archivos: number | null;
  motivo: string | null;
}

export interface Versiones {
  versionPublicada: number | null;
  versiones: VersionDelPanel[];
}

const SECCIONES = new Set([
  'identidad',
  'contacto',
  'apariencia',
  'venta',
  'cobro',
  'legal',
  'medicion',
  'agentes',
  'avisos',
]);
const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** «Ajustes › Contacto» lleva a esa sección; «Productos», a los productos; «Soporte», a ninguna. */
export function enlaceDe(donde: string): string | null {
  const [lugar = '', seccion] = donde.split('›').map((x) => sinTildes(x.trim()));
  if (lugar === 'ajustes')
    return seccion && SECCIONES.has(seccion) ? `/mas/ajustes/${seccion}/` : '/mas/ajustes/';
  if (lugar.startsWith('productos')) return '/productos/';
  if (lugar === 'envios') return '/mas/venta/';
  return null;
}

export const enCurso = (v: VersionDelPanel) =>
  v.estado === 'en_cola' || v.estado === 'horneando' || v.estado === 'lista';

/** Se puede volver a una que estuvo publicada y ya no lo está (CA2). */
/**
 * Cada cuánto se vuelve a leer la lista mientras algo se hornea: 3 s la primera vez y el doble cada
 * vez, hasta un minuto. Un panel abierto mientras una publicación se corta ya no lee la lista cada
 * 3 s para siempre (bitácora tienda3 27: cada lectura gasta filas de D1 del plan gratuito).
 */
export const esperaAntesDeLeer = (lecturas: number) => Math.min(3000 * 2 ** lecturas, 60_000);

export const sePuedeVolver = (v: VersionDelPanel, publicada: number | null) =>
  (v.estado === 'reemplazada' || v.estado === 'publicada') && v.version !== publicada;

const cuantas = (n: number) => (n === 1 ? '1 cosa' : `${n} cosas`);

/** El resumen de una versión, en palabras (CA2). */
export function resumenDe(v: VersionDelPanel, publicada: number | null): string {
  if (enCurso(v)) return v.automatica ? 'Poniendo al día las existencias…' : 'Publicando…';
  if (v.estado === 'fallida') {
    let fallas: unknown = null;
    try {
      fallas = JSON.parse(v.motivo ?? '');
    } catch {
      // Un motivo en palabras, no la lista de la compuerta.
    }
    return Array.isArray(fallas)
      ? `No se publicó: faltaba corregir ${cuantas(fallas.length)}`
      : 'No se publicó: algo falló al subirla y la tienda siguió como estaba';
  }
  const partes = [
    v.version === publicada ? 'La que ve la tienda' : null,
    v.automatica ? 'Existencias al día' : null,
    v.archivos === null ? null : v.archivos === 1 ? '1 archivo' : `${v.archivos} archivos`,
  ].filter(Boolean);
  return partes.join(' · ');
}

const formato = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** «15 oct, 10:00 a. m.», en la hora de Colombia. */
export const cuando = (v: VersionDelPanel) => formato.format(new Date(v.publicada ?? v.pedida));
