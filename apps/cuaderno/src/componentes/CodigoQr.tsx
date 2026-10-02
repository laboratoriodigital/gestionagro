/**
 * Un código QR en SVG, dibujado con Preact a partir de la matriz de `qrcode-generator` (MIT): sin
 * `innerHTML`, así el contenido nunca se interpreta como HTML. La misma matriz sirve para la
 * imagen que se comparte (`imagenDeEtiqueta`).
 */
import qrcode from 'qrcode-generator';

/** Los módulos del QR: `oscuro(fila, columna)` y su lado en módulos. */
export function matrizQr(texto: string): { n: number; oscuro: (f: number, c: number) => boolean } {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  return { n: qr.getModuleCount(), oscuro: (f, c) => qr.isDark(f, c) };
}

export function CodigoQr(props: { texto: string; titulo: string }) {
  const { n, oscuro } = matrizQr(props.texto);
  const margen = 2;
  let camino = '';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (oscuro(f, c)) camino += `M${c + margen} ${f + margen}h1v1h-1z`;
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

/**
 * La etiqueta como imagen PNG cuadrada, para compartirla por WhatsApp u otra app: el QR, el
 * código del lote, la finca y si está verificada. Se dibuja en el teléfono (browser-first).
 */
export async function imagenDeEtiqueta(datos: {
  enlace: string;
  codigo: string;
  finca: string;
  estado: string;
}): Promise<Blob> {
  const lado = 720;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('el navegador no puede dibujar la imagen');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lado, lado);
  const { n, oscuro } = matrizQr(datos.enlace);
  const zonaQr = 540;
  const modulo = Math.floor(zonaQr / (n + 4));
  const inicio = Math.floor((lado - modulo * n) / 2);
  ctx.fillStyle = '#000';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (oscuro(f, c))
        ctx.fillRect(inicio + c * modulo, 24 + 2 * modulo + f * modulo, modulo, modulo);
    }
  }
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(datos.codigo, lado / 2, 622);
  ctx.font = '28px sans-serif';
  ctx.fillText(datos.finca, lado / 2, 664, lado - 40);
  ctx.fillText(datos.estado, lado / 2, 700);
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (b) => (b ? resolver(b) : rechazar(new Error('no se pudo crear la imagen'))),
      'image/png',
    ),
  );
}
