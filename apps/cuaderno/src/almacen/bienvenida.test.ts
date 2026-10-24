/**
 * La bienvenida del cuaderno (HU-E0.10) sobre fake-indexeddb: cuándo se muestra y que «empezar sin
 * cuenta» se recuerda en el teléfono.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { saludo } from '../vistas/Bienvenida.tsx';
import { empezarSinCuenta, leerEstadoDeEntrada, mostrarBienvenida } from './bienvenida.ts';
import { abrirCuaderno } from './db.ts';
import { guardarCodigo } from './invitacion.ts';
import { CLAVE_SESION } from './sesion.ts';

const telefono = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
const ninguna = () => [];
const nada = {
  hayFinca: false,
  haySesion: false,
  hayInvitacion: false,
  hayOtrasFincas: false,
  empezoSinCuenta: false,
};

describe('mostrarBienvenida', () => {
  it('se muestra solo en un teléfono sin finca, sin cuenta y sin invitación', () => {
    expect(mostrarBienvenida(nada)).toBe(true);
  });

  it('❌ no se muestra si hay a dónde ir: finca, sesión, invitación, otra finca o ya empezó', () => {
    for (const clave of [
      'hayFinca',
      'haySesion',
      'hayInvitacion',
      'hayOtrasFincas',
      'empezoSinCuenta',
    ] as const) {
      expect(mostrarBienvenida({ ...nada, [clave]: true }), clave).toBe(false);
    }
  });
});

describe('estado de entrada en el teléfono', () => {
  it('un teléfono nuevo no tiene nada, y «empezar sin cuenta» se recuerda', async () => {
    const db = telefono();
    expect(await leerEstadoDeEntrada(db, ninguna)).toEqual({
      haySesion: false,
      hayInvitacion: false,
      hayOtrasFincas: false,
      empezoSinCuenta: false,
    });
    await empezarSinCuenta(db);
    expect((await leerEstadoDeEntrada(db, ninguna)).empezoSinCuenta).toBe(true);
  });

  it('lee la sesión, la invitación pendiente y si hay otra finca en el teléfono', async () => {
    const db = telefono();
    await db.meta.put({ clave: CLAVE_SESION, valor: { acceso: 'a' }, actualizado: '' });
    await guardarCodigo(db, 'codigo-de-ensayo');
    const otra = () => [{ base: 'gestionagro-cuaderno', nombre: 'Finca Ensayo Uno', org_id: null }];
    expect(await leerEstadoDeEntrada(db, otra)).toMatchObject({
      haySesion: true,
      hayInvitacion: true,
      hayOtrasFincas: true,
    });
  });
});

describe('saludo', () => {
  it('cambia con la hora del teléfono', () => {
    expect(saludo(4)).toBe('Buenas noches');
    expect(saludo(5)).toBe('Buenos días');
    expect(saludo(11)).toBe('Buenos días');
    expect(saludo(12)).toBe('Buenas tardes');
    expect(saludo(18)).toBe('Buenas tardes');
    expect(saludo(19)).toBe('Buenas noches');
  });
});
