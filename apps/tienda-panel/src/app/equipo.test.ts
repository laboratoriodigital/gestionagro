/**
 * HU-T10.5: invitar por WhatsApp con el código en el fragmento, unirse con la sesión de ahora, y el
 * panel que esconde lo que la API niega. El CORE es un `fetch` de mentira.
 */
import { accionesDeAjuste, puede } from '@ed1/tienda-schema/permisos';
import { describe, expect, it } from 'vitest';
import { CAMPOS, SECCIONES_EN_ORDEN } from './ajustes.ts';
import { almacenEnMemoria } from './almacen.ts';
import {
  aceptarInvitacion,
  CLAVE_INVITACION,
  codigoDelFragmento,
  crearInvitacion,
  enlaceDeWhatsApp,
  verInvitacion,
} from './equipo.ts';
import type { Sesion } from './sesion.ts';

const CORE = 'https://core.ejemplo.test';
const PANEL = 'https://panel.ejemplo.test';
const AHORA = 1_800_000_000_000;
const CODIGO = 'codigo-secreto-de-ensayo';

const sesion = (o: Partial<Sesion> = {}): Sesion => ({
  acceso: 'acceso-de-ensayo',
  acceso_vence: AHORA + 60_000,
  refresh: 'r',
  refresh_vence: AHORA + 86_400_000,
  usuario: { nombre: 'Ensayo Dos', email: 'ensayo.dos@ejemplo.test' },
  organizaciones: [],
  org_id: null,
  ...o,
});

function red(respuestas: Record<string, (() => Response)[]>) {
  const pedidos: { url: string; auth: string | null; cuerpo: unknown }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    pedidos.push({
      url,
      auth: new Headers(init?.headers).get('authorization'),
      cuerpo: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const r = respuestas[url]?.shift();
    if (!r) throw new Error(`sin respuesta para ${url}`);
    return r();
  }) as unknown as typeof fetch;
  return { pedidos, fetchFn };
}
const json = (estado: number, cuerpo: unknown) => () =>
  new Response(JSON.stringify(cuerpo), { status: estado });

describe('invitar a un colaborador (HU-T10.5 CA1)', () => {
  it('el CORE crea el código con rol colaborador; el enlace lo lleva solo en el fragmento', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion({ org_id: 'o' }) });
    const { pedidos, fetchFn } = red({
      [`${CORE}/api/core/invitaciones`]: [
        json(201, { codigo: CODIGO, rol: 'colaborador', expira: '2026-10-22T15:00:00.000Z' }),
      ],
    });
    const r = await crearInvitacion(
      { almacen, core: CORE, fetchFn, ahora: () => AHORA },
      { origen: PANEL, tienda: 'Comercio Ensayo Uno' },
    );
    expect(pedidos).toEqual([
      {
        url: `${CORE}/api/core/invitaciones`,
        auth: 'Bearer acceso-de-ensayo',
        cuerpo: { rol: 'colaborador' },
      },
    ]);
    if (r.tipo !== 'ok') throw new Error(r.motivo);
    expect(r.enlace).toBe(`${PANEL}/unirme/#invitacion=${CODIGO}`);
    // Nada del código antes del `#`: no llega a ningún servidor (P13).
    expect(r.enlace.split('#')[0]).not.toContain(CODIGO);
    expect(codigoDelFragmento(new URL(r.enlace).hash)).toBe(CODIGO);
    expect(r.mensaje).toContain('Comercio Ensayo Uno');
    expect(r.mensaje).toContain('como colaborador');
    expect(r.mensaje).toContain('hasta el 22 de octubre');
    expect(enlaceDeWhatsApp(r.mensaje)).toBe(
      `https://wa.me/?text=${encodeURIComponent(r.mensaje)}`,
    );
  });

  it('❌ si el CORE dice que no administra, lo dice en palabras', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion({ org_id: 'o' }) });
    const { fetchFn } = red({
      [`${CORE}/api/core/invitaciones`]: [json(403, { motivo: 'Solo quien administra la finca' })],
    });
    expect(
      await crearInvitacion(
        { almacen, core: CORE, fetchFn, ahora: () => AHORA },
        { origen: PANEL, tienda: 'x' },
      ),
    ).toEqual({ tipo: 'error', motivo: 'Solo quien administra la tienda puede invitar.' });
  });

  it('ver: la tienda, no «la finca»; y por qué ya no sirve', async () => {
    const { pedidos, fetchFn } = red({
      [`${CORE}/api/core/invitaciones/ver`]: [
        json(200, {
          estado: 'vigente',
          finca: 'Comercio Ensayo Uno',
          rol: 'colaborador',
          invita: 'Ensayo Uno',
          expira: '2026-10-22T15:00:00.000Z',
        }),
        json(410, { motivo: 'Este enlace ya se usó. Pídele a Ensayo Uno que te mande uno nuevo.' }),
      ],
    });
    expect(await verInvitacion(CORE, CODIGO, fetchFn)).toEqual({
      estado: 'vigente',
      tienda: 'Comercio Ensayo Uno',
      rol: 'colaborador',
      invita: 'Ensayo Uno',
      expira: '2026-10-22T15:00:00.000Z',
    });
    expect(pedidos[0]).toMatchObject({ auth: null, cuerpo: { codigo: CODIGO } });
    expect(await verInvitacion(CORE, CODIGO, fetchFn)).toEqual({
      estado: 'no-sirve',
      motivo: 'Este enlace ya se usó. Pídele a Ensayo Uno que te mande uno nuevo.',
    });
  });

  it('aceptar: con la sesión de ahora, borra el código y renueva hacia la tienda nueva', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion(), [CLAVE_INVITACION]: CODIGO });
    const nueva = sesion({
      acceso: `x.${btoa(JSON.stringify({ aud: 'tienda' }))}.y`,
      organizaciones: [{ org_id: 'o', nombre: 'Comercio Ensayo Uno', rol: 'colaborador' }],
      org_id: 'o',
    });
    const { pedidos, fetchFn } = red({
      [`${CORE}/api/core/invitaciones/aceptar`]: [
        json(200, { org_id: 'o', finca: 'Comercio Ensayo Uno', rol: 'colaborador' }),
      ],
      [`${CORE}/api/core/auth/refrescar`]: [json(200, nueva)],
    });
    const r = await aceptarInvitacion({ almacen, core: CORE, fetchFn, ahora: () => AHORA });
    expect(r).toMatchObject({ tipo: 'ok', tienda: 'Comercio Ensayo Uno' });
    expect(pedidos.map((p) => [p.url, p.cuerpo])).toEqual([
      [`${CORE}/api/core/invitaciones/aceptar`, { codigo: CODIGO }],
      [`${CORE}/api/core/auth/refrescar`, { refresh: 'r', org_id: 'o' }],
    ]);
    expect(await almacen.leer(CLAVE_INVITACION)).toBeNull();
  });

  it('❌ si ya es parte de la tienda, lo dice y el código se queda para intentarlo con otra cuenta', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion(), [CLAVE_INVITACION]: CODIGO });
    const { fetchFn } = red({
      [`${CORE}/api/core/invitaciones/aceptar`]: [
        json(409, { motivo: 'Ya eres parte de Comercio Ensayo Uno como colaborador.' }),
      ],
    });
    expect(await aceptarInvitacion({ almacen, core: CORE, fetchFn, ahora: () => AHORA })).toEqual({
      tipo: 'error',
      motivo: 'Ya eres parte de Comercio Ensayo Uno como colaborador.',
    });
    expect(await almacen.leer(CLAVE_INVITACION)).toBe(CODIGO);
  });
});

describe('el panel esconde lo que la API niega (HU-T10.5 CA2)', () => {
  it('cada campo de ajustes que pide un permiso del propietario lo dice con `pide`', () => {
    for (const seccion of SECCIONES_EN_ORDEN) {
      // El cobro entero es del propietario: la API no se lo manda al colaborador.
      if (seccion === 'cobro') continue;
      for (const c of CAMPOS[seccion]) {
        const pide = accionesDeAjuste(seccion, { [c.campo]: 'a' }, { [c.campo]: 'b' }).filter(
          (a) => !puede('colaborador', a),
        );
        expect(c.pide ? [c.pide] : [], `${seccion}.${c.campo}`).toEqual(pide);
      }
    }
  });
});
