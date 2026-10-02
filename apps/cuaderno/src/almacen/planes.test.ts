/**
 * La página de planes (HU-E0.6) dice la verdad: lo que promete cada plan coincide con lo que el
 * código limita por plan, y los precios son los del Estudio de mercado (CA2, P2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import configFotos from '../../../../content/agro/cuaderno/fotos.json' with { type: 'json' };
import { funcionActiva } from './funciones.ts';
import { AVISO_PRECIO, CON_ESPERA, PLANES } from './planes.ts';

const incluye = (plan: string, texto: string) =>
  (PLANES.find((p) => p.id === plan)?.incluye ?? []).some((x) => x.includes(texto));
/** Lo propio del plan, sin «Todo lo del plan …». */
const propio = (plan: string, texto: string) =>
  (PLANES.find((p) => p.id === plan)?.incluye ?? []).some(
    (x) => x.includes(texto) && !x.startsWith('Todo lo del plan'),
  );

describe('planes con precio visible (HU-E0.6)', () => {
  it('los cuatro planes de la escalera, y la lista de espera solo para los pagos', () => {
    expect(PLANES.map((p) => p.id)).toEqual(['gratuito', 'finca', 'exportador', 'cadena']);
    expect([...CON_ESPERA].sort()).toEqual(['cadena', 'exportador', 'finca']);
  });

  it('CA2: el precio se marca como tentativo y dice que hoy no se cobra', () => {
    expect(AVISO_PRECIO).toContain('Precio de lanzamiento tentativo');
    expect(AVISO_PRECIO).toContain('no se cobra nada');
  });

  it('CA2: cada precio es el de «Precios propuestos» del Estudio de mercado', () => {
    const estudio = readFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        '..',
        'docs',
        'Estudio de mercado software para invernaderos y agricultura.md',
      ),
      'utf8',
    );
    const precios = estudio.slice(estudio.indexOf('### Precios propuestos'));
    for (const p of PLANES) {
      const fila = precios
        .split('\n')
        .find((l) => l.startsWith(`| ${p.nombre} |`))
        ?.replace(/–/g, ' a ');
      expect(fila, `el Estudio no tiene la fila «${p.nombre}»`).toBeTruthy();
      for (const cifra of p.precio.match(/\d[\d.]*/g) ?? []) expect(fila).toContain(cifra);
    }
  });

  it('lo que dice cada plan coincide con lo que el código limita (funciones.json y fotos.json)', () => {
    // Fotos: solo en los planes con cuota.
    expect(incluye('gratuito', 'Fotos')).toBe(configFotos.por_plan.gratuito > 0);
    expect(propio('finca', 'Fotos')).toBe(configFotos.por_plan.finca > 0);
    // Rendimiento por persona: es del Exportador.
    expect(propio('exportador', 'Rendimiento por persona')).toBe(
      funcionActiva('rendimiento_operario', 'exportador'),
    );
    expect(incluye('finca', 'Rendimiento por persona')).toBe(
      funcionActiva('rendimiento_operario', 'finca'),
    );
    // Calendario de carencias: hoy gratis.
    expect(incluye('gratuito', 'Calendario de carencias')).toBe(
      funcionActiva('calendario_carencias', 'gratuito'),
    );
  });
});
