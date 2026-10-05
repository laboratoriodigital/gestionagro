/**
 * Bodega de insumos y costo de lo aplicado (HU-E7.1), en el navegador (ADR-5) con `bodega` de
 * agro-calc.
 *
 * - **Entradas:** compras (cantidad y precio total, que puede no anotarse) y ajustes por conteo,
 *   como registros `movimiento_insumo`. Solo propietario y supervisor (llevan precios, §9).
 * - **Salidas:** la cantidad usada de cada aplicación vigente (v2). No hay registro de salida
 *   aparte (P2): corregir la aplicación corrige la bodega. Una aplicación sin cantidad (o v1) no
 *   descuenta ni suma costo, y se cuenta para decirlo.
 * - **Existencia negativa** se avisa sin bloquear nada en el campo (CA3).
 * - **Costo por nave y ciclo:** el costo de cada salida, por el área y el ciclo de su aplicación.
 */
import { bodega, type Movimiento } from '@ed1/agro-calc';
import { aVersionVigente, ErrorDeValidacion, type Registro } from '@ed1/agro-schema';
import type { DatosAplicacionGuardada } from './aplicaciones.ts';
import { cabeceraDeRegistro } from './cabecera.ts';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';

export interface DatosMovimiento {
  insumo_id: string;
  insumo: string;
  clase: 'compra' | 'ajuste';
  cantidad: number;
  unidad: string;
  precio_total_cop: number | null;
  nota: string | null;
}

export interface NuevoMovimiento {
  insumoId: string;
  clase: 'compra' | 'ajuste';
  /** Compra: lo que entró. Ajuste: con signo (−3 si faltaban 3). */
  cantidad: number;
  precioTotal: number | null;
  nota: string;
}

export interface ExistenciaDeInsumo {
  insumoId: string;
  insumo: string;
  unidad: string;
  existencia: number;
  costoUnitario: number | null;
  /** Valor de lo que hay; nulo si el costo no se conoce o no hay existencia. */
  valor: number | null;
  quedoNegativa: boolean;
  /** Aplicaciones de este insumo sin cantidad anotada: no descontaron. */
  sinCantidad: number;
}

export interface CostoDeArea {
  areaId: string;
  cicloId: string | null;
  /** Suma de lo conocido. */
  costo: number;
  aplicaciones: number;
  /** Aplicaciones cuyo costo no se conoce (sin cantidad o sin precio de compra). */
  sinCosto: number;
}

const redondear = (x: number) => Math.round(x);

export async function registrarMovimiento(
  db: CuadernoDb,
  fincaId: string,
  nuevo: NuevoMovimiento,
  { ahora = () => new Date() }: { ahora?: () => Date } = {},
): Promise<Registro> {
  const insumo = await db.insumo.get(nuevo.insumoId);
  const motivos: { campo: string; motivo: string }[] = [];
  if (!insumo || insumo.finca_id !== fincaId)
    motivos.push({ campo: 'insumo', motivo: 'elige un insumo de la finca' });
  if (!(Number.isFinite(nuevo.cantidad) && nuevo.cantidad !== 0)) {
    motivos.push({ campo: 'cantidad', motivo: 'escribe la cantidad' });
  } else if (nuevo.clase === 'compra' && nuevo.cantidad < 0) {
    motivos.push({ campo: 'cantidad', motivo: 'una compra suma: escribe la cantidad sin signo' });
  }
  if (
    nuevo.precioTotal !== null &&
    (!Number.isInteger(nuevo.precioTotal) || nuevo.precioTotal < 1)
  ) {
    motivos.push({ campo: 'precio', motivo: 'el precio va en pesos enteros, mayor que 0' });
  }
  if (motivos.length > 0 || !insumo) throw new ErrorDeValidacion('Bodega', motivos);
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: '',
    tipo: 'movimiento_insumo',
    v: 1,
    personaIds: [],
    origen: 'manual',
    ahora,
  });
  return guardarRegistro(
    db,
    {
      ...cabecera,
      // De la bodega, no de un área ni de un ciclo.
      area_ids: [],
      ciclo_id: null,
      datos: {
        insumo_id: insumo.id,
        insumo: insumo.nombre_comercial,
        clase: nuevo.clase,
        cantidad: nuevo.cantidad,
        unidad: insumo.unidad,
        precio_total_cop: nuevo.clase === 'compra' ? nuevo.precioTotal : null,
        nota: nuevo.nota.trim() || null,
      } satisfies DatosMovimiento,
    },
    { ahora },
  );
}

const orden = (a: Registro, b: Registro) =>
  a.instante_evento === b.instante_evento
    ? a.id < b.id
      ? -1
      : 1
    : a.instante_evento < b.instante_evento
      ? -1
      : 1;

/** La bodega de cada insumo y el costo de cada aplicación, calculados una sola vez. */
async function calcular(db: CuadernoDb, fincaId: string) {
  const deTipo = async (tipo: string) =>
    soloVigentes(
      db,
      await db.registro
        .where('tipo')
        .equals(tipo)
        .filter((r) => r.finca_id === fincaId)
        .toArray(),
    );
  const [insumos, movimientos, aplicaciones] = await Promise.all([
    db.insumo.where('finca_id').equals(fincaId).toArray(),
    deTipo('movimiento_insumo'),
    deTipo('aplicacion'),
  ]);
  const costoDe = new Map<string, number | null>();
  const existencias: ExistenciaDeInsumo[] = [];
  for (const insumo of insumos) {
    const suyos = [
      ...movimientos.filter((r) => (r.datos as DatosMovimiento).insumo_id === insumo.id),
      ...aplicaciones.filter((r) => (r.datos as DatosAplicacionGuardada).insumo_id === insumo.id),
    ].sort(orden);
    let sinCantidad = 0;
    const lista: Movimiento[] = suyos.flatMap((r): Movimiento[] => {
      if (r.tipo === 'movimiento_insumo') {
        const d = r.datos as DatosMovimiento;
        return [
          d.clase === 'compra'
            ? { id: r.id, tipo: 'entrada', cantidad: d.cantidad, precioTotal: d.precio_total_cop }
            : { id: r.id, tipo: 'ajuste', cantidad: d.cantidad },
        ];
      }
      const d = aVersionVigente('aplicacion', r.v, r.datos).datos as DatosAplicacionGuardada;
      if (d.cantidadUsada === null) {
        sinCantidad += 1;
        return [];
      }
      return [{ id: r.id, tipo: 'salida', cantidad: d.cantidadUsada }];
    });
    const b = bodega(lista);
    for (const [id, costo] of b.costoDeSalida) costoDe.set(id, costo);
    if (suyos.length === 0) continue;
    existencias.push({
      insumoId: insumo.id,
      insumo: insumo.nombre_comercial,
      unidad: insumo.unidad,
      existencia: b.existencia,
      costoUnitario: b.costoUnitario,
      valor:
        b.costoUnitario === null || b.existencia <= 0
          ? null
          : redondear(b.existencia * b.costoUnitario),
      quedoNegativa: b.existencia < 0,
      sinCantidad,
    });
  }
  return { existencias, aplicaciones, costoDe };
}

export async function estadoDeBodega(
  db: CuadernoDb,
  fincaId: string,
): Promise<ExistenciaDeInsumo[]> {
  return (await calcular(db, fincaId)).existencias.sort((a, b) =>
    a.insumo.localeCompare(b.insumo, 'es'),
  );
}

/** Costo de los insumos aplicados por área y ciclo. */
export async function costoDeInsumosPorArea(
  db: CuadernoDb,
  fincaId: string,
): Promise<CostoDeArea[]> {
  const { aplicaciones, costoDe } = await calcular(db, fincaId);
  const por = new Map<string, CostoDeArea>();
  for (const r of aplicaciones) {
    const areaId = r.area_ids[0] ?? '';
    const clave = `${areaId}|${r.ciclo_id ?? ''}`;
    const fila = por.get(clave) ?? {
      areaId,
      cicloId: r.ciclo_id,
      costo: 0,
      aplicaciones: 0,
      sinCosto: 0,
    };
    const costo = costoDe.get(r.id);
    fila.aplicaciones += 1;
    if (costo === undefined || costo === null) fila.sinCosto += 1;
    else fila.costo = redondear(fila.costo + costo);
    por.set(clave, fila);
  }
  return [...por.values()];
}
