/**
 * Despachos a los clientes (HU-E6.3): a quién se vendió, de qué lotes, cuánto, a qué precio y cómo
 * pagó. Se anotan sin señal.
 *
 * - **Clientes** (CA1): van dentro del despacho, con nombre y tipo (consumidor, restaurante,
 *   tienda, cadena), sin datos de contacto. La app sugiere los ya usados.
 * - **Saldo** (CA4): un despacho que pide más de lo que le queda a un lote se niega con el motivo.
 *   Si dos teléfonos sin señal despachan del mismo lote, el lote avisa (`lotes.ts`).
 * - **Precio** (CA5): nulo es «no se anotó», nunca cero. Lo que la pantalla no puede leer no llega
 *   aquí: se dice como error.
 * - **Quién los ve** (CA3): solo propietario y supervisor (`MATRIZ_DE_REGISTROS` de
 *   `@gestionagro/sync`); la celda no se los manda a nadie más.
 */
import {
  ErrorDeValidacion,
  type MEDIOS_DE_PAGO,
  type Registro,
  type TIPOS_DE_CLIENTE,
} from '@gestionagro/agro-schema';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';
import { despachadoPorLote, leerLotes, vigenteDeCadaLote } from './lotes.ts';

export type TipoDeCliente = (typeof TIPOS_DE_CLIENTE)[number];
export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];

export interface DatosDespacho {
  cliente: { nombre: string; tipo: TipoDeCliente };
  lineas: { lote_id: string; codigo: string; cantidad: number }[];
  unidad: string;
  precio_unitario_cop: number | null;
  medio_pago: MedioDePago;
}

export interface NuevoDespacho {
  cliente: { nombre: string; tipo: TipoDeCliente | '' };
  lineas: { loteId: string; cantidad: number }[];
  /** Pesos por unidad; null si no se anotó. */
  precioUnitario: number | null;
  medioPago: MedioDePago | '';
}

export interface Despacho {
  registro: Registro;
  datos: DatosDespacho;
  /** Código vigente de cada lote (un lote corregido conserva el suyo). */
  codigos: string[];
  cantidad: number;
  /** Precio por cantidad; null si no se anotó el precio. */
  total: number | null;
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;
/** Número con coma decimal, como se escribe en Colombia. */
const coma = (n: number) => String(n).replace('.', ',');
const normal = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

async function despachosVigentes(db: CuadernoDb, fincaId: string): Promise<Registro[]> {
  const todos = await db.registro
    .where('tipo')
    .equals('despacho')
    .filter((r) => r.finca_id === fincaId)
    .toArray();
  return (await soloVigentes(db, todos)).sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** Clientes ya usados en la finca, el más reciente primero, sin repetir el nombre. */
export async function clientesConocidos(
  db: CuadernoDb,
  fincaId: string,
): Promise<DatosDespacho['cliente'][]> {
  const vistos = new Map<string, DatosDespacho['cliente']>();
  for (const r of await despachosVigentes(db, fincaId)) {
    const c = (r.datos as DatosDespacho).cliente;
    if (!vistos.has(normal(c.nombre))) vistos.set(normal(c.nombre), c);
  }
  return [...vistos.values()];
}

/** Despachos vigentes de la finca, del más reciente al más antiguo. */
export async function leerDespachos(db: CuadernoDb, fincaId: string): Promise<Despacho[]> {
  const lotes = await db.registro.where('tipo').equals('lote_venta').toArray();
  const vigenteDe = vigenteDeCadaLote(lotes);
  const codigoDe = new Map((await leerLotes(db, fincaId)).map((l) => [l.registro.id, l.codigo]));
  return (await despachosVigentes(db, fincaId)).map((registro) => {
    const datos = registro.datos as DatosDespacho;
    const cantidad = redondear(datos.lineas.reduce((s, l) => s + l.cantidad, 0));
    return {
      registro,
      datos,
      codigos: datos.lineas.map((l) => codigoDe.get(vigenteDe(l.lote_id)) ?? l.codigo),
      cantidad,
      total:
        datos.precio_unitario_cop === null
          ? null
          : Math.round(cantidad * datos.precio_unitario_cop),
    };
  });
}

/**
 * Anota un despacho (o corrige uno, con `corrige`). Lanza `ErrorDeValidacion` con los motivos en
 * palabras: sin cliente, sin lotes, más de lo que le queda a un lote, unidades mezcladas.
 */
export async function registrarDespacho(
  db: CuadernoDb,
  fincaId: string,
  nuevo: NuevoDespacho,
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro> {
  const motivos: { campo: string; motivo: string }[] = [];
  const nombre = nuevo.cliente.nombre.trim().replace(/\s+/g, ' ');
  if (!nombre) motivos.push({ campo: 'cliente', motivo: 'escribe a quién le vendiste' });
  if (!nuevo.cliente.tipo) motivos.push({ campo: 'tipo', motivo: 'elige el tipo de cliente' });
  if (!nuevo.medioPago) motivos.push({ campo: 'medio_pago', motivo: 'elige cómo te pagó' });
  if (
    nuevo.precioUnitario !== null &&
    (!Number.isInteger(nuevo.precioUnitario) || nuevo.precioUnitario < 1)
  ) {
    motivos.push({ campo: 'precio', motivo: 'el precio va en pesos enteros, mayor que 0' });
  }
  const lineas = nuevo.lineas;
  if (lineas.length === 0) motivos.push({ campo: 'lotes', motivo: 'elige al menos un lote' });
  if (new Set(lineas.map((l) => l.loteId)).size !== lineas.length) {
    motivos.push({ campo: 'lotes', motivo: 'cada lote va una sola vez en el despacho' });
  }

  const todos = await db.registro.where('tipo').equals('lote_venta').toArray();
  const vigenteDe = vigenteDeCadaLote(todos);
  const lotes = new Map((await leerLotes(db, fincaId)).map((l) => [l.registro.id, l]));
  // Al corregir, lo que este despacho ya sacó vuelve al saldo.
  const despachado = await despachadoPorLote(
    db,
    fincaId,
    todos,
    corrige ? { sin: corrige.id } : {},
  );
  const elegidos = lineas.map((l) => ({ ...l, lote: lotes.get(vigenteDe(l.loteId)) }));
  for (const l of elegidos) {
    if (!l.lote) {
      motivos.push({ campo: 'lotes', motivo: 'uno de los lotes ya no existe; vuelve a elegirlo' });
      continue;
    }
    if (!(l.cantidad > 0)) {
      motivos.push({ campo: 'cantidad', motivo: `escribe cuánto sale del lote ${l.lote.codigo}` });
      continue;
    }
    const queda = redondear(l.lote.cantidad - (despachado.get(l.lote.registro.id) ?? 0));
    if (l.cantidad > queda) {
      motivos.push({
        campo: 'cantidad',
        motivo: `al lote ${l.lote.codigo} le quedan ${coma(queda)} ${l.lote.unidad} y quieres despachar ${coma(l.cantidad)}`,
      });
    }
  }
  const unidades = new Set(elegidos.flatMap((l) => (l.lote ? [l.lote.unidad] : [])));
  if (unidades.size > 1) {
    motivos.push({
      campo: 'lotes',
      motivo: `no se mezclan unidades (${[...unidades].join(' y ')})`,
    });
  }
  if (motivos.length > 0) throw new ErrorDeValidacion('Despacho', motivos);

  const conLote = elegidos.flatMap((l) => (l.lote ? [{ ...l, lote: l.lote }] : []));
  const areaIds = [...new Set(conLote.flatMap((l) => l.lote.registro.area_ids))];
  const momento = ahora();
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: areaIds[0] ?? '',
    tipo: 'despacho',
    v: 1,
    personaIds: [],
    origen: 'manual',
    ahora: () => momento,
    corrige,
  });
  return guardarRegistro(
    db,
    {
      ...cabecera,
      area_ids: areaIds,
      ciclo_id: null,
      datos: {
        cliente: { nombre, tipo: nuevo.cliente.tipo as TipoDeCliente },
        lineas: conLote.map((l) => ({
          lote_id: l.lote.registro.id,
          codigo: l.lote.codigo,
          cantidad: redondear(l.cantidad),
        })),
        unidad: conLote[0]?.lote.unidad ?? '',
        precio_unitario_cop: nuevo.precioUnitario,
        medio_pago: nuevo.medioPago as MedioDePago,
      } satisfies DatosDespacho,
    },
    { ahora, confirmarCicloCerrado: true },
  );
}
