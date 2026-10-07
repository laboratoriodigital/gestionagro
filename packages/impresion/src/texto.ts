/**
 * El texto antes de codificarlo. Lo que escribe una persona (una nota, un nombre, una placa) no
 * puede llevar bytes de control: un `ESC` o un `GS` en una nota cambiaría la impresora a mitad del
 * recibo (PARQUEADERO §13.1, HU-Q2.2 CA3).
 */

/**
 * Quita los caracteres de control C0 (salvo el salto de línea), `DEL` y los C1. Un tabulador pasa a
 * espacio. Los saltos `\r\n` y `\r` quedan como `\n`.
 */
export function filtrarControl(texto: string): string {
  return (
    texto
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, ' ')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: es justo lo que se quita
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '')
  );
}

/** Signos tipográficos que no están en todas las páginas de códigos, por su forma simple. */
const TIPOGRAFIA: ReadonlyArray<[RegExp, string]> = [
  [/[\u2013\u2014\u2212]/g, '-'],
  [/[\u2018\u2019\u201A\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u2033]/g, '"'],
  [/\u2026/g, '...'],
  [/[\u00A0\u2007\u202F]/g, ' '],
];

export function simplificarTipografia(texto: string): string {
  let r = texto;
  for (const [re, por] of TIPOGRAFIA) r = r.replace(re, por);
  return r;
}

/** Lo que no se resuelve quitando el acento. */
const SIN_TILDES: Readonly<Record<string, string>> = {
  ñ: 'n',
  Ñ: 'N',
  '¿': '?',
  '¡': '!',
  º: 'o',
  ª: 'a',
  '°': 'o',
  '€': 'EUR',
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
};

/**
 * Para una impresora que no imprime bien ninguna página de códigos: solo ASCII imprimible y el salto
 * de línea. `áéíóú ñÑ ¿¡ $` da `aeiou nN ?! $`. Lo que no tiene forma ASCII sale como `?`: nunca
 * se manda un byte que la impresora pinte como basura (HU-Q2.6 CA3).
 */
export function transliterar(texto: string): string {
  return simplificarTipografia(texto)
    .replace(/[ñÑ¿¡ºª°€ßæÆ]/g, (c) => SIN_TILDES[c] ?? '?')
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\n\u0020-\u007E]/gu, '?');
}
