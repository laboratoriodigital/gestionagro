import 'fake-indexeddb/auto';
import type { BluetoothBle, CaracteristicaBle, ServidorGatt } from '@ed1/impresion';
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
