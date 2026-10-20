/**
 * Aislamiento de tenant (HU-E4.5, CA3; ARQUITECTURA §9): cada consulta SQL del Worker de una
 * celda, del agro o del parqueadero (HU-Q7.4), filtra por el `org_id` del token. La prueba lee el
 * código, no lo ejecuta: una consulta nueva sin filtro falla aquí antes de llegar a una base con
 * datos de otras organizaciones.
 *
 * Reglas, por cada tabla con datos de una organización:
 * - `FROM tabla` y `UPDATE tabla`: su WHERE (hasta cerrar el paréntesis en una subconsulta) dice
 *   `org_id = ?`.
 * - `INSERT INTO tabla (…)`: la lista de columnas lleva `org_id`.
 *
 * Las excepciones van con su motivo, una por una.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLAS_DEL_SHARD as TABLAS_AGRO } from '../../apps/api-celda/src/worker.ts';
import { TABLAS_DEL_SHARD as TABLAS_PARQUEADERO } from '../../apps/parqueadero-api/src/worker.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

interface Api {
  nombre: string;
  dir: string;
  tablas: readonly string[];
  archivos: readonly string[];
  excepciones: Record<string, string>;
}

/** Las API de celda, cada una con las tablas de su shard (HU-Q7.4 suma la del parqueadero). */
const APIS: readonly Api[] = [
  {
    nombre: 'agro',
    dir: join(RAIZ, 'apps', 'api-celda', 'src'),
    tablas: TABLAS_AGRO,
    archivos: ['mcp.ts', 'planes.ts', 'push.ts', 'pull.ts', 'qr.ts', 'worker.ts'],
    excepciones: {
      'select id, org_id from registro where id in':
        'busca el id en todas las organizaciones para saber si otra ya lo usa; el resultado solo se compara con la organización del token y nunca sale en la respuesta (push.ts)',
      'select id, org_id, entidad, version, datos from catalogo where id in':
        'lo mismo para los catálogos: detectar un id ajeno y mandarlo a cuarentena (push.ts)',
      'select org_id, plan, plan_vence from plan_de_org':
        'la vuelta programada compara la copia de los planes del shard entero con lo que dijo el CORE; no hay token ni usuario, y nada sale en una respuesta (planes.ts, HU-C5.6)',
    },
  },
  {
    nombre: 'parqueadero',
    dir: join(RAIZ, 'apps', 'parqueadero-api', 'src'),
    tablas: TABLAS_PARQUEADERO,
    archivos: [
      'certificados.ts',
      'dispositivos.ts',
      'push.ts',
      'pull.ts',
      'terminos.ts',
      'worker.ts',
    ],
    excepciones: {
      'select id, org_id, autor_usuario_id, instante_evento from registro where id in':
        'busca el id en todos los parqueaderos para saber si otro ya lo usa, y lo que una anulación anula; se compara con el parqueadero del token y nunca sale en la respuesta (push.ts)',
      'select id, org_id, entidad, version, datos from catalogo where id in':
        'lo mismo para los catálogos: detectar un id ajeno y mandarlo a cuarentena (push.ts)',
    },
  },
];

const normal = (sql: string) =>
  sql
    .replace(/\$\{[^}]*\}/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Las consultas de un archivo: el texto de cada `.prepare(…)`. */
function consultasDe(codigo: string): string[] {
  return [...codigo.matchAll(/\.prepare\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => normal(m[2] ?? ''));
}

/** Desde `inicio` hasta el paréntesis que cierra la subconsulta, o hasta el final. */
function alcance(sql: string, inicio: number): string {
  let nivel = 0;
  for (let i = inicio; i < sql.length; i++) {
    if (sql[i] === '(') nivel++;
    if (sql[i] === ')' && --nivel < 0) return sql.slice(inicio, i);
  }
  return sql.slice(inicio);
}

/** Qué le falta a la consulta, o null si filtra por organización. */
function faltaOrg(api: Api, sql: string): string | null {
  if (Object.keys(api.excepciones).some((e) => sql.startsWith(e))) return null;
  const tablas = api.tablas.join('|');
  for (const m of sql.matchAll(
    new RegExp(`\\binsert(?: or \\w+)? into (${tablas}) \\(([^)]*)\\)`, 'g'),
  )) {
    if (!/\borg_id\b/.test(m[2] ?? '')) return `INSERT en ${m[1]} sin la columna org_id`;
  }
  for (const m of sql.matchAll(new RegExp(`\\b(?:from|update) (${tablas})\\b`, 'g'))) {
    const parte = alcance(sql, m.index ?? 0);
    if (!/\bwhere\b.*\b(?:\w+\.)?org_id = \?/.test(parte))
      return `${m[0]} sin «where … org_id = ?»`;
  }
  return null;
}

/** Las consultas del código de una API; las pruebas y sus datos de prueba no cuentan. */
const consultasDeLaApi = (api: Api) =>
  readdirSync(api.dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.fixture.ts'))
    .flatMap((archivo) =>
      consultasDe(readFileSync(join(api.dir, archivo), 'utf8')).map((sql) => ({ archivo, sql })),
    );

describe.each(APIS.map((api) => [api.nombre, api] as const))(
  'CA3 · toda consulta de la celda del %s filtra por el org_id del token',
  (_nombre, api) => {
    const consultas = consultasDeLaApi(api);

    it('encuentra las consultas (si el patrón deja de verlas, esta prueba no probaría nada)', () => {
      expect(consultas.length).toBeGreaterThanOrEqual(8);
      expect(new Set(consultas.map((c) => c.archivo))).toEqual(new Set(api.archivos));
    });

    it.each(consultas.map((c) => [c.archivo, c.sql.slice(0, 70), c.sql] as const))(
      '%s: %s…',
      (_archivo, _inicio, sql) => {
        expect(faltaOrg(api, sql)).toBeNull();
      },
    );

    it('cada excepción sigue existiendo en el código (si no, se borra de la lista)', () => {
      for (const e of Object.keys(api.excepciones)) {
        expect(consultas.some((c) => c.sql.startsWith(e))).toBe(true);
      }
    });

    it('la regla ve los defectos (control negativo)', () => {
      expect(faltaOrg(api, 'select seq, datos from catalogo where seq > ? order by seq')).toMatch(
        /from catalogo/,
      );
      expect(faltaOrg(api, 'insert into cuarentena (id, motivo) values (?, ?)')).toMatch(
        /INSERT en cuarentena/,
      );
      expect(
        faltaOrg(
          api,
          'insert into registro (id, org_id, seq) values (?, ?, (select coalesce(max(seq), 0) + 1 from registro))',
        ),
      ).toMatch(/from registro/);
      expect(faltaOrg(api, 'select count(*) as n from registro where org_id = ?')).toBeNull();
    });
  },
);

// HU-T2.8 CA2: la API de la Tienda. Sus tablas son las de las migraciones del shard (todas llevan
// `org_id`, y `shard-tienda.test.ts` lo exige), salvo las de referencia. Todas las migraciones, no
// solo la 0001: una tabla nueva también se cuida (HU-T14.3 agregó `correo` en la 0006).
const DIR_DEL_SHARD = join(RAIZ, 'infrastructure/migraciones/tienda');
const TABLAS_TIENDA = readdirSync(DIR_DEL_SHARD)
  .filter((f) => f.endsWith('.sql'))
  .flatMap((f) => [
    ...readFileSync(join(DIR_DEL_SHARD, f), 'utf8').matchAll(/^CREATE TABLE (\w+)/gm),
  ])
  .map((m) => m[1] as string)
  .filter((t) => !t.startsWith('ref_'));
const TIENDA: Api = {
  nombre: 'tienda',
  dir: join(RAIZ, 'apps', 'tienda-api', 'src'),
  tablas: TABLAS_TIENDA,
  archivos: ['worker.ts'],
  excepciones: {
    'select org_id, version_publicada, estado, plan from tienda':
      'la tarea diaria rehace TIENDA_HOSTS con todas las tiendas del shard, con el plan de cada una (HU-T13.5); no hay token ni usuario, y nada sale en una respuesta (tareas.ts, HU-T17.1)',
    'select org_id from tienda where plan_vence is not null':
      'la tarea de cada hora busca en el shard las tiendas con el plan vencido y pasa cada una al gratuito con su org_id = ?; no hay token ni usuario, y nada sale en una respuesta (vencimiento.ts, HU-T13.5)',
    'select org_id from tienda':
      'la purga diaria recorre las tiendas del shard y purga cada una con su org_id = ?; no hay token ni usuario, y nada sale en una respuesta (tareas.ts, HU-T17.2)',
    'select count(*) as n from correo where dia = ?':
      'el tope diario de correos es de la celda entera, que comparte la cuenta de Gmail: se suman los shards; no hay token y solo sale el número (correos.ts, HU-T14.3)',
    'select t.org_id, t.anillo from tienda t join publicacion p':
      'el re-horneado por anillos busca, en todo el shard, las tiendas cuya versión publicada se horneó con otra release; no hay token, y cada una se re-hornea con su org_id = ? (releases.ts, HU-T4.6)',
    "select count(*) as n from publicacion where release = ? and estado = 'publicada'":
      'antes de borrar una release vieja se cuenta si alguna versión publicada del shard la usa; no hay token y solo sale el número (releases.ts, HU-T4.6)',
    'select count(*) as n from tienda where ?':
      'la salud cuenta los comercios de prueba del fixture (un org_id = ? por cada uno) para que el humo de producción exija cero; no hay token y solo sale el número (worker.ts, HU-T2.9)',
    'select kek_id, count(*) as n from llave indexed by llave_por_kek group by kek_id':
      'antes de retirar una KEK vieja, el despliegue cuenta cuántas DEK envuelve cada una en todo el shard; no hay token y solo salen los nombres de las KEK y números (llaves.ts, HU-T17.6)',
    'select org_id, proposito, version, envuelta, kek_id from llave indexed by llave_por_kek where kek_id in':
      'rotar la KEK reenvuelve las DEK de todas las tiendas del shard; cada una se reescribe con su org_id = ?, y nada sale en una respuesta (llaves.ts, HU-T17.6)',
    'select org_id, proposito, version, envuelta, kek_id from llave indexed by llave_por_kek':
      'terminada la rotación se comprueba que la KEK vigente abre cada DEK del shard; solo sale cuántas no abre (llaves.ts, HU-T17.6 CA2)',
    "select org_id from tienda indexed by tienda_baja_por_borrar where estado = 'baja' and datos_borrados is null and baja_pedida <= ? limit 20":
      'la tarea diaria busca en el shard las tiendas dadas de baja hace 30 días; cada una se borra con su org_id = ? y nada sale en una respuesta (baja.ts, HU-T13.7)',
  },
};

describe('HU-T2.8 CA2 · toda consulta de la API de la Tienda filtra por el org_id del token', () => {
  const consultas = consultasDeLaApi(TIENDA);

  it('conoce las tablas del shard y encuentra las consultas', () => {
    expect(TABLAS_TIENDA).toContain('pedido');
    expect(TABLAS_TIENDA).toContain('tienda');
    expect(TABLAS_TIENDA).toContain('correo');
    expect(consultas.some((c) => /\bfrom tienda\b/.test(c.sql))).toBe(true);
  });

  it.each(consultas.map((c) => [c.archivo, c.sql.slice(0, 70), c.sql] as const))(
    '%s: %s…',
    (_archivo, _inicio, sql) => {
      expect(faltaOrg(TIENDA, sql)).toBeNull();
    },
  );

  it('la regla ve los defectos (control negativo)', () => {
    expect(faltaOrg(TIENDA, 'select estado from pedido where codigo = ?')).toMatch(/from pedido/);
    expect(faltaOrg(TIENDA, 'insert into variante (id, producto_id) values (?, ?)')).toMatch(
      /INSERT en variante/,
    );
    expect(faltaOrg(TIENDA, 'select slug from tienda where org_id = ?')).toBeNull();
  });
});
