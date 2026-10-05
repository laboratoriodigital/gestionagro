/**
 * Convención de commits y PR (HU-C0.2, BACKLOG_CORE §2.2): `tipo(alcance): descripción`, en
 * español, de 72 caracteres o menos, y **sin la marca de Claude Code** en ninguna parte (pedido
 * del dueño, 5 oct 2026). Una regla escrita sin guardia se incumple el día que llega la prisa
 * (bitácora agro 5); esta es la guardia.
 *
 * Solo mira los commits del PR, nunca la historia vieja: los de antes del 5 oct 2026 tienen
 * otros alcances (`feat(HU-E1.1)`) y la marca, y marcarlos sería un rojo que no significa nada
 * (P19).
 */

export const TIPOS = [
  'feat',
  'fix',
  'docs',
  'refactor',
  'test',
  'ci',
  'build',
  'perf',
  'chore',
  'revert',
] as const;

export const LARGO_MAXIMO = 72;

const ASUNTO = new RegExp(`^(${TIPOS.join('|')})(\\(([a-z0-9][a-z0-9.-]*)\\))?(!)?: (\\S.*)$`);

/** Los commits de fusión que hace git o GitHub no siguen la convención, y no tienen por qué. */
const FUSION =
  /^Merge (pull request #\d+ from |branch '|remote-tracking branch '|[0-9a-f]{7,40} into )/;

/** La marca de Claude Code en sus tres formas, en el cuerpo de un commit o de un PR. */
const MARCA = [
  { patron: /Co-Authored-By:\s*Claude/i, nombre: 'Co-Authored-By: Claude' },
  { patron: /Claude-Session:/i, nombre: 'Claude-Session' },
  { patron: /Generated with \[?Claude Code/i, nombre: '«Generated with Claude Code»' },
];

/** Fallas del asunto (primera línea) de un commit o del título de un PR. */
export function fallasDelAsunto(asunto: string): string[] {
  if (FUSION.test(asunto)) return [];
  const fallas: string[] = [];
  const m = ASUNTO.exec(asunto);
  if (!m) {
    fallas.push(
      `no sigue «tipo(alcance): descripción» con un tipo de ${TIPOS.join(', ')}; el alcance va en minúsculas`,
    );
  } else if (m[5]?.endsWith('.')) {
    fallas.push('la descripción termina en punto');
  }
  if ([...asunto].length > LARGO_MAXIMO) {
    fallas.push(`tiene ${[...asunto].length} caracteres; el tope es ${LARGO_MAXIMO}`);
  }
  return fallas;
}

/** Fallas por la marca de Claude Code en un texto completo (cuerpo de commit o de PR). */
export function fallasDeMarca(texto: string): string[] {
  return MARCA.filter((m) => m.patron.test(texto)).map(
    (m) => `lleva la marca de Claude Code (${m.nombre})`,
  );
}

export interface Commit {
  sha: string;
  mensaje: string;
}

export interface Hallazgo {
  donde: string;
  falla: string;
}

/** Revisa los commits del PR y, si viene, su título y su descripción. */
export function revisar(
  commits: readonly Commit[],
  pr?: { titulo: string; cuerpo: string },
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const c of commits) {
    const asunto = c.mensaje.split(/\r?\n/)[0] ?? '';
    const donde = `commit ${c.sha.slice(0, 7)} «${asunto}»`;
    for (const falla of [...fallasDelAsunto(asunto), ...fallasDeMarca(c.mensaje)]) {
      hallazgos.push({ donde, falla });
    }
  }
  if (pr) {
    for (const falla of fallasDelAsunto(pr.titulo)) {
      hallazgos.push({ donde: `título del PR «${pr.titulo}»`, falla });
    }
    for (const falla of fallasDeMarca(pr.cuerpo)) {
      hallazgos.push({ donde: 'descripción del PR', falla });
    }
  }
  return hallazgos;
}

/** Separadores de `git log --format=%H%x1f%B%x1e`: unidad (sha | mensaje) y registro. */
export function leerLog(salida: string): Commit[] {
  return salida
    .split('\x1e')
    .map((r) => r.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((r) => {
      const [sha = '', mensaje = ''] = r.split('\x1f');
      return { sha: sha.trim(), mensaje: mensaje.trim() };
    });
}
