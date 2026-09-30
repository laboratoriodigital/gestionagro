/**
 * Términos prohibidos: nombres reales de la finca cero y de sus personas (P4, HU-E1.7).
 *
 * Dos tipos de término:
 * - `nombre`: se busca sin distinguir mayúsculas ni tildes, como palabra completa y con
 *   cualquier espacio entre palabras («Pérez  gomez» atrapa «Pérez Gómez»).
 * - `nombre-propio`: palabras que también son vocabulario común del producto (p. ej. un
 *   adjetivo). Solo cuentan escritas con mayúscula inicial **en medio de una frase**, donde
 *   funcionan como nombre. Al comienzo de una línea o después de `.`, `!`, `?`, `¿`, `¡` o `«`
 *   se permiten. Lo que no imita (P17): no distingue un nombre propio al comienzo de frase.
 */

export interface Termino {
  tipo: 'nombre' | 'nombre-propio';
  valor: string;
}

export interface ListaDeTerminos {
  terminos: Termino[];
}

export interface Coincidencia {
  archivo: string;
  linea: number;
  termino: string;
}

/** Quita tildes y pasa a minúsculas. Conserva la longitud de las letras base. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const escaparRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Letras y dígitos, con tildes, para delimitar palabras (el `\b` de JS solo sabe ASCII). */
const LETRA = '[\\p{L}\\p{N}]';

function regexDeNombre(valor: string): RegExp {
  const cuerpo = normalizar(valor).trim().split(/\s+/).map(escaparRegex).join('\\s+');
  return new RegExp(`(?<!${LETRA})${cuerpo}(?!${LETRA})`, 'u');
}

/** Fin de texto que indica comienzo de frase: vacío, marcas de Markdown o puntuación de cierre. */
const COMIENZO_DE_FRASE = /(^|[.!?¿¡«])[\s#>*\-|]*$/u;

function coincideNombrePropio(linea: string, valor: string): boolean {
  const lineaNormal = normalizar(linea);
  const buscado = normalizar(valor);
  const patron = new RegExp(`(?<!${LETRA})${escaparRegex(buscado)}(?!${LETRA})`, 'gu');
  for (const m of lineaNormal.matchAll(patron)) {
    // Quitar las marcas tras NFD deja una letra por cada letra de la forma NFC, así que el
    // índice sirve para mirar la letra original (y su mayúscula) en la línea en NFC.
    const original = linea.normalize('NFC');
    const primera = original[m.index];
    if (
      primera === undefined ||
      primera !== primera.toUpperCase() ||
      primera === primera.toLowerCase()
    ) {
      continue; // en minúscula es vocabulario, no nombre
    }
    if (COMIENZO_DE_FRASE.test(original.slice(0, m.index))) continue;
    return true;
  }
  return false;
}

export function buscarEnTexto(
  archivo: string,
  texto: string,
  lista: ListaDeTerminos,
): Coincidencia[] {
  const coincidencias: Coincidencia[] = [];
  const nombres = lista.terminos
    .filter((t) => t.tipo === 'nombre')
    .map((t) => ({ t, re: regexDeNombre(t.valor) }));
  const propios = lista.terminos.filter((t) => t.tipo === 'nombre-propio');

  // Se busca línea por línea. Lo que no imita (P17): un nombre partido entre dos líneas.
  const lineas = texto.split(/\r?\n/);
  lineas.forEach((linea, i) => {
    const normal = normalizar(linea.normalize('NFC'));
    for (const { t, re } of nombres) {
      if (re.test(normal)) coincidencias.push({ archivo, linea: i + 1, termino: t.valor });
    }
    for (const t of propios) {
      if (coincideNombrePropio(linea, t.valor)) {
        coincidencias.push({ archivo, linea: i + 1, termino: t.valor });
      }
    }
  });
  return coincidencias;
}

/** Valida la lista: vacía no protege nada (P1), y un valor vacío coincidiría con todo. */
export function validarLista(datos: unknown): ListaDeTerminos {
  const lista = datos as Partial<ListaDeTerminos> | null;
  if (!lista || !Array.isArray(lista.terminos) || lista.terminos.length === 0) {
    throw new Error(
      'La lista de términos prohibidos está vacía o no tiene «terminos». Vacía no protege nada (P4).',
    );
  }
  for (const [i, t] of lista.terminos.entries()) {
    if (
      !t ||
      (t.tipo !== 'nombre' && t.tipo !== 'nombre-propio') ||
      typeof t.valor !== 'string' ||
      t.valor.trim().length < 3
    ) {
      throw new Error(
        `Término ${i} inválido: necesita «tipo» (nombre | nombre-propio) y un «valor» de 3 letras o más.`,
      );
    }
  }
  return lista as ListaDeTerminos;
}
