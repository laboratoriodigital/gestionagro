import { describe, expect, it } from 'vitest';
import {
  abrirDek,
  type Contexto,
  cifrarCampo,
  crearDek,
  DescifradoFallido,
  descifrarCampo,
  importarKek,
  indiceCiego,
  type Kek,
  kekEnUso,
  reenvolverDek,
} from './index.ts';

const bytes = (n: number, relleno: number) => new Uint8Array(n).fill(relleno);
const ORG_UNO = '0192a000-0000-7000-8000-000000000001';
const ORG_DOS = '0192a000-0000-7000-8000-000000000002';
const PEDIDO = '0192a000-0000-7000-8000-0000000000aa';
const ctx = (org: string, id = PEDIDO): Contexto => ({
  org,
  tabla: 'pedido_contacto',
  campo: 'sobre',
  id,
});
const CONTACTO = 'María Fernanda · 3001234567 · Calle 10 # 4-21, Medellín';

async function kek(id: string, relleno: number): Promise<Kek> {
  return importarKek(id, bytes(32, relleno));
}

describe('cifrado de sobre (TIENDA-3.0 §14.2)', () => {
  it('un campo cifrado vuelve igual, y dos escrituras del mismo texto no se parecen (IV al azar)', async () => {
    const k = await kek('v1', 1);
    const { dek } = await crearDek(ORG_UNO, 'datos_personales', 1, k);
    const a = await cifrarCampo(dek, ctx(ORG_UNO), CONTACTO);
    const b = await cifrarCampo(dek, ctx(ORG_UNO), CONTACTO);
    expect(a).not.toBe(b);
    expect(a).not.toContain('María');
    expect(await descifrarCampo(new Map([[1, dek]]), ctx(ORG_UNO), a)).toBe(CONTACTO);
  });

  it('❌ copiado a otra fila no se descifra (AAD con el id)', async () => {
    const { dek } = await crearDek(ORG_UNO, 'datos_personales', 1, await kek('v1', 1));
    const c = await cifrarCampo(dek, ctx(ORG_UNO), CONTACTO);
    const otraFila = ctx(ORG_UNO, '0192a000-0000-7000-8000-0000000000bb');
    await expect(descifrarCampo(new Map([[1, dek]]), otraFila, c)).rejects.toThrow(
      DescifradoFallido,
    );
  });

  it('❌ copiado a otra tienda no se descifra, ni con la DEK de la otra', async () => {
    const k = await kek('v1', 1);
    const uno = await crearDek(ORG_UNO, 'datos_personales', 1, k);
    const dos = await crearDek(ORG_DOS, 'datos_personales', 1, k);
    const c = await cifrarCampo(uno.dek, ctx(ORG_UNO), CONTACTO);
    await expect(descifrarCampo(new Map([[1, dos.dek]]), ctx(ORG_DOS), c)).rejects.toThrow(
      DescifradoFallido,
    );
    await expect(descifrarCampo(new Map([[1, uno.dek]]), ctx(ORG_DOS), c)).rejects.toThrow(
      DescifradoFallido,
    );
  });

  it('❌ un cifrado alterado en un solo carácter no se descifra', async () => {
    const { dek } = await crearDek(ORG_UNO, 'datos_personales', 1, await kek('v1', 1));
    const c = await cifrarCampo(dek, ctx(ORG_UNO), CONTACTO);
    const ultimo = c.at(-1) === 'A' ? 'B' : 'A';
    await expect(
      descifrarCampo(new Map([[1, dek]]), ctx(ORG_UNO), c.slice(0, -1) + ultimo),
    ).rejects.toThrow(DescifradoFallido);
  });

  it('❌ una KEK equivocada no abre la DEK, y el error no dice nada del contenido (P13)', async () => {
    const { envuelta } = await crearDek(ORG_UNO, 'credenciales', 1, await kek('v1', 1));
    const otra = await kek('v1', 2);
    const error = await abrirDek(envuelta, new Map([['v1', otra]])).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DescifradoFallido);
    expect(String(error)).not.toMatch(/[0-9a-f]{16}/i);
    await expect(abrirDek(envuelta, new Map())).rejects.toThrow(DescifradoFallido);
  });

  it('❌ una DEK envuelta para un propósito no sirve para otro (AAD)', async () => {
    const k = await kek('v1', 1);
    const { envuelta } = await crearDek(ORG_UNO, 'credenciales', 1, k);
    await expect(
      abrirDek({ ...envuelta, proposito: 'datos_personales' }, new Map([['v1', k]])),
    ).rejects.toThrow(DescifradoFallido);
  });

  it('rotar la KEK reenvuelve la DEK y los campos siguen leyéndose; la vieja queda libre', async () => {
    const vieja = await kek('v1', 1);
    const nueva = await kek('v2', 9);
    const creada = await crearDek(ORG_UNO, 'credenciales', 1, vieja);
    const llaveBold = 'sk_live_abcdefghijklmnopqrstuvwx';
    const c = await cifrarCampo(creada.dek, { ...ctx(ORG_UNO), tabla: 'credencial' }, llaveBold);
    const rotada = await reenvolverDek(creada.envuelta, new Map([['v1', vieja]]), nueva);
    expect(rotada.kekId).toBe('v2');
    expect(kekEnUso('v1', [rotada])).toBe(false);
    expect(kekEnUso('v1', [creada.envuelta, rotada])).toBe(true);
    const abierta = await abrirDek(rotada, new Map([['v2', nueva]]));
    expect(
      await descifrarCampo(new Map([[1, abierta]]), { ...ctx(ORG_UNO), tabla: 'credencial' }, c),
    ).toBe(llaveBold);
  });

  it('un campo dice la versión de su DEK: después de rotar la DEK, lo viejo se lee con la vieja', async () => {
    const k = await kek('v1', 1);
    const d1 = (await crearDek(ORG_UNO, 'datos_personales', 1, k)).dek;
    const d2 = (await crearDek(ORG_UNO, 'datos_personales', 2, k)).dek;
    const viejo = await cifrarCampo(d1, ctx(ORG_UNO), 'antes');
    const nuevo = await cifrarCampo(d2, ctx(ORG_UNO), 'después');
    const deks = new Map([
      [1, d1],
      [2, d2],
    ]);
    expect(await descifrarCampo(deks, ctx(ORG_UNO), viejo)).toBe('antes');
    expect(await descifrarCampo(deks, ctx(ORG_UNO), nuevo)).toBe('después');
    // Borrado criptográfico: sin la DEK 1, lo viejo ya no se lee.
    await expect(descifrarCampo(new Map([[2, d2]]), ctx(ORG_UNO), viejo)).rejects.toThrow(
      DescifradoFallido,
    );
  });

  it('índice ciego: igual celular, igual índice en la tienda; otro en otra tienda', async () => {
    const k = await kek('v1', 1);
    const i1 = (await crearDek(ORG_UNO, 'indices', 1, k)).dek;
    const i2 = (await crearDek(ORG_DOS, 'indices', 1, k)).dek;
    const a = await indiceCiego(i1, '+573001234567');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await indiceCiego(i1, '+573001234567')).toBe(a);
    expect(await indiceCiego(i1, '+573001234568')).not.toBe(a);
    expect(await indiceCiego(i2, '+573001234567')).not.toBe(a);
  });

  it('❌ cada DEK solo hace lo suyo', async () => {
    const k = await kek('v1', 1);
    const indices = (await crearDek(ORG_UNO, 'indices', 1, k)).dek;
    const personales = (await crearDek(ORG_UNO, 'datos_personales', 1, k)).dek;
    await expect(cifrarCampo(indices, ctx(ORG_UNO), 'x')).rejects.toThrow(/índices/);
    await expect(indiceCiego(personales, 'x')).rejects.toThrow(/indices/);
    await expect(cifrarCampo(personales, ctx(ORG_DOS), 'x')).rejects.toThrow(/tienda/);
  });

  it('los datos asociados no admiten el separador ni partes vacías', async () => {
    const { dek } = await crearDek(ORG_UNO, 'datos_personales', 1, await kek('v1', 1));
    await expect(cifrarCampo(dek, { ...ctx(ORG_UNO), campo: 'a|b' }, 'x')).rejects.toThrow(
      RangeError,
    );
    await expect(cifrarCampo(dek, { ...ctx(ORG_UNO), id: '' }, 'x')).rejects.toThrow(RangeError);
  });

  it('la KEK es de 32 bytes', async () => {
    await expect(importarKek('v1', bytes(16, 1))).rejects.toThrow(/32 bytes/);
  });
});
