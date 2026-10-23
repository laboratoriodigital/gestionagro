/**
 * Solo para pruebas (HU-C4.5 CA3): firma un token v1, el formato retirado, para comprobar que todo
 * verificador lo rechaza. Ninguna app lo importa: lo exige `tests/repo/tokens-v1-retirados.test.ts`.
 */
import { DURACION_ACCESO_MS, EMISOR_V1, type Firmante, firmarReclamos } from './index.ts';

export async function firmarTokenV1DePrueba(
  firmante: Firmante,
  datos: {
    sub: string;
    org: string | null;
    rol: string | null;
    celda: string | null;
    shard: string | null;
    anillo: number | null;
  },
  ahoraMs: number,
): Promise<string> {
  const iat = Math.floor(ahoraMs / 1000);
  return firmarReclamos(firmante, {
    iss: EMISOR_V1,
    iat,
    exp: iat + DURACION_ACCESO_MS / 1000,
    ...datos,
  });
}
