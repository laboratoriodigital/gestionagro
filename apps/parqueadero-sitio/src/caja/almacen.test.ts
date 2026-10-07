import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { ReciboIncompleto } from '@ed1/parqueadero-recibos';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import {
  type Contexto,
  catalogosDelRegistro,
  EstadiaYaAbierta,
  faltaParaRegistrar,
  guardarPin,
  guardarSede,
  guardarTarifa,
  leerAjustes,
  registrarEntrada,
  registrarEntrega,
  TarifaSobreElTope,
  tienePin,
  vecesImpreso,
  verificarPin,
} from './almacen.ts';
import { abrirBase } from './datos.ts';

const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & {
    id: unknown;
    org_id: unknown;
    version: unknown;
    actualizado: unknown;
    entidad: unknown;
  };
  return resto;
};

function caja() {
  let ms = Date.UTC(2026, 9, 6, 23, 5);
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  return { db: abrirBase(`almacen-${uuidv7()}`), ctx };
}

async function configurada() {
  const { db, ctx } = caja();
  await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_MOTO), null, ctx);
  return { db, ctx };
}

const ENTRADA = {
  placa: 'ABC123',
  vehiculo: 'carro' as const,
  placaConfirmada: false,
  novedades: [],
  fotos: [],
};

describe('ajustes sin valores de fábrica (HU-Q3.2)', () => {
  it('una caja nueva dice todo lo que falta y no registra', async () => {
    const { db, ctx } = caja();
    expect(faltaParaRegistrar(await leerAjustes(db), ['carro'])).toEqual([
      'el nombre',
      'el NIT',
      'la dirección',
      'la ciudad',
      'el teléfono',
      'la póliza',
      'la tarifa de carro',
    ]);
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toBeInstanceOf(ReciboIncompleto);
    expect(await db.registros.count()).toBe(0);
  });

  it('una tarifa por encima del tope no se guarda y dice por qué (CA3)', async () => {
    const { db, ctx } = caja();
    await expect(
      guardarTarifa(db, { ...sinMeta(TARIFA_CARRO), valor: 250 }, null, ctx),
    ).rejects.toThrow('$250 por minuto pasa el tope de $230 por minuto');
    await expect(
      guardarTarifa(db, { ...sinMeta(TARIFA_CARRO), valor: 250 }, null, ctx),
    ).rejects.toBeInstanceOf(TarifaSobreElTope);
    expect(await db.catalogos.count()).toBe(0);
  });

  it('editar la sede sube la versión y guarda la anterior en el historial', async () => {
    const { db, ctx } = await configurada();
    const antes = (await leerAjustes(db)).sede;
    await guardarSede(
      db,
      { ...sinMeta(SEDE_ENSAYO_UNO), telefono: '3110000000' },
      antes?.id ?? null,
      ctx,
    );
    const despues = (await leerAjustes(db)).sede;
    expect(despues).toMatchObject({ id: antes?.id, version: 2, telefono: '3110000000' });
    expect(await db.historial.toArray()).toEqual([
      expect.objectContaining({ entidad_id: antes?.id, version: 1, motivo: 'edicion' }),
    ]);
  });

  it('el PIN se guarda como huella y se verifica', async () => {
    const { db } = caja();
    expect(await tienePin(db)).toBe(false);
    await expect(guardarPin(db, '12')).rejects.toThrow('4 a 6 números');
    await guardarPin(db, '4321');
    expect(JSON.stringify(await db.meta.get('pin'))).not.toContain('4321');
    expect(await verificarPin(db, '4321')).toBe(true);
    expect(await verificarPin(db, '1234')).toBe(false);
  });
});

describe('la entrada (HU-Q3.3)', () => {
  it('guarda el registro, la estadía y el consecutivo A-000001, A-000002', async () => {
    const { db, ctx } = await configurada();
    const a = await registrarEntrada(db, ENTRADA, ctx);
    const b = await registrarEntrada(db, { ...ENTRADA, placa: 'XYZ12A', vehiculo: 'moto' }, ctx);
    expect([a.serie, a.consecutivo, b.consecutivo]).toEqual(['A', 1, 2]);
    expect(await db.estadias.toArray()).toEqual([
      expect.objectContaining({ id: a.id, placa: 'ABC123', numero: 'A-000001' }),
      expect.objectContaining({ id: b.id, placa: 'XYZ12A', numero: 'A-000002' }),
    ]);
    expect(a.datos).toMatchObject({ tarifa_id: expect.any(String), tarifa_version: 1 });
  });

  it('una placa adentro no abre otra estadía (CA3)', async () => {
    const { db, ctx } = await configurada();
    await registrarEntrada(db, ENTRADA, ctx);
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toBeInstanceOf(EstadiaYaAbierta);
    expect(await db.registros.count()).toBe(1);
  });

  it('dos transacciones que fallan no gastan número: sin huecos (CA4 ❌)', async () => {
    const { db, ctx } = await configurada();
    let fallos = 2;
    db.estadias.hook('creating', () => {
      if (fallos-- > 0) throw new Error('el disco se llenó');
    });
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toThrow('el disco se llenó');
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toThrow('el disco se llenó');
    const buena = await registrarEntrada(db, ENTRADA, ctx);
    expect(buena.consecutivo).toBe(1);
    expect(await db.registros.count()).toBe(1);
  });

  it('las fotos quedan con su estadía y su formato real', async () => {
    const { db, ctx } = await configurada();
    const r = await registrarEntrada(
      db,
      {
        ...ENTRADA,
        fotos: [{ tipo: 'image/jpeg', datos: new Blob(['x'], { type: 'image/jpeg' }) }],
      },
      ctx,
    );
    const fotos = await db.fotos.where('estadia_id').equals(r.id).toArray();
    expect(fotos.map((f) => f.tipo)).toEqual(['image/jpeg']);
    expect((r.datos as { foto_ids: string[] }).foto_ids).toEqual([fotos[0]?.id]);
  });
});

describe('el recibo de una entrada ya registrada', () => {
  it('lleva la tarifa de su día, aunque después cambie (ADR-4)', async () => {
    const { db, ctx } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    const [antes] = (await leerAjustes(db)).tarifas.filter((t) => t.vehiculo === 'carro');
    if (!antes) throw new Error('falta la tarifa de carro');
    await guardarTarifa(db, { ...sinMeta(antes), valor: 200 }, antes.id, ctx);
    const { tarifa } = await catalogosDelRegistro(db, entrada);
    expect(tarifa).toMatchObject({ id: antes.id, version: 1, valor: TARIFA_CARRO.valor });
  });

  it('cuenta las veces que salió en papel: la siguiente es copia', async () => {
    const { db, ctx } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    expect(await vecesImpreso(db, entrada)).toBe(0);
    await registrarEntrega(db, entrada, 'whatsapp', false, ctx);
    await registrarEntrega(db, entrada, 'papel', false, ctx);
    expect(await vecesImpreso(db, entrada)).toBe(1);
  });
});
