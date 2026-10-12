/**
 * `node scripts/verificar-agentes.ts <url>`: las comprobaciones de lo legible por agentes contra un
 * sitio desplegado (HU-C8.5). Sin URL, contra staging. Lo esperado sale del repositorio y del build
 * de `apps/sitio/dist`, así que conviene correrlo después de `pnpm build`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { SITIO } from '../apps/sitio/src/lib/seo.ts';
import { cargarCeldas } from './lib/celdas.ts';
import { RAIZ } from './lib/repo.ts';
import {
  esperadoDelRepositorio,
  informeDeAgentes,
  verificarAgentes,
} from './lib/verificar-agentes.ts';

const base = process.argv[2] ?? cargarCeldas().sitio.url_staging;
const leer = (ruta: string) => (existsSync(ruta) ? readFileSync(ruta, 'utf8') : null);
const informe = await verificarAgentes(fetch, base, esperadoDelRepositorio(RAIZ, SITIO, leer));
console.log(`Lo legible por agentes en ${base}:\n${informeDeAgentes(informe).join('\n')}`);
process.exit(informe.fallas.length > 0 ? 1 : 0);
