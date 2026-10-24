import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';
import {
  buscarEnTexto,
  type ListaDeTerminos,
  validarLista,
} from '../../scripts/lib/terminos-prohibidos.ts';
import { FINCA_ENSAYO_DOS, FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';

// Lista inventada para probar el buscador sin escribir aquí ningún nombre real.
const LISTA_DE_PRUEBA: ListaDeTerminos = {
  terminos: [
    { tipo: 'nombre', valor: 'Juana Pérez' },
    { tipo: 'nombre-propio', valor: 'Primavera' },
  ],
};
const buscar = (texto: string) => buscarEnTexto('x.ts', texto, LISTA_DE_PRUEBA);

describe('buscador de términos prohibidos', () => {
  it.each([
    ['const dueña = "Juana Pérez";'],
    ['juana perez registró el riego'],
    ['JUANA   PÉREZ'],
    ['la finca Primavera tiene 4 naves'],
    ['nombre: Primavera'],
    ["nombre: 'Primavera'"],
  ])('atrapa «%s»', (texto) => {
    expect(buscar(texto)).toHaveLength(1);
  });

  it.each([
    ['Juana Pérezova no es la misma persona'],
    ['la primavera trae más humedad'],
    ['Primavera y otoño son épocas de siembra.'],
    ['Llegó la lluvia. Primavera temprana en la sabana.'],
    ['# Primavera'],
    ['- Primavera en la sabana'],
  ])('deja pasar «%s»', (texto) => {
    expect(buscar(texto)).toEqual([]);
  });

  it('dice el archivo y la línea', () => {
    expect(buscarEnTexto('a/b.md', 'uno\ndos Juana Pérez', LISTA_DE_PRUEBA)).toEqual([
      { archivo: 'a/b.md', linea: 2, termino: 'Juana Pérez' },
    ]);
  });

  it('rechaza una lista vacía: vacía no protege nada (P1)', () => {
    expect(() => validarLista({ terminos: [] })).toThrow(/vacía/);
    expect(() => validarLista({})).toThrow(/vacía/);
    expect(() => validarLista({ terminos: [{ tipo: 'nombre', valor: ' ' }] })).toThrow(/inválido/);
  });
});

describe('las dos fincas de prueba (ARQUITECTURA §10)', () => {
  it('son distintas en cultivo, tipo de área y régimen', () => {
    expect(FINCA_ENSAYO_UNO.finca.nombre).toBe('Finca Ensayo Uno');
    expect(FINCA_ENSAYO_UNO.finca.regimen).toBe('ecologico');
    expect(FINCA_ENSAYO_UNO.areas.filter((a) => a.tipo === 'nave')).toHaveLength(3);
    expect(FINCA_ENSAYO_DOS.finca.nombre).toBe('Finca Ensayo Dos');
    expect(FINCA_ENSAYO_DOS.finca.regimen).toBe('convencional');
    // Tres bloques: lo que cabe en el plan Gratis (HU-E0.13).
    expect(FINCA_ENSAYO_DOS.areas.filter((a) => a.tipo === 'bloque')).toHaveLength(3);
    expect(FINCA_ENSAYO_DOS.cultivo.unidad_cosecha).toBe('tallos');
  });

  it('no comparten ids', () => {
    const ids = (f: typeof FINCA_ENSAYO_UNO) => [
      f.finca.id,
      ...f.areas.map((a) => a.id),
      ...f.personas.map((p) => p.id),
    ];
    const todos = [...ids(FINCA_ENSAYO_UNO), ...ids(FINCA_ENSAYO_DOS)];
    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe('ningún término prohibido en el repositorio (P4, HU-E1.7)', () => {
  // Antes de publicar el repositorio, la lista sale de él y se pasa por esta variable.
  const rutaEnv = process.env['TERMINOS_PROHIBIDOS_RUTA'];
  const rutaLista = rutaEnv
    ? isAbsolute(rutaEnv)
      ? rutaEnv
      : join(RAIZ, rutaEnv)
    : join(RAIZ, 'tests', 'terminos-prohibidos.json');
  const lista = validarLista(JSON.parse(readFileSync(rutaLista, 'utf8')));

  const CARPETAS = [
    'apps/',
    'packages/',
    'content/',
    'schemas/',
    'infrastructure/',
    'scripts/',
    'tests/',
  ];
  const EXTENSIONES =
    /\.(ts|tsx|js|mjs|cjs|json|ya?ml|md|mdx|astro|html|css|sql|toml|txt|csv|grit)$/;
  const archivos = listarArchivos(
    (rel) =>
      CARPETAS.some((c) => rel.startsWith(c)) &&
      EXTENSIONES.test(rel) &&
      rel !== 'tests/terminos-prohibidos.json',
  );

  it('revisa un número razonable de archivos', () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  // Lee todo el repositorio: con la suite entera en paralelo pasó de los 5 s por defecto.
  it('no aparece ninguno', { timeout: 30_000 }, () => {
    const coincidencias = archivos.flatMap((archivo) =>
      buscarEnTexto(archivo, readFileSync(join(RAIZ, archivo), 'utf8'), lista),
    );
    expect(coincidencias).toEqual([]);
  });
});
