/**
 * `node scripts/registrar-pago-en-efectivo.ts` (HU-C5.8): registra un pago del plan que el cliente
 * le hizo al dueño en efectivo. Lo corre el flujo `registrar-pago-en-efectivo` con el token de
 * Cloudflare del ambiente; sin `CONFIRMAR=si` solo muestra lo que haría. Pasos en
 * `docs/runbooks/pago-en-efectivo.md`.
 *
 * Lee todo de variables de entorno (el flujo no interpola entradas en `run`): AMBIENTE, CLIENTE,
 * PRODUCTO, PLAN, MESES, MONTO (opcional), NOTA, CONFIRMAR, REGISTRA, CF_API_TOKEN, CF_ACCOUNT_ID.
 */
import { appendFileSync } from 'node:fs';
import { uuidv7 } from '@ed1/ids';
import {
  type PedidoEnEfectivo,
  type Plan,
  planearPagoEnEfectivo,
  registrarPagoEnEfectivo,
} from '../apps/core/src/pago-en-efectivo.ts';
import { cargarCeldas } from './lib/celdas.ts';
import { nombreD1Core } from './lib/d1-core.ts';
import { baseD1Remota, idDeLaBaseD1 } from './lib/d1-remota.ts';

/** `$299.000`: sin `Intl`, que cambia entre entornos. */
const formatearPesos = (n: number) => `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/** `2027-10-20T…` → `20/10/2027`, en Bogotá. */
const fecha = (iso: string | null) => {
  if (!iso) return 'sin vencimiento';
  const d = new Date(Date.parse(iso) - 5 * 3600_000);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

/** Lo que el dueño lee en el resumen de la corrida. */
export function resumen(plan: Plan, registrado: boolean): string {
  const lineas = [
    registrado ? '## ✅ Pago en efectivo registrado' : '## Vista previa: nada se escribió',
    '',
    `- **Organización:** ${plan.organizacion.nombre} (\`${plan.organizacion.id}\`)`,
    `- **Plan:** ${plan.plan}, ${plan.meses} ${plan.meses === 1 ? 'mes' : 'meses'}, ${formatearPesos(plan.monto_cop)}`,
    `- **Antes:** ${plan.antes.plan}, ${plan.antes.vence ? `vence el ${fecha(plan.antes.vence)}` : 'sin vencimiento'}`,
    `- **Queda:** ${plan.plan} hasta el ${fecha(plan.vence)}`,
  ];
  if (plan.precio_cop !== null && plan.precio_cop !== plan.monto_cop)
    lineas.push(`- **Ojo:** el precio del periodo es ${formatearPesos(plan.precio_cop)}.`);
  if (plan.credito_dias > 0)
    lineas.push(`- **Días del plan anterior que pasan al nuevo:** ${plan.credito_dias}.`);
  if (!registrado)
    lineas.push('', 'Si está bien, corra el flujo otra vez con «confirmar» en **si**.');
  else
    lineas.push(
      '',
      'La caja o el cuaderno del cliente lo ven en la próxima hora, o al volver a entrar.',
    );
  return lineas.join('\n');
}

export function pedidoDelEntorno(env: NodeJS.ProcessEnv): PedidoEnEfectivo | string {
  const ambiente = env['AMBIENTE'];
  const meses = Number(env['MESES']);
  const monto = (env['MONTO'] ?? '').replace(/[.\s$]/g, '');
  if (ambiente !== 'staging' && ambiente !== 'produccion') return 'AMBIENTE: staging o produccion';
  for (const v of ['CLIENTE', 'PRODUCTO', 'PLAN', 'NOTA', 'REGISTRA'] as const)
    if (!env[v]?.trim()) return `Falta ${v}`;
  if (monto && !/^\d+$/.test(monto)) return 'MONTO: solo pesos enteros, como 299000 o 299.000';
  return {
    cliente: (env['CLIENTE'] ?? '').trim(),
    producto: (env['PRODUCTO'] ?? '').trim(),
    plan: (env['PLAN'] ?? '').trim(),
    meses,
    monto_cop: monto ? Number(monto) : null,
    nota: env['NOTA'] ?? '',
    registra: env['REGISTRA'] ?? '',
    ambiente: ambiente === 'produccion' ? 'produccion' : 'pruebas',
  };
}

if (process.argv[1]?.endsWith('registrar-pago-en-efectivo.ts')) {
  const pedido = pedidoDelEntorno(process.env);
  const token = process.env['CF_API_TOKEN'];
  const cuenta = process.env['CF_ACCOUNT_ID'];
  if (typeof pedido === 'string' || !token || !cuenta) {
    console.error(
      `❌ ${typeof pedido === 'string' ? pedido : 'Faltan CF_API_TOKEN o CF_ACCOUNT_ID'}`,
    );
    process.exit(2);
  }
  const destino = process.env['AMBIENTE'] === 'produccion' ? 'produccion' : 'staging';
  const nombre = nombreD1Core(cargarCeldas().core.d1, destino);
  const db = baseD1Remota(fetch, token, cuenta, await idDeLaBaseD1(fetch, token, cuenta, nombre));
  const confirmar = process.env['CONFIRMAR'] === 'si';
  const ahora = Date.now();
  const r = confirmar
    ? await registrarPagoEnEfectivo(db, pedido, ahora, () => uuidv7(() => ahora))
    : await planearPagoEnEfectivo(db, pedido, ahora);
  const texto = r.ok ? resumen(r.plan, confirmar) : `## ❌ No se registró\n\n${r.motivo}`;
  console.log(texto);
  const archivo = process.env['GITHUB_STEP_SUMMARY'];
  if (archivo) appendFileSync(archivo, `${texto}\n`);
  process.exit(r.ok ? 0 : 1);
}
