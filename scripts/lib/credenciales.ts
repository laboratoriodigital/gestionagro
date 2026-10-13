/**
 * Credenciales por propósito (HU-C11.5, PLATAFORMA §3.5, R6, P12). Con una sola cuenta de Cloudflare
 * para todo, el aislamiento entre lo que despliega, lo que mide y lo que vende descansa en que cada
 * token tenga lo suyo y nada más: la causa 4 de la Tienda 2.0 fueron cuatro permisos que se pisaban.
 *
 * - **Lo que falta** lo dice `verificarToken` (`despliegue.ts`), leyendo lo mismo que el despliegue
 *   va a tocar.
 * - **Lo que sobra** lo dice este módulo (CA3): por cada permiso que un propósito *no* debe tener,
 *   una lectura que solo responde 200 con ese permiso. Si responde, la verificación falla y nombra
 *   el permiso de más. Solo lecturas (`GET`): nunca escribe nada para probar (P11).
 * - Una respuesta que no es ni 200 ni «sin permiso» (401 o 403) no se da por buena: se dice que no
 *   se pudo comprobar, y también detiene (P1).
 *
 * Lo que no ve (P17): un permiso de más que no tenga una lectura propia, como «Workers Scripts:
 * Edit» frente a «Read» (los dos leen la lista). Tampoco «Workers Scripts» en el de métricas: su
 * lista también se lee con Account Analytics (bitácora core 10). Una sonda entra solo si se vio
 * responder «sin permiso» a un token que no lo tiene. La lista de cada propósito está en
 * `docs/runbooks/credenciales.md`.
 */
import type { Fetch } from './despliegue.ts';

const API = 'https://api.cloudflare.com/client/v4';

export type Proposito = 'despliegue' | 'metricas';

/** Una lectura que solo un token con `permiso` puede hacer. */
export interface Sonda {
  permiso: string;
  /** La ruta, con la cuenta; null si la sonda necesita una zona y no hay. */
  ruta: (cuenta: string, zona?: string) => string | null;
}

const SONDAS = {
  tokens: {
    permiso: 'User → API Tokens',
    ruta: () => `${API}/user/tokens?per_page=1`,
  },
  miembros: {
    permiso: 'Account → Account Settings',
    ruta: (cuenta: string) => `${API}/accounts/${cuenta}/members?per_page=1`,
  },
  r2: {
    permiso: 'Account → Workers R2 Storage',
    ruta: (cuenta: string) => `${API}/accounts/${cuenta}/r2/buckets?per_page=1`,
  },
  pages: {
    permiso: 'Account → Cloudflare Pages',
    ruta: (cuenta: string) => `${API}/accounts/${cuenta}/pages/projects?per_page=1`,
  },
  scripts: {
    permiso: 'Account → Workers Scripts',
    ruta: (cuenta: string) => `${API}/accounts/${cuenta}/workers/scripts`,
  },
  kv: {
    permiso: 'Account → Workers KV Storage',
    ruta: (cuenta: string) => `${API}/accounts/${cuenta}/storage/kv/namespaces?per_page=1`,
  },
  d1: {
    permiso: 'Account → D1',
    ruta: (cuenta: string) => `${API}/accounts/${cuenta}/d1/database?per_page=1`,
  },
  dns: {
    permiso: 'Zone → DNS',
    ruta: (_cuenta: string, zona?: string) =>
      zona ? `${API}/zones/${zona}/dns_records?per_page=1` : null,
  },
} satisfies Record<string, Sonda>;

/**
 * Lo que cada propósito no debe tener. El de despliegue tiene lo que ARQUITECTURA §7.5 declara
 * (Workers Scripts, KV, D1, Workers Routes por zona, Account Analytics, Account Settings y User
 * Memberships, que wrangler lee). «Account Settings» no se sonda en él por eso: está declarado.
 * El de métricas solo lee Account Analytics.
 */
export const PERMISOS_DE_MAS: Readonly<Record<Proposito, readonly Sonda[]>> = {
  // «Zone → DNS» salió de observación el 12 oct 2026: en la publicación de CORE 0.4.0 respondió
  // «sin permiso» en las tres zonas y el dominio propio de la cuenta respondía igual. No hace falta.
  despliegue: [SONDAS.tokens, SONDAS.r2, SONDAS.pages, SONDAS.dns],
  metricas: [
    SONDAS.tokens,
    SONDAS.miembros,
    SONDAS.r2,
    SONDAS.pages,
    // Sin «Workers Scripts»: la lista de Workers de la cuenta también responde 200 a un token que
    // solo tiene Account Analytics. Lo vio el despliegue del 12 oct 2026 con el token del vigía
    // tal como lo pide el runbook (bitácora core 10). Una sonda que no distingue no se usa.
    SONDAS.kv,
    SONDAS.d1,
  ],
};

/** El nombre del secreto de GitHub de cada propósito, para los mensajes. */
const SECRETO: Readonly<Record<Proposito, string>> = {
  despliegue: 'CF_API_TOKEN',
  metricas: 'CF_METRICAS_TOKEN',
};

/**
 * Los permisos de más de un token, en palabras. `zonas` son los ids de las zonas que el propósito
 * toca: las sondas de zona miran cada una.
 */
/**
 * Sondas que todavía no se han visto contra Cloudflare: avisan y no detienen (bitácora core 10:
 * una guardia que puede detener producción se prueba primero en modo aviso). «Zone → DNS» solo
 * corría en producción sin haberse visto; la publicación de CORE 0.4.0 mostró que no hace falta
 * y pasó a `PERMISOS_DE_MAS`. La próxima sonda nueva entra aquí primero.
 */
export const EN_OBSERVACION: Readonly<Record<Proposito, readonly Sonda[]>> = {
  despliegue: [],
  metricas: [],
};

/** Los avisos de las sondas en observación: lo que parece de más, sin detener nada. */
export async function permisosEnObservacion(
  fetchFn: Fetch,
  proposito: Proposito,
  token: string,
  cuenta: string,
  zonas: readonly string[] = [],
): Promise<string[]> {
  const hallazgos = await sondear(
    fetchFn,
    proposito,
    EN_OBSERVACION[proposito],
    token,
    cuenta,
    zonas,
  );
  return [...new Set(hallazgos)].map(
    (h) => `${h} (en observación: no detiene el despliegue; ver docs/runbooks/credenciales.md)`,
  );
}

export function permisosDeMas(
  fetchFn: Fetch,
  proposito: Proposito,
  token: string,
  cuenta: string,
  zonas: readonly string[] = [],
): Promise<string[]> {
  return sondear(fetchFn, proposito, PERMISOS_DE_MAS[proposito], token, cuenta, zonas);
}

async function sondear(
  fetchFn: Fetch,
  proposito: Proposito,
  sondas: readonly Sonda[],
  token: string,
  cuenta: string,
  zonas: readonly string[],
): Promise<string[]> {
  const fallas: string[] = [];
  for (const sonda of sondas) {
    const rutas = (zonas.length > 0 ? zonas : [undefined])
      .map((z) => sonda.ruta(cuenta, z))
      .filter((r): r is string => r !== null);
    for (const ruta of [...new Set(rutas)]) {
      let estado: number;
      try {
        estado = (await fetchFn(ruta, { headers: { authorization: `Bearer ${token}` } })).status;
      } catch (e) {
        fallas.push(
          `${SECRETO[proposito]}: no se pudo comprobar «${sonda.permiso}» (${(e as Error).message})`,
        );
        continue;
      }
      if (estado === 200) {
        fallas.push(
          `${SECRETO[proposito]} tiene un permiso de más: «${sonda.permiso}». Quítalo del token en Cloudflare (docs/runbooks/credenciales.md)`,
        );
      } else if (estado !== 401 && estado !== 403) {
        fallas.push(
          `${SECRETO[proposito]}: no se pudo comprobar «${sonda.permiso}» (HTTP ${estado})`,
        );
      }
    }
  }
  return fallas;
}

/** Los ids de las zonas por nombre, con el mismo token; las que no ve se omiten (ya lo dijo P12). */
export async function idsDeZonas(
  fetchFn: Fetch,
  token: string,
  nombres: readonly string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const nombre of nombres) {
    const r = await fetchFn(`${API}/zones?name=${encodeURIComponent(nombre)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const cuerpo = (await r.json().catch(() => null)) as { result?: { id: string }[] } | null;
    const id = cuerpo?.result?.[0]?.id;
    if (r.status === 200 && id) ids.push(id);
  }
  return ids;
}

/**
 * CA1 para el token de métricas: hace la lectura que el vigía va a hacer (una consulta de GraphQL
 * de la cuenta) antes de cargarlo en la celda. Sin token, o si no puede leer, es un aviso y no
 * detiene: el vigía deja la celda en `alerta` y lo dice (HU-E8.2). Un permiso de más, sí detiene.
 */
export async function verificarTokenDeMetricas(
  fetchFn: Fetch,
  token: string | undefined,
  cuenta: string,
): Promise<{ fallas: string[]; avisos: string[] }> {
  if (!token) return { fallas: [], avisos: [] };
  let lee = false;
  try {
    const r = await fetchFn(`${API}/graphql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'query ($cuenta: string!) { viewer { accounts(filter: { accountTag: $cuenta }) { accountTag } } }',
        variables: { cuenta },
      }),
    });
    const cuerpo = (await r.json().catch(() => null)) as {
      data?: { viewer?: { accounts?: unknown[] } } | null;
      errors?: unknown[] | null;
    } | null;
    lee =
      r.status === 200 &&
      !cuerpo?.errors?.length &&
      (cuerpo?.data?.viewer?.accounts?.length ?? 0) > 0;
  } catch {
    lee = false;
  }
  const avisos = lee
    ? []
    : [
        'CF_METRICAS_TOKEN no puede leer las métricas de la cuenta (Account Analytics: Read): el vigía dejará la celda en alerta',
      ];
  return { fallas: await permisosDeMas(fetchFn, 'metricas', token, cuenta), avisos };
}
