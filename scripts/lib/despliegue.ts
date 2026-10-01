/**
 * Piezas del despliegue por celdas (HU-E1.5). Funciones puras o con `fetch` inyectado, para
 * probarlas sin tocar Cloudflare.
 */
import type { Celda } from './celdas.ts';

export type Destino = 'staging' | 'produccion';
export type Fetch = typeof fetch;

const API = 'https://api.cloudflare.com/client/v4';

// biome-ignore lint/suspicious/noControlCharactersInRegex: quita los códigos de color ANSI
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/**
 * Qué hacer ante errores de Cloudflare **ya vistos** en una corrida real, por código (P15).
 * Solo entra un código que se observó: uno supuesto mandaría a hacer lo que no es (P1).
 */
export const ACCIONES_POR_CODIGO: Readonly<Record<string, string>> = {
  // Visto el 1 oct 2026 en el primer despliegue a staging (bitácora agro 11).
  '10089':
    'Activa Analytics Engine creando sus datasets: Cloudflare → Workers & Pages → Analytics Engine → crear dataset, con los nombres de «dataset_eventos» en infrastructure/celdas.json (y el mismo con «_staging» al final). Es gratis dentro de la cuota (ED1 §41).',
};

/**
 * Causa de una falla de `wrangler deploy`, para el resumen de la corrida: el mensaje de error tal
 * cual (P15: se cita el síntoma) y, si el código es conocido, qué hacer. Nada de «ver el registro».
 */
export function causaDeWrangler(salida: string): string[] {
  const lineas = salida.replace(ANSI, '').split(/\r?\n/);
  const inicio = lineas.findIndex((l) => /\[ERROR\]/.test(l));
  if (inicio < 0) return ['sin mensaje de error de wrangler; revisa el registro de la corrida'];
  const bloque: string[] = [];
  for (const l of lineas.slice(inicio, inicio + 6)) {
    const limpia = l.replace(/^[\s✘]*\[ERROR\]\s*/, '').trim();
    if (!limpia || /^If you think this is a bug|^🪵/.test(limpia)) continue;
    bloque.push(limpia);
  }
  const codigo = bloque.join(' ').match(/\[code: (\d+)\]/)?.[1];
  const accion = codigo ? ACCIONES_POR_CODIGO[codigo] : undefined;
  return accion ? [...bloque, `Qué hacer: ${accion}`] : bloque;
}

interface RespuestaCf {
  success?: boolean;
  result?: unknown;
  errors?: { code: number; message: string }[];
}

async function leer(
  fetchFn: Fetch,
  url: string,
  token: string,
): Promise<{ estado: number; cuerpo: RespuestaCf }> {
  const r = await fetchFn(url, { headers: { authorization: `Bearer ${token}` } });
  let cuerpo: RespuestaCf = {};
  try {
    cuerpo = (await r.json()) as RespuestaCf;
  } catch {
    cuerpo = { success: false, errors: [{ code: r.status, message: 'respuesta que no es JSON' }] };
  }
  return { estado: r.status, cuerpo };
}

/**
 * P12: el permiso que se comprueba es el que se usa. Antes de desplegar, se lee lo mismo que el
 * despliegue va a tocar, y una falla nombra la celda y el permiso exacto que falta.
 */
export async function verificarToken(
  fetchFn: Fetch,
  celda: Celda,
  token: string | undefined,
  cuenta: string | undefined,
  destino: Destino,
  zona: string,
): Promise<string[]> {
  if (!token) return [`${celda.id}: falta el secreto ${celda.secretos.token} en GitHub`];
  if (!cuenta) return [`${celda.id}: falta el secreto ${celda.secretos.cuenta} en GitHub`];

  const verificacion = await leer(fetchFn, `${API}/user/tokens/verify`, token);
  const estadoToken = (verificacion.cuerpo.result as { status?: string } | undefined)?.status;
  if (verificacion.estado !== 200 || estadoToken !== 'active') {
    return [
      `${celda.id}: el token ${celda.secretos.token} no es válido o está vencido (${estadoToken ?? verificacion.estado})`,
    ];
  }

  const fallas: string[] = [];
  const scripts = await leer(fetchFn, `${API}/accounts/${cuenta}/workers/scripts`, token);
  if (scripts.estado === 403 || scripts.estado === 401) {
    fallas.push(
      `${celda.id}: al token le falta «Account → Workers Scripts: Edit» en la cuenta ${celda.cuenta}`,
    );
  } else if (scripts.estado === 404 || (scripts.cuerpo.errors ?? []).some((e) => e.code === 7003)) {
    fallas.push(
      `${celda.id}: la cuenta de ${celda.secretos.cuenta} no existe o el token no tiene acceso a ella`,
    );
  } else if (scripts.estado !== 200) {
    fallas.push(`${celda.id}: no se pudo leer los Workers de la cuenta (HTTP ${scripts.estado})`);
  }

  if (destino === 'produccion') {
    const zonas = await leer(fetchFn, `${API}/zones?name=${encodeURIComponent(zona)}`, token);
    const lista = (zonas.cuerpo.result as { id: string }[] | undefined) ?? [];
    const zonaId = lista[0]?.id;
    if (zonas.estado !== 200 || !zonaId) {
      fallas.push(
        `${celda.id}: el token no ve la zona ${zona}; le falta «Zone → Workers Routes: Edit» en esa zona`,
      );
    } else {
      const rutas = await leer(fetchFn, `${API}/zones/${zonaId}/workers/routes`, token);
      if (rutas.estado !== 200) {
        fallas.push(
          `${celda.id}: al token le falta «Zone → Workers Routes: Edit» en ${zona} (HTTP ${rutas.estado})`,
        );
      }
    }
  }
  return fallas;
}

/**
 * Prueba de humo después de desplegar (CA5). Solo lee páginas públicas y comprueba que la API
 * rechaza lo inválido: nunca escribe un evento ni toca datos de una finca real (P11).
 */
export async function humo(fetchFn: Fetch, base: string): Promise<string[]> {
  const fallas: string[] = [];
  const pedir = async (ruta: string, init?: RequestInit) => {
    try {
      return await fetchFn(`${base}${ruta}`, { redirect: 'manual', ...init });
    } catch (e) {
      fallas.push(`${ruta}: no respondió (${(e as Error).message})`);
      return null;
    }
  };
  const contiene = async (ruta: string, texto: string) => {
    const r = await pedir(ruta);
    if (!r) return;
    if (r.status !== 200) {
      fallas.push(`${ruta}: respondió ${r.status}, se esperaba 200`);
      return;
    }
    const cuerpo = await r.text();
    if (!cuerpo.includes(texto)) fallas.push(`${ruta}: no contiene «${texto}»`);
  };
  await contiene('/herramientas/agro/', 'Herramientas agronómicas');
  await contiene('/herramientas/agro/calculadora-dpv/', 'Calculadora de DPV');
  await contiene('/agro/app/', 'noindex');
  await contiene('/agro/app/manifest.webmanifest', '"scope":"/agro/app/"');
  await contiene('/agro/app/sw.js', 'precache');
  const get = await pedir('/api/eventos');
  if (get && get.status !== 405)
    fallas.push(`/api/eventos (GET): respondió ${get.status}, se esperaba 405`);
  const invalido = await pedir('/api/eventos', { method: 'POST', body: '{roto' });
  if (invalido && invalido.status !== 400) {
    fallas.push(`/api/eventos (POST inválido): respondió ${invalido.status}, se esperaba 400`);
  }
  return fallas;
}

/** URL de workers.dev que imprime `wrangler deploy` en staging. */
export function urlDeWorkersDev(salida: string): string | null {
  return salida.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0] ?? null;
}

export type EstadoCelda = 'desplegada' | 'fallo' | 'sin-tocar' | 'fuera';

export interface ResultadoCelda {
  celda: string;
  estado: EstadoCelda;
  detalle: string[];
}

/** Resumen para la persona que mira la corrida (P15): qué pasó en cada celda y cómo seguir. */
export function resumenDespliegue(destino: Destino, resultados: readonly ResultadoCelda[]): string {
  const icono: Record<EstadoCelda, string> = {
    desplegada: '✅',
    fallo: '❌',
    'sin-tocar': '⏸️',
    fuera: '🚫',
  };
  const filas = resultados.map(
    (r) => `| ${icono[r.estado]} | ${r.celda} | ${r.estado} | ${r.detalle.join('<br>') || '—'} |`,
  );
  const fallida = resultados.find((r) => r.estado === 'fallo');
  const sinTocar = resultados.filter((r) => r.estado === 'sin-tocar').map((r) => r.celda);
  const cierre = fallida
    ? [
        `El despliegue a ${destino} se detuvo en **${fallida.celda}**.`,
        sinTocar.length > 0
          ? `Quedaron sin tocar: ${sinTocar.join(', ')}.`
          : 'No quedaron celdas sin tocar.',
        `Para seguir: corrige la causa y vuelve a correr el flujo «desplegar» con «solo_celda: ${fallida.celda}»; o marca la celda \`"estado": "fuera"\` en infrastructure/celdas.json si no debe recibir este reparto.`,
      ].join(' ')
    : `Despliegue a ${destino} completo.`;
  return [
    `## Despliegue a ${destino}`,
    '',
    '| | Celda | Estado | Detalle |',
    '|---|---|---|---|',
    ...filas,
    '',
    cierre,
  ].join('\n');
}
