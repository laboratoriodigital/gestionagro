/**
 * Un flujo disparado por otro (`workflow_run`) corre en este repositorio con sus secretos, aunque
 * el flujo que lo disparó viniera de un PR de un fork. El filtro `branches:` mira solo el nombre de
 * la rama, y un fork puede llamar «main» a la suya. Todo trabajo de un flujo con `workflow_run`
 * exige que el disparo venga de un push a main de este mismo repositorio (revisión de seguridad,
 * 3 oct 2026).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

const dir = join(RAIZ, '.github', 'workflows');
const conWorkflowRun = readdirSync(dir)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const)
  .filter(([, t]) => /^\s+workflow_run:/m.test(t));

describe('flujos disparados por otros flujos', () => {
  it('hay al menos uno (el despliegue): la prueba no pasa en vacío', () => {
    expect(conWorkflowRun.map(([f]) => f)).toContain('desplegar.yml');
  });

  it.each(conWorkflowRun)('%s solo corre por un push a main de este repositorio', (_f, texto) => {
    expect(texto).toContain("github.event.workflow_run.event == 'push'");
    expect(texto).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(texto).toContain(
      'github.event.workflow_run.head_repository.full_name == github.repository',
    );
    expect(texto).not.toMatch(/pull_request_target/);
  });
});
