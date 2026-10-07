/**
 * Los enlaces de WhatsApp en un solo lugar (ADR-39; PARQUEADERO §6.4; HU-Q1.6). Antes de este
 * paquete, el agro armaba `https://wa.me/?text=…` a mano en tres sitios (P2).
 *
 * - Un número que no se puede normalizar **lanza**: nunca se arma un enlace a un número inventado.
 * - Un texto que empieza con emoji lanza: WhatsApp lo corta o lo muestra roto en el aviso
 *   (bitácora ecommerce, menores).
 * - El enlace del recibo va en su propia línea, para que WhatsApp lo convierta en vínculo.
 * - `encodeURIComponent` se llama aquí y en ningún otro lado.
 * - Sin `Intl`, sin reloj y sin módulos de Node: corre igual en el navegador, Node y workerd
 *   (`tests/repo/tienda-paquetes-puros.test.ts`).
 */

/** El indicativo que se pone cuando el número no trae uno: Colombia. */
export const INDICATIVO_POR_DEFECTO = '57';

/** Algo que no se puede convertir en un enlace. `motivo` nombra la causa para el aviso (P15). */
export class WhatsAppInvalido extends Error {
  readonly motivo: 'numero' | 'texto';
  constructor(motivo: 'numero' | 'texto', mensaje: string) {
    super(mensaje);
    this.name = 'WhatsAppInvalido';
    this.motivo = motivo;
  }
}

/** Lo que una persona escribe entre los dígitos de un teléfono y no cambia el número. */
const SEPARADORES = /[\s\-.()/]/g;

/**
 * El número en la forma que pide `wa.me`: solo dígitos, con indicativo y sin `+`.
 *
 * - `300 123 4567`, `+57 300 123 4567` y `573001234567` dan `573001234567`.
 * - Diez dígitos que empiezan por 3 (celular) o por 60 (fijo) son de Colombia.
 * - Con `+` o `00`, el número trae su indicativo y se respeta: `+1 415 555 0100` da `14155550100`.
 * - Sin `+`, de 11 a 15 dígitos, se toma como que ya trae su indicativo.
 * - Lo demás lanza: un número corto, con letras o colombiano de longitud equivocada.
 */
export function normalizarNumero(entrada: string): string {
  const limpio = entrada.trim().replace(SEPARADORES, '');
  let digitos: string;
  let conIndicativo: boolean;
  if (limpio.startsWith('+')) {
    digitos = limpio.slice(1);
    conIndicativo = true;
  } else if (limpio.startsWith('00')) {
    digitos = limpio.slice(2);
    conIndicativo = true;
  } else {
    digitos = limpio;
    conIndicativo = false;
  }
  if (!/^\d+$/.test(digitos)) {
    throw new WhatsAppInvalido(
      'numero',
      `«${entrada}» no es un número de teléfono: tiene letras o símbolos`,
    );
  }
  if (!conIndicativo && digitos.length === 10 && /^(3|60)/.test(digitos)) {
    return INDICATIVO_POR_DEFECTO + digitos;
  }
  if (!conIndicativo && digitos.length < 11) {
    throw new WhatsAppInvalido(
      'numero',
      `«${entrada}» no es un celular de Colombia (10 dígitos, empieza por 3) ni trae indicativo`,
    );
  }
  // E.164: hasta 15 dígitos con el indicativo; ningún país usa menos de 8.
  if (digitos.length < 8 || digitos.length > 15 || digitos.startsWith('0')) {
    throw new WhatsAppInvalido('numero', `«${entrada}» no tiene la longitud de un teléfono`);
  }
  if (digitos.startsWith(INDICATIVO_POR_DEFECTO) && digitos.length !== 12) {
    throw new WhatsAppInvalido(
      'numero',
      `«${entrada}» empieza por 57 pero no tiene los 10 dígitos de un número de Colombia`,
    );
  }
  return digitos;
}

/** Un pictograma o sus piezas: lo que WhatsApp no deja al principio de un mensaje. */
const EMOJI_AL_PRINCIPIO =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{FE0F}|\u{200D})/u;

/** Revisa el texto antes de ponerlo en un enlace. Lanza si está vacío o empieza con emoji. */
export function validarTexto(texto: string): string {
  const inicio = texto.trimStart();
  if (inicio === '') throw new WhatsAppInvalido('texto', 'El mensaje está vacío');
  if (EMOJI_AL_PRINCIPIO.test(inicio)) {
    throw new WhatsAppInvalido(
      'texto',
      'El mensaje empieza con un emoji: WhatsApp lo corta en el aviso. Póngalo después del texto',
    );
  }
  return texto;
}

const URL_EN_LINEA = /https?:\/\/\S+/;

/**
 * Junta las líneas de un mensaje. Una línea con un enlace tiene que tener solo el enlace, para
 * que WhatsApp lo convierta en vínculo (PARQUEADERO §6.4); si no, lanza.
 */
export function armarTexto(lineas: readonly string[]): string {
  const limpias = lineas.map((l) => l.trim());
  for (const linea of limpias) {
    const enlace = URL_EN_LINEA.exec(linea);
    if (enlace && enlace[0] !== linea) {
      throw new WhatsAppInvalido(
        'texto',
        `El enlace tiene que ir solo en su línea para que WhatsApp lo abra: «${linea}»`,
      );
    }
  }
  return validarTexto(limpias.join('\n'));
}

/** El único `encodeURIComponent` de los enlaces de WhatsApp. */
function parametroTexto(texto: string): string {
  return `text=${encodeURIComponent(validarTexto(texto))}`;
}

/** `https://wa.me/<numero>?text=…`: abre el chat con ese número y el mensaje escrito. */
export function enlaceConNumero(numero: string, texto: string): string {
  return `https://wa.me/${normalizarNumero(numero)}?${parametroTexto(texto)}`;
}

/** `https://wa.me/?text=…`: deja elegir el chat. Es la forma que usa el agro. */
export function enlaceParaCompartir(texto: string): string {
  return `https://wa.me/?${parametroTexto(texto)}`;
}
