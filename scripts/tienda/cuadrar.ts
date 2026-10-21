/**
 * `node scripts/tienda/cuadrar.ts --ambiente staging|produccion --org <id>` (HU-T14.6): cuadra ya la
 * semana de una tienda, sus pedidos y pagos de la base frente a lo que contó la medición de su
 * vitrina, sin esperar su turno. Lo corre el flujo `cuadrar-tienda`, con el secreto del despacho:
 * staging no tiene cron (D-T10), y así se ve la aceptación de M5 con los comercios de prueba. El
 * resultado sale en el tablero de Inicio del panel. Solo cifras.
 */
import { panelDe } from './suspender.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export async function cuadrar(
  p: { ambiente: 'staging' | 'produccion'; org: string },
  secreto: string,
  f: Fetch = fetch,
  panel = panelDe(p.ambiente),
): Promise<{ ok: boolean; texto: string }> {
  const r = await f(`${panel}/api/despliegue/cuadre`, {
    method: 'POST',
    headers: { 'x-despliegue': secreto, 'content-type': 'application/json' },
    body: JSON.stringify({ org: p.org }),
  });
  const c = (await r.json().catch(() => ({}))) as {
    estado?: string;
    motivo?: string;
    semana?: string;
    base?: { pedidos: number; pagos: number };
    eventos?: { pedidos: number; pagos: number };
  };
  if (r.status === 404) return { ok: false, texto: `No hay una tienda ${p.org} en ${p.ambiente}.` };
  if (!r.ok || !c.base || !c.eventos)
    return {
      ok: false,
      texto: `La API respondió ${r.status}: ${c.motivo ?? c.estado ?? 'sin detalle'}`,
    };
  return {
    ok: true,
    texto: `Semana del ${c.semana}: pedidos ${c.base.pedidos} en la base y ${c.eventos.pedidos} en la medición; pagos ${c.base.pagos} y ${c.eventos.pagos}. Ya se ve en el Inicio del panel.`,
  };
}

if (process.argv[1]?.endsWith('cuadrar.ts')) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const ambiente = arg('ambiente');
  const org = arg('org');
  const secreto = process.env['SECRETO_DESPACHO'];
  if ((ambiente !== 'staging' && ambiente !== 'produccion') || !org || !secreto) {
    console.error(
      '❌ Uso: node scripts/tienda/cuadrar.ts --ambiente staging|produccion --org <id>, con SECRETO_DESPACHO',
    );
    process.exit(2);
  }
  const r = await cuadrar({ ambiente, org }, secreto);
  console.log(`${r.ok ? '✅' : '❌'} ${r.texto}`);
  process.exit(r.ok ? 0 : 1);
}
