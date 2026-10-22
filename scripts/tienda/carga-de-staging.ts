/**
 * `node scripts/tienda/carga-de-staging.ts [--host <tienda de staging>]` (HU-T11.10 CA2): la prueba
 * de carga del despacho y de la API contra staging, con sus límites.
 *
 * - **Las páginas:** la portada, una ficha, el carrito y los términos, muchas veces y varias a la
 *   vez. Ninguna puede responder 5xx, y el p95 tiene que quedar por debajo de 1,5 s.
 * - **La API:** \`cotizar\` en ráfagas, muchas más veces por minuto de las que deja el limitador por
 *   IP (30): tiene que empezar a responder 429, y nunca 5xx. El limitador de los Workers es
 *   aproximado: cada máquina de un centro de datos cuenta aparte y las cuentas se juntan después, así
 *   que una por una pueden pasar de largo (bitácora tienda3 53). En ráfagas, como un abuso de
 *   verdad, sí corta.
 * - La regla de límite de la zona (60 en 10 s por IP, en el panel de Cloudflare) responde su propio
 *   429, sin el JSON de la tienda: el resumen lo cuenta aparte («429 zona») y avisa si no apareció.
 *
 * Lo corre a mano el flujo `carga-staging-tienda`. Con los valores de siempre son unas 320
 * solicitudes: una fracción de las 100.000 diarias del plan gratuito. Las cotizaciones van vacías:
 * la API las rechaza después de revisar el límite, sin leer la base.
 */
import { ENSAYOS, hostDeStaging } from '../../packages/tienda-schema/src/ensayos.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpcionesDeCarga {
  host: string;
  /** Cuántas veces se pide cada página. */
  vueltas?: number;
  /** Cuántas solicitudes a la vez. */
  aLaVez?: number;
  /** Cuántas veces se cotiza desde la misma IP, en ráfagas. */
  cotizaciones?: number;
  /** Cuántas cotizaciones a la vez. */
  rafaga?: number;
  fetch?: Fetch;
  ahora?: () => number;
}

export interface ResultadoDeCarga {
  paginas: { pedidas: number; porEstado: Record<string, number>; p50: number; p95: number };
  cotizar: { pedidas: number; porEstado: Record<string, number> };
  fallas: string[];
  /** Lo que conviene revisar sin que la prueba falle: la regla de la zona que no bloqueó. */
  avisos: string[];
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
  const cotizaciones = o.cotizaciones ?? 120;
  await enTandas(
    Array.from({ length: cotizaciones }, () => async () => {
      let estado = 'sin respuesta';
      try {
        const r = await f(`${base}/api/v1/cotizar`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lineas: [] }),
        });
        const texto = await r.text();
        estado = String(r.status);
        // El 429 de la tienda trae su JSON; el de la regla de la zona es la página de Cloudflare.
        if (r.status === 429 && !texto.includes('"limite"')) estado = '429 zona';
      } catch {
        // Cuenta como falla abajo.
      }
      cotizar[estado] = (cotizar[estado] ?? 0) + 1;
    }),
    o.rafaga ?? 20,
  );
  const errores = (e: Record<string, number>) =>
    Object.entries(e)
      .filter(([k]) => k === 'sin respuesta' || k.startsWith('5'))
      .reduce((s, [, n]) => s + n, 0);
  const p95 = percentil(tiempos, 95);
  if (errores(porEstado) > 0) fallas.push(`${errores(porEstado)} páginas respondieron 5xx o nada`);
  if (p95 > 1500) fallas.push(`el p95 de las páginas es ${Math.round(p95)} ms: el tope es 1.500`);
  if (errores(cotizar) > 0) fallas.push(`${errores(cotizar)} cotizaciones respondieron 5xx o nada`);
  if (cotizaciones > 30 && !cotizar['429'] && !cotizar['429 zona'])
    fallas.push(
      `${cotizaciones} cotizaciones en ráfagas y ningún 429: el limitador por IP no está puesto`,
    );
  const avisos: string[] = [];
  if (cotizaciones > 60 && !cotizar['429 zona'])
    avisos.push(
      'la regla de límite de la zona no bloqueó ninguna: revisa en Cloudflare que esté desplegada',
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
    avisos,
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
  for (const aviso of r.avisos) console.log(`⚠️ ${aviso}`);
  for (const falla of r.fallas) console.log(`❌ ${falla}`);
  if (r.fallas.length === 0) console.log('✅ Staging aguantó la carga y sus límites respondieron.');
  process.exit(r.fallas.length === 0 ? 0 : 1);
}
