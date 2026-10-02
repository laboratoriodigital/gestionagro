/**
 * Un código QR en SVG, dibujado con Preact a partir de la matriz de `qrcode-generator` (MIT): sin
 * `innerHTML`, así el contenido nunca se interpreta como HTML.
 */
import qrcode from 'qrcode-generator';

export function CodigoQr(props: { texto: string; titulo: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(props.texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const margen = 2;
  let camino = '';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(f, c)) camino += `M${c + margen} ${f + margen}h1v1h-1z`;
    }
  }
  const lado = n + margen * 2;
  return (
    <svg
      class="codigo-qr"
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={props.titulo}
      shape-rendering="crispEdges"
    >
      <rect width={lado} height={lado} fill="#fff" />
      <path d={camino} fill="#000" />
    </svg>
  );
}
