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
    const t = trabajo['timeout-minutes'];
    return typeof t === 'number' && t > 0 && t <= TIEMPO_MAXIMO_MIN
      ? []
      : [
          {
            archivo,
            motivo: `jobs.${id}: necesita «timeout-minutes» entre 1 y ${TIEMPO_MAXIMO_MIN}`,
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
