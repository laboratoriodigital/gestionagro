import { describe, expect, it } from 'vitest';
import {
  AJUSTE_ENSAYO,
  DISPOSITIVO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
} from './ensayos.fixture.ts';
import type { Registro } from './registro.ts';
import {
  ACCIONES_DE_SEDE,
  alcance,
  decidirEscritura,
  ENTIDADES_DE_CATALOGO,
  MATRIZ,
  MINUTOS_PARA_ANULAR_LO_SUYO,
  type OperacionValida,
  ROLES,
  TABLA,
  validarOperacion,
} from './sync.ts';

/**
 * La matriz entera contra lo que decidirá la celda (HU-Q7.8, CA3): cada rol con cada catálogo y
 * cada tipo de registro, más las dos reglas de §11.2 que la matriz sola no dice.
 */

const CAJERA = '0199bc3e-3b40-7000-8000-00000000a001';
const OTRO = '0199bc3e-3b40-7000-8000-00000000a002';
const ADMIN = '0199bc3e-3b40-7000-8000-00000000a003';

const op = (entidad: string, datos: { id: string; version?: number }): OperacionValida => {
  const r = validarOperacion({
    id: datos.version ? `${datos.id}@v${datos.version}` : datos.id,
    entidad,
    entidad_id: datos.id,
    version: datos.version ?? 1,
    datos,
  });
  if (!r.ok) throw new Error(r.motivo);
  return r.op;
};

const minutosDespues = (instante: string, minutos: number) =>
  new Date(Date.parse(instante) + minutos * 60_000).toISOString();

const entradaDe = (autor: string | null): Registro => ({
  ...ENTRADA_ENSAYO,
  autor_usuario_id: autor,
});

const anulacion = (autor: string | null, minutos: number): OperacionValida =>
  op('registro', {
    ...ENTRADA_ENSAYO,
    id: '0199bc3e-3b40-7000-8000-000000000201',
    tipo: 'anulacion',
    instante_evento: minutosDespues(ENTRADA_ENSAYO.instante_evento, minutos),
    autor_usuario_id: autor,
    anula_id: ENTRADA_ENSAYO.id,
    serie: null,
    consecutivo: null,
    datos: { motivo: 'Placa mal escrita', operador: 'Ana' },
  } as Registro);

const copia = (autor: string | null, esCopia: boolean): OperacionValida =>
  op('registro', {
    ...ENTRADA_ENSAYO,
    id: '0199bc3e-3b40-7000-8000-000000000301',
    tipo: 'entrega_recibo',
    autor_usuario_id: autor,
    dispositivo_id: DISPOSITIVO,
    estadia_id: ENTRADA_ENSAYO.id,
    serie: null,
    consecutivo: null,
    datos: { recibo_id: ENTRADA_ENSAYO.id, canal: 'papel', copia: esCopia },
  } as Registro);

const CATALOGOS = {
  sede: SEDE_ENSAYO_UNO,
  tarifa: TARIFA_CARRO,
  ajuste_recibo: AJUSTE_ENSAYO,
} as const;

describe('la matriz del parqueadero (HU-Q7.8)', () => {
  it('cada catálogo que viaja por la sincronización es un ajuste: lo escribe quien administra', () => {
    const administran = ROLES.filter((r) => alcance(r, 'ajustes') === 'si');
    expect(administran).toEqual(['propietario', 'administrador']);
    for (const e of ENTIDADES_DE_CATALOGO) {
      expect(MATRIZ[e].escribir, e).toEqual(administran);
      expect(MATRIZ[e].leer, e).toEqual(ROLES);
    }
    expect(Object.keys(TABLA).sort()).toEqual(Object.keys(ACCIONES_DE_SEDE).sort());
  });

  it('decide cada catálogo según la fila «Tarifas, datos legales, textos del recibo»', () => {
    for (const rol of ROLES) {
      for (const [entidad, datos] of Object.entries(CATALOGOS)) {
        const d = decidirEscritura({ rol, usuario_id: ADMIN }, op(entidad, datos));
        expect(d.ok, `${rol} escribe ${entidad}`).toBe(alcance(rol, 'ajustes') === 'si');
      }
    }
  });

  it('un cajero que cambia una tarifa directo contra la API recibe un no con su motivo (CA3)', () => {
    const d = decidirEscritura({ rol: 'cajero', usuario_id: CAJERA }, op('tarifa', TARIFA_CARRO));
    expect(d).toEqual({
      ok: false,
      motivo:
        'Con el rol de cajero no se pueden cambiar las tarifas. Pídaselo a quien administra el parqueadero.',
    });
  });

  it('todos registran entradas, salidas y copias con su usuario', () => {
    for (const rol of ROLES) {
      const quien = { rol, usuario_id: CAJERA };
      expect(decidirEscritura(quien, op('registro', ENTRADA_ENSAYO)).ok).toBe(true);
      expect(decidirEscritura(quien, op('registro', SALIDA_ENSAYO)).ok).toBe(true);
      expect(decidirEscritura(quien, copia(CAJERA, true)).ok).toBe(true);
    }
  });

  it('un rol que no está en la matriz no escribe nada', () => {
    const quien = { rol: 'operario', usuario_id: CAJERA };
    expect(decidirEscritura(quien, op('registro', ENTRADA_ENSAYO)).ok).toBe(false);
    expect(decidirEscritura(quien, op('sede', SEDE_ENSAYO_UNO)).ok).toBe(false);
    expect(decidirEscritura(quien, anulacion(CAJERA, 1), entradaDe(CAJERA)).ok).toBe(false);
  });
});

describe('anular (PARQUEADERO §11.2)', () => {
  const cajera = { rol: 'cajero', usuario_id: CAJERA };

  it('la cajera anula lo suyo dentro de los primeros minutos', () => {
    const d = decidirEscritura(
      cajera,
      anulacion(CAJERA, MINUTOS_PARA_ANULAR_LO_SUYO),
      entradaDe(CAJERA),
    );
    expect(d).toEqual({ ok: true });
  });

  it('pasado ese tiempo, ya no: lo anula quien administra', () => {
    const tarde = anulacion(CAJERA, MINUTOS_PARA_ANULAR_LO_SUYO + 1);
    const d = decidirEscritura(cajera, tarde, entradaDe(CAJERA));
    expect(d.ok).toBe(false);
    expect(d.ok || d.motivo).toMatch(/Pasaron más de 10 minutos/);
    expect(
      decidirEscritura({ rol: 'administrador', usuario_id: ADMIN }, tarde, entradaDe(CAJERA)),
    ).toEqual({ ok: true });
  });

  it('no anula lo de otro cajero, ni lo que la celda no conoce', () => {
    const d = decidirEscritura(cajera, anulacion(CAJERA, 1), entradaDe(OTRO));
    expect(d.ok || d.motivo).toBe('Con el rol de cajero solo se anula un recibo propio.');
    expect(decidirEscritura(cajera, anulacion(CAJERA, 1), null).ok).toBe(false);
    // Un recibo de M0, sin usuario, no es de nadie: lo anula quien administra.
    expect(decidirEscritura(cajera, anulacion(CAJERA, 1), entradaDe(null)).ok).toBe(false);
  });

  it('propietario y administrador anulan cualquiera, a cualquier hora', () => {
    for (const rol of ['propietario', 'administrador']) {
      const d = decidirEscritura(
        { rol, usuario_id: ADMIN },
        anulacion(ADMIN, 600),
        entradaDe(OTRO),
      );
      expect(d).toEqual({ ok: true });
    }
  });
});

describe('reimprimir (PARQUEADERO §11.2)', () => {
  it('una copia sin usuario no se acepta; una entrega de M0 sin usuario, sí', () => {
    const quien = { rol: 'cajero', usuario_id: CAJERA };
    expect(decidirEscritura(quien, copia(null, true))).toEqual({
      ok: false,
      motivo: 'Una copia queda registrada con el usuario que la imprimió.',
    });
    expect(decidirEscritura(quien, copia(null, false))).toEqual({ ok: true });
  });
});
