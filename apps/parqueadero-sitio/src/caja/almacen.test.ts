import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import {
  armarRecibo,
  enlaceCompleto,
  enlaceCorto,
  ORIGEN_DEL_RECIBO,
  ReciboIncompleto,
} from '@ed1/parqueadero-recibos';
import { armarExport, type DatosDeSalida, ErrorDeValidacion } from '@ed1/parqueadero-schema';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import {
  buscarPorLectura,
  type Contexto,
  CotizacionVencida,
  catalogosDelRegistro,
  contactoDe,
  EstadiaCerrada,
  EstadiaYaAbierta,
  estadiasAbiertas,
  faltaParaRegistrar,
  guardarContacto,
  guardarPin,
  guardarSede,
  guardarTarifa,
  leerAjustes,
  reconstruirEstadias,
  registrarEntrada,
  registrarEntrega,
  registrarSalida,
  SinAvisoDePrivacidad,
  TarifaSobreElTope,
  tienePin,
  vecesImpreso,
  verificarPin,
} from './almacen.ts';
import { abrirBase, purgarContactos } from './datos.ts';
import { avisoDeLaSede, VERSION_DEL_AVISO } from './privacidad.ts';

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
  const avanzar = (minutos: number) => {
    ms += minutos * 60_000;
  };
  return { db: abrirBase(`almacen-${uuidv7()}`), ctx, avanzar };
}

async function configurada() {
  const { db, ctx, avanzar } = caja();
  await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_MOTO), null, ctx);
  return { db, ctx, avanzar };
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
    await registrarEntrega(
      db,
      entrada,
      { canal: 'whatsapp', copia: false, resultado: 'abierto' },
      ctx,
    );
    const papel = {
      canal: 'papel',
      copia: false,
      camino: 'bluetooth',
      resultado: 'enviado',
    } as const;
    await registrarEntrega(db, entrada, papel, ctx);
    expect(await vecesImpreso(db, entrada)).toBe(1);
    // «No salió» descuenta ese envío: la siguiente vuelve a ser el original (HU-Q3.6 CA2).
    await registrarEntrega(db, entrada, { ...papel, resultado: 'fallido' }, ctx);
    expect(await vecesImpreso(db, entrada)).toBe(0);
    await registrarEntrega(db, entrada, papel, ctx);
    await registrarEntrega(db, entrada, { ...papel, copia: true }, ctx);
    expect(await vecesImpreso(db, entrada)).toBe(2);
  });
});

describe('la salida y el cobro (HU-Q3.5)', () => {
  const EFECTIVO = {
    perdido: false,
    medio: 'efectivo',
    recibido: 50_000,
    motivoCortesia: null,
  } as const;

  it('cobra con la tarifa de la entrada, cierra la estadía y toma el número siguiente', async () => {
    const { db, ctx, avanzar } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(179);
    const salida = await registrarSalida(db, entrada.id, EFECTIVO, ctx);
    const d = salida.datos as DatosDeSalida;
    expect(salida.consecutivo).toBe(2);
    expect(d.entrada_numero).toBe('A-000001');
    expect(d.minutos).toBe(180);
    // 180 × 230 = 41.400 pasa el tope por día de la tarifa de ensayo: 30.000 (§9.3).
    expect([d.total, d.recibido, d.cambio]).toEqual([30_000, 50_000, 20_000]);
    expect(await estadiasAbiertas(db)).toEqual([]);
    await expect(registrarSalida(db, entrada.id, EFECTIVO, ctx)).rejects.toBeInstanceOf(
      EstadiaCerrada,
    );
  });

  it('efectivo que no alcanza o cortesía sin motivo no cobran ni gastan número (CA4 ❌)', async () => {
    const { db, ctx, avanzar } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(60);
    await expect(
      registrarSalida(db, entrada.id, { ...EFECTIVO, recibido: 1_000 }, ctx),
    ).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(
      registrarSalida(
        db,
        entrada.id,
        { perdido: false, medio: 'cortesia', recibido: null, motivoCortesia: '  ' },
        ctx,
      ),
    ).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(await estadiasAbiertas(db)).toHaveLength(1);
    const buena = await registrarSalida(
      db,
      entrada.id,
      { perdido: false, medio: 'cortesia', recibido: null, motivoCortesia: 'Cliente del local 4' },
      ctx,
    );
    expect(buena.consecutivo).toBe(2);
  });

  it('el tiquete perdido es una línea más (CA3)', async () => {
    const { db, ctx, avanzar } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(10);
    const s = await registrarSalida(db, entrada.id, { ...EFECTIVO, perdido: true }, ctx);
    const d = s.datos as DatosDeSalida;
    expect(d.perdido).toBe(true);
    expect(d.lineas.map((l) => l.concepto)).toContain('perdido');
  });
});

describe('estadías abiertas (HU-Q3.4)', () => {
  it('se rehacen desde los registros con la tabla borrada (CA3 ❌)', async () => {
    const { db, ctx, avanzar } = await configurada();
    const sale = await registrarEntrada(db, ENTRADA, ctx);
    const queda = await registrarEntrada(db, { ...ENTRADA, placa: 'XYZ987' }, ctx);
    avanzar(30);
    await registrarSalida(
      db,
      sale.id,
      { perdido: false, medio: 'datafono', recibido: null, motivoCortesia: null },
      ctx,
    );
    const antes = await estadiasAbiertas(db);
    await db.estadias.clear();
    expect(await reconstruirEstadias(db)).toBe(1);
    expect(await estadiasAbiertas(db)).toEqual(antes);
    expect(antes.map((e) => [e.id, e.numero])).toEqual([[queda.id, 'A-000002']]);
  });
});

describe('el QR escaneado (HU-Q3.4 CA2 y CA3)', () => {
  async function conReciboDeEntrada() {
    const c = await configurada();
    const entrada = await registrarEntrada(c.db, ENTRADA, c.ctx);
    const recibo = armarRecibo(entrada, await catalogosDelRegistro(c.db, entrada), {
      prueba: true,
    });
    return { ...c, entrada, recibo };
  }

  it('la forma corta del papel y la completa del teléfono abren la misma estadía', async () => {
    const { db, entrada, recibo } = await conReciboDeEntrada();
    const esperado = { encontrada: true, estadiaId: entrada.id };
    expect(await buscarPorLectura(db, enlaceCorto(recibo))).toEqual(esperado);
    expect(await buscarPorLectura(db, await enlaceCompleto(recibo))).toEqual(esperado);
  });

  it('una estadía cerrada, otro parqueadero o un QR cualquiera dicen qué son (CA3 ❌)', async () => {
    const { db, ctx, entrada, recibo, avanzar } = await conReciboDeEntrada();
    const ajeno = enlaceCorto({ ...recibo, numero: 'A-000777', entrada: recibo.entrada - 60_000 });
    expect(await buscarPorLectura(db, ajeno)).toEqual({
      encontrada: false,
      motivo: 'El recibo A-000777 de ABC123 no es de esta caja: puede ser de otro parqueadero.',
    });
    expect(await buscarPorLectura(db, 'https://ejemplo.com/x')).toMatchObject({
      motivo: 'Este QR no es un recibo del parqueadero.',
    });
    expect(await buscarPorLectura(db, `${ORIGEN_DEL_RECIBO}#1.dañado`)).toMatchObject({
      motivo: 'No se pudo leer este recibo: el QR está dañado.',
    });
    avanzar(5);
    await registrarSalida(
      db,
      entrada.id,
      { perdido: false, medio: 'datafono', recibido: null, motivoCortesia: null },
      ctx,
    );
    expect(await buscarPorLectura(db, enlaceCorto(recibo))).toEqual({
      encontrada: false,
      motivo: 'La estadía de ABC123 (recibo A-000001) ya salió.',
    });
  });
});

describe('el total que vio el cajero', () => {
  it('se cobra tal cual, y con más de 10 minutos se vuelve a calcular', async () => {
    const { db, ctx, avanzar } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(30);
    const visto = ctx.reloj();
    avanzar(11);
    const cobro = {
      perdido: false,
      medio: 'datafono',
      recibido: null,
      motivoCortesia: null,
    } as const;
    await expect(registrarSalida(db, entrada.id, cobro, ctx, visto)).rejects.toBeInstanceOf(
      CotizacionVencida,
    );
    const s = await registrarSalida(db, entrada.id, cobro, ctx, visto + 2 * 60_000);
    expect((s.datos as DatosDeSalida).minutos).toBe(33);
  });
});

describe('el WhatsApp del conductor (HU-Q4.1 y HU-Q4.4)', () => {
  const NUMERO = '300 123 4567';
  const COBRO = {
    perdido: false,
    medio: 'datafono' as const,
    recibido: null,
    motivoCortesia: null,
  };
  const HORA = 3_600_000;

  async function conAviso() {
    const c = await configurada();
    const a = await leerAjustes(c.db);
    if (!a.sede) throw new Error('sin sede');
    await guardarSede(
      c.db,
      {
        ...sinMeta(a.sede),
        aviso_privacidad: { version: VERSION_DEL_AVISO, aceptado: '2026-10-06T23:00:00.000Z' },
      },
      a.sede.id,
      c.ctx,
    );
    return c;
  }

  it('sin el aviso aceptado no se guarda el número ni se gasta el recibo (HU-Q4.4 CA2)', async () => {
    const { db, ctx } = await configurada();
    await expect(registrarEntrada(db, { ...ENTRADA, whatsapp: NUMERO }, ctx)).rejects.toThrow(
      SinAvisoDePrivacidad,
    );
    expect(await db.registros.count()).toBe(0);
    expect(await db.contactos.count()).toBe(0);
  });

  it('se guarda con la entrada, sirve para la salida y se borra 24 h después (CA3 y CA4 ❌)', async () => {
    const { db, ctx, avanzar } = await conAviso();
    const entrada = await registrarEntrada(db, { ...ENTRADA, whatsapp: NUMERO }, ctx);
    const c = await contactoDe(db, entrada.id, ctx.reloj());
    expect(c).toMatchObject({ numero: '573001234567', aviso_version: '1', borrar_en: null });

    avanzar(90);
    const salida = await registrarSalida(db, entrada.id, COBRO, ctx);
    const instante = Date.parse(salida.instante_evento);
    expect((await db.contactos.get(entrada.id))?.borrar_en).toBe(instante + 24 * HORA);
    expect((await contactoDe(db, salida.estadia_id ?? '', instante + 23 * HORA))?.numero).toBe(
      '573001234567',
    );

    expect(await purgarContactos(db, instante + 23 * HORA)).toBe(0);
    expect(await purgarContactos(db, instante + 25 * HORA)).toBe(1);
    expect(await db.contactos.count()).toBe(0);
  });

  it('el número escrito después de la salida vence con esa salida, no 24 h después de escribirlo', async () => {
    const { db, ctx, avanzar } = await conAviso();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(30);
    const salida = await registrarSalida(db, entrada.id, COBRO, ctx);
    avanzar(120);
    const c = await guardarContacto(db, entrada.id, NUMERO, ctx);
    expect(c.borrar_en).toBe(Date.parse(salida.instante_evento) + 24 * HORA);
  });

  it('el número no está en los registros ni en el respaldo (CA4 ❌)', async () => {
    const { db, ctx, avanzar } = await conAviso();
    const entrada = await registrarEntrada(db, { ...ENTRADA, whatsapp: NUMERO }, ctx);
    await registrarEntrega(
      db,
      entrada,
      { canal: 'whatsapp', copia: false, resultado: 'abierto', autorizado: true },
      ctx,
    );
    avanzar(45);
    await registrarSalida(db, entrada.id, COBRO, ctx);
    const respaldo = await armarExport({
      generado: new Date(ctx.reloj()).toISOString(),
      app: 'parqueadero-caja',
      dispositivo: { id: entrada.dispositivo_id, serie: 'A' },
      sede_id: null,
      catalogo: await db.catalogos.toArray(),
      registro: await db.registros.toArray(),
      historial: await db.historial.toArray(),
    });
    const todo = JSON.stringify(respaldo);
    expect(todo).toContain('ABC123');
    for (const forma of ['3001234567', '300 123 4567', '573001234567']) {
      expect(todo).not.toContain(forma);
    }
    expect(await db.contactos.count()).toBe(1);
  });
});

describe('el aviso de privacidad (HU-Q4.4)', () => {
  const frase = (p: readonly string[]) => p.some((x) => x.includes('no salen de este'));

  it('se llena con los datos de la sede, sin marcadores sueltos (CA1)', () => {
    const a = avisoDeLaSede({ ...SEDE_ENSAYO_UNO, org_id: null });
    const todo = [...a.parrafos, ...a.politica.secciones.flat()].join('\n');
    expect(todo).toContain(SEDE_ENSAYO_UNO.nit);
    expect(todo).toContain(SEDE_ENSAYO_UNO.telefono);
    expect(todo).toContain('24 horas después de su salida');
    expect(todo).not.toMatch(/[{}]/);
  });

  it('«sin cuenta» solo se dice en una caja sin cuenta (CA3 ❌)', () => {
    expect(frase(avisoDeLaSede({ ...SEDE_ENSAYO_UNO, org_id: null }).parrafos)).toBe(true);
    expect(frase(avisoDeLaSede({ ...SEDE_ENSAYO_UNO, org_id: 'org-1' }).parrafos)).toBe(false);
  });
});
