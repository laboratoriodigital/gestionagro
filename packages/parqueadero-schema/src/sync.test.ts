import { LOTE_MAXIMO, PROTOCOLO } from '@ed1/sync';
import { describe, expect, it } from 'vitest';
import {
  AJUSTE_ENSAYO,
  DISPOSITIVO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
  TARIFA_MOTO,
} from './ensayos.fixture.ts';
import {
  ENTIDADES_DE_CATALOGO,
  type Operacion,
  type PedidoPush,
  type RespuestaPull,
  validarOperacion,
} from './sync.ts';

/**
 * La batería del parqueadero sobre el protocolo común (HU-Q7.3, CA2): lo que la caja subirá a su
 * celda pasa por el mismo `@ed1/sync` que el cuaderno, y lo que no sirve sale con su motivo.
 */

const deRegistro = (r: typeof ENTRADA_ENSAYO): Operacion => ({
  id: r.id,
  entidad: 'registro',
  entidad_id: r.id,
  version: 1,
  datos: r,
});

const deCatalogo = (c: { id: string; version: number; entidad: string }): Operacion => ({
  id: `${c.id}@v${c.version}`,
  entidad: c.entidad as Operacion['entidad'],
  entidad_id: c.id,
  version: c.version,
  datos: c,
});

/** Lo que llega a la celda: el lote pasa por JSON, como en el cable. */
const porElCable = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('el protocolo común con los tipos del parqueadero (HU-Q7.3)', () => {
  it('un lote de caja con la entrada, la salida y sus catálogos se acepta entero', () => {
    const lote: PedidoPush = porElCable({
      protocolo: PROTOCOLO,
      dispositivo: DISPOSITIVO,
      app: '0.2.0',
      ops: [
        deCatalogo(SEDE_ENSAYO_UNO),
        deCatalogo(TARIFA_CARRO),
        deCatalogo(TARIFA_MOTO),
        deCatalogo(AJUSTE_ENSAYO),
        deRegistro(ENTRADA_ENSAYO),
        deRegistro(SALIDA_ENSAYO),
      ],
    });
    expect(lote.ops.length).toBeLessThanOrEqual(LOTE_MAXIMO);
    const resultados = lote.ops.map(validarOperacion);
    expect(resultados.map((r) => r.ok)).toEqual([true, true, true, true, true, true]);
    const salida = resultados[5];
    expect(
      salida?.ok && salida.op.entidad === 'registro' && salida.op.registro.datos,
    ).toMatchObject({ total: 30_000 });
    const tarifa = resultados[1];
    expect(tarifa?.ok && tarifa.op).toMatchObject({
      id: `${TARIFA_CARRO.id}@v1`,
      entidad: 'tarifa',
      version: 1,
    });
  });

  it('viajan los catálogos del anexo A, la sede primero, y ninguno del agro', () => {
    expect(ENTIDADES_DE_CATALOGO[0]).toBe('sede');
    expect([...ENTIDADES_DE_CATALOGO].sort()).toEqual(
      ['abonado', 'ajuste_recibo', 'punto', 'sede', 'tarifa'].sort(),
    );
    const finca = validarOperacion({ ...deCatalogo(SEDE_ENSAYO_UNO), entidad: 'finca' });
    expect(finca).toEqual({
      ok: false,
      id: `${SEDE_ENSAYO_UNO.id}@v1`,
      motivo: 'Entidad desconocida: finca',
    });
  });

  it('un registro que no valida va a cuarentena con el campo y el motivo, sin lanzar', () => {
    const malo = {
      ...ENTRADA_ENSAYO,
      datos: { ...(ENTRADA_ENSAYO.datos as object), placa: 'abc 123' },
    };
    const r = validarOperacion(deRegistro(malo));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/datos\.placa/);
  });

  it('una operación que no coincide con su registro o su versión se rechaza con su motivo', () => {
    const otraId = { ...deRegistro(ENTRADA_ENSAYO), entidad_id: SALIDA_ENSAYO.id };
    expect(validarOperacion(otraId)).toMatchObject({
      ok: false,
      motivo: 'El registro no coincide con su operación',
    });
    const otraVersion = { ...deCatalogo(TARIFA_CARRO), version: 2 };
    expect(validarOperacion(otraVersion)).toMatchObject({
      ok: false,
      motivo: 'tarifa no coincide con su operación (id o versión)',
    });
  });

  it('una tarifa enviada como sede no se guarda como sede', () => {
    const r = validarOperacion({ ...deCatalogo(TARIFA_CARRO), entidad: 'sede' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/^sede inválido/);
  });

  it('el pull del parqueadero tiene la misma forma que el del cuaderno', () => {
    const pagina: RespuestaPull = porElCable({
      catalogos: [{ entidad: 'tarifa', datos: TARIFA_CARRO }],
      registros: [ENTRADA_ENSAYO],
      cursor: { registro: 1, catalogo: 1 },
      mas: false,
    });
    expect(Object.keys(pagina).sort()).toEqual(['catalogos', 'cursor', 'mas', 'registros']);
  });
});
