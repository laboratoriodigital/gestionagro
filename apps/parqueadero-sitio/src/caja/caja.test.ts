import 'fake-indexeddb/auto';
import {
  type BluetoothBle,
  type CaracteristicaBle,
  type PuertoSerie,
  SERVICIO_SERIE,
  type SerialWeb,
  type ServidorGatt,
} from '@ed1/impresion';
import { ORIGEN_DEL_RECIBO } from '@ed1/parqueadero-recibos';
import { describe, expect, it } from 'vitest';
import { decidirActualizacion } from './actividad.ts';
import { abrirBase } from './datos.ts';
import { conMarcaDeEntorno, esProduccion, HOST_DE_PRODUCCION, origenDelRecibo } from './entorno.ts';
import { fechaBogota, horaBogota } from './fecha.ts';
import { alVolverALaCaja, crearControl, MS_PARA_REFRESCAR } from './impresora.ts';
import { proponerCamino, senalDeImpresora, senalDePendientes, senalDeRespaldo } from './senales.ts';

describe('el entorno', () => {
  it('solo el host de producción imprime sin PRUEBA; uno desconocido cuenta como prueba', () => {
    expect(esProduccion(HOST_DE_PRODUCCION)).toBe(true);
    for (const h of [
      'ed1-parqueadero-staging.x.workers.dev',
      'localhost',
      'parqueadero.otro.app',
    ]) {
      expect(esProduccion(h)).toBe(false);
      expect(conMarcaDeEntorno([], h)[0]).toMatchObject({
        texto: expect.stringContaining('PRUEBA'),
      });
    }
    expect(conMarcaDeEntorno([{ tipo: 'regla' }], HOST_DE_PRODUCCION)).toEqual([{ tipo: 'regla' }]);
  });

  it('los recibos de producción llevan su dominio; los de staging, su propia /r/', () => {
    const staging = 'https://ed1-parqueadero-staging.x.workers.dev';
    expect(origenDelRecibo({ hostname: HOST_DE_PRODUCCION, origin: staging })).toBe(
      ORIGEN_DEL_RECIBO,
    );
    expect(
      origenDelRecibo({ hostname: 'ed1-parqueadero-staging.x.workers.dev', origin: staging }),
    ).toBe(`${staging}/r/`);
  });
});

describe('la fecha de Bogotá, UTC−5 fijo', () => {
  it('a medianoche UTC todavía es el día anterior en Bogotá', () => {
    const ms = Date.UTC(2026, 9, 7, 2, 5);
    expect(fechaBogota(ms)).toBe('06/10/2026');
    expect(horaBogota(ms)).toBe('21:05');
  });
});

describe('la actualización', () => {
  it('espera con un formulario abierto o una impresión en curso', () => {
    expect(decidirActualizacion(false, { formulariosAbiertos: 0, impresionesEnCurso: 0 })).toBe(
      'nada',
    );
    expect(decidirActualizacion(true, { formulariosAbiertos: 1, impresionesEnCurso: 0 })).toBe(
      'esperar',
    );
    expect(decidirActualizacion(true, { formulariosAbiertos: 0, impresionesEnCurso: 1 })).toBe(
      'esperar',
    );
    expect(decidirActualizacion(true, { formulariosAbiertos: 0, impresionesEnCurso: 0 })).toBe(
      'ofrecer',
    );
  });
});

describe('las señales de la cabecera', () => {
  const registro = {
    id: 'actual',
    camino: 'bluetooth',
    nombre: 'PT-210',
    dispositivoId: 'x',
    paginaDeCodigos: 'cp850',
    qr: 'nativo',
    columnas: 32,
    probada: true,
  } as const;

  it('sin prueba dice «Impresora sin probar» en amarillo, aunque esté conectada', () => {
    expect(senalDeImpresora(undefined, 'sin_vincular')).toEqual({
      texto: 'Impresora sin configurar',
      tono: 'aviso',
    });
    expect(senalDeImpresora({ ...registro, probada: false }, 'conectada')).toEqual({
      texto: 'Impresora sin probar',
      tono: 'aviso',
    });
    expect(senalDeImpresora(registro, 'desconectada').tono).toBe('error');
    expect(senalDeImpresora(registro, 'conectada').tono).toBe('bien');
  });

  it('las entregas pendientes se cuentan', () => {
    expect(senalDePendientes(0).tono).toBe('bien');
    expect(senalDePendientes(2)).toEqual({ texto: '2 entregas pendientes', tono: 'error' });
  });

  it('el respaldo dice su fecha, y pasado un día se pide otra vez (HU-Q3.10 CA1)', () => {
    const t = Date.UTC(2026, 9, 7, 19, 5);
    expect(senalDeRespaldo(undefined, t)).toEqual({ texto: 'Respaldo sin hacer', tono: 'aviso' });
    expect(senalDeRespaldo(t, t + 3_600_000)).toEqual({
      texto: 'Respaldo: 07/10 14:05',
      tono: 'bien',
    });
    expect(senalDeRespaldo(t, t + 25 * 3_600_000).tono).toBe('aviso');
  });

  it('en iPhone lo dice desde el paso 1; sin Bluetooth no propone camino', () => {
    expect(proponerCamino({ bluetooth: true, ios: true }).camino).toBeNull();
    expect(proponerCamino({ bluetooth: false, ios: false }).camino).toBeNull();
    expect(proponerCamino({ bluetooth: true, ios: false }).camino).toBe('bluetooth');
    // HU-Q2.4 CA3: la impresora emparejada solo se ofrece con Web Serial.
    expect(proponerCamino({ bluetooth: true, serial: true, ios: false }).serial).toBe(true);
    expect(proponerCamino({ bluetooth: true, ios: false }).serial).toBe(false);
    expect(proponerCamino({ bluetooth: false, serial: true, ios: false }).camino).toBe('serial');
    expect(proponerCamino({ bluetooth: true, serial: true, ios: true }).serial).toBe(false);
  });
});

function bluetoothFalso(alEscribir: (d: Uint8Array) => void): BluetoothBle {
  const c: CaracteristicaBle = {
    uuid: 'escribir',
    properties: { write: true, writeWithoutResponse: true, notify: false },
    writeValueWithoutResponse: async (d) => alEscribir(d),
    writeValueWithResponse: async () => undefined,
  };
  const gatt: ServidorGatt = {
    connected: true,
    connect: async () => gatt,
    getPrimaryService: async () => ({ uuid: 's', getCharacteristics: async () => [c] }),
  };
  return {
    requestDevice: async () => ({
      id: 'pt',
      name: 'PT-210',
      gatt,
      addEventListener: () => undefined,
    }),
  };
}

describe('la impresora de la caja', () => {
  it('conecta, guarda la impresora sin probar e imprime con PRUEBA fuera de producción', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const escrito: number[] = [];
    const control = crearControl(db, {
      bluetooth: bluetoothFalso((d) => escrito.push(...d)),
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-1',
    });
    expect((await control.imprimir([{ tipo: 'texto', texto: 'Hola' }])).ok).toBe(false);
    await control.conectar(false);
    expect(await db.impresora.get('actual')).toMatchObject({ nombre: 'PT-210', probada: false });
    const r = await control.imprimir([{ tipo: 'texto', texto: 'Hola' }]);
    expect(r.ok).toBe(true);
    const texto = new TextDecoder('latin1').decode(Uint8Array.from(escrito));
    expect(texto).toContain('PRUEBA');
    expect(texto).toContain('Hola');
  });

  it('una impresión que falla queda en entregas pendientes con su motivo', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const control = crearControl(db, {
      bluetooth: bluetoothFalso(() => {
        throw new DOMException('apagada', 'NetworkError');
      }),
      hostname: HOST_DE_PRODUCCION,
      reloj: () => 42,
      nuevoId: () => 'id-2',
    });
    await control.conectar(false);
    const r = await control.imprimir([{ tipo: 'texto', texto: 'Hola' }]);
    expect(r).toMatchObject({ ok: false, motivo: 'fuera_de_alcance' });
    expect(await db.entregas_pendientes.toArray()).toEqual([
      expect.objectContaining({ trabajoId: 'id-2', motivo: 'fuera_de_alcance', creadaEn: 42 }),
    ]);
  });

  it('si elegir otra impresora falla, la conectada sigue y la cabecera no queda «conectando»', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const escrito: number[] = [];
    const buena = bluetoothFalso((d) => escrito.push(...d));
    // Un equipo que no es impresora: conecta, pero no tiene dónde escribir.
    const otro: ServidorGatt = {
      connected: true,
      connect: async () => otro,
      getPrimaryService: () => Promise.reject(new DOMException('no', 'NotFoundError')),
    };
    let pedidos = 0;
    const control = crearControl(db, {
      bluetooth: {
        requestDevice: (o) =>
          pedidos++ === 0
            ? buena.requestDevice(o)
            : Promise.resolve({ id: 'otro', gatt: otro, addEventListener: () => undefined }),
      },
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-3',
    });
    const estados: string[] = [];
    control.escuchar((e) => estados.push(e));
    await control.conectar(false);
    await expect(control.conectar(false)).rejects.toMatchObject({ motivo: 'sin_caracteristica' });
    expect(estados).toEqual(['conectando', 'conectada', 'conectando', 'conectada']);
    expect((await control.imprimir([{ tipo: 'texto', texto: 'Hola' }])).ok).toBe(true);
    expect(await control.reconectar()).toBe(true);
    // El diagnóstico cuenta el último intento, el que falló.
    expect(control.diagnostico()).toContain('Sin nombre (sin usar)');
  });

  it('sin impresora en esta sesión, reconectar dice que no, sin selector', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const control = crearControl(db, {
      bluetooth: bluetoothFalso(() => undefined),
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-4',
    });
    expect(await control.reconectar()).toBe(false);
    expect(control.estado()).toBe('sin_vincular');
  });
});

describe('la caja vuelve a la pantalla (bitácora parqueadero 19)', () => {
  it('reconecta lo que se soltó, y tras un bloqueo largo abre otra conexión', () => {
    expect(alVolverALaCaja('desconectada', 5_000)).toBe('reconectar');
    expect(alVolverALaCaja('conectada', 5_000)).toBe('nada');
    expect(alVolverALaCaja('conectada', MS_PARA_REFRESCAR)).toBe('refrescar');
    expect(alVolverALaCaja('desconectada', MS_PARA_REFRESCAR)).toBe('refrescar');
  });

  it('sin impresora, imprimiendo o conectando, no toca nada', () => {
    for (const e of ['sin_vincular', 'ocupada', 'conectando'] as const) {
      expect(alVolverALaCaja(e, MS_PARA_REFRESCAR * 10)).toBe('nada');
    }
  });
});

describe('la impresora emparejada (HU-Q2.4)', () => {
  /** Un puerto serie falso con el permiso que el navegador recuerda entre sesiones. */
  function serieFalsa() {
    const escrito: number[] = [];
    let abierto = false;
    let permiso = false;
    const puerto: PuertoSerie = {
      open: async () => {
        abierto = true;
      },
      close: async () => {
        abierto = false;
      },
      get writable() {
        return abierto
          ? new WritableStream<Uint8Array>({ write: (d) => void escrito.push(...d) })
          : null;
      },
      getInfo: () => ({ bluetoothServiceClassId: SERVICIO_SERIE }),
    };
    let pedidos = 0;
    const serial: SerialWeb = {
      requestPort: async () => {
        pedidos++;
        permiso = true;
        return puerto;
      },
      getPorts: async () => (permiso ? [puerto] : []),
    };
    return { serial, escrito, pedidos: () => pedidos, cerrar: () => void puerto.close() };
  }

  it('se elige una vez; al abrir otra vez la caja, vuelve sola y sin selector (CA1)', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const f = serieFalsa();
    const opciones = {
      bluetooth: undefined,
      serial: f.serial,
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-5',
    };
    const primera = crearControl(db, opciones);
    const v = await primera.conectar(false, 'serial');
    expect(v.camino).toBe('serial');
    expect(await db.impresora.get('actual')).toMatchObject({
      camino: 'serial',
      dispositivoId: `bt:${SERVICIO_SERIE}`,
    });
    f.cerrar();

    // La caja se recarga: otro control, la misma base.
    const segunda = crearControl(db, opciones);
    expect(segunda.estado()).toBe('sin_vincular');
    expect(await segunda.recuperar()).toBe(true);
    expect(segunda.estado()).toBe('conectada');
    expect((await segunda.imprimir([{ tipo: 'texto', texto: 'Hola' }])).ok).toBe(true);
    expect(f.pedidos()).toBe(1);
    expect(new TextDecoder('latin1').decode(Uint8Array.from(f.escrito))).toContain('Hola');
  });

  it('con una impresora por Bluetooth, o sin Web Serial, no recupera nada', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const bt = crearControl(db, {
      bluetooth: bluetoothFalso(() => undefined),
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-6',
    });
    await bt.conectar(false);
    const otra = crearControl(db, {
      bluetooth: undefined,
      serial: serieFalsa().serial,
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-7',
    });
    expect(await otra.recuperar()).toBe(false);
    const sinSerie = crearControl(db, {
      bluetooth: undefined,
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-8',
    });
    await expect(sinSerie.conectar(false, 'serial')).rejects.toMatchObject({
      motivo: 'no_soportado',
    });
  });
});

describe('el diagnóstico sobrevive a la recarga (bitácora parqueadero 21)', () => {
  it('al cerrar la caja se guarda, y la caja nueva lo muestra debajo del suyo', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const memoria = new Map<string, string>();
    const guardado = {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => void memoria.set(k, v),
    };
    const opciones = {
      bluetooth: bluetoothFalso(() => undefined),
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-9',
      guardado,
    };
    const primera = crearControl(db, opciones);
    await primera.conectar(false);
    primera.soltar();
    const nueva = crearControl(db, opciones);
    const d = nueva.diagnostico();
    expect(d).toContain('Impresora: sin vincular en esta sesión');
    expect(d).toContain('--- Antes de recargar la caja ---');
    expect(d).toContain('Impresora: PT-210');
  });

  it('sin almacenamiento, o si falla, la caja sigue igual', () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const c = crearControl(db, {
      bluetooth: undefined,
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-10',
      guardado: roto,
    });
    expect(() => c.soltar()).not.toThrow();
    expect(c.diagnostico()).toBe(
      'Este navegador: Bluetooth web no · impresora emparejada no\nImpresora: sin vincular en esta sesión',
    );
  });

  it('el diagnóstico dice qué caminos tiene el navegador (bitácora parqueadero 24)', () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const c = crearControl(db, {
      bluetooth: bluetoothFalso(() => undefined),
      serial: { requestPort: () => Promise.reject(new Error('no')), getPorts: async () => [] },
      hostname: 'localhost',
      reloj: () => 0,
      nuevoId: () => 'id-11',
    });
    expect(c.caminos()).toEqual({ bluetooth: true, serial: true });
    expect(c.diagnostico()).toMatch(
      /^Este navegador: Bluetooth web sí · impresora emparejada sí\n/,
    );
  });
});
