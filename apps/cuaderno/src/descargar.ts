/**
 * Descargar un archivo hecho en el teléfono (respaldo, CSV para Excel, disponibilidad para la
 * Tienda). Una sola fuente para las pantallas que descargan (P2).
 */

/** «Finca Ensayo Uno» → «finca-ensayo-uno», para el nombre del archivo. */
export const corto = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function descargar(nombre: string, contenido: string | Uint8Array, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido as BlobPart], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  // Se libera después: algunos navegadores leen el enlace cuando el clic ya terminó.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
