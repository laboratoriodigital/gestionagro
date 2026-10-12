/**
 * HU-C8.4: `security.txt` (RFC 9116) en los dos dominios, y ningún catálogo de API vacío.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIAS_DE_VIGENCIA, securityTxt } from '../../apps/core/src/security-txt.ts';
import { crearApp } from '../../apps/core/src/worker.ts';
import politicaDeLaCuenta from '../../content/cuenta/privacidad/politica.json' with {
  type: 'json',
};
import { RAIZ } from '../../scripts/lib/repo.ts';

const AHORA = Date.UTC(2026, 9, 12, 15, 30);
const DIA = 24 * 60 * 60 * 1000;

describe('HU-C8.4 · security.txt', () => {
  it('CA1 · contacto, vencimiento a menos de un año, idiomas y dirección canónica', () => {
    const texto = securityTxt({
      correo: 'seguridad@example.com',
      canonical: 'https://x.example/.well-known/security.txt',
      ahora: AHORA,
    });
    expect(texto).toBe(
      'Contact: mailto:seguridad@example.com\nExpires: 2027-04-10T00:00:00Z\nPreferred-Languages: es, en\nCanonical: https://x.example/.well-known/security.txt\n',
    );
    const expira = Date.parse(texto.match(/^Expires: (.+)$/m)?.[1] ?? '');
    expect(expira - AHORA).toBeLessThan(365 * DIA);
    expect(expira - AHORA).toBeGreaterThan((DIAS_DE_VIGENCIA - 1) * DIA);
  });

  it('el mismo día da el mismo archivo, a cualquier hora', () => {
    const a = securityTxt({ correo: 'c@example.com', canonical: 'x', ahora: AHORA });
    const b = securityTxt({ correo: 'c@example.com', canonical: 'x', ahora: AHORA + 8 * 3600_000 });
    expect(a).toBe(b);
  });

  it('CA1 · el CORE lo sirve con el correo de la política de la cuenta y su propio dominio', async () => {
    const r = await crearApp({ ahora: () => AHORA }).fetch(
      new Request('https://cuenta.laboratorio-digital.com/.well-known/security.txt'),
      {} as never,
    );
    expect(r.status).toBe(200);
    const texto = await r.text();
    expect(texto).toContain(`Contact: mailto:${politicaDeLaCuenta.responsable.correo}`);
    expect(texto).toContain(
      'Canonical: https://cuenta.laboratorio-digital.com/.well-known/security.txt',
    );
  });

  it('CA2 ❌ · ningún catálogo de API se publica: no hay una API pública para terceros (P1)', async () => {
    const r = await crearApp().fetch(
      new Request('https://cuenta.laboratorio-digital.com/.well-known/api-catalog'),
      {} as never,
    );
    expect(r.status).toBe(404);
    expect(existsSync(join(RAIZ, 'apps', 'sitio', 'public', '.well-known', 'api-catalog'))).toBe(
      false,
    );
  });
});
