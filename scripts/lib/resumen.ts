/** Resultado de un paso de verificación. */
export interface ResultadoPaso {
  paso: string;
  ok: boolean;
  segundos: number;
}

/**
 * Resumen con TODAS las fallas, no solo la primera (P15).
 * Devuelve Markdown para que sirva igual en la consola y en `$GITHUB_STEP_SUMMARY`.
 */
export function resumir(resultados: readonly ResultadoPaso[]): string {
  const filas = resultados.map(
    (r) => `| ${r.ok ? '✅' : '❌'} | ${r.paso} | ${r.segundos.toFixed(1)} s |`,
  );
  const fallas = resultados.filter((r) => !r.ok).map((r) => r.paso);
  const cierre =
    fallas.length === 0
      ? 'Todo en verde.'
      : `Fallaron ${fallas.length} de ${resultados.length}: ${fallas.join(', ')}. Sin esto en verde no se marca como terminado.`;
  return ['| | Paso | Tiempo |', '|---|---|---|', ...filas, '', cierre].join('\n');
}
