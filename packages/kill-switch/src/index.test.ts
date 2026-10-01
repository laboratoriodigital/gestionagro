import { describe, expect, it } from 'vitest';
import {
  claveKillSwitch,
  crearLectorDeNivel,
  crearLectorKillSwitch,
  MAX_EDAD_MS,
} from './index.ts';

function kvFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  let lecturas = 0;
  let caido = false;
  return {
    kv: {
      get: async (clave: string) => {
        lecturas++;
        if (caido) throw new Error('KV no responde');
        return datos.get(clave) ?? null;
      },
    },
    poner: (clave: string, valor: string) => datos.set(clave, valor),
    caer: () => {
      caido = true;
    },
    lecturas: () => lecturas,
  };
}

const ID = 'agro-calculadora-dpv';

describe('kill switch por producto (HU-E8.1)', () => {
  it('la clave es ks:<product.id>', () => {
    expect(claveKillSwitch(ID)).toBe('ks:agro-calculadora-dpv');
  });

  it('CA1 (P7): un cambio se ve a más tardar a los 60 s, y no antes de que venza la caché', async () => {
    const f = kvFalso({ [claveKillSwitch(ID)]: 'encendido' });
    let t = 1_000_000;
    const lector = crearLectorKillSwitch({ kv: f.kv, ahora: () => t });
    expect(await lector.apagado(ID)).toBe(false);
    f.poner(claveKillSwitch(ID), 'apagado');
    t += MAX_EDAD_MS - 1;
    expect(await lector.apagado(ID)).toBe(false); // todavía en caché
    t += 1;
    expect(await lector.apagado(ID)).toBe(true); // a los 60 s exactos ya se ve
    expect(MAX_EDAD_MS).toBe(60_000);
  });

  it('la caché ahorra lecturas: una por producto por minuto', async () => {
    const f = kvFalso();
    let t = 0;
    const lector = crearLectorKillSwitch({ kv: f.kv, ahora: () => t });
    for (let i = 0; i < 100; i++) {
      await lector.apagado(ID);
      t += 500;
    }
    expect(f.lecturas()).toBe(1);
  });

  it.each([
    ['apagado', true],
    [' APAGADO ', true],
    ['encendido', false],
    ['off', false],
    ['', false],
  ])('«%s» → apagado = %s; solo «apagado» apaga', async (valor, esperado) => {
    const lector = crearLectorKillSwitch({ kv: kvFalso({ [claveKillSwitch(ID)]: valor }).kv });
    expect(await lector.apagado(ID)).toBe(esperado);
  });

  it('una clave que falta deja el producto encendido', async () => {
    expect(await crearLectorKillSwitch({ kv: kvFalso().kv }).apagado(ID)).toBe(false);
  });

  it('si KV falla, se queda con lo último que leyó; sin lectura previa, encendido y con aviso', async () => {
    const f = kvFalso({ [claveKillSwitch(ID)]: 'apagado' });
    let t = 0;
    const avisos: string[] = [];
    const lector = crearLectorKillSwitch({
      kv: f.kv,
      ahora: () => t,
      avisar: (m) => avisos.push(m),
    });
    expect(await lector.apagado(ID)).toBe(true);
    f.caer();
    t += MAX_EDAD_MS * 5;
    expect(await lector.apagado(ID)).toBe(true);
    expect(await lector.apagado('otro-producto')).toBe(false);
    expect(avisos).toHaveLength(2);
    expect(avisos[1]).toContain('ks:otro-producto');
  });
});

describe('nivel de la celda (ARQUITECTURA §8.2)', () => {
  it('lee el nivel con caché de 60 s; sin clave es «normal»', async () => {
    let valor: string | null = null;
    let lecturas = 0;
    let t = 0;
    const lector = crearLectorDeNivel({
      kv: {
        get: async () => {
          lecturas++;
          return valor;
        },
      },
      ahora: () => t,
    });
    expect(await lector.nivel()).toBe('normal');
    valor = 'esencial';
    t = 59_000;
    expect(await lector.nivel()).toBe('normal'); // caché
    t = 60_000;
    expect(await lector.nivel()).toBe('esencial');
    expect(lecturas).toBe(2);
  });

  it('un valor desconocido es «normal» y queda en el log (P1)', async () => {
    const avisos: string[] = [];
    const lector = crearLectorDeNivel({
      kv: { get: async () => 'rojo' },
      avisar: (m) => avisos.push(m),
    });
    expect(await lector.nivel()).toBe('normal');
    expect(avisos[0]).toContain('«rojo»');
  });
});
