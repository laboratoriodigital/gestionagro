/**
 * Los derechos del titular en el panel (HU-T7.3): lo que la pantalla necesita para buscar a un
 * comprador por su celular y descargar, corregir o borrar sus datos. Puras, para probarlas sin
 * navegador. La API vuelve a revisar todo; aquí solo se evita mandar lo que no va a pasar.
 */

export interface PedidoDelTitular {
  id: string;
  numero: number;
  creado: string;
  estado: string;
  totalCop: number;
  terminado: boolean;
  ciudad: string | null;
}

export interface Encontrados {
  estado: 'ok';
  comprador: { nombre: string | null; celular: string } | null;
  pedidos: PedidoDelTitular[];
}

export interface DatosDelTitular {
  formato: 'titular/1';
  exportada: string;
  pedidos: unknown[];
}

export interface Hecho {
  estado: 'guardado';
  pedidos: number;
  enCurso: number;
}

/** Los 10 dígitos de un celular de Colombia, con o sin +57; `null` si no lo es. */
export function celularDe(texto: string): string | null {
  const d = texto.replace(/\D/g, '');
  const local = d.length === 12 && d.startsWith('57') ? d.slice(2) : d;
  return /^3\d{9}$/.test(local) ? local : null;
}

const pedidos = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`);

/** Lo que pasó al corregir o borrar, en una frase. */
export function hechoEnPalabras(accion: 'corregir' | 'suprimir', r: Hecho): string {
  if (accion === 'corregir')
    return r.pedidos === 0
      ? 'No había pedidos con ese celular: no se corrigió nada.'
      : `Se corrigieron los datos de ${pedidos(r.pedidos)}.`;
  const borrados =
    r.pedidos === 0
      ? 'No se borró ningún dato'
      : `Se borraron los datos de ${pedidos(r.pedidos)}; los pedidos quedan, sin ellos, como prueba de la venta`;
  const enCurso = r.enCurso
    ? `. ${r.enCurso === 1 ? 'Un pedido en curso guarda los suyos' : `${r.enCurso} pedidos en curso guardan los suyos`} hasta terminar: bórralos cuando lleguen.`
    : '.';
  return borrados + enCurso;
}

export const CAMPOS_DEL_CONTACTO = [
  ['nombre', 'Nombre'],
  ['celular', 'Celular'],
  ['correo', 'Correo'],
  ['direccion', 'Dirección'],
  ['ciudad', 'Ciudad'],
] as const;
export type CampoDelContacto = (typeof CAMPOS_DEL_CONTACTO)[number][0];

/** Lo que se va a corregir: solo lo escrito. Un celular nuevo, en sus 10 dígitos. */
export function correccionDe(
  form: Partial<Record<CampoDelContacto, string>>,
): { contacto: Partial<Record<CampoDelContacto, string>> } | { error: string } {
  const contacto: Partial<Record<CampoDelContacto, string>> = {};
  for (const [k] of CAMPOS_DEL_CONTACTO) {
    const v = form[k]?.trim();
    if (v) contacto[k] = v;
  }
  if (contacto.celular !== undefined) {
    const c = celularDe(contacto.celular);
    if (!c) return { error: 'El celular nuevo debe tener 10 dígitos y empezar por 3.' };
    contacto.celular = c;
  }
  if (Object.keys(contacto).length === 0) return { error: 'Escribe lo que hay que corregir.' };
  return { contacto };
}

/** El archivo que se le entrega al comprador: el día, sin su celular en el nombre. */
export const nombreDeLaDescarga = (d: Pick<DatosDelTitular, 'exportada'>) =>
  `datos-del-comprador-${d.exportada.slice(0, 10)}.json`;
