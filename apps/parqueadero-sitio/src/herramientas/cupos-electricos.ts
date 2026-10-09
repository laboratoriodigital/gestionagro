/**
 * Los cupos para vehículos eléctricos (HU-Q11.7) en el navegador: el porcentaje mínimo de la ley
 * sobre los cupos del parqueadero, redondeado hacia arriba para no quedar por debajo. La norma y su
 * fecha de consulta viven en `content/parqueadero/cupos-electricos.json` (P18); la página pasa el
 * porcentaje en `data-porcentaje`, y este código no carga el texto del sitio.
 *
 * Eventos (HU-Q11.5 CA2, `@ed1/eventos`): `tool.opened` al abrir, `tool.completed` con el primer
 * cálculo y `tool.next_step` al ir a la caja, en un lote a `/_m`.
 */
import { type Colector, crearColector, entornoDelNavegador } from '@ed1/eventos';

const CUPOS_MAXIMOS = 100_000;

export interface CuposElectricos {
  /** El porcentaje de los cupos, en centésimas de cupo: 120 cupos al 2 % son 240 (2,4 cupos). */
  readonly centesimas: number;
  /** Los cupos que pide la ley: la cuenta hacia arriba. */
  readonly cupos: number;
}

/** Los cupos para eléctricos de un parqueadero; `null` si los cupos no son un entero legible. */
export function cuposElectricos(cupos: number, porcentaje: number): CuposElectricos | null {
  if (!Number.isSafeInteger(cupos) || cupos < 1 || cupos > CUPOS_MAXIMOS) return null;
  const centesimas = cupos * porcentaje;
  return { centesimas, cupos: Math.ceil(centesimas / 100) };
}

/** `2,4` o `3`: centésimas con coma decimal y sin ceros de más. */
export function conComa(centesimas: number): string {
  const enteros = Math.floor(centesimas / 100);
  const resto = String(centesimas % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return resto ? `${enteros},${resto}` : String(enteros);
}

/** Lo que se le dice al parqueadero, según si su municipio está obligado. */
export function respuesta(
  c: CuposElectricos,
  cupos: number,
  porcentaje: number,
  municipio: string,
): { readonly titular: string; readonly detalle: string } {
  const plural = (n: number) => (n === 1 ? '1 cupo' : `${n} cupos`);
  const cuenta =
    c.centesimas % 100 === 0
      ? `El ${porcentaje} % de ${plural(cupos)} es ${conComa(c.centesimas)}.`
      : `El ${porcentaje} % de ${plural(cupos)} es ${conComa(c.centesimas)}: se redondea hacia arriba, a ${c.cupos}.`;
  if (municipio === 'no') {
    return {
      titular: 'La ley no se lo exige en su municipio',
      detalle: `La obligación es para los municipios de categoría especial, primera y segunda. Si quiere ofrecerlos, ${plural(c.cupos)} cumplirían el mismo mínimo. ${cuenta}`,
    };
  }
  const titular = `${plural(c.cupos)} para vehículos eléctricos, como mínimo`;
  return municipio === 'si'
    ? { titular, detalle: cuenta }
    : {
        titular,
        detalle: `${cuenta} Aplica si su municipio es de categoría especial, primera o segunda: su alcaldía le dice la categoría.`,
      };
}

const leerCupos = (texto: string): number => {
  const limpio = texto.trim().replaceAll('.', '');
  return /^\d{1,6}$/.test(limpio) ? Number(limpio) : Number.NaN;
};

export function iniciarCupos(documento: Document): Colector {
  const $id = <T extends HTMLElement>(id: string) => documento.getElementById(id) as T;
  const form = $id<HTMLFormElement>('cupos-electricos');
  const colector = crearColector({
    producto: form.dataset['producto'] ?? '',
    endpoint: '/_m',
    entorno: entornoDelNavegador(),
  });
  colector.registrar('tool.opened');
  const porcentaje = Number(form.dataset['porcentaje']);
  const campo = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement;
  const resultado = $id<HTMLElement>('resultado');
  const faltan = $id<HTMLElement>('faltan');
  let calculos = 0;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cupos = leerCupos(campo('cupos').value);
    const c = cuposElectricos(cupos, porcentaje);
    if (!c) {
      faltan.textContent = 'Escriba cuántos cupos tiene su parqueadero, por ejemplo 120.';
      faltan.hidden = false;
      resultado.hidden = true;
      return;
    }
    faltan.hidden = true;
    const r = respuesta(c, cupos, porcentaje, campo('municipio').value);
    $id('titulo-resultado').textContent = r.titular;
    $id('detalle-cupos').textContent = r.detalle;
    resultado.hidden = false;
    if (calculos++ === 0) colector.registrar('tool.completed');
    $id<HTMLElement>('titulo-resultado').focus();
  });

  $id<HTMLAnchorElement>('ir-a-la-caja').addEventListener('click', () =>
    colector.registrar('tool.next_step'),
  );
  return colector;
}
