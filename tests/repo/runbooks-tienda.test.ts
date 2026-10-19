/**
 * Los runbooks de la Tienda no mienten (HU-T17.5, TIENDA-3.0 §15.6, P18): cada operación delicada
 * tiene el suyo (CA1), y lo que nombran existe (CA2): los archivos y los scripts del repositorio,
 * los otros runbooks que enlazan, los secretos, las rutas de la API, los kill switches, los KV y los
 * flujos de Actions. Un script renombrado, un secreto que cambió de nombre o una ruta que ya no está
 * ponen esto en rojo, como la guardia de documentos de la 2.0.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nombreKvHosts } from '../../scripts/lib/celda-tienda.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { nombreKvFlags } from '../../scripts/lib/kv-flags.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

/** CA1: cada operación de TIENDA §15.6, con su runbook o el motivo por el que todavía no lo tiene. */
const OPERACIONES: Record<string, string | { pendiente: string }> = {
  'alta de una tienda': {
    pendiente:
      'el alta abierta es HU-T13.4 (T16): hoy no existe la operación; su runbook se escribe con ella',
  },
  'conectar un dominio': 'tienda-conectar-un-dominio.md',
  'suspender una tienda': 'tienda-suspender.md',
  'rotar la KEK': 'tienda-rotar-la-kek.md',
  'incidente de datos personales': 'tienda-incidente-datos-personales.md',
  'restaurar una tienda': 'tienda-restaurar.md',
  'agregar un shard': 'tienda-agregar-un-shard.md',
  'volver atrás el código': 'tienda-volver-atras-el-codigo.md',
  'el corte de una tienda': {
    pendiente:
      'retirado con M6 (13 oct 2026): ninguna tienda 2.0 se migra a la 3.0 (HU-T12.8, bitácora tienda3 9)',
  },
};

/** Los runbooks de la Tienda: los suyos y los de sus secretos y su correo. */
const RUNBOOKS = readdirSync(join(RAIZ, 'docs/runbooks'))
  .filter((f) => /^tienda-.+\.md$/.test(f))
  .concat(['secretos-de-la-tienda.md', 'correo-de-gmail.md']);

const PREFIJOS_DE_SECRETOS =
  /\b(?:CF|TIENDA|CORREO|SECRETO|BOLD|TELEGRAM|GOOGLE)_[A-Z0-9_]*[A-Z0-9]\b(?!<)/g;

/** Lo que existe de verdad, leído del código y de la infraestructura. */
function loQueExiste() {
  const arquitectura = leer('docs/ARQUITECTURA.md');
  const env = leer('apps/tienda-api/src/worker.ts');
  const secretos = new Set([
    ...[...arquitectura.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1] ?? ''),
    ...[...env.matchAll(/^\s+([A-Z][A-Z0-9_]+)\?:/gm)].map((m) => m[1] ?? ''),
  ]);
  // Las rutas de verdad: el `app.all('*')` del 404 no cuenta como una.
  const rutas = [...env.matchAll(/app\.(?:get|post)\('([^']+)'/g)]
    .map((m) => m[1] ?? '')
    .map((r) => new RegExp(`^${r.replace(/:[a-z]+/gi, '[^/]+').replace(/\*/g, '.*')}$`));
  const productos = JSON.parse(leer('infrastructure/productos.json')) as {
    productos: { id: string; kill_switches?: string[] }[];
  };
  const claves = new Set(productos.productos.find((p) => p.id === 'tienda')?.kill_switches ?? []);
  const config = cargarCeldas();
  const kv = new Set(
    config.celdas
      .filter((c) => c.producto === 'tienda')
      .flatMap((c) =>
        (['staging', 'produccion'] as const).flatMap((d) => [
          nombreKvFlags(c.id, d, c.producto),
          nombreKvHosts(c.id, d),
        ]),
      ),
  );
  return { secretos, rutas, claves, kv };
}

/** Lo que un runbook nombra y no existe. */
function sinRespaldo(md: string, existe = loQueExiste()) {
  const archivos = [
    ...[
      ...md.matchAll(
        /`((?:apps|packages|content|docs|scripts|tests|infrastructure|\.github)\/[^`\s<>*]+)`/g,
      ),
    ].map((m) => m[1] ?? ''),
    ...[...md.matchAll(/node (scripts\/[^\s`]+\.ts)/g)].map((m) => m[1] ?? ''),
    ...[...md.matchAll(/\]\(([a-z0-9-]+\.md)\)/g)].map((m) => `docs/runbooks/${m[1]}`),
  ]
    .map((a) => a.replace(/[:#].*$/, '').replace(/[.,;)]$/, ''))
    .filter((a) => !existsSync(join(RAIZ, a)));
  const secretos = [...md.matchAll(PREFIJOS_DE_SECRETOS)]
    .map((m) => m[0])
    .filter((s) => !existe.secretos.has(s));
  const rutas = [...md.matchAll(/`(?:GET |POST )?(\/api\/[a-z0-9/_.<>-]+)`/g)]
    .map((m) => (m[1] ?? '').replace(/<[^>]+>/g, 'x'))
    .filter((r) => !existe.rutas.some((patron) => patron.test(r)));
  const claves = [...md.matchAll(/`(ks:[a-z0-9:<>-]+)`/g)]
    .map((m) => m[1] ?? '')
    .filter((c) => c !== 'ks:tienda:<org>' && !existe.claves.has(c));
  const kv = [...md.matchAll(/`(tienda-c[0-9]+-(?:flags|hosts)(?:-staging)?)`/g)]
    .map((m) => m[1] ?? '')
    .filter((k) => !existe.kv.has(k));
  const flujos = [...md.matchAll(/flujos?(?: a mano)? ((?:`[a-z0-9-]+`(?:,? (?:y )?)?)+)/g)]
    .flatMap((m) => [...(m[1] ?? '').matchAll(/`([a-z0-9-]+)`/g)].map((x) => x[1] ?? ''))
    .filter((f) => !existsSync(join(RAIZ, '.github/workflows', `${f}.yml`)));
  return { archivos, secretos, rutas, claves, kv, flujos };
}

const VACIO = { archivos: [], secretos: [], rutas: [], claves: [], kv: [], flujos: [] };

describe('los runbooks de la Tienda (HU-T17.5)', () => {
  it('CA1: cada operación delicada tiene su runbook, o dice por qué todavía no', () => {
    for (const [operacion, r] of Object.entries(OPERACIONES)) {
      if (typeof r === 'string') {
        expect(existsSync(join(RAIZ, 'docs/runbooks', r)), operacion).toBe(true);
      } else {
        expect(r.pendiente.length, operacion).toBeGreaterThan(20);
      }
    }
  });

  it.each(RUNBOOKS)('%s nombra solo lo que existe (CA2)', (r) => {
    expect(sinRespaldo(leer(`docs/runbooks/${r}`))).toEqual(VACIO);
  });

  it('❌ CA2: un script, un secreto, una ruta, un kill switch, un KV o un flujo que no existen se ven', () => {
    const md = [
      'Corre `node scripts/tienda/no-existe.ts` y mira `docs/runbooks/tampoco.md` o [esto](nada.md).',
      'Guarda `TIENDA_SECRETO_INVENTADO` y llama `POST /api/panel/v1/ruta-que-no-esta`.',
      'Apaga `ks:tienda-inventado` en `tienda-c9-flags` y corre el flujo `flujo-inventado`.',
    ].join('\n');
    expect(sinRespaldo(md)).toEqual({
      archivos: [
        'docs/runbooks/tampoco.md',
        'scripts/tienda/no-existe.ts',
        'docs/runbooks/nada.md',
      ],
      secretos: ['TIENDA_SECRETO_INVENTADO'],
      rutas: ['/api/panel/v1/ruta-que-no-esta'],
      claves: ['ks:tienda-inventado'],
      kv: ['tienda-c9-flags'],
      flujos: ['flujo-inventado'],
    });
  });

  it('lo que sí existe pasa: el control no es una guardia que lo rechaza todo', () => {
    const md =
      'Corre `node scripts/tienda/generar-secretos.ts`, guarda `TIENDA_KEK_V2`, llama `POST /api/despliegue/llaves`, apaga `ks:tienda:<org>` en `tienda-c1-flags-staging` y corre el flujo `simulacro-restauracion-tienda`.';
    expect(sinRespaldo(md)).toEqual(VACIO);
  });
});
