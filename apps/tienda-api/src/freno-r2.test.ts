/**
 * Bitácora tienda3 27: el freno de R2. Con la API de métricas, el KV de flags y Telegram de
 * mentira: qué mide, cuándo avisa, qué apaga, qué vuelve a encender y qué hace si no puede medir.
 */
import { describe, expect, it } from 'vitest';
import {
  R2_CLASE_A as CLASE_A_DEL_VIGIA,
  R2_GRATIS as GRATIS_DEL_VIGIA,
} from '../../api-celda/src/vigia.ts';
import {
  CLAVE_DEL_FRENO,
  FRENO_R2,
  frenar,
  type MedicionR2,
  medirR2,
  R2_CLASE_A,
  R2_GRATIS,
} from './freno-r2.ts';
import type { EntornoDeTareas, KvDeTareas } from './tareas.ts';

const T0 = Date.parse('2026-10-16T21:00:00.000Z');

function kv(inicial: Record<string, string> = {}): KvDeTareas & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    get: async (k) => datos.get(k) ?? null,
    put: async (k, v) => {
      datos.set(k, v);
    },
  };
}

/** La API de métricas de mentira: responde lo de cada consulta y guarda lo que se pidió. */
function metricas(respuesta: { operaciones?: unknown[]; espacio?: unknown[]; status?: number }) {
  const pedidas: { query: string; variables: Record<string, string> }[] = [];
  const telegram: string[] = [];
  const fetchFalso = (async (url: string, init: RequestInit) => {
    const cuerpo = JSON.parse(String(init.body)) as {
      query: string;
      variables: Record<string, string>;
      text?: string;
    };
    if (url.includes('api.telegram.org')) {
      telegram.push(cuerpo.text ?? '');
      return new Response('{}', { status: 200 });
    }
    pedidas.push(cuerpo);
    const campo = cuerpo.query.includes('r2StorageAdaptiveGroups')
      ? 'r2StorageAdaptiveGroups'
      : 'r2OperationsAdaptiveGroups';
    const filas = campo === 'r2StorageAdaptiveGroups' ? respuesta.espacio : respuesta.operaciones;
    if (!filas) return new Response(JSON.stringify({ errors: [{ message: 'no hay datos' }] }));
    return new Response(JSON.stringify({ data: { viewer: { accounts: [{ [campo]: filas }] } } }), {
      status: respuesta.status ?? 200,
    });
  }) as unknown as typeof fetch;
  return { fetchFalso, pedidas, telegram };
}

const ops = (accion: string, requests: number) => ({
  sum: { requests },
  dimensions: { actionType: accion },
});
const espacio = (bucket: string, bytes: number) => ({
  max: { payloadSize: bytes, metadataSize: 0 },
  dimensions: { bucketName: bucket },
});
const GB = 1_000_000_000;

const entorno = (flags: KvDeTareas, fetchFn: typeof fetch): EntornoDeTareas => ({
  celda: 'c1',
  shards: [],
  control: undefined as unknown as EntornoDeTareas['control'],
  hosts: kv(),
  flags,
  telegram: { token: 'bot', chat: '1' },
  fetch: fetchFn,
  metricas: { token: 'tok', cuenta: 'cuenta-ensayo' },
});

describe('bitácora tienda3 27 · el freno de R2', () => {
  it('cuenta las mismas operaciones de clase A y gratis que el vigía', () => {
    expect([...R2_CLASE_A].sort()).toEqual([...CLASE_A_DEL_VIGIA].sort());
    expect([...R2_GRATIS].sort()).toEqual([...GRATIS_DEL_VIGIA].sort());
  });

  it('mide el espacio de las últimas 24 horas y las operaciones del mes, de toda la cuenta', async () => {
    const m = metricas({
      operaciones: [
        ops('PutObject', 400_000),
        ops('ListObjects', 100_000),
        ops('GetObject', 1_000_000),
        ops('DeleteObject', 9_000_000),
      ],
      // El mayor de cada bucket, sumados: 3 GB + 1,5 GB.
      espacio: [
        espacio('tienda-c1', 2 * GB),
        espacio('tienda-c1', 3 * GB),
        espacio('tienda-c1-fotos', 1.5 * GB),
      ],
    });
    expect(await medirR2(m.fetchFalso, 'tok', 'cuenta-ensayo', T0)).toEqual({
      uso: { clase_a: 50, clase_b: 10, espacio: 45 },
      fallas: [],
    });
    expect(m.pedidas.map((p) => p.variables)).toEqual([
      {
        cuenta: 'cuenta-ensayo',
        desde: '2026-10-01T00:00:00.000Z',
        hasta: '2026-10-16T21:00:00.000Z',
      },
      {
        cuenta: 'cuenta-ensayo',
        desde: '2026-10-15T21:00:00.000Z',
        hasta: '2026-10-16T21:00:00.000Z',
      },
    ]);
  });

  it('❌ al 90 % del espacio apaga publicar y subir fotos, avisa una vez y nunca apaga la venta', async () => {
    const flags = kv({ 'ks:tienda-horno': 'encendido', 'ks:tienda-fotos': 'encendido' });
    const m = metricas({
      operaciones: [ops('PutObject', 10_000)],
      espacio: [espacio('tienda-c1', 9.1 * GB)],
    });
    const resumen = await FRENO_R2.correr(entorno(flags, m.fetchFalso), T0);
    expect(resumen).toBe(
      'R2: espacio guardado 91 %, escrituras (clase A) 1 %, lecturas (clase B) 0 %; apagado: ks:tienda-horno, ks:tienda-fotos',
    );
    expect(flags.datos.get('ks:tienda-horno')).toBe('apagado');
    expect(flags.datos.get('ks:tienda-fotos')).toBe('apagado');
    expect(flags.datos.has('ks:tienda')).toBe(false);
    expect(flags.datos.has('ks:tienda-cobros')).toBe(false);
    expect(m.telegram).toHaveLength(1);
    expect(m.telegram[0]).toContain('Apagué ks:tienda-horno y ks:tienda-fotos');
    // La hora siguiente, todavía arriba: ni otro aviso ni otra escritura.
    const antes = flags.datos.get(CLAVE_DEL_FRENO);
    await FRENO_R2.correr(entorno(flags, m.fetchFalso), T0 + 3_600_000);
    expect(m.telegram).toHaveLength(1);
    expect(flags.datos.get(CLAVE_DEL_FRENO)).toBe(antes);
  });

  it('❌ por debajo del 80 % enciende solo lo que apagó él; lo que el dueño apagó sigue apagado', async () => {
    const flags = kv({ 'ks:tienda-horno': 'encendido', 'ks:tienda-fotos': 'apagado' });
    const avisos: string[] = [];
    const avisar = async (t: string) => {
      avisos.push(t);
    };
    const con = (espacioPct: number): MedicionR2 => ({
      uso: { espacio: espacioPct, clase_a: 5, clase_b: 5 },
      fallas: [],
    });
    await frenar(flags, con(95), avisar);
    expect(JSON.parse(flags.datos.get(CLAVE_DEL_FRENO) ?? '')).toEqual({
      escalon: 90,
      apagadas: ['ks:tienda-horno'],
    });
    // Entre el 80 y el 90 % no se suelta: no se prende y apaga cada hora.
    expect(await frenar(flags, con(85), avisar)).not.toContain('encendido');
    expect(flags.datos.get('ks:tienda-horno')).toBe('apagado');
    expect(await frenar(flags, con(70), avisar)).toContain('encendido otra vez: ks:tienda-horno');
    expect(flags.datos.get('ks:tienda-horno')).toBe('encendido');
    expect(flags.datos.get('ks:tienda-fotos')).toBe('apagado');
    expect(avisos.at(-1)).toContain('Encendí otra vez ks:tienda-horno');
  });

  it('desde el 75 % avisa sin apagar, y las lecturas solo avisan aunque pasen el 90 %', async () => {
    const flags = kv();
    const avisos: string[] = [];
    await frenar(
      flags,
      { uso: { espacio: 10, clase_a: 10, clase_b: 96 }, fallas: [] },
      async (t) => {
        avisos.push(t);
      },
    );
    expect(flags.datos.has('ks:tienda-horno')).toBe(false);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('apagar no las baja');
    const otra = kv();
    await frenar(otra, { uso: { espacio: 76, clase_a: 10, clase_b: 1 }, fallas: [] }, async (t) => {
      avisos.push(t);
    });
    expect(avisos[1]).toContain('Pasó el 75 %');
    expect(otra.datos.has('ks:tienda-fotos')).toBe(false);
  });

  it('❌ sin poder medir no apaga ni enciende nada y la tarea queda en falla (P1)', async () => {
    const flags = kv({
      'ks:tienda-horno': 'apagado',
      [CLAVE_DEL_FRENO]: JSON.stringify({ escalon: 90, apagadas: ['ks:tienda-horno'] }),
    });
    // El espacio no responde y la clase A va baja: soltar sin saber el espacio sería a ciegas.
    const m = metricas({ operaciones: [ops('PutObject', 1_000)] });
    await expect(FRENO_R2.correr(entorno(flags, m.fetchFalso), T0)).rejects.toThrow(
      /No se pudo leer: espacio: no hay datos/,
    );
    expect(flags.datos.get('ks:tienda-horno')).toBe('apagado');
    const sinToken = {
      ...entorno(flags, m.fetchFalso),
      metricas: { token: undefined, cuenta: 'c' },
    };
    await expect(FRENO_R2.correr(sinToken, T0)).rejects.toThrow(/CF_METRICAS_TOKEN/);
    expect(m.telegram).toHaveLength(0);
  });
});
