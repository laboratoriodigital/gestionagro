/**
 * `/.well-known/security.txt` (RFC 9116, HU-C8.4, PLATAFORMA §5.3 7): a quién escribirle si se
 * encuentra un fallo. La usan el CORE (`cuenta.laboratorio-digital.com`) y el sitio
 * (`cultivopro.co`), cada uno con el correo del responsable de su política de datos (P2).
 *
 * `Expires` es obligatorio y debe ser menor de un año: se pone a 180 días del día en que se arma
 * (el sitio) o se pide (el CORE), contado desde el comienzo del día, para que no cambie en cada
 * solicitud del mismo día.
 */
const DIA_MS = 24 * 60 * 60 * 1000;
export const DIAS_DE_VIGENCIA = 180;

export function securityTxt(datos: { correo: string; canonical: string; ahora: number }): string {
  const hoy = Math.floor(datos.ahora / DIA_MS) * DIA_MS;
  const expira = new Date(hoy + DIAS_DE_VIGENCIA * DIA_MS).toISOString().replace('.000Z', 'Z');
  return [
    `Contact: mailto:${datos.correo}`,
    `Expires: ${expira}`,
    'Preferred-Languages: es, en',
    `Canonical: ${datos.canonical}`,
    '',
  ].join('\n');
}
