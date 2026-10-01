/**
 * Personas (HU-E3.5) e insumos (HU-E3.6) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeValidacion } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import {
  avisoEcologico,
  crearInsumo,
  editarInsumo,
  leerInsumos,
  plazo,
  TEXTO_ETIQUETA,
} from './insumos.ts';
import {
  crearPersona,
  definirJornal,
  editarPersona,
  jornalVigente,
  leerPersonas,
} from './personas.ts';

const campos = (e: unknown) =>
  e instanceof ErrorDeValidacion
    ? e.campos.map((c) => c.campo)
    : [`(no es ErrorDeValidacion: ${String(e)})`];

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [{ tipo: 'nave', nombre: 'Área 1', area_m2: 100, capacidad_plantas: null }],
    );
    return { db, finca };
  }

  describe('personas (HU-E3.5)', () => {
    it('CA1: nombre y rol; el jornal va aparte y rige desde su fecha', async () => {
      const { db, finca } = await preparar();
      const [p] = f.personas;
      if (!p) throw new Error('sin personas');
      const persona = await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol });
      expect(persona).not.toHaveProperty('valor_cop');
      await definirJornal(db, persona.id, 60_000, '2026-10-01');
      await definirJornal(db, persona.id, 65_000, '2027-01-01');
      expect((await jornalVigente(db, persona.id, '2026-12-31'))?.valor_cop).toBe(60_000);
      expect((await jornalVigente(db, persona.id, '2027-01-01'))?.valor_cop).toBe(65_000);
      expect(await jornalVigente(db, persona.id, '2026-09-30')).toBeUndefined();
    });

    it('CA2: no se guarda cédula ni teléfono', async () => {
      const { db, finca } = await preparar();
      const intento = {
        nombre: 'Persona Ensayo',
        rol: 'operario',
        cedula: '123',
        telefono: '300',
      } as unknown as Parameters<typeof crearPersona>[2];
      expect(campos(await crearPersona(db, finca.id, intento).catch((e: unknown) => e))).toEqual([
        '(registro)',
      ]);
      expect(await db.persona.count()).toBe(0);
    });

    it('CA3: una persona inactiva sale de los formularios y conserva su historial', async () => {
      const { db, finca } = await preparar();
      const creadas = [];
      for (const p of f.personas)
        creadas.push(await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol }));
      const primera = creadas[0];
      if (!primera) throw new Error('sin personas');
      await editarPersona(db, primera.id, { activa: false });
      expect((await leerPersonas(db, finca.id)).map((p) => p.id)).not.toContain(primera.id);
      expect(
        (await leerPersonas(db, finca.id, { incluirInactivas: true })).map((p) => p.id),
      ).toContain(primera.id);
      expect(await db.historial.where('entidad_id').equals(primera.id).count()).toBe(1);
    });

    it('un jornal de 0 o con decimales no se guarda', async () => {
      const { db, finca } = await preparar();
      const persona = await crearPersona(db, finca.id, {
        nombre: 'Persona Ensayo',
        rol: 'operario',
      });
      expect(
        campos(await definirJornal(db, persona.id, 0, '2026-10-01').catch((e: unknown) => e)),
      ).toEqual(['valor_cop']);
      expect(
        campos(await definirJornal(db, persona.id, 1500.5, '2026-10-01').catch((e: unknown) => e)),
      ).toEqual(['valor_cop']);
    });
  });

  describe('insumos (HU-E3.6)', () => {
    it('CA1: guarda los datos de la etiqueta tal como se escriben', async () => {
      const { db, finca } = await preparar();
      for (const i of f.insumos) await crearInsumo(db, finca.id, i);
      const leidos = await leerInsumos(db, finca.id);
      expect(leidos.map((i) => i.nombre_comercial)).toEqual(
        f.insumos.map((i) => i.nombre_comercial).sort(),
      );
      for (const i of f.insumos) {
        expect(leidos.find((x) => x.nombre_comercial === i.nombre_comercial)).toMatchObject(i);
      }
    });

    it('CA4: carencia vacía es «desconocida», no cero', async () => {
      expect(plazo(null, 'días')).toEqual({ conocido: false, texto: 'desconocida' });
      expect(plazo(0, 'días')).toEqual({ conocido: true, texto: '0 días' });
      expect(plazo(1, 'días').texto).toBe('1 día');
      expect(plazo(12, 'horas').texto).toBe('12 horas');
    });

    it('editar un insumo guarda la versión anterior', async () => {
      const { db, finca } = await preparar();
      const i = f.insumos[0];
      if (!i) throw new Error('sin insumos');
      const creado = await crearInsumo(db, finca.id, i);
      const editado = await editarInsumo(db, creado.id, { carencia_dias: 5 });
      expect(editado).toMatchObject({ version: 2, carencia_dias: 5 });
      expect(await db.historial.where('entidad_id').equals(creado.id).count()).toBe(1);
    });

    it('una carencia negativa o con decimales no se guarda', async () => {
      const { db, finca } = await preparar();
      const i = f.insumos[0];
      if (!i) throw new Error('sin insumos');
      expect(
        campos(
          await crearInsumo(db, finca.id, { ...i, carencia_dias: -1 }).catch((e: unknown) => e),
        ),
      ).toEqual(['carencia_dias']);
      expect(
        campos(
          await crearInsumo(db, finca.id, { ...i, reentrada_horas: 1.5 }).catch((e: unknown) => e),
        ),
      ).toEqual(['reentrada_horas']);
    });
  });
});

describe('aviso ecológico (HU-E3.6, CA3)', () => {
  it('solo en finca ecológica, y nunca para un insumo marcado como permitido', () => {
    expect(avisoEcologico({ regimen: 'ecologico' }, { permitido_ecologico: true })).toBeNull();
    expect(avisoEcologico({ regimen: 'ecologico' }, { permitido_ecologico: null })).toMatch(
      /No está marcado como permitido/,
    );
    expect(avisoEcologico({ regimen: 'ecologico' }, { permitido_ecologico: false })).toMatch(
      /NO permitido/,
    );
    expect(avisoEcologico({ regimen: 'convencional' }, { permitido_ecologico: false })).toBeNull();
  });

  it('avisa sin bloquear: el texto lo dice', () => {
    expect(avisoEcologico({ regimen: 'ecologico' }, { permitido_ecologico: null })).toContain(
      'no lo bloquea',
    );
  });

  it('CA2: el texto legal dice de dónde salen los datos y que no se recomiendan productos ni dosis', () => {
    expect(TEXTO_ETIQUETA).toContain('etiqueta del producto registrado ante el ICA');
    expect(TEXTO_ETIQUETA).toContain('no recomienda productos ni dosis');
  });
});
