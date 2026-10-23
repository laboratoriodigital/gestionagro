/**
 * Guardias de los flujos de GitHub Actions (HU-E1.2).
 *
 * - Toda tubería con `tee` lleva `set -o pipefail` (P14).
 * - Todo secreto que nombra un flujo está listado en ARQUITECTURA §7.5 (P18).
 * - Cada trabajo tiene `timeout-minutes` de 15 o menos, y cada flujo cancela la corrida vieja
 *   de la misma rama.
 */

export interface Hallazgo {
  archivo: string;
  motivo: string;
}

interface Paso {
  name?: string;
  run?: string;
}

interface Trabajo {
  'timeout-minutes'?: unknown;
  /** Un trabajo que llama a otro flujo (workflow_call): su tiempo lo pone el flujo llamado. */
  uses?: string;
  steps?: Paso[];
}

export interface Flujo {
  name?: string;
  concurrency?: { group?: string; 'cancel-in-progress'?: unknown } | string;
  jobs?: Record<string, Trabajo>;
}

const TIEMPO_MAXIMO_MIN = 15;
/**
 * Con el repositorio público, los minutos de los equipos estándar de GitHub no se cobran: el tope de
 * 15 cuidaba los 2.000 del mes del privado, no el reloj. El 23 oct 2026 el PR #230 se cortó en 15
 * porque el espejo de Ubuntu bajó las dependencias de Playwright a 34 kB/s (11 minutos), con el
 * mismo código que el #229 verificó en 9½ (bitácora core 13). Un trabajo puede pedir más solo con
 * la forma de abajo, que vuelve a 15 o menos si el repositorio pasa a privado.
 */
const TIEMPO_MAXIMO_PUBLICO_MIN = 30;
const TIEMPO_POR_VISIBILIDAD =
  /^\$\{\{\s*github\.event\.repository\.private\s*&&\s*(\d+)\s*\|\|\s*(\d+)\s*\}\}$/;

/** Si el `timeout-minutes` de un trabajo está dentro de lo permitido. */
function tiempoValido(t: unknown): boolean {
  if (typeof t === 'number') return t > 0 && t <= TIEMPO_MAXIMO_MIN;
  const m = typeof t === 'string' ? TIEMPO_POR_VISIBILIDAD.exec(t.trim()) : null;
  if (!m) return false;
  const privado = Number(m[1]);
  const publico = Number(m[2]);
  return (
    privado > 0 &&
    privado <= TIEMPO_MAXIMO_MIN &&
    publico > 0 &&
    publico <= TIEMPO_MAXIMO_PUBLICO_MIN
  );
}

export function revisarPipefail(archivo: string, flujo: Flujo): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const [id, trabajo] of Object.entries(flujo.jobs ?? {})) {
    for (const [i, paso] of (trabajo.steps ?? []).entries()) {
      const run = paso.run ?? '';
      if (/\|\s*tee\b/.test(run) && !/set -o pipefail/.test(run)) {
        hallazgos.push({
          archivo,
          motivo: `jobs.${id}, paso «${paso.name ?? i}»: usa «| tee» sin «set -o pipefail»; una falla antes del tee pasaría en verde (P14)`,
        });
      }
    }
  }
  return hallazgos;
}

export function revisarTiempos(archivo: string, flujo: Flujo): Hallazgo[] {
  return Object.entries(flujo.jobs ?? {}).flatMap(([id, trabajo]) => {
    // GitHub no acepta «timeout-minutes» en un trabajo con «uses»: lo cuida el flujo llamado,
    // que también pasa por esta revisión.
    if (typeof trabajo.uses === 'string') return [];
    return tiempoValido(trabajo['timeout-minutes'])
      ? []
      : [
          {
            archivo,
            motivo: `jobs.${id}: necesita «timeout-minutes» entre 1 y ${TIEMPO_MAXIMO_MIN}, o «\${{ github.event.repository.private && N || M }}» con N hasta ${TIEMPO_MAXIMO_MIN} y M hasta ${TIEMPO_MAXIMO_PUBLICO_MIN}`,
          },
        ];
  });
}

/**
 * CI: cancela la corrida vieja de la misma rama (ahorra minutos).
 * Despliegue (flujos «desplegar…») y registros de datos del dueño («registrar…», HU-C5.8): NUNCA
 * cancela uno a medias; los encola en un solo grupo.
 */
export function revisarConcurrencia(archivo: string, flujo: Flujo): Hallazgo[] {
  const c = flujo.concurrency;
  const noSeCorta = /^(desplegar|registrar)/.test(flujo.name ?? '');
  if (typeof c !== 'object') {
    return [{ archivo, motivo: 'falta «concurrency»' }];
  }
  if (noSeCorta) {
    return c['cancel-in-progress'] === false && c.group
      ? []
      : [
          {
            archivo,
            motivo:
              'un flujo de despliegue o de registro necesita «concurrency» con grupo y «cancel-in-progress: false»: cancelar a medias deja celdas a medio desplegar o un registro a medio escribir',
          },
        ];
  }
  return c['cancel-in-progress'] === true && /github\.ref/.test(c.group ?? '')
    ? []
    : [
        {
          archivo,
          motivo: 'falta «concurrency» por rama (github.ref) con «cancel-in-progress: true»',
        },
      ];
}

/** Ninguna entrada de usuario se interpola dentro de un `run`: va por `env` (inyección de comandos). */
export function revisarInyeccion(archivo: string, flujo: Flujo): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const [id, trabajo] of Object.entries(flujo.jobs ?? {})) {
    for (const [i, paso] of (trabajo.steps ?? []).entries()) {
      if (
        /\$\{\{\s*(inputs\.|github\.event\.(issue|pull_request|comment|head_commit|release)\.)/.test(
          paso.run ?? '',
        )
      ) {
        hallazgos.push({
          archivo,
          motivo: `jobs.${id}, paso «${paso.name ?? i}»: interpola una entrada en el comando; pásala por env`,
        });
      }
    }
  }
  return hallazgos;
}

/** Secretos que nombra el texto de un flujo, sin el que da GitHub. */
export function secretosNombrados(texto: string): string[] {
  const nombres = new Set<string>();
  for (const m of texto.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (m[1] && m[1] !== 'GITHUB_TOKEN') nombres.add(m[1]);
  }
  return [...nombres].sort();
}

/** Nombres en `MAYUSCULAS` entre comillas invertidas dentro de ARQUITECTURA §7.5. */
export function secretosDocumentados(arquitectura: string): string[] {
  const inicio = arquitectura.indexOf('### 7.5 Secretos');
  if (inicio < 0) throw new Error('ARQUITECTURA.md no tiene la sección «### 7.5 Secretos»');
  const fin = arquitectura.indexOf('\n## ', inicio);
  const seccion = arquitectura.slice(inicio, fin < 0 ? undefined : fin);
  return [...new Set([...seccion.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1] ?? ''))].sort();
}

export function revisarSecretos(
  archivo: string,
  texto: string,
  documentados: readonly string[],
): Hallazgo[] {
  return secretosNombrados(texto)
    .filter((s) => !documentados.includes(s))
    .map((s) => ({
      archivo,
      motivo: `usa el secreto «${s}», que no está listado en ARQUITECTURA §7.5 (P18)`,
    }));
}
