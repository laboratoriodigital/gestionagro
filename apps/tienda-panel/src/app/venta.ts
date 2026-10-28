/**
 * Envíos y cupones sin la pantalla (HU-T10.1): lo que revisan los formularios antes de mandar y
 * cómo se dice cada cupón. Puras, para probarlas sin navegador. La API vuelve a revisar todo.
 */
import { enPesos, pesos } from './catalogo.ts';

type Error = { campo: string; mensaje: string };

export interface EnvioDelPanel {
  id: string;
  nombre: string;
  precioCop: number;
  gratisDesdeCop: number | null;
  ciudades: string[] | null;
  diasMin: number | null;
  diasMax: number | null;
  activa: boolean;
  version: number;
  /** Como lo verá el comprador. */
  plazo: string;
}

export interface CuponDelPanel {
  codigo: string;
  tipo: 'porcentaje' | 'valor' | 'envio_gratis';
  valor: number;
  minimoCop: number;
  desde: string | null;
  hasta: string | null;
  usosMaximos: number | null;
  usos: number;
  activo: boolean;
  version: number;
  /** HU-P1.3: los productos y las categorías en que aplica; `null`, en todo el carrito. */
  alcance?: { productos: string[]; colecciones: string[] } | null;
}

/** Sin otro pacto, un pedido llega en máximo 30 días calendario (Ley 2439). */
export const PLAZO_DE_LEY_DIAS = 30;

export interface FormularioDeEnvio {
  nombre: string;
  precio: string;
  gratisDesde: string;
  ciudades: string;
  diasMin: string;
  diasMax: string;
  activa: boolean;
}

export const formularioDeEnvio = (e: EnvioDelPanel | null): FormularioDeEnvio => ({
  nombre: e?.nombre ?? '',
  precio: e ? String(e.precioCop) : '',
  gratisDesde: e?.gratisDesdeCop ? String(e.gratisDesdeCop) : '',
  ciudades: e?.ciudades?.join(', ') ?? '',
  diasMin: e?.diasMin === null || e?.diasMin === undefined ? '' : String(e.diasMin),
  diasMax: e?.diasMax === null || e?.diasMax === undefined ? '' : String(e.diasMax),
  activa: e?.activa ?? true,
});

const dias = (texto: string): number | null | 'mal' => {
  const t = texto.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : 'mal';
};

/** CA1: si el plazo pasa de 30 días calendario. Lo dice el formulario antes de guardar. */
export function pasaDeLaLey(f: FormularioDeEnvio): boolean {
  const n = [dias(f.diasMin), dias(f.diasMax)].filter((d): d is number => typeof d === 'number');
  return n.some((d) => d > PLAZO_DE_LEY_DIAS);
}

export function revisarEnvio(f: FormularioDeEnvio): {
  errores: Error[];
  cuerpo: {
    nombre: string;
    precioCop: number;
    gratisDesdeCop: number | null;
    ciudades: string[] | null;
    diasMin: number | null;
    diasMax: number | null;
    activa: boolean;
  };
} {
  const errores: Error[] = [];
  if (f.nombre.trim() === '')
    errores.push({ campo: 'nombre', mensaje: 'Escribe el nombre, como «Medellín» o «Nacional».' });
  const precio = f.precio.trim() === '' ? 0 : pesos(f.precio);
  if (precio === null || !Number.isInteger(precio) || precio < 0)
    errores.push({
      campo: 'precio',
      mensaje: 'Escribe el precio en pesos, como 8.000, o 0 si es gratis.',
    });
  const gratis = f.gratisDesde.trim() === '' ? null : pesos(f.gratisDesde);
  if (f.gratisDesde.trim() !== '' && (gratis === null || !Number.isInteger(gratis) || gratis < 1))
    errores.push({
      campo: 'gratisDesde',
      mensaje: 'Escribe desde cuánto es gratis, en pesos, o déjalo vacío.',
    });
  const min = dias(f.diasMin);
  const max = dias(f.diasMax);
  if (min === 'mal') errores.push({ campo: 'diasMin', mensaje: 'Escribe los días en números.' });
  if (max === 'mal') errores.push({ campo: 'diasMax', mensaje: 'Escribe los días en números.' });
  else if (max === null)
    errores.push({
      campo: 'diasMax',
      mensaje: 'Escribe en cuántos días llega, como máximo: el comprador lo ve antes de pedir.',
    });
  if (typeof min === 'number' && typeof max === 'number' && min > max)
    errores.push({ campo: 'diasMin', mensaje: 'Los días mínimos pasan de los máximos.' });
  const ciudades = [
    ...new Set(
      f.ciudades
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  return {
    errores,
    cuerpo: {
      nombre: f.nombre.trim(),
      precioCop: precio ?? 0,
      gratisDesdeCop: gratis,
      ciudades: ciudades.length > 0 ? ciudades : null,
      diasMin: typeof min === 'number' ? min : null,
      diasMax: typeof max === 'number' ? max : null,
      activa: f.activa,
    },
  };
}

export interface FormularioDeCupon {
  codigo: string;
  tipo: '' | CuponDelPanel['tipo'];
  valor: string;
  minimo: string;
  desde: string;
  hasta: string;
  usosMaximos: string;
  activo: boolean;
  /** HU-P1.3: las categorías elegidas; los productos que traiga de la API se conservan. */
  colecciones?: string[];
  productos?: string[];
}

export const formularioDeCupon = (c: CuponDelPanel | null): FormularioDeCupon => ({
  codigo: c?.codigo ?? '',
  tipo: c?.tipo ?? '',
  valor: c && c.tipo !== 'envio_gratis' ? String(c.valor) : '',
  minimo: c?.minimoCop ? String(c.minimoCop) : '',
  desde: c?.desde ?? '',
  hasta: c?.hasta ?? '',
  usosMaximos: c?.usosMaximos ? String(c.usosMaximos) : '',
  activo: c?.activo ?? true,
  colecciones: c?.alcance?.colecciones ?? [],
  productos: c?.alcance?.productos ?? [],
});

export function revisarCupon(
  f: FormularioDeCupon,
  usados = 0,
): {
  errores: Error[];
  cuerpo: {
    codigo: string;
    tipo: string;
    valor: number;
    minimoCop: number;
    desde: string | null;
    hasta: string | null;
    usosMaximos: number | null;
    activo: boolean;
    alcance: { productos: string[]; colecciones: string[] } | null;
  };
} {
  const errores: Error[] = [];
  const codigo = f.codigo.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(codigo))
    errores.push({
      campo: 'codigo',
      mensaje: 'El código va de 3 a 24 letras sin tilde, números o guiones, sin espacios.',
    });
  if (f.tipo === '') errores.push({ campo: 'tipo', mensaje: 'Elige qué descuenta.' });
  let valor = 0;
  if (f.tipo === 'porcentaje') {
    valor = Number(f.valor.trim().replace('%', ''));
    if (!Number.isInteger(valor) || valor < 1 || valor > 100)
      errores.push({ campo: 'valor', mensaje: 'Escribe el porcentaje, de 1 a 100.' });
  } else if (f.tipo === 'valor') {
    valor = pesos(f.valor) ?? Number.NaN;
    if (!Number.isInteger(valor) || valor < 1)
      errores.push({ campo: 'valor', mensaje: 'Escribe cuánto descuenta, en pesos, como 5.000.' });
  }
  const minimo = f.minimo.trim() === '' ? 0 : pesos(f.minimo);
  if (minimo === null || !Number.isInteger(minimo) || minimo < 0)
    errores.push({
      campo: 'minimo',
      mensaje: 'Escribe la compra mínima en pesos, o déjala vacía.',
    });
  const desde = f.desde.trim() || null;
  const hasta = f.hasta.trim() || null;
  if (desde && hasta && desde > hasta)
    errores.push({ campo: 'hasta', mensaje: 'La vigencia termina antes de empezar.' });
  const usos = f.usosMaximos.trim() === '' ? null : Number(f.usosMaximos.trim());
  if (usos !== null && (!Number.isInteger(usos) || usos < 1))
    errores.push({
      campo: 'usosMaximos',
      mensaje: 'Escribe cuántas veces se puede usar, o déjalo vacío para que no tenga tope.',
    });
  else if (usos !== null && usos < usados)
    errores.push({
      campo: 'usosMaximos',
      mensaje: `Ya se usó ${usados === 1 ? '1 vez' : `${usados} veces`}: el tope no puede ser menor.`,
    });
  return {
    errores,
    cuerpo: {
      codigo,
      tipo: f.tipo,
      valor: Number.isFinite(valor) ? valor : 0,
      minimoCop: minimo ?? 0,
      desde,
      hasta,
      usosMaximos: usos,
      activo: f.activo,
      alcance:
        (f.colecciones?.length ?? 0) + (f.productos?.length ?? 0) > 0
          ? { productos: f.productos ?? [], colecciones: f.colecciones ?? [] }
          : null,
    },
  };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = (f: string) => {
  const [a, m, d] = f.split('-').map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${a}`;
};

/** «10 % de descuento · desde $60.000 · hasta 15 oct 2026 · 3 de 50 usos». */
export function cuponEnPalabras(c: CuponDelPanel): string {
  const que =
    c.tipo === 'porcentaje'
      ? `${c.valor} % de descuento`
      : c.tipo === 'valor'
        ? `${enPesos(c.valor)} de descuento`
        : 'Envío gratis';
  return [
    que,
    c.minimoCop > 0 ? `en compras desde ${enPesos(c.minimoCop)}` : null,
    c.desde ? `desde el ${fecha(c.desde)}` : null,
    c.hasta ? `hasta el ${fecha(c.hasta)}` : null,
    c.usosMaximos === null
      ? `${c.usos === 1 ? '1 uso' : `${c.usos} usos`}, sin tope`
      : c.usos >= c.usosMaximos
        ? `agotado: ${c.usos} de ${c.usosMaximos} usos`
        : `${c.usos} de ${c.usosMaximos} usos`,
    c.alcance && c.alcance.colecciones.length + c.alcance.productos.length > 0
      ? 'solo en algunos productos'
      : null,
    c.activo ? null : 'apagado',
  ]
    .filter(Boolean)
    .join(' · ');
}
