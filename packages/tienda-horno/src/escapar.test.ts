/**
 * HU-T4.2: lo que escribe el comercio no se ejecuta. Un corpus de cargas XSS en descripciones y
 * nombres sale inerte; el control negativo corre el mismo corpus sin escapar y lo ve peligroso.
 */
import { describe, expect, it } from 'vitest';
import { enlaceSeguro, escaparHtml, markdownSeguro } from './escapar.ts';

const CORPUS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '"><script>alert(1)</script>',
  "'><img src=x onerror=alert(1)>",
  '[clic](javascript:alert(1))',
  '[clic](JaVaScRiPt:alert(1))',
  '[clic](java\tscript:alert(1))',
  '[clic](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '[clic](vbscript:msgbox(1))',
  '<a href="javascript:alert(1)">x</a>',
  '<iframe src="https://ejemplo.test"></iframe>',
  '**<b onmouseover=alert(1)>negrita</b>**',
  '<style>body{display:none}</style>',
];

/** Lo que un navegador ejecutaría: una etiqueta abierta de verdad o un esquema peligroso enlazado. */
const peligroso = (html: string) =>
  /<(script|img|svg|iframe|style|b )/i.test(html) ||
  /href="\s*(javascript|data|vbscript):/i.test(html);

describe('HU-T4.2 · el corpus XSS sale inerte', () => {
  it.each(CORPUS)('markdownSeguro(%s)', (carga) => {
    expect(peligroso(markdownSeguro(carga))).toBe(false);
  });

  it.each(CORPUS)('escaparHtml(%s)', (carga) => {
    expect(peligroso(escaparHtml(carga))).toBe(false);
  });

  it('❌ sin escapar, el mismo corpus es peligroso: la prueba ve el defecto', () => {
    const sinEscapar = (t: string) => t;
    expect(CORPUS.filter((c) => peligroso(sinEscapar(c))).length).toBeGreaterThan(8);
  });
});

describe('el Markdown que sí se permite', () => {
  it('párrafos, negrita, cursiva y listas', () => {
    expect(markdownSeguro('Hola **mundo** y *bienvenidos*.\n\n- uno\n- dos')).toBe(
      '<p>Hola <strong>mundo</strong> y <em>bienvenidos</em>.</p>\n<ul><li>uno</li><li>dos</li></ul>',
    );
  });

  it('solo enlaces https, mailto, tel y wa.me', () => {
    expect(markdownSeguro('[Escríbenos](https://wa.me/573000000001)')).toBe(
      '<p><a href="https://wa.me/573000000001" rel="nofollow">Escríbenos</a></p>',
    );
    expect(enlaceSeguro('mailto:hola@ejemplo.test')).toBe('mailto:hola@ejemplo.test');
    expect(enlaceSeguro('tel:+573000000001')).toBe('tel:+573000000001');
    expect(enlaceSeguro('http://ejemplo.test')).toBeNull();
    expect(markdownSeguro('[sitio](http://ejemplo.test)')).toBe('<p>sitio</p>');
  });

  it('el texto de una etiqueta se ve como texto', () => {
    expect(markdownSeguro('<b>hola</b>')).toBe('<p>&lt;b&gt;hola&lt;/b&gt;</p>');
  });
});
