/**
 * Las cuentas de la finca sin almacén (HU-E0.12): bodega de insumos, mano de obra, costo por kilo y
 * rendimiento. Salieron del cuaderno para que el asistente de la finca (el MCP de la celda) dé las
 * mismas cifras que la pantalla (P2), como antes el calendario de carencias (HU-C9.7).
 *
 * Reciben los datos de la finca ya leídos (`DatosDeLaFinca`): el cuaderno los lee de su base local
 * y la celda de D1. Las reglas son las de siempre:
 * - Lo corregido no cuenta: un registro anulado por otro (`anulados`) se ignora (HU-E3.12).
 * - Lo desconocido no suma 0: una compra sin precio, una aplicación sin cantidad o un jornal sin
 *   valor se cuentan para decirlo (P1).
 */
import {
  bodega,
  type CostoUnitario,
  costoDeHoras,
  costoUnitario,
  type Movimiento,
  type Rendimiento,
  rendimiento,
  type ValorConVigencia,
  valorVigente,
} from '@ed1/agro-calc';
import type { Area, Ciclo, Insumo, ValorJornal } from './catalogos.ts';
import type { Registro } from './registro.ts';
import { aVersionVigente } from './versiones.ts';

/** Lo que las cuentas leen de un registro. */
export type RegistroParaCuentas = Pick<
  Registro,
  | 'id'
  | 'tipo'
  | 'v'
  | 'area_ids'
  | 'ciclo_id'
  | 'persona_ids'
  | 'fecha_agronomica'
  | 'instante_evento'
  | 'anula_id'
  | 'datos'
>;

export interface DatosDeLaFinca {
  areas: readonly Area[];
  ciclos: readonly Ciclo[];
  insumos: readonly Insumo[];
  valoresJornal: readonly ValorJornal[];
  /** Los registros de los tipos que la cuenta necesita, también los anulados. */
  registros: readonly RegistroParaCuentas[];
  /** Los ids que una corrección anuló. */
  anulados: ReadonlySet<string>;
}

const delTipo = (d: DatosDeLaFinca, tipo: string) => d.registros.filter((r) => r.tipo === tipo);
const vigentesDelTipo = (d: DatosDeLaFinca, tipo: string) =>
  delTipo(d, tipo).filter((r) => !d.anulados.has(r.id));
const redondear = (x: number) => Math.round(x);

// ---------------------------------------------------------------------------------------------
// Bodega (HU-E7.1)

export interface DatosMovimiento {
  insumo_id: string;
  insumo: string;
  clase: 'compra' | 'ajuste';
  cantidad: number;
  unidad: string;
  precio_total_cop: number | null;
  nota: string | null;
}

interface DatosAplicacionParaBodega {
  insumo_id: string;
  cantidadUsada: number | null;
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

const orden = (a: RegistroParaCuentas, b: RegistroParaCuentas) =>
  a.instante_evento === b.instante_evento
    ? a.id < b.id
      ? -1
      : 1
    : a.instante_evento < b.instante_evento
      ? -1
      : 1;

/** La bodega de cada insumo y el costo de cada aplicación, calculados una sola vez. */
function calcularBodega(d: DatosDeLaFinca) {
  const movimientos = vigentesDelTipo(d, 'movimiento_insumo');
  const aplicaciones = vigentesDelTipo(d, 'aplicacion');
  const costoDe = new Map<string, number | null>();
  const existencias: ExistenciaDeInsumo[] = [];
  for (const insumo of d.insumos) {
    const suyos = [
      ...movimientos.filter((r) => (r.datos as DatosMovimiento).insumo_id === insumo.id),
      ...aplicaciones.filter((r) => (r.datos as DatosAplicacionParaBodega).insumo_id === insumo.id),
    ].sort(orden);
    let sinCantidad = 0;
    const lista: Movimiento[] = suyos.flatMap((r): Movimiento[] => {
      if (r.tipo === 'movimiento_insumo') {
        const m = r.datos as DatosMovimiento;
        return [
          m.clase === 'compra'
            ? { id: r.id, tipo: 'entrada', cantidad: m.cantidad, precioTotal: m.precio_total_cop }
            : { id: r.id, tipo: 'ajuste', cantidad: m.cantidad },
        ];
      }
      const a = aVersionVigente('aplicacion', r.v, r.datos).datos as DatosAplicacionParaBodega;
      // Sin cantidad (o un registro que no la trae) no descuenta ni suma costo: se cuenta (P1).
      if (a.cantidadUsada === null || a.cantidadUsada === undefined) {
        sinCantidad += 1;
        return [];
      }
      return [{ id: r.id, tipo: 'salida', cantidad: a.cantidadUsada }];
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

/** Lo que hay de cada insumo con movimientos, por nombre. Tipos: movimiento_insumo y aplicacion. */
export function estadoDeBodega(d: DatosDeLaFinca): ExistenciaDeInsumo[] {
  return calcularBodega(d).existencias.sort((a, b) => a.insumo.localeCompare(b.insumo, 'es'));
}

/** Costo de los insumos aplicados por área y ciclo. Tipos: movimiento_insumo y aplicacion. */
export function costoDeInsumosPorArea(d: DatosDeLaFinca): CostoDeArea[] {
  const { aplicaciones, costoDe } = calcularBodega(d);
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

// ---------------------------------------------------------------------------------------------
// Mano de obra (HU-E7.2)

export interface ManoDeObraDeArea {
  areaId: string;
  horas: number;
  /** Suma de lo conocido, en pesos. */
  costo: number;
  /** Personas-labor sin valor de jornal que rigiera ese día. */
  sinValor: number;
}

export interface Periodo {
  /** AAAA-MM-DD, incluidos; null = sin límite. */
  desde: string | null;
  hasta: string | null;
}

export interface ManoDeObraDeAreaYCiclo extends ManoDeObraDeArea {
  /** El ciclo del registro, si el área es de ese ciclo; null si no hay. */
  cicloId: string | null;
}

/**
 * Por área y ciclo (HU-E7.3). Una labor en varias áreas lleva el ciclo de la primera: en las otras
 * cuenta para su ciclo solo si el área también es de él; si no, va al área sin ciclo. Tipo: labor.
 */
export function manoDeObraPorAreaYCiclo(
  d: DatosDeLaFinca,
  periodo: Periodo,
): ManoDeObraDeAreaYCiclo[] {
  const labores = vigentesDelTipo(d, 'labor')
    .filter(
      (r) =>
        (periodo.desde === null || r.fecha_agronomica >= periodo.desde) &&
        (periodo.hasta === null || r.fecha_agronomica <= periodo.hasta),
    )
    .sort((a, b) => a.fecha_agronomica.localeCompare(b.fecha_agronomica));
  const deQuien = (personaId: string | null): ValorConVigencia[] =>
    d.valoresJornal
      .filter((v) => v.persona_id === personaId)
      .map((v) => ({ desde: v.vigente_desde, valor: v.valor_cop, actualizado: v.actualizado }));
  const general = deQuien(null);
  const areasDelCiclo = new Map(d.ciclos.map((c) => [c.id, c.area_ids]));
  const por = new Map<string, ManoDeObraDeAreaYCiclo>();
  for (const r of labores) {
    const horas = (r.datos as { horasPorPersona: number }).horasPorPersona;
    for (const areaId of r.area_ids) {
      const cicloId =
        r.ciclo_id && areasDelCiclo.get(r.ciclo_id)?.includes(areaId) ? r.ciclo_id : null;
      const clave = `${areaId}|${cicloId ?? ''}`;
      const fila = por.get(clave) ?? { areaId, cicloId, horas: 0, costo: 0, sinValor: 0 };
      for (const personaId of r.persona_ids) {
        const valor =
          valorVigente(deQuien(personaId), r.fecha_agronomica) ??
          valorVigente(general, r.fecha_agronomica);
        // Una labor en varias áreas reparte sus horas por partes iguales.
        const parte = horas / r.area_ids.length;
        fila.horas += parte;
        const costo = costoDeHoras(parte, valor);
        if (costo === null) fila.sinValor += 1;
        else fila.costo += costo;
      }
      por.set(clave, fila);
    }
  }
  return [...por.values()];
}

/** Por área, sumando sus ciclos. Tipo: labor. */
export function manoDeObraPorArea(d: DatosDeLaFinca, periodo: Periodo): ManoDeObraDeArea[] {
  const por = new Map<string, ManoDeObraDeArea>();
  for (const f of manoDeObraPorAreaYCiclo(d, periodo)) {
    const fila = por.get(f.areaId) ?? { areaId: f.areaId, horas: 0, costo: 0, sinValor: 0 };
    fila.horas += f.horas;
    fila.costo += f.costo;
    fila.sinValor += f.sinValor;
    por.set(f.areaId, fila);
  }
  return [...por.values()].map((f) => ({ ...f, horas: Math.round(f.horas * 100) / 100 }));
}

// ---------------------------------------------------------------------------------------------
// Costo por kilo y margen (HU-E7.3)

/** De cualquier versión de un lote (también una corregida) al id de su versión vigente. */
export function vigenteDeCadaLote(
  todos: readonly Pick<RegistroParaCuentas, 'id' | 'anula_id'>[],
): (id: string) => string {
  const siguiente = new Map(
    todos.flatMap((l) => (l.anula_id ? [[l.anula_id, l.id] as const] : [])),
  );
  return (id) => {
    let actual = id;
    for (let n = 0; n < 1000 && siguiente.has(actual); n++)
      actual = siguiente.get(actual) ?? actual;
    return actual;
  };
}

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

const vendibleDe = (r: RegistroParaCuentas) => {
  const c = r.datos as DatosCosecha;
  return Math.max(0, c.cantidad - (c.descarte ?? 0));
};

/** Los tipos de registro que lee `costoPorCiclo`. */
export const TIPOS_DEL_COSTO = [
  'movimiento_insumo',
  'aplicacion',
  'labor',
  'cosecha',
  'lote_venta',
  'despacho',
] as const;

/**
 * Una fila por ciclo (sus naves) y, aparte, por área para lo que no tiene ciclo: insumos y mano de
 * obra de toda su vida, sobre lo vendible, con los ingresos de los despachos repartidos entre las
 * cosechas de cada lote. Con varias unidades de cosecha no se reparte el costo, y se dice (P1).
 */
export function costoPorCiclo(d: DatosDeLaFinca): CostoDeCiclo[] {
  const cicloDe = new Map(d.ciclos.map((c) => [c.id, c]));
  const nombreDe = new Map(d.areas.map((a) => [a.id, a.nombre]));
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

  for (const f of costoDeInsumosPorArea(d)) {
    const a = de(claveDe(f.areaId, f.cicloId));
    a.insumos += f.costo;
    a.insumosSinCosto += f.sinCosto;
  }
  for (const f of manoDeObraPorAreaYCiclo(d, { desde: null, hasta: null })) {
    const a = de(claveDe(f.areaId, f.cicloId));
    a.manoDeObra += f.costo;
    a.jornalesSinValor += f.sinValor;
  }

  const cosechasTodas = delTipo(d, 'cosecha');
  const lotesTodos = delTipo(d, 'lote_venta');
  const claveDeCosecha = (r: RegistroParaCuentas) => claveDe(r.area_ids[0] ?? '', r.ciclo_id);
  for (const r of cosechasTodas.filter((c) => !d.anulados.has(c.id))) {
    const a = de(claveDeCosecha(r));
    const unidad = (r.datos as DatosCosecha).unidad;
    a.vendiblePorUnidad.set(unidad, (a.vendiblePorUnidad.get(unidad) ?? 0) + vendibleDe(r));
  }

  // Ingresos: del despacho al lote vigente, y del lote a sus cosechas.
  const vigenteDe = vigenteDeCadaLote(lotesTodos);
  const loteDe = new Map(lotesTodos.map((l) => [l.id, l]));
  const cosechaDe = new Map(cosechasTodas.map((c) => [c.id, c]));
  for (const despacho of vigentesDelTipo(d, 'despacho')) {
    const datos = despacho.datos as {
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
        a.ventas.add(despacho.id);
        if (datos.precio_unitario_cop === null) a.ventasSinPrecio.add(despacho.id);
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

// ---------------------------------------------------------------------------------------------
// Rendimiento (HU-E6.6)

export interface FilaDeRendimiento {
  clave: string;
  /** Nombres de las áreas del ciclo (o el área de la cosecha sin ciclo). */
  areas: string;
  areaM2: number;
  /** Nulo para las cosechas sin ciclo. */
  ciclo: {
    cultivo: string;
    variedad: string;
    trasplante: string;
    estado: 'activo' | 'cerrado';
    plantas: number | null;
  } | null;
  unidad: string;
  cosechas: number;
  cosechado: number;
  descarte: number;
  resultado: Rendimiento;
}

export interface GrupoDeRendimiento {
  /** «Sin ciclo» para las cosechas que no tienen. */
  cultivo: string;
  filas: FilaDeRendimiento[];
}

/**
 * Una fila por ciclo y unidad de cosecha, sobre el área de sus naves y sus plantas, agrupadas por
 * cultivo y con la mejor nave primero. Las cosechas sin ciclo van aparte. Tipo: cosecha.
 */
export function rendimientoDeLaFinca(d: DatosDeLaFinca): GrupoDeRendimiento[] {
  const cosechas = vigentesDelTipo(d, 'cosecha');
  const areaDe = new Map(d.areas.map((a) => [a.id, a]));
  const cicloDe = new Map(d.ciclos.map((c) => [c.id, c]));

  // Clave: ciclo (o área, sin ciclo) y unidad.
  const acumulado = new Map<string, { base: Omit<FilaDeRendimiento, 'resultado'> }>();
  for (const r of cosechas) {
    const c = r.datos as DatosCosecha;
    const ciclo = r.ciclo_id ? cicloDe.get(r.ciclo_id) : undefined;
    const ids = ciclo ? ciclo.area_ids : r.area_ids;
    const clave = `${ciclo ? `ciclo:${ciclo.id}` : `area:${ids.join(',')}`}|${c.unidad}`;
    const previo = acumulado.get(clave);
    if (previo) {
      previo.base.cosechas += 1;
      previo.base.cosechado += c.cantidad;
      previo.base.descarte += c.descarte ?? 0;
      continue;
    }
    const suyas = ids.flatMap((id) => areaDe.get(id) ?? []);
    acumulado.set(clave, {
      base: {
        clave,
        areas: suyas.map((a) => a.nombre).join(', ') || 'Área sin nombre',
        areaM2: suyas.reduce((s, a) => s + a.area_m2, 0),
        ciclo: ciclo
          ? {
              cultivo: ciclo.cultivo,
              variedad: ciclo.variedad,
              trasplante: ciclo.fecha_trasplante,
              estado: ciclo.estado,
              plantas: ciclo.plantas,
            }
          : null,
        unidad: c.unidad,
        cosechas: 1,
        cosechado: c.cantidad,
        descarte: c.descarte ?? 0,
      },
    });
  }

  const grupos = new Map<string, FilaDeRendimiento[]>();
  for (const { base } of acumulado.values()) {
    if (base.areaM2 <= 0) continue; // un área sin m² no deja calcular por m²
    const fila: FilaDeRendimiento = {
      ...base,
      resultado: rendimiento({
        cosechado: base.cosechado,
        descarte: Math.min(base.descarte, base.cosechado),
        areaM2: base.areaM2,
        plantas: base.ciclo?.plantas ?? null,
      }),
    };
    const cultivo = base.ciclo?.cultivo ?? 'Sin ciclo';
    grupos.set(cultivo, [...(grupos.get(cultivo) ?? []), fila]);
  }
  return [...grupos]
    .map(([cultivo, filas]) => ({
      cultivo,
      // La mejor nave primero: es lo que se compara.
      filas: filas.sort((a, b) => b.resultado.porM2 - a.resultado.porM2),
    }))
    .sort((a, b) =>
      a.cultivo === 'Sin ciclo'
        ? 1
        : b.cultivo === 'Sin ciclo'
          ? -1
          : a.cultivo.localeCompare(b.cultivo, 'es'),
    );
}
