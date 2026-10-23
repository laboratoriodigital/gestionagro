/**
 * `node scripts/copia/permiso-de-drive.ts --ambiente staging|produccion [--llave-nueva]` (HU-C11.4
 * WI-C11.4.3, ADR-30): el dueño da una sola vez el permiso para que el CORE guarde la copia semanal
 * en **su** Google Drive, y el script guarda en el ambiente de GitHub lo que lee el despliegue:
 * `COPIA_DRIVE_CLIENTE_ID`, `COPIA_DRIVE_CLIENTE_SECRETO` y `COPIA_DRIVE_REFRESH`.
 *
 * - **Solo `drive.file`** (CA1b, documentación de Google: «ver, editar, crear y borrar solo los
 *   archivos de Drive que usas con esta app»). El CORE no ve nada más del Drive del dueño.
 * - **La llave de la copia** (`COPIA_LLAVE`, 32 bytes al azar) se crea la primera vez, o con
 *   `--llave-nueva`, y se muestra **una sola vez** para que el dueño la guarde en su gestor de
 *   contraseñas: GitHub no deja leerla de vuelta, y sin ella ninguna copia se abre (CA4: la llave no
 *   vive en Google). Las copias de antes siguen necesitando la llave con que se hicieron.
 *
 * El navegador, la vuelta en 127.0.0.1 con PKCE y la forma de guardar en GitHub son los del permiso
 * de Gmail (`scripts/correo/permiso-de-gmail.ts`). Los pasos están en `docs/runbooks/copia-en-drive.md`.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  AMBIENTES,
  type Ambiente,
  esperarLaVuelta,
  type Mundo,
  mundoReal,
} from '../correo/permiso-de-gmail.ts';

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
export const ALCANCE_DE_DRIVE = 'https://www.googleapis.com/auth/drive.file';

export interface ResultadoDelPermiso {
  ok: boolean;
  /** La llave nueva, en base64, si se creó: el dueño la guarda. Nunca se escribe en un archivo. */
  llave?: string;
  motivo?: string;
}

const base64url = (b: Buffer) => b.toString('base64url');

export async function darPermisoDeDrive(
  ambiente: Ambiente,
  mundo: Mundo,
  opciones: { llaveNueva?: boolean; azar?: (n: number) => Buffer } = {},
): Promise<ResultadoDelPermiso> {
  const lista = mundo.gh(['secret', 'list', '--env', ambiente, '--json', 'name']);
  if (!lista.ok) {
    return {
      ok: false,
      motivo: `gh no pudo leer el ambiente «${ambiente}». Revisa «gh auth status» y que el ambiente exista.`,
    };
  }
  const yaTieneLlave = /"COPIA_LLAVE"/.test(lista.salida);
  const clienteId = (await mundo.preguntar('Id del cliente de OAuth (de escritorio): ')).trim();
  const clienteSecreto = (
    await mundo.preguntar('Secreto de ese cliente (no se ve al pegarlo): ', true)
  ).trim();
  if (!/\.apps\.googleusercontent\.com$/.test(clienteId) || clienteSecreto.length < 10) {
    return {
      ok: false,
      motivo:
        'el id del cliente termina en «.apps.googleusercontent.com» y el secreto viene con él: cópialos de Google Cloud › APIs y servicios › Credenciales.',
    };
  }
  const state = base64url(randomBytes(24));
  const verificador = base64url(randomBytes(48));
  const reto = base64url(createHash('sha256').update(verificador).digest());
  const vuelta = await esperarLaVuelta(state);
  const redirect = `http://127.0.0.1:${vuelta.puerto}`;
  mundo.decir(
    'Se abre el navegador. Entra con TU cuenta de Google, la del Drive donde van las copias, y acepta el permiso.',
  );
  mundo.abrir(
    `${AUTORIZAR}?${new URLSearchParams({
      client_id: clienteId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: ALCANCE_DE_DRIVE,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: reto,
      code_challenge_method: 'S256',
    })}`,
  );
  let codigo: string;
  try {
    codigo = await vuelta.codigo;
  } catch (e) {
    return { ok: false, motivo: (e as Error).message };
  }
  const canje = await mundo.fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clienteId,
      client_secret: clienteSecreto,
      code: codigo,
      code_verifier: verificador,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    }),
  });
  const t = (await canje.json().catch(() => ({}))) as {
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  if (!canje.ok)
    return { ok: false, motivo: `Google no cambió el código (${t.error ?? canje.status})` };
  if (!t.refresh_token) {
    return {
      ok: false,
      motivo:
        'Google no dio el permiso duradero. Quita el acceso de esta app en https://myaccount.google.com/permissions y vuelve a correr el script.',
    };
  }
  if (!t.scope?.split(' ').includes(ALCANCE_DE_DRIVE)) {
    return {
      ok: false,
      motivo:
        'el permiso no incluye guardar archivos en tu Drive. Vuelve a correr el script y marca esa casilla en la pantalla de Google antes de Continuar.',
    };
  }
  const prueba = await mundo.fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clienteId,
      client_secret: clienteSecreto,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!prueba.ok) {
    return { ok: false, motivo: `el permiso no sirvió para pedir un acceso (${prueba.status})` };
  }
  const llave =
    opciones.llaveNueva || !yaTieneLlave
      ? (opciones.azar ?? randomBytes)(32).toString('base64')
      : undefined;
  const valores: [string, string][] = [
    ['COPIA_DRIVE_CLIENTE_ID', clienteId],
    ['COPIA_DRIVE_CLIENTE_SECRETO', clienteSecreto],
    ['COPIA_DRIVE_REFRESH', t.refresh_token],
    ...(llave ? ([['COPIA_LLAVE', llave]] as [string, string][]) : []),
  ];
  for (const [nombre, valor] of valores) {
    const g = mundo.gh(['secret', 'set', nombre, '--env', ambiente], valor);
    if (!g.ok) {
      return {
        ok: false,
        motivo: `gh no pudo guardar ${nombre}: ${g.salida.trim().slice(0, 200)}`,
      };
    }
  }
  return llave ? { ok: true, llave } : { ok: true };
}

if (process.argv[1]?.endsWith('permiso-de-drive.ts')) {
  const i = process.argv.indexOf('--ambiente');
  const ambiente = process.argv[i + 1] as Ambiente | undefined;
  if (i < 0 || !ambiente || !AMBIENTES.includes(ambiente)) {
    console.error(
      '❌ Uso: node scripts/copia/permiso-de-drive.ts --ambiente staging|produccion [--llave-nueva]',
    );
    process.exit(1);
  }
  const r = await darPermisoDeDrive(ambiente, mundoReal(), {
    llaveNueva: process.argv.includes('--llave-nueva'),
  });
  if (!r.ok) {
    console.error(`❌ ${r.motivo}`);
    process.exit(1);
  }
  console.log(
    `✅ Permiso de Drive guardado en «${ambiente}». La copia empieza con el próximo despliegue.`,
  );
  if (r.llave) {
    console.log(
      `\n🔑 Llave de la copia (${ambiente}). Guárdala YA en tu gestor de contraseñas; no se vuelve a mostrar y sin ella ninguna copia se abre:\n\n${r.llave}\n`,
    );
  }
  process.exit(0);
}
