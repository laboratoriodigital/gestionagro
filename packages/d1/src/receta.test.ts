/**
 * HU-C2.1: la receta de reconstrucción, en el D1 local de workerd y no en `node:sqlite`
 * (PLATAFORMA §4.4 la había probado solo con el SQLite de Node: P17, el instrumento también
 * miente). Resultado del 5 oct 2026: D1 se comporta igual en los cinco casos, y la guarda revisa
 * toda la base (bitácora core 2).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BaseD1 } from './index.ts';
import { baseLocal } from './local.ts';
import { correr, limpiar } from './receta.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/core/wrangler.jsonc',
    binding: 'DB',
    base: 'core',
  }));
}, 60_000);
afterAll(async () => cerrar?.());

describe('rehacer una tabla padre en D1 (PLATAFORMA §4.4)', () => {
  it('V1 · con defer_foreign_keys encendido hasta el final, falla al confirmar aunque los datos estén bien', async () => {
    const r = await correr(db, 'V1');
    expect(r.confirmo).toBe(false);
    expect(r.error).toMatch(/FOREIGN KEY constraint failed/);
    expect(r).toMatchObject({ aplicada: false, filasPadre: 3, huerfanas: 0 });
  });

  it('W1 · apagándolo antes de terminar, confirma', async () => {
    expect(await correr(db, 'W1')).toMatchObject({
      confirmo: true,
      aplicada: true,
      filasPadre: 3,
      huerfanas: 0,
    });
  });

  it('W2 · y si la copia pierde una fila padre, confirma IGUAL, callado, con una huérfana: el arreglo esconde lo que contaba (PC2)', async () => {
    expect(await correr(db, 'W2')).toMatchObject({
      confirmo: true,
      aplicada: true,
      filasPadre: 2,
      huerfanas: 1,
    });
  });

  it('W3 · con la guarda y sin huérfanas, confirma: D1 acepta pragma_foreign_key_check como función de tabla', async () => {
    expect(await correr(db, 'W3')).toMatchObject({
      confirmo: true,
      aplicada: true,
      filasPadre: 3,
      huerfanas: 0,
    });
  });

  it('W4 · con la guarda y una huérfana, la migración entera vuelve atrás y la base queda como estaba', async () => {
    const r = await correr(db, 'W4');
    expect(r.confirmo).toBe(false);
    expect(r.error).toMatch(/CHECK constraint failed: huerfanas = 0/);
    expect(r).toMatchObject({ aplicada: false, filasPadre: 3, huerfanas: 0 });
  });

  it('la guarda revisa TODA la base: una huérfana vieja en otra tabla detiene una migración sana (bitácora core 2)', async () => {
    // W2 deja una huérfana real en h_W2 y se conserva; W3, que no pierde nada, ya no confirma.
    await correr(db, 'W2', { conservar: true });
    const r = await correr(db, 'W3');
    expect(r.confirmo).toBe(false);
    expect(r.error).toMatch(/CHECK constraint failed: huerfanas = 0/);
    await limpiar(db, 'W2');
    expect(await correr(db, 'W3')).toMatchObject({ confirmo: true });
  });
});
