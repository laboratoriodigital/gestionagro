/**
 * La página de prueba de la impresora (PARQUEADERO §7.7): la regla de 32 columnas, la misma línea
 * en tres páginas de códigos y sin tildes, y el QR nativo y el de imagen. El operador mira el papel
 * y responde tres preguntas; sus respuestas son los `AjustesDeImpresion` de la caja.
 */
import type { AjustesDeImpresion, Bloque, PaginaDeCodigos } from './documento.ts';

export const MUESTRA = 'áéíóú ñÑ ¿¡ $';

/** El orden de las líneas en el papel: la respuesta «línea 1» es `cp850`. */
export const LINEAS_DE_PRUEBA: readonly PaginaDeCodigos[] = [
  'cp850',
  'windows1252',
  'cp858',
  'transliterar',
];

const ETIQUETA: Readonly<Record<PaginaDeCodigos, string>> = {
  cp850: 'CP850   ',
  windows1252: 'WPC1252 ',
  cp858: 'CP858   ',
  transliterar: 'Sin tildes:',
};

/** `fecha` llega ya escrita (`06/10/2026`): el paquete no lee el reloj (P8). */
export function paginaDePrueba(fecha: string, contenidoQr: string): Bloque[] {
  const columnas = 32;
  return [
    { tipo: 'par', izquierda: 'PRUEBA DE IMPRESORA', derecha: fecha },
    { tipo: 'texto', texto: '12345678901234567890123456789012'.slice(0, columnas) },
    ...LINEAS_DE_PRUEBA.map(
      (pagina, i): Bloque => ({
        tipo: 'texto',
        texto: `${i + 1}) ${ETIQUETA[pagina]} ${MUESTRA}`,
        paginaDeCodigos: pagina,
      }),
    ),
    { tipo: 'texto', texto: 'QR nativo:' },
    { tipo: 'qr', valor: contenidoQr, modo: 'nativo' },
    { tipo: 'texto', texto: 'QR imagen:' },
    { tipo: 'qr', valor: contenidoQr, modo: 'imagen' },
  ];
}

/** Las tres respuestas del operador (§7.7 paso 4). */
export interface RespuestasDePrueba {
  /** 1 a 4: la línea que se lee bien. `null`: ninguna. */
  readonly lineaLegible: 1 | 2 | 3 | 4 | null;
  readonly qrNativoLee: boolean;
  readonly qrImagenLee: boolean;
  readonly reglaCabe: boolean;
}

/**
 * Las respuestas en ajustes. Si ninguna línea con tildes se ve bien, translitera: nunca imprime
 * basura (HU-Q2.6 CA3). Si ningún QR se lee, devuelve `null` en `qr`: la caja no lo da por probado.
 */
export function ajustesDesdeRespuestas(
  r: RespuestasDePrueba,
): Omit<AjustesDeImpresion, 'qr' | 'avanceFinal'> & { qr: 'nativo' | 'imagen' | null } {
  const pagina = r.lineaLegible === null ? 'transliterar' : LINEAS_DE_PRUEBA[r.lineaLegible - 1];
  return {
    paginaDeCodigos: pagina ?? 'transliterar',
    qr: r.qrNativoLee ? 'nativo' : r.qrImagenLee ? 'imagen' : null,
    // La regla de 32 no cupo: la impresora tiene menos columnas. 30 deja margen sin medir otra vez.
    columnas: r.reglaCabe ? 32 : 30,
  };
}
