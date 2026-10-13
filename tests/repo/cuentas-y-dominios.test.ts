/**
 * HU-C1.3: la cuenta y los dominios del ecosistema, declarados (PLATAFORMA §3.4–§3.5).
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import {
  fallasDeCuentas,
  fallasDeDominios,
  nombresApp,
  nombresAppDeWorkers,
  reservadosDeLaTienda,
} from '../../scripts/lib/cuentas-y-dominios.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const texto = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');
const cuentasReales = () => texto('infrastructure/cuentas.json');
const dominiosReales = () => JSON.parse(texto('infrastructure/dominios.json'));
const deLasCeldas = () => cargarCeldas().celdas.map((c) => c.cuenta);

describe('cuentas.json', () => {
  it('es válido y cada celda vive en una cuenta declarada', () => {
    expect(fallasDeCuentas(cuentasReales(), deLasCeldas())).toEqual([]);
  });

  it('rechaza una celda en una cuenta que nadie declaró', () => {
    expect(fallasDeCuentas(cuentasReales(), ['ED1 principal', 'Otra cuenta'])).toEqual([
      'una celda vive en «Otra cuenta», que no está declarada',
    ]);
  });

  it('rechaza una celda en una cuenta que está fuera de la plataforma', () => {
    expect(fallasDeCuentas(cuentasReales(), ['Gratuita del dueño'])).toEqual([
      'una celda vive en «Gratuita del dueño», que está fuera de la plataforma',
    ]);
  });

  it('rechaza un identificador de cuenta, esté donde esté (P13)', () => {
    const conId = cuentasReales().replace(
      '"plan": "free"',
      '"plan": "free", "nota_id": "0123456789abcdef0123456789abcdef"',
    );
    expect(fallasDeCuentas(conId, deLasCeldas())).toEqual([
      'cuentas.json lleva algo con forma de identificador de cuenta: va en los secretos (P13)',
    ]);
  });

  it('rechaza un plan que no existe', () => {
    const malo = cuentasReales().replace('"plan": "free"', '"plan": "enterprise"');
    expect(fallasDeCuentas(malo, deLasCeldas()).length).toBeGreaterThan(0);
  });
});

describe('dominios.json', () => {
  it('es válido: los tres dominios en la cuenta declarada, y ningún Worker usa un nombre sin reservar', () => {
    expect(
      fallasDeDominios(
        dominiosReales(),
        ['ED1 principal'],
        nombresAppDeWorkers(),
        reservadosDeLaTienda(),
      ),
    ).toEqual([]);
    expect(dominiosReales().dominios.map((d: { dominio: string }) => d.dominio)).toEqual([
      'laboratorio-digital.com',
      'laboratorio-digital.app',
      'cultivopro.co',
    ]);
  });

  it('un Worker que usa un nombre de .app sin reservar falla nombrando el archivo (control negativo de CA3)', () => {
    const usados = [
      { archivo: 'apps/demo/wrangler.jsonc', nombre: 'demo' },
      { archivo: 'apps/demo/wrangler.jsonc', nombre: 'cultivopro--staging' },
    ];
    expect(fallasDeDominios(dominiosReales(), ['ED1 principal'], usados, [])).toEqual([
      'apps/demo/wrangler.jsonc usa «demo.laboratorio-digital.app», que no está reservado: una tienda podría tomarlo',
    ]);
  });

  it('acepta un nombre que la Tienda reserva como infraestructura (panel, img, mcp…)', () => {
    const usados = [{ archivo: 'apps/tienda-panel/wrangler.jsonc', nombre: 'panel' }];
    expect(fallasDeDominios(dominiosReales(), ['ED1 principal'], usados, ['panel'])).toEqual([]);
  });

  it('rechaza un nombre reservado dos veces, aquí o con la Tienda (P2)', () => {
    const d = dominiosReales();
    d.reservados_app.proyecto = ['cultivopro', 'panel'];
    expect(fallasDeDominios(d, ['ED1 principal'], [], ['panel'])).toEqual([
      '«cultivopro» está reservado como proyecto y como marca: un nombre, un motivo',
      '«panel» ya lo reserva la base de control de la Tienda: no se declara dos veces (P2)',
    ]);
  });

  it('rechaza «--» en un nombre: queda para la plataforma (staging)', () => {
    const d = dominiosReales();
    d.reservados_app.proyecto = ['mi--proyecto'];
    expect(fallasDeDominios(d, ['ED1 principal'], [], []).length).toBeGreaterThan(0);
  });

  it('rechaza un dominio en una cuenta no declarada', () => {
    expect(fallasDeDominios(dominiosReales(), ['Otra'], [], [])).toContain(
      '«cultivopro.co» vive en «ED1 principal», que no está en cuentas.json',
    );
  });
});

describe('los instrumentos', () => {
  it('encuentra los nombres de .app en una configuración, incluido el de staging', () => {
    expect(
      nombresApp(
        '"routes": ["panel.laboratorio-digital.app/*", "x--staging.laboratorio-digital.app"]',
      ),
    ).toEqual(['panel', 'x--staging']);
  });

  it('lee los reservados de la migración de la base de control cuando existe', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'reservados-'));
    const dir = join(raiz, 'infrastructure', 'migraciones', 'tienda-control');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, '0001.sql'),
      texto('infrastructure/migraciones/tienda-control/0001_control_v1.sql'),
    );
    const reservados = reservadosDeLaTienda(raiz);
    expect(reservados).toContain('panel');
    expect(reservados).toContain('cuenta');
    expect(reservados).not.toContain('proyecto');
  });

  it('sin la migración de la Tienda (antes de su M0), no inventa reservados', () => {
    expect(reservadosDeLaTienda(mkdtempSync(join(tmpdir(), 'sin-')))).toEqual([]);
  });
});
