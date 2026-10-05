/**
 * Costo por kilo y margen por ciclo (HU-E7.3), en el navegador (ADR-5) con `costoUnitario` de
 * agro-calc. Una fila por ciclo (sus naves) y, aparte, por área para lo que no tiene ciclo.
 *
 * - **Costo:** insumos aplicados (HU-E7.1) y mano de obra (HU-E7.2) del ciclo, en toda su vida.
 * - **Por unidad:** sobre lo vendible (cosechado − descarte), en la unidad de la cosecha. Si el
 *   ciclo cosechó en varias unidades (kg y cajas), no se puede repartir el costo entre ellas: no
 *   se calcula y se dice (P1).
 * - **Ingresos:** cada línea de despacho vale cantidad × precio, y se reparte entre los ciclos de
 *   las cosechas de su lote según cuánto puso cada una. Un despacho sin precio no suma 0: deja el
 *   margen incompleto.
 */
import { type CostoUnitario, costoUnitario } from '@ed1/agro-calc';
import type { Ciclo, Registro } from '@ed1/agro-schema';
import { costoDeInsumosPorArea } from './bodega.ts';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { vigenteDeCadaLote } from './lotes.ts';
import { manoDeObraPorAreaYCiclo } from './mano-de-obra.ts';

export interface CostoDeCiclo {
  clave: string;
  /** «Nave 1, Nave 2» */
  areas: string;
  /** Null para lo que no tiene ciclo. */
  ciclo: Pick<Ciclo, 'cultivo' | 'variedad' | 'fecha_trasplante' | 'estado'> | null;
  /** Unidad de la cosecha; null si no hubo cosecha o si hubo varias unidades. */
  unidad: string | null;
  variasUnidades: boolean;
  vendible: number;
  insumos: number;
  insumosSinCosto: number;
  manoDeObra: number;
  jornalesSinValor: number;
  ingresos: number;
  ventas: number;
  ventasSinPrecio: number;
  resultado: CostoUnitario;
}

interface Acumulado {
  insumos: number;
  insumosSinCosto: number;
  manoDeObra: number;
  jornalesSinValor: number;
  vendiblePorUnidad: Map<string, number>;
  ingresos: number;
  ventas: Set<string>;
  ventasSinPrecio: Set<string>;
}

const nuevo = (): Acumulado => ({
  insumos: 0,
  insumosSinCosto: 0,
  manoDeObra: 0,
  jornalesSinValor: 0,
  vendiblePorUnidad: new Map(),
  ingresos: 0,
  ventas: new Set(),
  ventasSinPrecio: new Set(),
});

interface DatosCosecha {
  cantidad: number;
  unidad: string;
  descarte: number | null;
}

const vendibleDe = (r: Registro) => {
  const d = r.datos as DatosCosecha;
  return Math.max(0, d.cantidad - (d.descarte ?? 0));
};

export async function costoPorCiclo(db: CuadernoDb, fincaId: string): Promise<CostoDeCiclo[]> {
  const [areas, ciclos] = await Promise.all([
    db.area.where('finca_id').equals(fincaId).toArray(),
    db.ciclo.where('finca_id').equals(fincaId).toArray(),
  ]);
  const cicloDe = new Map(ciclos.map((c) => [c.id, c]));
  const nombreDe = new Map(areas.map((a) => [a.id, a.nombre]));
  /** El ciclo si el área es suya; si no, el área sola (P2: la misma regla para todo). */
  const claveDe = (areaId: string, cicloId: string | null) =>
    cicloId && cicloDe.get(cicloId)?.area_ids.includes(areaId)
      ? `ciclo:${cicloId}`
      : `area:${areaId}`;
  const por = new Map<string, Acumulado>();
  const de = (clave: string) => {
    const a = por.get(clave) ?? nuevo();
    por.set(clave, a);
    return a;
  };

  for (const f of await costoDeInsumosPorArea(db, fincaId)) {
    const a = de(claveDe(f.areaId, f.cicloId));
    a.insumos += f.costo;
    a.insumosSinCosto += f.sinCosto;
  }
  for (const f of await manoDeObraPorAreaYCiclo(db, fincaId, { desde: null, hasta: null })) {
    const a = de(claveDe(f.areaId, f.cicloId));
    a.manoDeObra += f.costo;
    a.jornalesSinValor += f.sinValor;
  }

  const delTipo = (tipo: string) =>
    db.registro
      .where('tipo')
      .equals(tipo)
      .filter((r) => r.finca_id === fincaId)
      .toArray();
  const [cosechasTodas, lotesTodos, despachosTodos] = await Promise.all([
    delTipo('cosecha'),
    delTipo('lote_venta'),
    delTipo('despacho'),
  ]);
  const claveDeCosecha = (r: Registro) => claveDe(r.area_ids[0] ?? '', r.ciclo_id);
  for (const r of await soloVigentes(db, cosechasTodas)) {
    const a = de(claveDeCosecha(r));
    const unidad = (r.datos as DatosCosecha).unidad;
    a.vendiblePorUnidad.set(unidad, (a.vendiblePorUnidad.get(unidad) ?? 0) + vendibleDe(r));
  }

  // Ingresos: del despacho al lote vigente, y del lote a sus cosechas.
  const vigenteDe = vigenteDeCadaLote(lotesTodos);
  const loteDe = new Map(lotesTodos.map((l) => [l.id, l]));
  const cosechaDe = new Map(cosechasTodas.map((c) => [c.id, c]));
  for (const d of await soloVigentes(db, despachosTodos)) {
    const datos = d.datos as {
      lineas: { lote_id: string; cantidad: number }[];
      precio_unitario_cop: number | null;
    };
    for (const linea of datos.lineas) {
      const lote = loteDe.get(vigenteDe(linea.lote_id));
      const cosechas = ((lote?.datos as { cosecha_ids?: string[] })?.cosecha_ids ?? []).flatMap(
        (id) => cosechaDe.get(id) ?? [],
      );
      const total = cosechas.reduce((s, c) => s + vendibleDe(c), 0);
      for (const c of cosechas) {
        const a = de(claveDeCosecha(c));
        a.ventas.add(d.id);
        if (datos.precio_unitario_cop === null) a.ventasSinPrecio.add(d.id);
        else if (total > 0) {
          a.ingresos += (linea.cantidad * datos.precio_unitario_cop * vendibleDe(c)) / total;
        }
      }
    }
  }

  return [...por]
    .map(([clave, a]): CostoDeCiclo => {
      const ciclo = clave.startsWith('ciclo:') ? cicloDe.get(clave.slice(6)) : undefined;
      const ids = ciclo ? ciclo.area_ids : [clave.slice(5)];
      const unidades = [...a.vendiblePorUnidad];
      const variasUnidades = unidades.length > 1;
      const [unidad, vendible] = unidades.length === 1 ? (unidades[0] ?? [null, 0]) : [null, 0];
      return {
        clave,
        areas: ids.map((id) => nombreDe.get(id) ?? 'Área sin nombre').join(', '),
        ciclo: ciclo
          ? {
              cultivo: ciclo.cultivo,
              variedad: ciclo.variedad,
              fecha_trasplante: ciclo.fecha_trasplante,
              estado: ciclo.estado,
            }
          : null,
        unidad,
        variasUnidades,
        vendible,
        insumos: a.insumos,
        insumosSinCosto: a.insumosSinCosto,
        manoDeObra: a.manoDeObra,
        jornalesSinValor: a.jornalesSinValor,
        ingresos: Math.round(a.ingresos),
        ventas: a.ventas.size,
        ventasSinPrecio: a.ventasSinPrecio.size,
        resultado: costoUnitario({
          insumos: a.insumos,
          manoDeObra: a.manoDeObra,
          costosSinDato: a.insumosSinCosto + a.jornalesSinValor,
          // Con varias unidades no hay una cantidad sobre la que repartir el costo.
          vendible: variasUnidades ? Number.NaN : vendible,
          ingresos: a.ingresos,
          ventas: a.ventas.size,
          ventasSinPrecio: a.ventasSinPrecio.size,
        }),
      };
    })
    .sort((x, y) =>
      `${x.ciclo ? 0 : 1}${x.areas}`.localeCompare(`${y.ciclo ? 0 : 1}${y.areas}`, 'es', {
        numeric: true,
      }),
    );
}
