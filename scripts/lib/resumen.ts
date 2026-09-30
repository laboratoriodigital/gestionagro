/** Resultado de un paso de verificación. */
export interface ResultadoPaso {
  paso: string;
  ok: boolean;
  segundos: number;
  /** El paso no corrió porque uno anterior del que depende falló. */
  omitido?: boolean;
  /** Salida del paso (stdout y stderr), para citar la falla en el resumen de CI. */
  salida?: string;
}

const LINEAS_DE_DETALLE = 40;

// biome-ignore lint/suspicious/noControlCharactersInRegex: quita los códigos de color ANSI
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** Últimas líneas útiles de la salida de un paso, sin colores. */
export function colaDeSalida(salida: string, lineas = LINEAS_DE_DETALLE): string {
  const limpias = salida.replace(ANSI, '').replace(/\r/g, '').trimEnd().split('\n');
  return limpias.slice(-lineas).join('\n');
}

/**
 * Resumen con TODAS las fallas, no solo la primera (P15).
 * Devuelve Markdown para que sirva igual en la consola y en `$GITHUB_STEP_SUMMARY`.
 * Con `detalle`, cada paso fallido lleva debajo las últimas líneas de su salida.
 */
export function resumir(resultados: readonly ResultadoPaso[], { detalle = false } = {}): string {
  const icono = (r: ResultadoPaso) => (r.ok ? '✅' : r.omitido ? '⏭️' : '❌');
  const filas = resultados.map(
    (r) => `| ${icono(r)} | ${r.paso} | ${r.omitido ? 'omitido' : `${r.segundos.toFixed(1)} s`} |`,
  );
  const fallas = resultados.filter((r) => !r.ok && !r.omitido).map((r) => r.paso);
  const omitidos = resultados.filter((r) => r.omitido).map((r) => r.paso);
  const cierre =
    fallas.length === 0 && omitidos.length === 0
      ? 'Todo en verde.'
      : [
          `Fallaron ${fallas.length} de ${resultados.length}: ${fallas.join(', ')}.`,
          omitidos.length > 0 ? `Sin correr por esa falla: ${omitidos.join(', ')}.` : '',
          'Sin esto en verde no se marca como terminado.',
        ]
          .filter(Boolean)
          .join(' ');
  const detalles = detalle
    ? resultados
        .filter((r) => !r.ok && !r.omitido)
        .map(
          (r) =>
            `\n<details open><summary>❌ ${r.paso}</summary>\n\n\`\`\`text\n${colaDeSalida(r.salida ?? '(sin salida)')}\n\`\`\`\n</details>`,
        )
    : [];
  return ['| | Paso | Tiempo |', '|---|---|---|', ...filas, '', cierre, ...detalles].join('\n');
}
