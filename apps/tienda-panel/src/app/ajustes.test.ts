/**
 * HU-T10.3: los ajustes del panel pasan de texto a datos y de vuelta sin perder lo que el
 * formulario no muestra, y sin inventar valores (CA4).
 */
import { REQUERIDOS_PARA_PUBLICAR } from '@ed1/tienda-schema';
import { describe, expect, it } from 'vitest';
import {
  aDatos,
  aTexto,
  CAMPOS,
  campoDelProblema,
  chatDePrueba,
  nombreDelCampo,
  SECCIONES_EN_ORDEN,
} from './ajustes.ts';

describe('ajustes del panel', () => {
  it('las 9 secciones tienen campos (CA1)', () => {
    expect(SECCIONES_EN_ORDEN).toHaveLength(9);
    for (const s of SECCIONES_EN_ORDEN) expect(CAMPOS[s].length).toBeGreaterThan(0);
  });

  it('lo que el panel marca obligatorio es lo que pide la compuerta (P2)', () => {
    const delPanel = SECCIONES_EN_ORDEN.flatMap((s) =>
      CAMPOS[s].filter((c) => c.requerido).map((c) => `${s}.${c.campo.split('.')[0]}`),
    );
    const deLaCompuerta = Object.entries(REQUERIDOS_PARA_PUBLICAR).flatMap(([s, cs]) =>
      (cs ?? []).map((c) => `${s}.${c}`),
    );
    expect([...new Set(delPanel)].sort()).toEqual(deLaCompuerta.sort());
  });

  it('ida y vuelta: lo guardado vuelve igual, y lo que no se muestra sigue', () => {
    const guardado = {
      whatsapp: '+573001234567',
      whatsappVerificado: true,
      correo: 'ensayo@ejemplo.test',
    };
    const texto = aTexto('contacto', guardado);
    expect(texto).toEqual({ whatsapp: '3001234567', correo: 'ensayo@ejemplo.test', horario: '' });
    // `whatsappVerificado` lo pone la API, nunca el formulario.
    expect(aDatos('contacto', texto, guardado)).toEqual({
      whatsapp: '+573001234567',
      correo: 'ensayo@ejemplo.test',
      horario: '',
    });

    const venta = {
      modo: 'whatsapp',
      formas: [{ forma: 'contraentrega', ciudades: ['Envigado'] }],
    };
    const t = aTexto('venta', venta);
    expect(t['formas']).toBe('contraentrega');
    expect(
      aDatos('venta', { ...t, formas: 'contraentrega,transferencia' }, venta)['formas'],
    ).toEqual([{ forma: 'contraentrega', ciudades: ['Envigado'] }, { forma: 'transferencia' }]);
  });

  it('❌ CA4: lo vacío se manda vacío, sin valores de fábrica', () => {
    const datos = aDatos('legal', aTexto('legal', {}), {});
    for (const v of Object.values(datos)) {
      if (typeof v === 'object')
        expect(Object.values(v as object).every((x) => x === '')).toBe(true);
      else expect(v).toBe('');
    }
  });

  it('los números, los sí y no, y los teléfonos', () => {
    const v = aDatos('venta', { pedidoMinimoCop: '50.000', abierta: 'no' }, {});
    expect(v['pedidoMinimoCop']).toBe(50_000);
    expect(v['abierta']).toBe(false);
    expect(aDatos('legal', { telefono: '604 444 5555' }, {})['telefono']).toBe('+576044445555');
    expect(
      aDatos('cobro', { 'transferencia.banco': 'Banco Ensayo' }, {})['transferencia'],
    ).toMatchObject({ banco: 'Banco Ensayo', numero: '' });
  });

  it('cada problema de la API llega a su campo, con un nombre que se entiende', () => {
    expect(campoDelProblema('legal', 'legal.documento.numero')).toBe('documento.numero');
    expect(campoDelProblema('cobro', 'cobro.transferencia')).toBe('transferencia.banco');
    expect(nombreDelCampo('legal.razonSocial')).toBe(
      'Datos legales: Razón social o nombre completo',
    );
    expect(nombreDelCampo('contacto.whatsappVerificado')).toBe('Contacto: verificar el WhatsApp');
  });

  it('CA3: el chat de prueba abre el WhatsApp guardado', () => {
    expect(chatDePrueba('+573001234567')).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
  });
});
