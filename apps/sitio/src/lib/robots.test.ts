/**
 * HU-C8.1: el robots.txt sale de content/agentes.json. Cada agente de la lista está en su grupo, con
 * lo que su señal permite, y lo cerrado sigue cerrado para todos.
 */
import { describe, expect, it } from 'vitest';
import agentes from '../../../../content/agentes.json' with { type: 'json' };
import { type Agentes, robotsTxt } from './robots.ts';

const lista = agentes as Agentes;
const grupoDe = (texto: string, agente: string) =>
  texto.split('\n\n').find((g) => g.split('\n').includes(`User-agent: ${agente}`)) ?? '';

describe('HU-C8.1 · robots.txt de agentes y señales', () => {
  const texto = robotsTxt(lista, 'https://cultivopro.co');

  it('CA1 · cada agente de la lista está, con lo que su señal permite', () => {
    for (const familia of lista.familias) {
      const permitido = lista.content_signal[familia.segun] === 'yes';
      for (const agente of familia.agentes) {
        const grupo = grupoDe(texto, agente);
        expect(grupo, agente).toContain(permitido ? 'Allow: /' : 'Disallow: /');
        if (permitido) {
          expect(grupo).toContain('Disallow: /api/');
          expect(grupo).toContain('Disallow: /agro/app/');
        }
      }
    }
  });

  it('CA1 · con ai-train=no, quien entrena no lee nada; los buscadores sí', () => {
    expect(grupoDe(texto, 'GPTBot').split('\n').slice(-1)).toEqual(['Disallow: /']);
    expect(grupoDe(texto, 'OAI-SearchBot')).toContain('Allow: /');
  });

  it('CA1 · al final, todos con lo cerrado y la Content-Signal, y el sitemap', () => {
    const grupos = texto.trimEnd().split('\n\n');
    expect(grupos.at(-2)).toBe(
      '# Todos los demás\nUser-agent: *\nDisallow: /api/\nDisallow: /agro/app/\nContent-Signal: search=yes, ai-input=yes, ai-train=no',
    );
    expect(grupos.at(-1)).toBe('Sitemap: https://cultivopro.co/sitemap.xml');
  });

  it('cambiar la decisión es un dato: con ai-train=yes, el entrenamiento lee lo público', () => {
    const otro = robotsTxt(
      { ...lista, content_signal: { ...lista.content_signal, 'ai-train': 'yes' } },
      'https://cultivopro.co',
    );
    expect(grupoDe(otro, 'CCBot')).toContain('Allow: /');
    expect(grupoDe(otro, 'CCBot')).toContain('Disallow: /api/');
  });
});
