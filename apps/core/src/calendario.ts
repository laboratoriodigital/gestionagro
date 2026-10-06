/**
 * Meses calendario en la fecha de Bogotá (HU-C5.1, PLATAFORMA §4.8). Quien paga 12 meses recibe 12
 * meses, no 360 días: un plan pagado el 31 de enero vence el 28 (o 29) de febrero, no el 2 de marzo.
 *
 * Colombia está en UTC−5 todo el año, sin horario de verano: el desfase es fijo y no se le pregunta
 * al sistema. Solo se usan los métodos UTC de `Date`: el resultado es el mismo en un servidor de
 * Cloudflare, en Windows o en una máquina en Kiritimati (UTC+14). Lo prueba una batería que corre
 * también con `TZ=Pacific/Kiritimati` (bitácora ecommerce, patrón 8).
 */
const BOGOTA_MS = -5 * 60 * 60 * 1000;

/** Los días de un mes (0 = enero), sin preguntarle a la zona del sistema. */
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

/**
 * `n` meses después de `desde` (ms), contados en la fecha de Bogotá y con la misma hora. Si ese día
 * no existe en el mes de llegada, el último día de ese mes.
 */
export function sumarMeses(desde: number, n: number): number {
  const local = new Date(desde + BOGOTA_MS);
  const total = local.getUTCFullYear() * 12 + local.getUTCMonth() + n;
  const anio = Math.floor(total / 12);
  const mes = total - anio * 12;
  const dia = Math.min(local.getUTCDate(), diasDelMes(anio, mes));
  const llegada = Date.UTC(
    anio,
    mes,
    dia,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return llegada - BOGOTA_MS;
}
