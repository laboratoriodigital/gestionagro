/**
 * HU-T17.6: rotar la KEK desde el despliegue y el script de los secretos, sin Cloudflare ni GitHub.
 * El despliegue carga todas las KEK del ambiente, pide a la API que reenvuelva y borra del Worker
 * solo la que salió del ambiente y ya no envuelve nada (CA2). Cada caso malo es su control negativo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  idDeLaKek,
  kekQueSeRetiran,
  reenvolverEnLaCelda,
  secretosDeLaTienda,
  type UsoDeLasKeks,
} from '../../scripts/lib/celda-tienda.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';
import {
  KEKS_DEL_FLUJO,
  type Mundo,
  rotarKek,
  siguienteKek,
} from '../../scripts/tienda/generar-secretos.ts';

describe('las KEK del ambiente, en el despliegue', () => {
  it('van todas a la API, y solo a la API; una vacía no cuenta', () => {
    const r = secretosDeLaTienda({
      SECRETO_DESPACHO: 'd',
      TIENDA_KEK_V1: 'uno',
      TIENDA_KEK_V2: ' dos ',
      TIENDA_KEK_V3: '',
    });
    expect(r).toMatchObject({
      ok: true,
      api: { SECRETO_DESPACHO: 'd', TIENDA_KEK_V1: 'uno', TIENDA_KEK_V2: 'dos' },
      frente: { SECRETO_DESPACHO: 'd' },
      conKek: true,
    });
    expect(r.ok && 'TIENDA_KEK_V3' in r.api).toBe(false);
  });

  it(`el flujo carga de TIENDA_KEK_V1 a TIENDA_KEK_V${KEKS_DEL_FLUJO}`, () => {
    const flujo = readFileSync(join(RAIZ, '.github/workflows/desplegar-destino.yml'), 'utf8');
    for (let n = 1; n <= KEKS_DEL_FLUJO; n++) {
      expect(flujo).toContain(`TIENDA_KEK_V${n}: \${{ secrets.TIENDA_KEK_V${n} }}`);
    }
  });

  it('el nombre del secreto es el id que guarda la tabla llave', () => {
    expect(idDeLaKek('TIENDA_KEK_V2')).toBe('v2');
    expect(idDeLaKek('TIENDA_KEK_V12')).toBe('v12');
  });
});

describe('retirar una KEK (HU-T17.6 CA2)', () => {
  const enElWorker = ['SECRETO_DESPACHO', 'TIENDA_KEK_V1', 'TIENDA_KEK_V2'];

  it('la que salió del ambiente y no envuelve nada se borra; las demás se quedan', () => {
    expect(kekQueSeRetiran(enElWorker, ['SECRETO_DESPACHO', 'TIENDA_KEK_V2'], { v2: 6 })).toEqual({
      borrar: ['TIENDA_KEK_V1'],
      fallas: [],
    });
    expect(kekQueSeRetiran(enElWorker, ['TIENDA_KEK_V1', 'TIENDA_KEK_V2'], { v2: 6 })).toEqual({
      borrar: [],
      fallas: [],
    });
  });

  it('❌ la que todavía envuelve llaves no se borra, y no se borra ninguna', () => {
    const r = kekQueSeRetiran(
      [...enElWorker, 'TIENDA_KEK_V3'],
      ['SECRETO_DESPACHO', 'TIENDA_KEK_V2'],
      { v1: 2, v2: 4 },
    );
    expect(r.borrar).toEqual([]);
    expect(r.fallas).toEqual([
      expect.stringMatching(/^TIENDA_KEK_V1 salió del ambiente de GitHub, pero todavía envuelve 2/),
    ]);
  });

  it('❌ si la vigente no abre alguna llave, no se retira ninguna KEK', () => {
    const r = kekQueSeRetiran(enElWorker, ['TIENDA_KEK_V2'], { v2: 6 }, 1);
    expect(r.borrar).toEqual([]);
    expect(r.fallas).toEqual([expect.stringMatching(/no abre 1 llave/)]);
    expect(kekQueSeRetiran(enElWorker, ['TIENDA_KEK_V2'], { v2: 6 }, 0).borrar).toEqual([
      'TIENDA_KEK_V1',
    ]);
  });

  it('❌ borrar la vigente del ambiente tampoco borra nada si envuelve llaves', () => {
    expect(
      kekQueSeRetiran(enElWorker, ['SECRETO_DESPACHO', 'TIENDA_KEK_V1'], { v2: 6 }).fallas,
    ).toHaveLength(1);
  });
});

describe('reenvolver desde el despliegue (HU-T17.6 CA1)', () => {
  const respuestas = (lista: Partial<UsoDeLasKeks>[]) => {
    const pedidas: { url: string; secreto: string | null }[] = [];
    const f: Fetch = async (url, init) => {
      pedidas.push({
        url: String(url),
        secreto: new Headers(init?.headers).get('x-despliegue'),
      });
      const uso = lista[Math.min(pedidas.length, lista.length) - 1];
      return new Response(
        JSON.stringify({ vigente: 'v2', cargadas: ['v1', 'v2'], enUso: {}, ...uso }),
      );
    };
    return { f, pedidas };
  };

  it('llama hasta que no queda ninguna con otra KEK, y suma lo reenvuelto', async () => {
    const { f, pedidas } = respuestas([
      { reenvueltas: 200, quedan: 30, enUso: { v1: 30, v2: 200 } },
      { reenvueltas: 30, quedan: 0, enUso: { v2: 230 } },
    ]);
    const r = await reenvolverEnLaCelda(f, 'https://panel', 'secreto');
    expect(r.fallas).toEqual([]);
    expect(r.uso).toMatchObject({ reenvueltas: 230, quedan: 0, enUso: { v2: 230 } });
    expect(pedidas).toEqual([
      { url: 'https://panel/api/despliegue/llaves', secreto: 'secreto' },
      { url: 'https://panel/api/despliegue/llaves', secreto: 'secreto' },
    ]);
  });

  it('❌ si una vuelta no avanza, para: lo que queda lo dice el uso', async () => {
    const { f, pedidas } = respuestas([{ reenvueltas: 0, quedan: 3, enUso: { v1: 3 } }]);
    const r = await reenvolverEnLaCelda(f, 'https://panel', 's');
    expect(pedidas).toHaveLength(1);
    expect(r.uso?.quedan).toBe(3);
  });

  it('❌ si la API falla, lo dice', async () => {
    const r = await reenvolverEnLaCelda(
      async () => new Response('sin bases', { status: 503 }),
      'https://panel',
      's',
    );
    expect(r).toEqual({ uso: null, fallas: ['reenvolver las llaves respondió 503: sin bases'] });
  });
});

describe('--rotar-kek (HU-T17.6)', () => {
  function mundo(existentes: string[], o: { respuesta?: string; ghGuarda?: boolean } = {}) {
    const guardados: Record<string, string> = {};
    const dicho: string[] = [];
    const portapapeles: string[] = [];
    const m: Mundo = {
      gh(argumentos, entrada) {
        if (argumentos[1] === 'list') {
          return { ok: true, salida: JSON.stringify(existentes.map((name) => ({ name }))) };
        }
        if (o.ghGuarda === false) return { ok: false, salida: 'HTTP 403' };
        guardados[argumentos[2] ?? ''] = entrada ?? '';
        return { ok: true, salida: '' };
      },
      copiar(texto) {
        portapapeles.push(texto);
        return true;
      },
      preguntar: async () => o.respuesta ?? 'sí',
      decir: (t) => dicho.push(t),
      aleatorio: (k) => Uint8Array.from({ length: k }, (_, i) => (i * 7) % 256),
    };
    return { m, guardados, dicho, portapapeles };
  }

  it('la siguiente sigue a la de número más alto', () => {
    expect(siguienteKek(['SECRETO_DESPACHO', 'TIENDA_KEK_V1'])).toEqual({
      nombre: 'TIENDA_KEK_V2',
      n: 2,
    });
    expect(siguienteKek(['TIENDA_KEK_V3', 'TIENDA_KEK_V1'])?.nombre).toBe('TIENDA_KEK_V4');
    expect(siguienteKek(['SECRETO_DESPACHO'])).toBeNull();
  });

  it('crea la V2 con su copia fuera de línea y no toca la V1', async () => {
    const w = mundo(['SECRETO_DESPACHO', 'TIENDA_KEK_V1']);
    expect(await rotarKek('staging', w.m)).toEqual({ ok: true, creada: 'TIENDA_KEK_V2' });
    expect(Object.keys(w.guardados)).toEqual(['TIENDA_KEK_V2']);
    const valor = w.guardados['TIENDA_KEK_V2'] ?? '';
    expect(atob(valor)).toHaveLength(32);
    expect(w.portapapeles).toEqual([valor, '']);
    expect(w.dicho.join('\n')).not.toContain(valor);
    expect(w.dicho.join('\n')).toContain('llave maestra V2 · staging');
  });

  it('❌ sin la copia, sin una primera o pasado el tope del flujo, no guarda nada', async () => {
    const sinCopia = mundo(['TIENDA_KEK_V1'], { respuesta: 'no' });
    expect((await rotarKek('staging', sinCopia.m)).ok).toBe(false);
    expect(sinCopia.guardados).toEqual({});
    expect(sinCopia.portapapeles.at(-1)).toBe('');
    const sinPrimera = mundo(['SECRETO_DESPACHO']);
    expect((await rotarKek('staging', sinPrimera.m)).motivo).toMatch(/sin --rotar-kek/);
    const tope = mundo([`TIENDA_KEK_V${KEKS_DEL_FLUJO}`]);
    expect((await rotarKek('produccion', tope.m)).motivo).toMatch(/retira primero las viejas/);
    expect([sinPrimera.guardados, tope.guardados, tope.portapapeles]).toEqual([{}, {}, []]);
  });
});
