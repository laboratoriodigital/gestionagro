/**
 * `node scripts/tienda/hornear-ensayo.ts`: hornea a Comercio Ensayo Uno (HU-T2.6) en
 * `apps/tienda-sitio/.ensayo/`, con los archivos comunes de la vitrina en `/_t/<release>/`, para
 * que las e2e de la Tienda lo sirvan con `scripts/servir-estatico.ts` (HU-T5.2 y HU-T5.4). Es la
 * misma tienda que el despacho sirve desde R2, sin el despacho: las e2e miden lo que ve el
 * comprador (el diseño, el carrito, sin JavaScript), no el Worker, que tiene sus propias pruebas.
 *
 * Lo corre el `build` de `apps/tienda-sitio`. La carpeta no va a git.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hornear } from '../../packages/tienda-horno/src/index.ts';
import {
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
} from '../../packages/tienda-schema/src/ensayos.ts';
import { archivosDeLaVitrina } from '../armar-vitrina.ts';
import { RAIZ } from '../lib/repo.ts';

export const DIR_ENSAYO = join(RAIZ, 'apps', 'tienda-sitio', '.ensayo');

export async function hornearEnsayo(): Promise<Map<string, string | Buffer>> {
  const { release, archivos: comunes } = archivosDeLaVitrina();
  const apariencia = ENSAYO_UNO.ajustes['apariencia'] as unknown as Parameters<
    typeof hornear
  >[0]['apariencia'];
  const horneados = await hornear({
    dominio: hostDeStaging(ENSAYO_UNO.slug),
    release,
    nombre: ENSAYO_UNO.nombre,
    frase: ENSAYO_UNO.ajustes['identidad']?.['frase'] as string,
    whatsapp: ENSAYO_UNO.ajustes['contacto']?.['whatsapp'] as string,
    apariencia,
    agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
    legal: legalDeEnsayo(ENSAYO_UNO),
    productos: ENSAYO_UNO.productos.map((p) => ({
      slug: p.slug,
      nombre: p.nombre,
      opciones: p.opciones,
      variantes: p.variantes,
      actualizado: '2026-10-14T15:00:00.000Z',
      retracto:
        p.retracto === 'aplica' ? { aplica: true } : { aplica: false, motivo: p.retracto.motivo },
    })),
    colecciones: [{ slug: 'lino', nombre: 'Lino', productos: ['camisa-de-lino'] }],
  });
  const salida = new Map<string, string | Buffer>();
  for (const [ruta, a] of horneados) salida.set(ruta.slice(1), a.contenido);
  for (const [ruta, contenido] of comunes) salida.set(`_t/${release}/${ruta}`, contenido);
  return salida;
}

if (process.argv[1]?.endsWith('hornear-ensayo.ts')) {
  const archivos = await hornearEnsayo();
  rmSync(DIR_ENSAYO, { recursive: true, force: true });
  for (const [ruta, contenido] of archivos) {
    const destino = join(DIR_ENSAYO, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  console.log(`✅ Ensayo Uno horneado en apps/tienda-sitio/.ensayo (${archivos.size} archivos)`);
}
