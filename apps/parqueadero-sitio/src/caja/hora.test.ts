import { describe, expect, it } from 'vitest';
import { diferenciaDeHora, MAXIMA_DIFERENCIA, senalDeHora, URL_DE_LA_HORA } from './hora.ts';

const SERVIDOR = Date.UTC(2026, 9, 7, 19, 0);

/**
 * Un servidor con una caché delante, como un navegador: sin `no-store` contesta la respuesta
 * guardada hace un día, con su hora vieja (P7).
 */
function servidor(pedidos: { url: string; init: RequestInit }[] = []) {
  return async (url: string, init: RequestInit) => {
    pedidos.push({ url, init });
    const hora = init.cache === 'no-store' ? SERVIDOR : SERVIDOR - 86_400_000;
    return { headers: new Headers({ date: new Date(hora).toUTCString() }) };
  };
}

describe('la hora del teléfono (HU-Q3.8)', () => {
  it('con la hora bien, la diferencia es la del viaje y la cabecera dice «Hora correcta»', async () => {
    const d = await diferenciaDeHora(servidor(), () => SERVIDOR + 500);
    expect(d).toBe(500);
    expect(senalDeHora(d)).toEqual({ texto: 'Hora correcta', tono: 'bien' });
  });

  it('corrida más de 2 minutos, avisa en rojo y pide corregirla; no la corrige (CA1)', async () => {
    const d = await diferenciaDeHora(servidor(), () => SERVIDOR - 7 * 60_000);
    expect(senalDeHora(d)).toEqual({
      texto: 'La hora del teléfono está 7 min atrasada: corríjala',
      tono: 'error',
    });
    expect(senalDeHora(MAXIMA_DIFERENCIA + 60_000).texto).toContain('adelantada');
  });

  it('pide sin caché y con una marca: una respuesta guardada no esconde el reloj corrido (CA3 ❌)', async () => {
    const pedidos: { url: string; init: RequestInit }[] = [];
    const d = await diferenciaDeHora(servidor(pedidos), () => SERVIDOR);
    expect(d).toBe(0);
    expect(pedidos[0]?.init).toMatchObject({ method: 'HEAD', cache: 'no-store' });
    expect(pedidos[0]?.url).toBe(`${URL_DE_LA_HORA}?hora=${SERVIDOR}`);
    // Lo que vería la caja sin `no-store`: un día de diferencia que no existe.
    const conCache = await servidor()(URL_DE_LA_HORA, { method: 'HEAD' });
    expect(Date.parse(conCache.headers.get('date') ?? '')).toBe(SERVIDOR - 86_400_000);
  });

  it('sin red o sin cabecera no inventa una hora', async () => {
    const sinRed = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await diferenciaDeHora(sinRed, () => SERVIDOR)).toBeNull();
    const sinFecha = async () => ({ headers: new Headers() });
    expect(await diferenciaDeHora(sinFecha, () => SERVIDOR)).toBeNull();
    expect(senalDeHora(null)).toEqual({ texto: 'Hora sin revisar', tono: 'neutro' });
  });
});
