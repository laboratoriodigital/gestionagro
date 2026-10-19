/**
 * `node scripts/tienda/cargar.ts <archivo.json> --panel <url> [--aplicar]` (HU-T12.2, TIENDA §17.2):
 * carga una tienda desde un `tienda-import/1` por la API del panel, con el token del CORE de quien la
 * carga en `TIENDA_TOKEN` (nunca en la línea de comandos, que queda en el historial). Sin `--aplicar`
 * solo revisa: dice todos los problemas y no escribe nada. Con él, aplica parte por parte; si una
 * falla, dice cuál y volver a correrlo termina el trabajo (cada parte es idempotente).
 *
 * Después de aplicar, sube las fotos del archivo (HU-T12.3, `fotos-de-la-carga.ts`): las baja, hace
 * sus derivadas y las sube como el teléfono. Una que falla se dice y las demás siguen; si faltó
 * alguna, sale con 1, y volver a correrlo termina el trabajo.
 */
import { readFileSync } from 'node:fs';
import { cargaTienda } from '../../packages/tienda-schema/src/carga.ts';
import { type OpcionesDeLasFotos, subirFotosDeLaCarga } from './fotos-de-la-carga.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpcionesDeCarga {
  carga: unknown;
  panel: string;
  token: string;
  aplicar: boolean;
  fetch?: Fetch;
  decir?: (linea: string) => void;
  /** Cómo se abren las fotos (`sharp` si no se dice); `false`: no subirlas. */
  fotos?: Pick<OpcionesDeLasFotos, 'abrir'> | false;
}

/** Devuelve 0 si todo salió, 1 si algo no. */
export async function cargar(o: OpcionesDeCarga): Promise<number> {
  const f = o.fetch ?? fetch;
  const decir = o.decir ?? ((l: string) => console.log(l));
  const post = (ruta: string, cuerpo: object) =>
    f(`${o.panel.replace(/\/$/, '')}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${o.token}` },
      body: JSON.stringify(cuerpo),
    });
  const revisar = await post('/api/panel/v1/importar/revisar', { carga: o.carga });
  const r = (await revisar.json().catch(() => ({}))) as {
    ok?: boolean;
    problemas?: { campo: string; mensaje: string }[];
    resumen?: Record<string, number>;
    motivo?: string;
  };
  if (!revisar.ok || !r.ok) {
    if (r.problemas) {
      decir(`❌ El archivo tiene ${r.problemas.length} problema(s):`);
      for (const p of r.problemas) decir(`  - ${p.campo || '(el archivo)'}: ${p.mensaje}`);
    } else {
      decir(`❌ El panel respondió ${revisar.status}${r.motivo ? `: ${r.motivo}` : ''}`);
    }
    return 1;
  }
  const resumen = r.resumen ?? {};
  decir(
    `✅ Sin problemas: ${resumen['productos'] ?? 0} productos (${resumen['variantes'] ?? 0} variantes), ${resumen['colecciones'] ?? 0} colecciones, ${resumen['pedidos'] ?? 0} pedidos históricos, en ${resumen['partes'] ?? 0} partes.`,
  );
  if ((resumen['fotos'] ?? 0) > 0) {
    decir(`ℹ️  ${resumen['fotos']} fotos para subir después de aplicar.`);
  }
  if (!o.aplicar) {
    decir('Para escribirlo, vuelve a correrlo con --aplicar.');
    return 0;
  }
  let parte: number | null = 0;
  while (parte !== null) {
    const a = await post('/api/panel/v1/importar/aplicar', { carga: o.carga, parte });
    const cuerpo = (await a.json().catch(() => ({}))) as {
      siguiente?: number | null;
      motivo?: string;
    };
    if (!a.ok) {
      decir(
        `❌ La parte ${parte + 1} no se aplicó (${a.status}${cuerpo.motivo ? `: ${cuerpo.motivo}` : ''}). Vuelve a correr el comando.`,
      );
      return 1;
    }
    decir(`  parte ${parte + 1} de ${resumen['partes'] ?? '?'} aplicada`);
    parte = cuerpo.siguiente ?? null;
  }
  decir('✅ Tienda cargada.');
  const carga = cargaTienda.safeParse(o.carga);
  if (o.fotos !== false && carga.success && (resumen['fotos'] ?? 0) > 0) {
    decir('Subiendo las fotos…');
    const { faltaron } = await subirFotosDeLaCarga({
      carga: carga.data,
      panel: o.panel,
      token: o.token,
      fetch: f,
      decir,
      ...(o.fotos?.abrir ? { abrir: o.fotos.abrir } : {}),
    });
    if (faltaron > 0) return 1;
  }
  decir('Revisa la tienda en el panel y publícala cuando esté lista.');
  return 0;
}

if (process.argv[1]?.endsWith('cargar.ts')) {
  const [archivo] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const i = process.argv.indexOf('--panel');
  const panel = i > 0 ? process.argv[i + 1] : undefined;
  const token = process.env['TIENDA_TOKEN'];
  if (!archivo || !panel || !token) {
    console.error(
      'Uso: TIENDA_TOKEN=<token del panel> node scripts/tienda/cargar.ts <archivo.json> --panel <url> [--aplicar]',
    );
    process.exit(2);
  }
  process.exit(
    await cargar({
      carga: JSON.parse(readFileSync(archivo, 'utf8')),
      panel,
      token,
      aplicar: process.argv.includes('--aplicar'),
    }),
  );
}
