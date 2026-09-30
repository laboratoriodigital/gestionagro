import { describe, expect, it } from 'vitest';
import { revisarLicencias } from '../../scripts/lib/licencias.ts';

const pkg = (name: string) => [{ name, versions: ['1.0.0'] }];

describe('licencias de las dependencias (HU-E1.2)', () => {
  it('acepta licencias permisivas y alternativas con OR', () => {
    expect(
      revisarLicencias({
        MIT: pkg('a'),
        'Apache-2.0': pkg('b'),
        'MIT OR Apache-2.0': pkg('c'),
        'MPL-2.0': pkg('d'),
        '(MIT OR AGPL-3.0-only)': pkg('e'),
      }),
    ).toEqual([]);
  });

  // Control negativo: cada caso prohibido nombra el paquete.
  it.each([
    ['AGPL-3.0-only', 'licencia AGPL'],
    ['AGPL-3.0-or-later', 'licencia AGPL'],
    ['MIT AND AGPL-3.0', 'licencia AGPL'],
    ['Unknown', 'sin licencia declarada'],
    ['', 'sin licencia declarada'],
    ['UNLICENSED', 'sin licencia declarada'],
  ])('rechaza «%s»', (licencia, motivo) => {
    expect(revisarLicencias({ [licencia]: pkg('malo') })).toEqual([
      expect.objectContaining({ paquete: 'malo@1.0.0', motivo }),
    ]);
  });
});
