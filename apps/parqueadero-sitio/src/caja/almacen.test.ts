import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import {
  armarRecibo,
  enlaceCompleto,
  enlaceCorto,
  lineasDePapel,
  ORIGEN_DEL_RECIBO,
  pantalla,
  papel as papelDelRecibo,
  ReciboIncompleto,
  textoWhatsApp,
} from '@ed1/parqueadero-recibos';
import { armarExport, type DatosDeSalida, ErrorDeValidacion } from '@ed1/parqueadero-schema';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import {
  abrirTurno,
  anulados,
  anular,
  armarRespaldo,
  avisoDelAbono,
  buscarPorLectura,
  type Contexto,
  CotizacionVencida,
  catalogosDelRegistro,
  cerrarTurno,
  contactoDe,
  cotizar,
  EstadiaCerrada,
  EstadiaYaAbierta,
  estadiasAbiertas,
  faltaParaRegistrar,
  guardarAbonado,
  guardarContacto,
  guardarPin,
  guardarSede,
  guardarTarifa,
  leerAbonados,
  leerAjustes,
  NoSeAnula,
  PinIncorrecto,
  RespaldoInvalido,
  reconstruirEstadias,
  registrarEntrada,
  registrarEntrega,
  registrarMovimiento,
  registrarSalida,
  restaurar,
  resumenDelTurno,
  SinAvisoDePrivacidad,
  SinTurno,
  TarifaSobreElTope,
  tienePin,
  turnoAbierto,
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
  await abrirTurno(db, { operador: 'Caja 1', base: 100_000 }, ctx);
  return { db, ctx, avanzar };
}

/** Los registros que no son del turno: la apertura no es un recibo. */
const recibos = (db: ReturnType<typeof abrirBase>) =>
  db.registros.filter((r) => r.tipo !== 'turno_apertura').count();

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

  it('dos entradas a la vez salen con números distintos (HU-Q6.3 CA3 ❌)', async () => {
    const { db, ctx } = await configurada();
    const placas = ['AAA111', 'BBB222', 'CCC333', 'DDD444'];
    const hechas = await Promise.all(
      placas.map((placa) => registrarEntrada(db, { ...ENTRADA, placa }, ctx)),
    );
    expect(hechas.map((h) => h.consecutivo).sort()).toEqual([1, 2, 3, 4]);
    expect(await db.meta.get('consecutivo')).toEqual({ clave: 'consecutivo', ultimo: 4 });
  });

  it('una placa adentro no abre otra estadía (CA3)', async () => {
    const { db, ctx } = await configurada();
    await registrarEntrada(db, ENTRADA, ctx);
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toBeInstanceOf(EstadiaYaAbierta);
    expect(await recibos(db)).toBe(1);
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
    expect(await recibos(db)).toBe(1);
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
    expect(await recibos(db)).toBe(0);
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

describe('anular sin borrar (HU-Q3.7)', () => {
  const EFECTIVO = {
    perdido: false,
    medio: 'efectivo',
    recibido: 50_000,
    motivoCortesia: null,
  } as const;
  const DATOS = { motivo: 'placa mal digitada', pin: '2468', operador: 'Caja 1' };

  async function conPin() {
    const c = await configurada();
    await guardarPin(c.db, '2468');
    return c;
  }

  it('una entrada anulada cierra su estadía y deja el registro y la anulación (CA1)', async () => {
    const { db, ctx } = await conPin();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    const a = await anular(db, entrada.id, DATOS, ctx);
    expect(a).toMatchObject({ tipo: 'anulacion', anula_id: entrada.id, estadia_id: entrada.id });
    expect(a.datos).toEqual({ motivo: 'placa mal digitada', operador: 'Caja 1' });
    expect(await estadiasAbiertas(db)).toEqual([]);
    expect(await db.registros.get(entrada.id)).toEqual(entrada);
    // Lo derivado se rehace igual desde los registros.
    expect(await reconstruirEstadias(db)).toBe(0);
    // La misma placa puede entrar otra vez.
    expect((await registrarEntrada(db, ENTRADA, ctx)).consecutivo).toBe(2);
  });

  it('una salida anulada reabre la estadía con su hora de entrada (CA1)', async () => {
    const { db, ctx, avanzar } = await conPin();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(30);
    const salida = await registrarSalida(db, entrada.id, EFECTIVO, ctx);
    await anular(db, salida.id, DATOS, ctx);
    const [abierta] = await estadiasAbiertas(db);
    expect(abierta).toMatchObject({ id: entrada.id, placa: 'ABC123', numero: 'A-000001' });
    expect(abierta?.entrada).toBe(Date.parse(entrada.instante_evento));
    expect(await reconstruirEstadias(db)).toBe(1);
    // Se vuelve a cobrar, con otro número.
    expect((await registrarSalida(db, entrada.id, EFECTIVO, ctx)).consecutivo).toBe(3);
  });

  it('sin PIN, sin motivo, dos veces o con la salida vigente no anula (CA1 ❌)', async () => {
    const { db, ctx, avanzar } = await conPin();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    const motivo = (p: Promise<unknown>) => p.catch((e: Error) => e.message);
    expect(await motivo(anular(db, entrada.id, { ...DATOS, pin: '1111' }, ctx))).toBe(
      'Ese no es el PIN de administrador',
    );
    expect(await motivo(anular(db, entrada.id, { ...DATOS, motivo: '  ' }, ctx))).toBe(
      'Falta el motivo de la anulación',
    );
    avanzar(10);
    const salida = await registrarSalida(db, entrada.id, EFECTIVO, ctx);
    expect(await motivo(anular(db, entrada.id, DATOS, ctx))).toContain(
      'primero se anula su salida',
    );
    await registrarEntrada(db, ENTRADA, ctx);
    expect(await motivo(anular(db, salida.id, DATOS, ctx))).toContain('volvió a entrar');
    const ninguna = await db.registros.where('tipo').equals('anulacion').count();
    expect(ninguna).toBe(0);
  });

  it('un recibo ya anulado no se anula otra vez', async () => {
    const { db, ctx } = await conPin();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    await anular(db, entrada.id, DATOS, ctx);
    await expect(anular(db, entrada.id, DATOS, ctx)).rejects.toBeInstanceOf(NoSeAnula);
    expect(await anulados(db)).toEqual(new Set([entrada.id]));
  });
});

describe('el turno (HU-Q3.9)', () => {
  const EFECTIVO = {
    perdido: false,
    medio: 'efectivo',
    recibido: 50_000,
    motivoCortesia: null,
  } as const;

  it('sin turno abierto no hay entrada, salida ni anulación (CA4 ❌)', async () => {
    const { db, ctx } = caja();
    await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
    await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toBeInstanceOf(SinTurno);
    expect(await db.registros.count()).toBe(0);
  });

  it('sigue abierto aunque se cierre la app: se lee de los registros (CA3)', async () => {
    const { db, ctx } = await configurada();
    const t = await turnoAbierto(db);
    expect(t).toMatchObject({ numero: 1, operador: 'Caja 1', base: 100_000 });
    // Abrir otra vez devuelve el mismo, no abre un segundo.
    expect((await abrirTurno(db, { operador: 'Otro', base: 0 }, ctx)).apertura.id).toBe(
      t?.apertura.id,
    );
  });

  it('cierra con lo esperado calculado en la caja, y el siguiente es el T-002 (CA1)', async () => {
    const { db, ctx, avanzar } = await configurada();
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(179);
    await registrarSalida(db, entrada.id, EFECTIVO, ctx);
    await registrarMovimiento(db, { clase: 'gasto', valor: 4_000, concepto: 'bolsas' }, ctx);
    const t = (await turnoAbierto(db)) as NonNullable<Awaited<ReturnType<typeof turnoAbierto>>>;
    const { cierre, resumen } = await cerrarTurno(db, t, { contado: 126_000, motivo: null }, ctx);
    expect(resumen).toMatchObject({ entradas: 1, salidas: 1, esperado: 100_000 + 30_000 - 4_000 });
    expect(cierre.datos).toMatchObject({ esperado: 126_000, contado: 126_000, diferencia: 0 });
    expect(await turnoAbierto(db)).toBeNull();
    await expect(registrarEntrada(db, { ...ENTRADA, placa: 'XYZ987' }, ctx)).rejects.toBeInstanceOf(
      SinTurno,
    );
    const otro = await abrirTurno(db, { operador: 'Caja 2', base: 50_000 }, ctx);
    expect(otro.numero).toBe(2);
    expect((await resumenDelTurno(db, otro)).numero).toBe('T-002');
  });

  it('una diferencia sin motivo no se guarda (CA4 ❌)', async () => {
    const { db, ctx } = await configurada();
    const t = (await turnoAbierto(db)) as NonNullable<Awaited<ReturnType<typeof turnoAbierto>>>;
    await expect(cerrarTurno(db, t, { contado: 95_000, motivo: '  ' }, ctx)).rejects.toBeInstanceOf(
      ErrorDeValidacion,
    );
    expect(await turnoAbierto(db)).not.toBeNull();
    const { cierre } = await cerrarTurno(db, t, { contado: 95_000, motivo: 'faltó cambio' }, ctx);
    expect(cierre.datos).toMatchObject({ diferencia: -5_000, motivo: 'faltó cambio' });
  });
});

describe('respaldo y restauración (HU-Q3.10)', () => {
  const EFECTIVO = {
    perdido: false,
    medio: 'efectivo',
    recibido: 50_000,
    motivoCortesia: null,
  } as const;

  async function conMovimiento() {
    const c = await configurada();
    const e1 = await registrarEntrada(c.db, ENTRADA, c.ctx);
    c.avanzar(30);
    await registrarSalida(c.db, e1.id, EFECTIVO, c.ctx);
    await registrarEntrada(c.db, { ...ENTRADA, placa: 'XYZ987' }, c.ctx);
    return c;
  }

  it('en un teléfono nuevo deja todo igual, y el siguiente recibo sigue la numeración (CA2)', async () => {
    const { db, ctx } = await conMovimiento();
    const r = await armarRespaldo(db, ctx, '0.0.0');
    expect(r.nombre).toMatch(/^parqueadero-2026-10-06-\d{4}$/);
    expect(r.csv.split('\r\n')[0]).toContain('numero;tipo;fecha');
    const nuevo = caja();
    const res = await restaurar(nuevo.db, JSON.parse(JSON.stringify(r.json)));
    expect(res.yaEstaban).toBe(0);
    expect(res.agregados).toBe((await db.registros.count()) + (await db.catalogos.count()));
    expect((await estadiasAbiertas(nuevo.db)).map((e) => e.placa)).toEqual(['XYZ987']);
    // A-000001 entrada, A-000002 salida, A-000003 entrada: la siguiente es la A-000004.
    const sigue = await registrarEntrada(nuevo.db, { ...ENTRADA, placa: 'JKL321' }, nuevo.ctx);
    expect(sigue.consecutivo).toBe(4);
  });

  it('un respaldo viejo encima de una caja con registros nuevos no borra ninguno (CA4 ❌)', async () => {
    const { db, ctx } = await conMovimiento();
    const viejo = (await armarRespaldo(db, ctx, '0.0.0')).json;
    await registrarEntrada(db, { ...ENTRADA, placa: 'JKL321' }, ctx);
    const antes = await db.registros.count();
    const res = await restaurar(db, viejo);
    expect(res.agregados).toBe(0);
    expect(await db.registros.count()).toBe(antes);
    expect((await estadiasAbiertas(db)).map((e) => e.placa).sort()).toEqual(['JKL321', 'XYZ987']);
  });

  it('un archivo alterado, de otra sede o de otra versión se rechaza entero (CA4 ❌)', async () => {
    const { db, ctx } = await conMovimiento();
    const bueno = (await armarRespaldo(db, ctx, '0.0.0')).json;
    const copia = () => JSON.parse(JSON.stringify(bueno));
    const nuevo = caja();
    const alterado = copia();
    alterado.tablas.registro.filas[0].datos.placa = 'ZZZ999';
    await expect(restaurar(nuevo.db, alterado)).rejects.toBeInstanceOf(RespaldoInvalido);
    await expect(restaurar(nuevo.db, { ...copia(), version: 2 })).rejects.toBeInstanceOf(
      RespaldoInvalido,
    );
    expect(await nuevo.db.registros.count()).toBe(0);
    const otra = await configurada();
    const motivo = await restaurar(otra.db, copia()).catch((e: RespaldoInvalido) => e.message);
    expect(motivo).toContain('otro parqueadero');
  });

  it('las fotos no van en el archivo (CA3)', async () => {
    const { db, ctx } = await configurada();
    const foto = { tipo: 'image/jpeg' as const, datos: new Blob(['x'.repeat(50)]) };
    await registrarEntrada(db, { ...ENTRADA, fotos: [foto] }, ctx);
    const r = await armarRespaldo(db, ctx, '0.0.0');
    expect(Object.keys(r.json.tablas)).toEqual(['catalogo', 'registro', 'historial']);
    expect(JSON.stringify(r.json)).not.toContain('x'.repeat(50));
  });
});

describe('el tope de la ciudad en la tarifa (HU-Q1.2 CA2)', () => {
  it('en Bogotá, una tarifa con tope de 240 o sin tope no se guarda', async () => {
    const { db, ctx } = await configurada();
    const carro = sinMeta(TARIFA_CARRO);
    await expect(guardarTarifa(db, { ...carro, tope_minuto: 240 }, null, ctx)).rejects.toThrow(
      'en Bogotá el tope es de 230 pesos por minuto',
    );
    await expect(
      guardarTarifa(db, { ...carro, tope_minuto: null }, null, ctx),
    ).rejects.toBeInstanceOf(TarifaSobreElTope);
    expect(
      (await guardarTarifa(db, { ...carro, tope_minuto: 200, valor: 200 }, null, ctx)).tope_minuto,
    ).toBe(200);
  });
});

describe('abonados por placa (HU-Q3.11)', () => {
  const EFECTIVO = {
    perdido: false,
    medio: 'efectivo',
    recibido: 50_000,
    motivoCortesia: null,
  } as const;
  /** La caja empieza el 6 oct a las 18:05 de Bogotá. */
  const ABONO = {
    placa: 'ABC123',
    vehiculo: 'carro' as const,
    referencia: 'Apto 302',
    desde: '2026-10-01',
    hasta: '2026-10-31',
    valor: 300_000,
    activo: true,
  };

  async function conPin() {
    const c = await configurada();
    await guardarPin(c.db, '2468');
    return c;
  }

  it('solo el administrador los cambia, con su PIN, y la versión anterior queda (CA1)', async () => {
    const { db, ctx } = await conPin();
    await expect(guardarAbonado(db, ABONO, null, '1111', ctx)).rejects.toBeInstanceOf(
      PinIncorrecto,
    );
    expect(await leerAbonados(db)).toEqual([]);
    const a = await guardarAbonado(db, ABONO, null, '2468', ctx);
    const renovado = await guardarAbonado(db, { ...ABONO, hasta: '2026-11-30' }, a.id, '2468', ctx);
    expect([renovado.id, renovado.version, renovado.hasta]).toEqual([a.id, 2, '2026-11-30']);
    expect(await db.historial.where('entidad_id').equals(a.id).count()).toBe(1);
  });

  it('el vigente se marca al entrar y sale en 0, como «abonado» y hasta cuándo (CA2)', async () => {
    const { db, ctx, avanzar } = await conPin();
    const a = await guardarAbonado(db, ABONO, null, '2468', ctx);
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    expect((entrada.datos as { abonado_id: string | null }).abonado_id).toBe(a.id);
    avanzar(179);
    // El cajero no elige medio: lo que mande, el abono lo cubre.
    const salida = await registrarSalida(db, entrada.id, EFECTIVO, ctx);
    const d = salida.datos as DatosDeSalida;
    expect([d.total, d.medio_pago, d.recibido, d.cambio]).toEqual([0, 'abonado', null, null]);
    expect(d.lineas.map((l) => l.concepto)).toEqual(['abonado']);
    const recibo = armarRecibo(salida, await catalogosDelRegistro(db, salida), { prueba: false });
    expect(recibo.salida?.abonadoHasta).toBe('2026-10-31');
    const lineas = lineasDePapel(
      papelDelRecibo(recibo, { columnas: 32, paginaDeCodigos: 'cp850', qr: null }),
      32,
    );
    expect(lineas).toContain('Abonado hasta 31/10/2026');
    expect(pantalla(recibo).filas).toContainEqual(['Abono', 'Abonado hasta 31/10/2026']);
    expect(textoWhatsApp(recibo, ORIGEN_DEL_RECIBO)).toContain('Abonado hasta 31/10/2026.');
  });

  it('uno vencido liquida como visitante y la caja lo dice (CA3 ❌)', async () => {
    const { db, ctx, avanzar } = await conPin();
    await guardarAbonado(db, { ...ABONO, hasta: '2026-10-05' }, null, '2468', ctx);
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    expect((entrada.datos as { abonado_id: string | null }).abonado_id).toBeNull();
    avanzar(60);
    const q = await cotizar(db, entrada.id, ctx.reloj(), false);
    expect(q.liquidacion.total).toBeGreaterThan(0);
    expect(avisoDelAbono(q)).toBe('El abono venció el 05/10/2026: se cobra como visitante');
    const d = (await registrarSalida(db, entrada.id, EFECTIVO, ctx, q.salida))
      .datos as DatosDeSalida;
    expect([d.medio_pago, d.total]).toEqual(['efectivo', q.liquidacion.total]);
  });

  it('desactivado no cuenta, y el que vence en medio cobra desde que venció (CA3 ❌)', async () => {
    const { db, ctx, avanzar } = await conPin();
    const a = await guardarAbonado(db, { ...ABONO, hasta: '2026-10-06' }, null, '2468', ctx);
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(60 * 13); // sale el 7 oct a las 07:05: el abono cubrió hasta la medianoche
    const q = await cotizar(db, entrada.id, ctx.reloj(), false);
    expect(q.liquidacion.lineas.map((l) => l.concepto)).toContain('abonado');
    expect(q.liquidacion.total).toBeGreaterThan(0);
    expect(avisoDelAbono(q)).toBe('El abono venció el 06/10/2026: se cobra desde ese día');
    await guardarAbonado(db, { ...ABONO, activo: false }, a.id, '2468', ctx);
    const otra = await registrarEntrada(db, { ...ENTRADA, placa: 'ABC124' }, ctx);
    await guardarAbonado(db, { ...ABONO, placa: 'ABC124', activo: false }, null, '2468', ctx);
    expect((await cotizar(db, otra.id, ctx.reloj(), false)).abonado).toBeNull();
  });

  it('no guarda el WhatsApp del abonado en M0 (CA3 ❌, ADR-38)', async () => {
    const { db, ctx } = await conPin();
    const conNumero = { ...ABONO, whatsapp: '3001234567' } as typeof ABONO;
    await expect(guardarAbonado(db, conNumero, null, '2468', ctx)).rejects.toBeInstanceOf(
      ErrorDeValidacion,
    );
  });
});
