/**
 * Días hábiles de Colombia (HU-T1.2). Una sola fuente para la Tienda (plazos de las solicitudes,
 * TIENDA-3.0 §8.6) y para el CORE (Ley 1581, HU-C7.7): P2.
 *
 * Las fechas son civiles de Bogotá, como texto `AAAA-MM-DD`, y todo se calcula en UTC: el huso
 * de la máquina no cambia nada (P8). Colombia está en UTC−5 todo el año.
 *
 * Los festivos (Ley 51 de 1983, «Ley Emiliani»):
 * - fijos: 1 de enero, 1 de mayo, 20 de julio, 7 de agosto, 8 y 25 de diciembre;
 * - corridos al lunes siguiente si no caen en lunes: Reyes (6 ene), San José (19 mar), San Pedro y
 *   San Pablo (29 jun), Asunción (15 ago), Día de la Raza (12 oct), Todos los Santos (1 nov) e
 *   Independencia de Cartagena (11 nov);
 * - de la Pascua: Jueves y Viernes Santos, y Ascensión (+43), Corpus Christi (+64) y Sagrado
 *   Corazón (+71), que ya caen en lunes.
 */

/** Años con festivos calculados. Fuera de ellos se lanza: la ley puede cambiar (P1). */
export const RANGO = { desde: 2020, hasta: 2040 } as const;

const DIA_MS = 86_400_000;
const BOGOTA_MS = -5 * 3_600_000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

function aUtc(fecha: string): number {
  const m = FORMATO.exec(fecha);
  if (!m) throw new RangeError(`Fecha inválida, se espera AAAA-MM-DD: ${JSON.stringify(fecha)}`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(a, mes - 1, d);
  if (aTexto(t) !== fecha) throw new RangeError(`Esa fecha no existe: ${fecha}`);
  return t;
}

function aTexto(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** La fecha civil de Bogotá de un instante (milisegundos Unix). */
export function fechaEnBogota(instanteMs: number): string {
  if (!Number.isFinite(instanteMs)) throw new RangeError(`Instante inválido: ${instanteMs}`);
  return aTexto(instanteMs + BOGOTA_MS);
}

/** Domingo de Pascua (algoritmo gregoriano anónimo, Meeus/Jones/Butcher), en UTC. */
export function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return aTexto(Date.UTC(anio, mes - 1, dia));
}

function alLunes(t: number): number {
  const dia = new Date(t).getUTCDay(); // 0 domingo … 6 sábado
  return dia === 1 ? t : t + ((8 - dia) % 7) * DIA_MS;
}

const cache = new Map<number, ReadonlySet<string>>();

/**
 * Los festivos del año, ordenados y sin repetir: 18, o 17 cuando dos caen el mismo lunes (en 2030,
 * Sagrado Corazón y San Pedro y San Pablo).
 */
export function festivosDe(anio: number): string[] {
  return [...conjuntoDe(anio)].sort();
}

function conjuntoDe(anio: number): ReadonlySet<string> {
  if (!Number.isInteger(anio) || anio < RANGO.desde || anio > RANGO.hasta) {
    throw new RangeError(
      `No hay festivos calculados para ${anio} (de ${RANGO.desde} a ${RANGO.hasta}): revisar la ley antes de ampliar`,
    );
  }
  const guardado = cache.get(anio);
  if (guardado) return guardado;
  const f = (mes: number, dia: number) => Date.UTC(anio, mes - 1, dia);
  const pascua = aUtc(domingoDePascua(anio));
  const dias = [
    f(1, 1),
    f(5, 1),
    f(7, 20),
    f(8, 7),
    f(12, 8),
    f(12, 25),
    ...[f(1, 6), f(3, 19), f(6, 29), f(8, 15), f(10, 12), f(11, 1), f(11, 11)].map(alLunes),
    pascua - 3 * DIA_MS,
    pascua - 2 * DIA_MS,
    pascua + 43 * DIA_MS,
    pascua + 64 * DIA_MS,
    pascua + 71 * DIA_MS,
  ];
  const conjunto = new Set(dias.map(aTexto));
  cache.set(anio, conjunto);
  return conjunto;
}

export function esFestivo(fecha: string): boolean {
  aUtc(fecha);
  return conjuntoDe(Number(fecha.slice(0, 4))).has(fecha);
}

/** Lunes a viernes que no es festivo. */
export function esHabil(fecha: string): boolean {
  const dia = new Date(aUtc(fecha)).getUTCDay();
  return dia !== 0 && dia !== 6 && !esFestivo(fecha);
}

/** La fecha `n` días calendario después. */
export function sumarDiasCalendario(fecha: string, n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Días inválidos: ${n}`);
  return aTexto(aUtc(fecha) + n * DIA_MS);
}

/**
 * El `n`-ésimo día hábil después de `fecha` (sin contarla). Con `n = 0`, la misma fecha. Es como
 * se cuenta un plazo «de 15 días hábiles» desde el día en que se radica.
 */
export function sumarDiasHabiles(fecha: string, n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`Días inválidos: ${n}`);
  let t = aUtc(fecha);
  let faltan = n;
  while (faltan > 0) {
    t += DIA_MS;
    if (esHabil(aTexto(t))) faltan--;
  }
  return aTexto(t);
}

/** Días hábiles que hay después de `desde` hasta `hasta`, incluida `hasta` (0 si no es posterior). */
export function diasHabilesEntre(desde: string, hasta: string): number {
  let t = aUtc(desde);
  const fin = aUtc(hasta);
  let n = 0;
  while (t < fin) {
    t += DIA_MS;
    if (esHabil(aTexto(t))) n++;
  }
  return n;
}
