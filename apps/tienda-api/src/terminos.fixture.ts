/**
 * Para las pruebas que publican o cobran por la API del panel: la tienda ya aceptó los términos
 * vigentes (HU-T7.2) y la custodia de sus llaves (HU-T11.2), como lo haría su propietario. Las que
 * prueban la aceptación misma no lo usan.
 */
import type { BaseD1 } from '@ed1/d1';
import { textosVigentes } from './terminos.ts';

export async function conTerminosAceptados(
  db: BaseD1,
  orgs: readonly string[],
  instante: string,
): Promise<void> {
  const v = await textosVigentes();
  for (const org of orgs) {
    await db
      .prepare(
        `UPDATE tienda SET terminos_huella = ?, terminos_aceptados = ?, terminos_por = 'usuario:prueba',
           custodia_huella = ?, custodia_aceptada = ?, custodia_por = 'usuario:prueba' WHERE org_id = ?`,
      )
      .bind(v.terminos.huella, instante, v.custodia.huella, instante, org)
      .run();
  }
}
