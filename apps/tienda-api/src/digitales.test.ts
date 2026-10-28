/**
 * HU-P6.1 y HU-P6.2 (sprint PF2): los productos digitales, contra el shard local y un bucket en
 * memoria: subir con sus topes y su plan, entregar solo con el pago confirmado, el enlace con sus
 * 5 usos y su vencimiento, y la contraentrega negada para un pedido solo de digitales.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type BucketDigital,
  borrarArchivosDeLaTienda,
  DESCARGAS_POR_ENLACE,
  descargar,
  enlacesDeDescarga,
  nombreDelArchivo,
  subirArchivo,
} from './digitales.ts';
import { soloDigitales } from './pedidos.ts';

const AHORA = '2026-10-28T15:00:00.000Z';
const UNO = ENSAYO_UNO.org;
const M = 'v-camisa-m-arena';
const HUELLA = 'a'.repeat(64);
let shard: BaseD1;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => cerrar?.());

/** Un bucket en memoria: guarda lo que le llega y dice qué se borró. */
function bucket() {
  const objetos = new Map<string, Uint8Array>();
  const b: BucketDigital & { objetos: typeof objetos } = {
    objetos,
    async put(clave, valor) {
      const datos =
        valor instanceof ArrayBuffer
          ? new Uint8Array(valor)
          : new Uint8Array(await new Response(valor).arrayBuffer());
      objetos.set(clave, datos);
    },
    async get(clave) {
      const d = objetos.get(clave);
      return d ? { body: new Blob([d as Uint8Array<ArrayBuffer>]).stream(), size: d.length } : null;
    },
    async delete(claves) {
      for (const k of Array.isArray(claves) ? claves : [claves]) objetos.delete(k);
    },
  };
  return b;
}
const quien = { org: UNO, actor: 'usuario:prueba', instante: AHORA };
const flujo = (texto: string) => new Response(texto).body as ReadableStream;
const plan = (p: string) =>
  shard.prepare('UPDATE tienda SET plan = ? WHERE org_id = ?').bind(p, UNO).run();
const digital = (si: boolean) =>
  shard
    .prepare("UPDATE producto SET tipo = ? WHERE org_id = ? AND id = 'p-camisa'")
    .bind(si ? 'digital' : 'fisico', UNO)
    .run();
const archivo = (extra: Partial<{ tipo: string; bytes: number }> = {}) => ({
  variante: M,
  nombre: 'C:\\Mis documentos\\Guía de lino.pdf',
  tipo: 'application/pdf',
  bytes: 11,
  huella: HUELLA,
  ...extra,
});

describe('HU-P6.1 · subir el archivo de un producto digital', () => {
  it('❌ en Gratis no; ❌ un producto físico no; ❌ otro tipo o más de 50 MB no', async () => {
    const b = bucket();
    await plan('gratis');
    expect((await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('hola'))).estado).toBe(
      'plan',
    );
    await plan('pro');
    await digital(false);
    expect(await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('hola'))).toMatchObject({
      estado: 'problemas',
    });
    await digital(true);
    const mal = await subirArchivo(
      { ...quien, db: shard },
      b,
      archivo({ tipo: 'text/html', bytes: 60_000_000 }),
      flujo('<script>'),
    );
    expect(JSON.stringify(mal)).toContain('PDF, ZIP');
    expect(JSON.stringify(mal)).toContain('50 MB');
    expect(b.objetos.size).toBe(0);
  });

  it('se guarda en el bucket con su nombre limpio; el que reemplaza borra el anterior', async () => {
    const b = bucket();
    await plan('pro');
    await digital(true);
    const r = await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('primero pdf'));
    expect(r).toEqual({ estado: 'guardado', nombre: 'Guia de lino.pdf', bytes: 11 });
    expect(b.objetos.size).toBe(1);
    await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('segundo pdf'));
    expect(b.objetos.size).toBe(1);
    expect(nombreDelArchivo('../../x.exe', 'application/zip')).toBe('x.zip');
  });
});

describe('HU-P6.2 · la entrega después del pago', () => {
  const pedido = async (estado: string) => {
    await shard
      .prepare(
        `INSERT OR REPLACE INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado)
         VALUES (?, 'ped-digital', 'DGT123', 7001, ?, 'panel', 'en_linea', 129000, 129000, 'sistema', ?, ?)`,
      )
      .bind(UNO, estado, AHORA, AHORA)
      .run();
    await shard
      .prepare(
        `INSERT OR REPLACE INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, precio_unitario_cop, cantidad, total_cop)
         VALUES (?, 'ped-digital', 1, 'p-camisa', ?, 'Camisa de lino', 129000, 1, 129000)`,
      )
      .bind(UNO, M)
      .run();
  };

  it('❌ sin el pago confirmado no hay enlace; con él, uno que vale 5 descargas', async () => {
    const b = bucket();
    await plan('pro');
    await digital(true);
    await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('el archivo'));
    await pedido('por_pagar');
    expect(await enlacesDeDescarga(shard, UNO, 'DGT123', AHORA)).toEqual([]);
    await pedido('pagado');
    const [e] = await enlacesDeDescarga(shard, UNO, 'DGT123', AHORA);
    expect(e?.nombre).toBe('Guia de lino.pdf');
    const secreto = e?.enlace?.split('/').pop() ?? '';
    for (let i = 0; i < DESCARGAS_POR_ENLACE; i++) {
      const r = await descargar(shard, UNO, b, secreto, AHORA);
      expect(r.estado).toBe('archivo');
      if (r.estado === 'archivo') expect(await new Response(r.cuerpo).text()).toBe('el archivo');
    }
    expect((await descargar(shard, UNO, b, secreto, AHORA)).estado).toBe('no-sirve');
  });

  it('❌ vencido, inventado o de otra tienda, no sirve', async () => {
    const b = bucket();
    await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('el archivo'));
    const [e] = await enlacesDeDescarga(shard, UNO, 'DGT123', AHORA);
    const secreto = e?.enlace?.split('/').pop() ?? '';
    expect((await descargar(shard, UNO, b, secreto, '2026-11-30T00:00:00.000Z')).estado).toBe(
      'no-sirve',
    );
    expect((await descargar(shard, ENSAYO_DOS.org, b, secreto, AHORA)).estado).toBe('no-sirve');
    expect((await descargar(shard, UNO, b, 'x'.repeat(43), AHORA)).estado).toBe('no-sirve');
  });

  it('HU-P6.3: un pedido solo de digitales no va contra entrega; con uno físico, sí', async () => {
    await digital(true);
    expect(await soloDigitales(shard, UNO, [M])).toBe(true);
    await digital(false);
    expect(await soloDigitales(shard, UNO, [M])).toBe(false);
  });

  it('HU-T13.7: la baja borra los archivos del bucket', async () => {
    const b = bucket();
    await digital(true);
    await subirArchivo({ ...quien, db: shard }, b, archivo(), flujo('el archivo'));
    expect(await borrarArchivosDeLaTienda(shard, UNO, b)).toBe(1);
    expect(b.objetos.size).toBe(0);
  });
});
