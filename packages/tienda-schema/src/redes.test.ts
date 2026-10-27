import { describe, expect, it } from 'vitest';
import { validarSeccion } from './index.ts';
import { enlaceDeRed } from './redes.ts';

describe('HU-P4.3 · las redes sociales de la tienda', () => {
  it.each([
    ['instagram', '@lino.taller', 'https://www.instagram.com/lino.taller'],
    ['instagram', 'lino_taller', 'https://www.instagram.com/lino_taller'],
    [
      'instagram',
      'https://www.instagram.com/lino.taller/',
      'https://www.instagram.com/lino.taller',
    ],
    ['instagram', 'instagram.com/lino.taller?igsh=abc', 'https://www.instagram.com/lino.taller'],
    ['tiktok', '@linotaller', 'https://www.tiktok.com/@linotaller'],
    ['tiktok', 'https://www.tiktok.com/@linotaller', 'https://www.tiktok.com/@linotaller'],
    ['facebook', 'LinoTaller', 'https://www.facebook.com/LinoTaller'],
    ['facebook', 'https://m.facebook.com/LinoTaller', 'https://www.facebook.com/LinoTaller'],
    [
      'facebook',
      'https://www.facebook.com/profile.php?id=1000123',
      'https://www.facebook.com/profile.php?id=1000123',
    ],
  ] as const)('%s: «%s» se guarda como %s', (red, escrito, enlace) => {
    expect(enlaceDeRed(red, escrito)).toBe(enlace);
    // Volver a guardar el enlace no lo cambia.
    expect(enlaceDeRed(red, enlace)).toBe(enlace);
  });

  it.each([
    ['instagram', 'https://evil.example/lino'],
    ['instagram', 'https://www.tiktok.com/@lino'],
    ['instagram', 'javascript:alert(1)'],
    ['instagram', 'https://instagram.com.evil.example/lino'],
    ['instagram', 'https://www.instagram.com/lino/p/abc'],
    ['instagram', 'lino taller'],
    ['instagram', '<script>'],
    ['facebook', 'https://www.facebook.com/profile.php?id=x'],
    ['tiktok', ''],
  ] as const)('❌ %s: «%s» no es un perfil de esa red', (red, escrito) => {
    expect(enlaceDeRed(red, escrito)).toBeNull();
  });

  it('la sección de contacto guarda el enlace, y lo que no es un perfil se rechaza con su campo', () => {
    const bien = validarSeccion('contacto', { instagram: '@lino.taller', tiktok: '@linotaller' });
    expect(bien).toMatchObject({
      ok: true,
      datos: {
        instagram: 'https://www.instagram.com/lino.taller',
        tiktok: 'https://www.tiktok.com/@linotaller',
      },
    });
    const mal = validarSeccion('contacto', { facebook: 'https://evil.example/x' });
    expect(mal.ok).toBe(false);
    expect(JSON.stringify(mal)).toContain('facebook');
  });
});
