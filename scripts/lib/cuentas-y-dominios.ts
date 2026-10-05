/**
 * `infrastructure/cuentas.json` y `infrastructure/dominios.json` (HU-C1.3, PLATAFORMA §3.4–§3.5).
 *
 * - Toda celda nombra una cuenta declarada, y ninguna cuenta lleva su identificador (P13).
 * - Todo hostname de `laboratorio-digital.app` que use un Worker del repositorio está declarado:
 *   como proyecto o marca aquí, o como infraestructura en la base de control de la Tienda.
 *   Así, el día que un despliegue use un nombre, una tienda no lo puede tener ya (PLATAFORMA §3.4).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { listarArchivos, RAIZ } from './repo.ts';

export const DOMINIO_APP = 'laboratorio-digital.app';

export interface Cuentas {
  cuentas: { nombre: string; plan: 'free' | 'paid' }[];
  fuera_de_la_plataforma: { nombre: string }[];
}

export interface Dominios {
  dominios: { dominio: string; cuenta: string; zona_activa: boolean }[];
  reservados_app: { proyecto: string[]; marca: string[] };
}

const leerJson = (ruta: string) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));

function fallasDeEsquema(esquema: string, datos: unknown): string[] {
  const validar = new Ajv2020({ allErrors: true, strict: true }).compile(leerJson(esquema));
  return validar(datos)
    ? []
    : (validar.errors ?? []).map((e) => `${e.instancePath || '(raíz)'} ${e.message}`);
}

/** Algo con forma de identificador de cuenta de Cloudflare: 32 caracteres hexadecimales. */
const ID_DE_CUENTA = /\b[0-9a-f]{32}\b/i;

export function fallasDeCuentas(texto: string, cuentasDeLasCeldas: readonly string[]): string[] {
  if (ID_DE_CUENTA.test(texto)) {
    return [
      'cuentas.json lleva algo con forma de identificador de cuenta: va en los secretos (P13)',
    ];
  }
  const datos = JSON.parse(texto) as Cuentas;
  const fallas = fallasDeEsquema('schemas/cuentas.schema.json', datos);
  if (fallas.length > 0) return fallas;
  const nombres = [...datos.cuentas, ...datos.fuera_de_la_plataforma].map((c) => c.nombre);
  for (const n of new Set(nombres.filter((x, i) => nombres.indexOf(x) !== i))) {
    fallas.push(`la cuenta «${n}» está dos veces`);
  }
  const fuera = new Set(datos.fuera_de_la_plataforma.map((c) => c.nombre));
  const declaradas = new Set(datos.cuentas.map((c) => c.nombre));
  for (const c of new Set(cuentasDeLasCeldas)) {
    if (fuera.has(c)) fallas.push(`una celda vive en «${c}», que está fuera de la plataforma`);
    else if (!declaradas.has(c)) fallas.push(`una celda vive en «${c}», que no está declarada`);
  }
  return fallas;
}

/**
 * Los nombres que siembra la base de control de la Tienda (infraestructura y suplantación),
 * leídos de su migración cuando exista en `infrastructure/migraciones/tienda-control/` (M0).
 */
export function reservadosDeLaTienda(raiz = RAIZ): string[] {
  const dir = join(raiz, 'infrastructure', 'migraciones', 'tienda-control');
  if (!existsSync(dir)) return [];
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  return [...sql.matchAll(/\('([a-z0-9-]+)',\s*'(?:infraestructura|suplantacion)'\)/g)].map(
    (m) => m[1] as string,
  );
}

/** Primer nivel de cada hostname de `laboratorio-digital.app` en un texto. */
export function nombresApp(texto: string): string[] {
  const patron = /([a-z0-9-]+)\.laboratorio-digital\.app/g;
  return [...texto.matchAll(patron)].map((m) => m[1] as string);
}

/** Los nombres de `.app` que usan las configuraciones de Worker del repositorio. */
export function nombresAppDeWorkers(): { archivo: string; nombre: string }[] {
  return listarArchivos((r) => /^apps\/.+\/wrangler[^/]*\.jsonc?$/.test(r)).flatMap((archivo) =>
    nombresApp(readFileSync(join(RAIZ, archivo), 'utf8')).map((nombre) => ({ archivo, nombre })),
  );
}

export function fallasDeDominios(
  datos: unknown,
  cuentasDeclaradas: readonly string[],
  usados: readonly { archivo: string; nombre: string }[],
  deLaTienda: readonly string[],
): string[] {
  const fallas = fallasDeEsquema('schemas/dominios.schema.json', datos);
  if (fallas.length > 0) return fallas;
  const d = datos as Dominios;
  for (const dom of d.dominios) {
    if (!cuentasDeclaradas.includes(dom.cuenta)) {
      fallas.push(`«${dom.dominio}» vive en «${dom.cuenta}», que no está en cuentas.json`);
    }
  }
  const { proyecto, marca } = d.reservados_app;
  for (const n of proyecto.filter((p) => marca.includes(p))) {
    fallas.push(`«${n}» está reservado como proyecto y como marca: un nombre, un motivo`);
  }
  for (const n of [...proyecto, ...marca].filter((p) => deLaTienda.includes(p))) {
    fallas.push(
      `«${n}» ya lo reserva la base de control de la Tienda: no se declara dos veces (P2)`,
    );
  }
  const declarados = new Set([...proyecto, ...marca, ...deLaTienda]);
  for (const { archivo, nombre } of usados) {
    // `<nombre>--staging` es el mismo nombre en staging (PLATAFORMA §3.4).
    const base = nombre.replace(/--staging$/, '');
    if (!declarados.has(base)) {
      fallas.push(
        `${archivo} usa «${nombre}.${DOMINIO_APP}», que no está reservado: una tienda podría tomarlo`,
      );
    }
  }
  return fallas;
}
