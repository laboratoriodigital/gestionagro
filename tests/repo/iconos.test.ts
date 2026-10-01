import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARPETA_ICONOS, generar, ICONOS } from '../../scripts/generar-iconos.ts';

describe('íconos del cuaderno (HU-E3.1, CA4)', () => {
  it('los del repositorio son exactamente los que genera el script (P2)', () => {
    for (const [archivo, datos] of generar()) {
      const enRepo = readFileSync(join(CARPETA_ICONOS, archivo));
      expect(enRepo.equals(datos), `${archivo}: corre «node scripts/generar-iconos.ts»`).toBe(true);
    }
  });

  it.each(ICONOS)('$archivo es un PNG de $lado×$lado', ({ archivo, lado }) => {
    const png = readFileSync(join(CARPETA_ICONOS, archivo));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([lado, lado]);
  });
});
