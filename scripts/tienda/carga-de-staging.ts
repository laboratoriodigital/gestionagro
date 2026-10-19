/**
 * `node scripts/tienda/carga-de-staging.ts [--host <tienda de staging>]` (HU-T11.10 CA2): la prueba
 * de carga del despacho y de la API contra staging, con sus límites.
 *
 * - **Las páginas:** la portada, una ficha, el carrito y los términos, muchas veces y varias a la
 *   vez. Ninguna puede responder 5xx, y el p95 tiene que quedar por debajo de 1,5 s.
 * - **La API:** \`cotizar\` más veces por minuto de las que deja el limitador por IP (30): tiene que
 *   empezar a responder 429, y nunca 5xx. Así se ve que el límite está puesto en staging.
 * - Lo que mide la regla de límite de la zona (un tope por visitante en el panel de Cloudflare) se ve
 *   igual: aparece como 429 en las páginas, y el resumen lo cuenta aparte.
 *
 * Lo corre a mano el flujo `carga-staging-tienda`. Con los valores de siempre son unas 500
 * solicitudes: una fracción de las 100.000 diarias del plan gratuito, y \`cotizar\` lee pocas filas.
 */
import { ENSAYOS, hostDeStaging } from '../../packages/tienda-schema/src/ensayos.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpcionesDeCarga {
  host: string;
  /** Cuántas veces se pide cada página. */
  vueltas?: number;
  /** Cuántas solicitudes a la vez. */
  aLaVez?: number;
  /** Cuántas veces se cotiza seguido, desde la misma IP. */
  cotizaciones?: number;
  fetch?: Fetch;
  ahora?: () => number;
}

export interface ResultadoDeCarga {
  paginas: { pedidas: number; porEstado: Record<string, number>; p50: number; p95: number };
  cotizar: { pedidas: number; porEstado: Record<string, number> };
  fallas: string[];
}

const percentil = (ms: number[], p: number) => {
  const orden = [...ms].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))] ?? 0;
};

async function enTandas<T>(trabajos: (() => Promise<T>)[], aLaVez: number): Promise<T[]> {
  const salida: T[] = [];
  for (let i = 0; i < trabajos.length; i += aLaVez) {
    salida.push(...(await Promise.all(trabajos.slice(i, i + aLaVez).map((t) => t()))));
  }
  return salida;
}

export async function cargaDeStaging(o: OpcionesDeCarga): Promise<ResultadoDeCarga> {
  const f = o.fetch ?? fetch;
  const ahora = o.ahora ?? (() => performance.now());
  const base = `https://${o.host}`;
  const fallas: string[] = [];
  // Una ficha de verdad, del catálogo de la tienda.
  let ficha: string | null = null;
  try {
    const cat = (await (await f(`${base}/catalogo.json`)).json()) as {
      productos?: { slug?: string }[];
    };
    const slug = cat.productos?.[0]?.slug;
    ficha = slug ? `/p/${slug}/` : null;
  } catch {
    fallas.push('no se pudo leer /catalogo.json: la prueba sigue sin ficha');
  }
  const rutas = ['/', '/carrito/', '/legal/terminos/', ...(ficha ? [ficha] : [])];
  const vueltas = o.vueltas ?? 50;
  const tiempos: number[] = [];
  const porEstado: Record<string, number> = {};
  await enTandas(
    Array.from({ length: vueltas * rutas.length }, (_, i) => async () => {
      const t0 = ahora();
      let estado = 'sin respuesta';
      try {
        const r = await f(`${base}${rutas[i % rutas.length]}`);
        await r.arrayBuffer();
        estado = String(r.status);
      } catch {
        // Cuenta como falla abajo.
      }
      tiempos.push(ahora() - t0);
      porEstado[estado] = (porEstado[estado] ?? 0) + 1;
    }),
    o.aLaVez ?? 10,
  );
  const cotizar: Record<string, number> = {};
  const cotizaciones = o.cotizaciones ?? 45;
  for (let i = 0; i < cotizaciones; i++) {
    let estado = 'sin respuesta';
    try {
      const r = await f(`${base}/api/v1/cotizar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineas: [] }),
      });
      await r.arrayBuffer();
      estado = String(r.status);
    } catch {
      // Cuenta como falla abajo.
    }
    cotizar[estado] = (cotizar[estado] ?? 0) + 1;
  }
  const errores = (e: Record<string, number>) =>
    Object.entries(e)
      .filter(([k]) => k === 'sin respuesta' || k.startsWith('5'))
      .reduce((s, [, n]) => s + n, 0);
  const p95 = percentil(tiempos, 95);
  if (errores(porEstado) > 0) fallas.push(`${errores(porEstado)} páginas respondieron 5xx o nada`);
  if (p95 > 1500) fallas.push(`el p95 de las páginas es ${Math.round(p95)} ms: el tope es 1.500`);
  if (errores(cotizar) > 0) fallas.push(`${errores(cotizar)} cotizaciones respondieron 5xx o nada`);
  if (cotizaciones > 30 && !cotizar['429'])
    fallas.push(
      `${cotizaciones} cotizaciones seguidas y ningún 429: el limitador por IP no está puesto`,
    );
  return {
    paginas: {
      pedidas: tiempos.length,
      porEstado,
      p50: Math.round(percentil(tiempos, 50)),
      p95: Math.round(p95),
    },
    cotizar: { pedidas: cotizaciones, porEstado: cotizar },
    fallas,
  };
}

if (process.argv[1]?.endsWith('carga-de-staging.ts')) {
  const i = process.argv.indexOf('--host');
  // Solo contra los comercios de prueba de staging: nunca una tienda de verdad.
  const deStaging = ENSAYOS.map((e) => hostDeStaging(e.slug));
  const host = i > 0 ? process.argv[i + 1] : deStaging[1];
  if (!host || !deStaging.includes(host)) {
    console.error(`Solo contra un comercio de prueba de staging: ${deStaging.join(', ')}.`);
    process.exit(2);
  }
  const r = await cargaDeStaging({ host });
  console.log(
    `Páginas: ${r.paginas.pedidas}, ${JSON.stringify(r.paginas.porEstado)}, p50 ${r.paginas.p50} ms, p95 ${r.paginas.p95} ms`,
  );
  console.log(`Cotizar: ${r.cotizar.pedidas}, ${JSON.stringify(r.cotizar.porEstado)}`);
  for (const falla of r.fallas) console.log(`❌ ${falla}`);
  if (r.fallas.length === 0) console.log('✅ Staging aguantó la carga y sus límites respondieron.');
  process.exit(r.fallas.length === 0 ? 0 : 1);
}
