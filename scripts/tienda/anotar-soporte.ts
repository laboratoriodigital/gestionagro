/**
 * `node scripts/tienda/anotar-soporte.ts --ambiente staging|produccion --org <id> --minutos <n> --tema
 * <tema> [--dia AAAA-MM-DD]` (HU-T14.7): el dueño anota una atención de soporte a un comercio. Lo
 * corre el flujo «anotar-soporte-tienda», con el secreto del despacho. Sin texto libre: solo la
 * tienda, los minutos y el tema. El reporte semanal suma la semana.
 */
import { panelDe } from './suspender.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export const TEMAS = ['alta', 'catalogo', 'pedidos', 'cobro', 'dominio', 'otro'] as const;

export interface Atencion {
  ambiente: 'staging' | 'produccion';
  org: string;
  minutos: number;
  tema: (typeof TEMAS)[number];
  dia?: string;
}

export async function anotar(
  a: Atencion,
  secreto: string,
  f: Fetch = fetch,
  panel = panelDe(a.ambiente),
): Promise<{ ok: boolean; texto: string }> {
  const r = await f(`${panel}/api/despliegue/soporte`, {
    method: 'POST',
    headers: { 'x-despliegue': secreto, 'content-type': 'application/json' },
    body: JSON.stringify({
      org: a.org,
      minutos: a.minutos,
      tema: a.tema,
      ...(a.dia ? { dia: a.dia } : {}),
    }),
  });
  const c = (await r.json().catch(() => ({}))) as {
    estado?: string;
    motivo?: string;
    dia?: string;
  };
  if (r.status === 404) return { ok: false, texto: `No hay una tienda ${a.org} en ${a.ambiente}.` };
  if (!r.ok || c.estado !== 'anotado')
    return {
      ok: false,
      texto: `La API respondió ${r.status}: ${c.motivo ?? c.estado ?? 'sin detalle'}`,
    };
  return { ok: true, texto: `Anotados ${a.minutos} minutos de «${a.tema}» el ${c.dia}.` };
}

if (process.argv[1]?.endsWith('anotar-soporte.ts')) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const ambiente = arg('ambiente');
  const org = arg('org');
  const minutos = Number(arg('minutos'));
  const tema = arg('tema') as Atencion['tema'] | undefined;
  const dia = arg('dia') || undefined;
  const secreto = process.env['SECRETO_DESPACHO'];
  if (
    (ambiente !== 'staging' && ambiente !== 'produccion') ||
    !org ||
    !Number.isInteger(minutos) ||
    !tema ||
    !TEMAS.includes(tema) ||
    !secreto
  ) {
    console.error(
      `❌ Uso: node scripts/tienda/anotar-soporte.ts --ambiente staging|produccion --org <id> --minutos <n> --tema ${TEMAS.join('|')} [--dia AAAA-MM-DD], con SECRETO_DESPACHO`,
    );
    process.exit(2);
  }
  const r = await anotar({ ambiente, org, minutos, tema, ...(dia ? { dia } : {}) }, secreto);
  console.log(`${r.ok ? '✅' : '❌'} ${r.texto}`);
  process.exit(r.ok ? 0 : 1);
}
