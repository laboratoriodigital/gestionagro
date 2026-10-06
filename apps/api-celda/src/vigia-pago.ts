/**
 * El vigía con Workers Paid (HU-C11.1, PLATAFORMA §3.2 y §4.10). En el plan gratuito la cuenta se
 * corta al llegar a la cuota diaria, y el vigía degrada por niveles (`vigia.ts`). Con Workers Paid
 * no hay corte: se factura. Entonces la pregunta cambia de «¿cuánto queda hoy?» a «¿cuánto voy a
 * pagar este mes?».
 *
 * - Mide el consumo **del mes** de toda la cuenta, con las mismas fuentes de `vigia.ts` (P7).
 * - Lo compara con lo incluido en el plan y proyecta el costo del mes en dólares, al ritmo que va.
 * - Avisa al 50, 75 y 90 % de lo incluido, y cuando la proyección pasa el presupuesto del producto.
 * - Con el 100 % del presupuesto apaga lo que el producto declare en `productos.json`
 *   (`presupuesto.al_agotarse`): una capacidad, nunca la venta (lo exige `@ed1/productos`).
 *
 * Precios de https://developers.cloudflare.com/workers/platform/pricing/ y
 * https://developers.cloudflare.com/r2/pricing/, leídos el 6 oct 2026. Lo que no se mide aquí, dicho:
 * el tiempo de CPU (30 millones de ms incluidos) y el almacenamiento de D1, KV y R2. La segunda red
 * son las alertas de facturación de Cloudflare (CA4).
 */
import type { Cuota } from './vigia.ts';

/** Lo que cuesta Workers Paid aunque no se use nada. */
export const BASE_USD_MES = 5;

/** Lo incluido cada mes y el precio de cada millón adicional. */
export const CUOTAS_PAGO: Record<Cuota, { incluido: number; usdPorMillon: number }> = {
  workers_solicitudes: { incluido: 10_000_000, usdPorMillon: 0.3 },
  d1_filas_leidas: { incluido: 25_000_000_000, usdPorMillon: 0.001 },
  d1_filas_escritas: { incluido: 50_000_000, usdPorMillon: 1 },
  kv_lecturas: { incluido: 10_000_000, usdPorMillon: 0.5 },
  kv_escrituras: { incluido: 1_000_000, usdPorMillon: 5 },
  r2_clase_a: { incluido: 1_000_000, usdPorMillon: 4.5 },
  r2_clase_b: { incluido: 10_000_000, usdPorMillon: 0.36 },
};

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Qué parte del mes ya pasó. Nunca menos de un día: proyectar el mes con la primera hora
 * multiplicaría por 720 cualquier pico de la madrugada del día 1.
 */
export function parteDelMes(ahora: number): number {
  const d = new Date(ahora);
  const inicio = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const dias = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.min(1, Math.max(ahora - inicio, DIA_MS) / (dias * DIA_MS));
}

export interface Proyeccion {
  /** % de lo incluido que ya se usó este mes, por cuota. */
  usoDelIncluido: Partial<Record<Cuota, number>>;
  /** Lo que costaría el mes completo al ritmo que va, con la base. */
  usdProyectado: number;
}

export function proyectar(consumo: Partial<Record<Cuota, number>>, ahora: number): Proyeccion {
  const parte = parteDelMes(ahora);
  const usoDelIncluido: Partial<Record<Cuota, number>> = {};
  let usd = BASE_USD_MES;
  for (const [cuota, usado] of Object.entries(consumo) as [Cuota, number][]) {
    const { incluido, usdPorMillon } = CUOTAS_PAGO[cuota];
    usoDelIncluido[cuota] = Math.round((usado / incluido) * 1000) / 10;
    const delMes = usado / parte;
    usd += (Math.max(0, delMes - incluido) / 1_000_000) * usdPorMillon;
  }
  return { usoDelIncluido, usdProyectado: Math.round(usd * 100) / 100 };
}

/** Lo que ya se debe este mes: la base y lo que pasó de lo incluido. */
export function costoHastaHoy(consumo: Partial<Record<Cuota, number>>): number {
  let usd = BASE_USD_MES;
  for (const [cuota, usado] of Object.entries(consumo) as [Cuota, number][]) {
    const { incluido, usdPorMillon } = CUOTAS_PAGO[cuota];
    usd += (Math.max(0, usado - incluido) / 1_000_000) * usdPorMillon;
  }
  return Math.round(usd * 100) / 100;
}

/** El escalón de aviso de lo incluido: 0, 50, 75 o 90. Cambia de escalón, cambia el aviso. */
export function escalonDeAviso(porcentaje: number): 0 | 50 | 75 | 90 {
  if (porcentaje >= 90) return 90;
  if (porcentaje >= 75) return 75;
  if (porcentaje >= 50) return 50;
  return 0;
}

/**
 * El presupuesto es lo que se acepta pagar **encima de la base** de USD 5 (como lo dice TIENDA-3.0
 * §15.1). Las métricas son de toda la cuenta, así que el de la celda es la suma de los presupuestos
 * de los productos de la cuenta (lo arma el despliegue). Atribuir el costo a cada producto pide
 * filtrar las métricas por Worker y por base: queda dicho, no hecho.
 */
export interface Presupuesto {
  usdMes: number;
  /** Claves de kill switch que se apagan al agotarlo (`ks:<producto>-…`), validadas en el registro. */
  alAgotarse: readonly string[];
}

/** El presupuesto de la celda, de sus variables (salen de `productos.json`); null si no lo tiene. */
export function presupuestoDe(
  usdMes: string | undefined,
  alAgotarse: string | undefined,
): Presupuesto | null {
  const usd = Number(usdMes);
  if (!usdMes || !Number.isFinite(usd) || usd <= 0) return null;
  return {
    usdMes: usd,
    alAgotarse: (alAgotarse ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  };
}

export interface DecisionDePago extends Proyeccion {
  escalon: 0 | 50 | 75 | 90;
  /** Lo proyectado encima de la base ≥ presupuesto. */
  sobrePresupuesto: boolean;
  /** Las claves a apagar ahora: solo con el 100 % del presupuesto ya gastado, no proyectado. */
  apagar: readonly string[];
}

/**
 * Avisar se decide con la proyección, para que haya tiempo. Apagar, con lo ya gastado: una
 * proyección alta el día 2 no le quita al productor una capacidad que todavía no le costó nada.
 */
export function decidirConPago(
  consumo: Partial<Record<Cuota, number>>,
  ahora: number,
  presupuesto: Presupuesto | null,
): DecisionDePago {
  const p = proyectar(consumo, ahora);
  const maximo = Math.max(0, ...Object.values(p.usoDelIncluido));
  const gastado = costoHastaHoy(consumo) - BASE_USD_MES;
  return {
    ...p,
    escalon: escalonDeAviso(maximo),
    sobrePresupuesto: presupuesto !== null && p.usdProyectado - BASE_USD_MES >= presupuesto.usdMes,
    apagar: presupuesto !== null && gastado >= presupuesto.usdMes ? presupuesto.alAgotarse : [],
  };
}
