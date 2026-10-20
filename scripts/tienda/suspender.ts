/**
 * `node scripts/tienda/suspender.ts --ambiente staging|produccion --org <id> --accion suspender|levantar
 * --motivo "<texto>"` (HU-T13.6): el clic del operador para suspender o levantar una tienda. Lo corre
 * el flujo `suspender-tienda`, con el secreto del despacho del ambiente; la API la pone en
 * `suspendida` y el despacho responde 451 en todas sus direcciones. Pasos y simulacro en
 * `docs/runbooks/tienda-suspender.md`.
 */
import { cargarCeldas } from '../lib/celdas.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface PedidoDeSuspension {
  ambiente: 'staging' | 'produccion';
  org: string;
  accion: 'suspender' | 'levantar';
  motivo: string;
}

/** La dirección de la API de la Tienda en ese ambiente: la del panel, que pasa `/api/*`. */
export function panelDe(ambiente: PedidoDeSuspension['ambiente']): string {
  const celda = cargarCeldas().celdas.find((c) => c.producto === 'tienda');
  if (!celda) throw new Error('celdas.json no tiene la celda de la Tienda');
  return ambiente === 'staging' ? celda.api_staging : celda.api;
}

export async function suspender(
  p: PedidoDeSuspension,
  secreto: string,
  f: Fetch = fetch,
  panel = panelDe(p.ambiente),
): Promise<{ ok: boolean; texto: string }> {
  const r = await f(`${panel}/api/despliegue/tienda-estado`, {
    method: 'POST',
    headers: { 'x-despliegue': secreto, 'content-type': 'application/json' },
    body: JSON.stringify({ org: p.org, accion: p.accion, motivo: p.motivo }),
  });
  const cuerpo = (await r.json().catch(() => ({}))) as {
    estado?: string;
    ahora?: string;
    motivo?: string;
  };
  if (r.status === 404 && cuerpo.estado === 'no-existe')
    return { ok: false, texto: `No hay una tienda ${p.org} en ${p.ambiente}.` };
  if (!r.ok)
    return {
      ok: false,
      texto: `La API respondió ${r.status}: ${cuerpo.motivo ?? cuerpo.estado ?? 'sin detalle'}`,
    };
  if (cuerpo.estado === 'sin-cambio')
    return { ok: true, texto: `La tienda ya estaba «${cuerpo.ahora}»: nada cambió.` };
  return {
    ok: true,
    texto:
      p.accion === 'suspender'
        ? 'La tienda quedó suspendida: en dos minutos todas sus direcciones responden 451.'
        : `Suspensión levantada: la tienda vuelve a «${cuerpo.ahora}».`,
  };
}

if (process.argv[1]?.endsWith('suspender.ts')) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const ambiente = arg('ambiente');
  const accion = arg('accion');
  const org = arg('org');
  const motivo = arg('motivo');
  const secreto = process.env['SECRETO_DESPACHO'];
  if (
    (ambiente !== 'staging' && ambiente !== 'produccion') ||
    (accion !== 'suspender' && accion !== 'levantar') ||
    !org ||
    !motivo ||
    !secreto
  ) {
    console.error(
      '❌ Uso: node scripts/tienda/suspender.ts --ambiente staging|produccion --org <id> --accion suspender|levantar --motivo "<texto>", con SECRETO_DESPACHO',
    );
    process.exit(2);
  }
  const r = await suspender({ ambiente, accion, org, motivo }, secreto);
  console.log(`${r.ok ? '✅' : '❌'} ${r.texto}`);
  process.exit(r.ok ? 0 : 1);
}
