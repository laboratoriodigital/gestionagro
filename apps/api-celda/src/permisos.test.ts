/**
 * Roles y permisos en la celda (HU-E4.5, CA1 y CA2) contra el D1 local de un shard. Una prueba
 * por cada fila de la matriz y cada rol: subir y bajar. Los datos son las muestras del contrato de
 * la app 0.1.0, que cubren todas las entidades (HU-E5.5).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { uuidv7 } from '@ed1/agro-schema';
import {
  type Entidad,
  MATRIZ,
  MATRIZ_DE_REGISTROS,
  motivoSinPermiso,
  puede,
  puedeRegistro,
  type RespuestaPull,
  ROLES,
} from '@ed1/agro-schema/sync';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, RAIZ, vaciar } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp, TABLAS_DEL_SHARD } from './worker.ts';

const SHARD = 'agro_c0_s1';
const ORG = '0199a1b2-0000-7000-8000-0000000000f4';
const T0 = Date.UTC(2026, 9, 1, 12);

interface Muestra {
  entidad: string;
  datos: { id: string; version: number } & Record<string, unknown>;
}
const contrato = JSON.parse(
  readFileSync(join(RAIZ, 'packages', 'agro-schema', 'contratos', 'app-0.1.0.json'), 'utf8'),
) as { catalogos: Muestra[]; registros: ({ id: string } & Record<string, unknown>)[] };

let db: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());

const app = crearApp({ ahora: () => T0 });
async function pedir(rol: string, ruta: string, cuerpo?: object) {
  const token = (
    await firmarAcceso(
      firmante,
      { sub: 'u', org: ORG, rol, celda: 'c0', shard: SHARD, anillo: 1 },
      T0,
    )
  ).token;
  const r = await app.fetch(
    new Request(`https://api.ejemplo.test${ruta}`, {
      method: cuerpo ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    }),
    {
      CELDA: 'c0',
      PRODUCTO: 'agro',
      CORE_CLAVES: JSON.stringify([firmante.publica]),
      ORIGENES_APP: 'https://agro.ejemplo.test',
      [SHARD]: db,
    },
  );
  return { estado: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}
const subir = (rol: string, ops: object[]) =>
  pedir(rol, '/api/v1/sync/push', { protocolo: 1, dispositivo: 'telefono-1', app: '0.1.0', ops });
const bajar = async (rol: string) =>
  (await pedir(rol, '/api/v1/sync/pull?registro=0&catalogo=0')).cuerpo as unknown as RespuestaPull;

const catalogoOp = (m: Muestra, version: number) => ({
  id: `${m.datos.id}@v${version}`,
  entidad: m.entidad,
  entidad_id: m.datos.id,
  version,
  datos: { ...m.datos, version },
});
const registroOp = (r: { id: string } & Record<string, unknown>, id = r.id) => ({
  id,
  entidad: 'registro',
  entidad_id: id,
  version: 1,
  datos: { ...r, id },
});

/** Una operación nueva de esa entidad sobre la finca que ya está en la nube. */
let n = 0;
function operacionDe(entidad: Entidad) {
  if (entidad === 'registro') {
    const [r] = contrato.registros;
    if (!r) throw new Error('el contrato no trae registros');
    return registroOp(
      r,
      uuidv7(() => T0 + ++n),
    );
  }
  const m = contrato.catalogos.find((c) => c.entidad === entidad);
  if (!m) throw new Error(`el contrato no trae ${entidad}`);
  return catalogoOp(m, m.datos.version + 1);
}

beforeEach(async () => {
  await vaciar(db, [...TABLAS_DEL_SHARD]);
  // La finca entera, subida por el propietario.
  const r = await subir('propietario', [
    ...contrato.catalogos.map((m) => catalogoOp(m, m.datos.version)),
    ...contrato.registros.map((x) => registroOp(x)),
  ]);
  expect((r.cuerpo['acks'] as { estado: string }[]).every((a) => a.estado === 'aceptado')).toBe(
    true,
  );
});

const filas = Object.keys(MATRIZ) as Entidad[];
const escriben = ROLES.filter((rol) => filas.some((e) => puede(rol, 'escribir', e)));

describe.each(filas)('fila «%s» de la matriz', (entidad) => {
  it.each(escriben)(
    'escribir como %s: entra si la matriz lo permite; si no, cuarentena con el motivo',
    async (rol) => {
      const op = operacionDe(entidad);
      const r = await subir(rol, [op]);
      expect(r.estado).toBe(200);
      const [ack] = r.cuerpo['acks'] as { estado: string; motivo?: string }[];
      if (puede(rol, 'escribir', entidad)) {
        expect(ack).toMatchObject({ estado: 'aceptado' });
      } else {
        expect(ack).toEqual({
          id: op.id,
          estado: 'cuarentena',
          motivo: motivoSinPermiso(rol, entidad),
        });
        const guardada = await db
          .prepare('SELECT motivo FROM cuarentena WHERE org_id = ? AND id = ?')
          .bind(ORG, op.id)
          .first<{ motivo: string }>();
        expect(guardada?.motivo).toBe(motivoSinPermiso(rol, entidad)); // nada se pierde (P1)
      }
    },
  );

  it.each([...ROLES])('leer como %s: baja solo si la matriz lo permite', async (rol) => {
    const pagina = await bajar(rol);
    const llego =
      entidad === 'registro'
        ? pagina.registros.length > 0
        : pagina.catalogos.some((c) => c.entidad === entidad);
    expect(llego).toBe(puede(rol, 'leer', entidad));
  });
});

/** Muestras de la app 0.2.0 para los tipos de registro con permisos propios (HU-E6.3). */
const nuevos = JSON.parse(
  readFileSync(join(RAIZ, 'packages', 'agro-schema', 'contratos', 'app-0.2.0.json'), 'utf8'),
) as { registros: ({ id: string; tipo: string } & Record<string, unknown>)[] };
const muestraDe = (tipo: string) => {
  const m = nuevos.registros.find((r) => r.tipo === tipo);
  if (!m) throw new Error(`el contrato 0.2.0 no trae ${tipo}`);
  return registroOp(
    m,
    uuidv7(() => T0 + ++n),
  );
};

describe.each(Object.keys(MATRIZ_DE_REGISTROS))('fila de registros «%s» de la matriz', (tipo) => {
  it.each(escriben)(
    'escribir como %s: entra si la matriz lo permite; si no, cuarentena',
    async (rol) => {
      const op = muestraDe(tipo);
      const [ack] = (await subir(rol, [op])).cuerpo['acks'] as {
        estado: string;
        motivo?: string;
      }[];
      expect(ack).toEqual(
        puedeRegistro(rol, 'escribir', tipo)
          ? { id: op.id, estado: 'aceptado' }
          : { id: op.id, estado: 'cuarentena', motivo: motivoSinPermiso(rol, 'registro', tipo) },
      );
    },
  );

  it.each([...ROLES])('leer como %s: baja solo si la matriz lo permite', async (rol) => {
    await subir('propietario', [muestraDe(tipo)]);
    const pagina = await bajar(rol);
    expect(pagina.registros.some((r) => r.tipo === tipo)).toBe(puedeRegistro(rol, 'leer', tipo));
    // Los demás registros siguen llegando a quien puede leerlos.
    expect(pagina.registros.some((r) => r.tipo !== tipo)).toBe(puede(rol, 'leer', 'registro'));
  });
});

describe('CA2: lo que un rol no puede, la celda lo niega aunque la interfaz no lo esconda', () => {
  it.each(ROLES.filter((rol) => !escriben.includes(rol)))(
    '%s no registra: subir responde 403 y no escribe nada',
    async (rol) => {
      const antes = await db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
      const r = await subir(rol, [operacionDe('registro')]);
      expect(r.estado).toBe(403);
      expect(r.cuerpo['estado']).toBe('sin-permiso');
      const despues = await db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
      expect(despues?.n).toBe(antes?.n);
    },
  );

  it('un operario no recibe el valor del jornal ni puede cambiarlo', async () => {
    const pagina = await bajar('operario');
    expect(pagina.catalogos.map((c) => c.entidad)).not.toContain('valor_jornal');
    expect(JSON.stringify(pagina)).not.toContain('valor_cop');
    const r = await subir('operario', [operacionDe('valor_jornal')]);
    expect((r.cuerpo['acks'] as { estado: string }[])[0]?.estado).toBe('cuarentena');
  });

  it('un rol que la matriz no conoce no lee ni escribe nada', async () => {
    expect((await subir('jefe', [operacionDe('registro')])).estado).toBe(403);
    const pagina = await bajar('jefe');
    expect(pagina.catalogos).toEqual([]);
    expect(pagina.registros).toEqual([]);
  });

  it('en un lote mezclado, lo permitido entra y lo negado va a cuarentena', async () => {
    const r = await subir('operario', [operacionDe('registro'), operacionDe('area')]);
    expect((r.cuerpo['acks'] as { estado: string }[]).map((a) => a.estado)).toEqual([
      'aceptado',
      'cuarentena',
    ]);
  });
});
