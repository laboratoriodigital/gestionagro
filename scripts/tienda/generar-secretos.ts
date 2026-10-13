/**
 * `node scripts/tienda/generar-secretos.ts --ambiente staging|produccion` (HU-T2.5, TIENDA-3.0
 * §14.2 y §14.6): genera, una sola vez por ambiente, los dos secretos de la Tienda y los guarda en
 * el ambiente de GitHub con `gh`, por stdin:
 *
 * - `SECRETO_DESPACHO`: el que comparten el despacho, el panel y la API (§14.1).
 * - `TIENDA_KEK_V1`: la llave maestra del cifrado de sobre. **A diferencia de la clave del CORE, no
 *   nace dentro del Worker: perderla pierde datos.** Por eso se copia al portapapeles, nunca a la
 *   pantalla, y el script no la guarda hasta que el dueño confirma que la pegó en su gestor de
 *   contraseñas. Después vacía el portapapeles.
 *
 * Lo que ya existe en el ambiente no se reemplaza: una KEK nueva dejaría ilegible lo cifrado con la
 * vieja (rotarla es otra historia, con su cola de reenvoltura). Si `gh` no puede leer el ambiente, lo
 * dice y no genera nada: nunca queda una KEK a medias (CA3). Node y `gh`, sin shell (P3: corre en
 * Windows). Los pasos están en `docs/runbooks/secretos-de-la-tienda.md`.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

export const SECRETOS = ['SECRETO_DESPACHO', 'TIENDA_KEK_V1'] as const;
export type Secreto = (typeof SECRETOS)[number];
export const AMBIENTES = ['staging', 'produccion'] as const;
export type Ambiente = (typeof AMBIENTES)[number];

/** 32 bytes al azar en base64: lo que lee `estadoDeLaKek` de la API. */
export function nuevoSecreto(aleatorio: (n: number) => Uint8Array): string {
  const bytes = aleatorio(32);
  if (bytes.length !== 32) throw new RangeError('se necesitan 32 bytes');
  return btoa(String.fromCharCode(...bytes));
}

/** Los secretos que faltan en el ambiente, en orden: lo que existe nunca se reemplaza. */
export const secretosQueFaltan = (existentes: readonly string[]): Secreto[] =>
  SECRETOS.filter((s) => !existentes.includes(s));

/** El portapapeles de cada sistema: el de Windows primero (P3). */
export function comandoDelPortapapeles(plataforma: NodeJS.Platform): [string, string[]] | null {
  if (plataforma === 'win32') return ['clip', []];
  if (plataforma === 'darwin') return ['pbcopy', []];
  if (plataforma === 'linux') return ['xclip', ['-selection', 'clipboard']];
  return null;
}

/** Lo que el script necesita del mundo: inyectable para probarlo sin GitHub ni teclado. */
export interface Mundo {
  /** `gh` con argumentos y, si se da, lo que va por stdin. */
  gh(argumentos: string[], entrada?: string): { ok: boolean; salida: string };
  /** Copia al portapapeles; false si no pudo. */
  copiar(texto: string): boolean;
  preguntar(pregunta: string): Promise<string>;
  decir(texto: string): void;
  aleatorio(n: number): Uint8Array;
}

/** Lo que pasó, para la salida y para las pruebas. Nunca lleva un valor secreto. */
export interface Resultado {
  ok: boolean;
  creados: Secreto[];
  existian: Secreto[];
  motivo?: string;
}

export async function generar(ambiente: Ambiente, mundo: Mundo): Promise<Resultado> {
  const lista = mundo.gh(['secret', 'list', '--env', ambiente, '--json', 'name']);
  let existentes: string[];
  try {
    if (!lista.ok) throw new Error();
    existentes = (JSON.parse(lista.salida) as { name: string }[]).map((x) => x.name);
  } catch {
    return {
      ok: false,
      creados: [],
      existian: [],
      motivo: `gh no pudo leer los secretos del ambiente «${ambiente}». Revisa «gh auth status» y que el ambiente exista en el repositorio. No se generó nada.`,
    };
  }
  const faltan = secretosQueFaltan(existentes);
  const existian = SECRETOS.filter((s) => existentes.includes(s));
  const creados: Secreto[] = [];
  for (const secreto of faltan) {
    const valor = nuevoSecreto(mundo.aleatorio);
    if (secreto === 'TIENDA_KEK_V1') {
      if (!mundo.copiar(valor)) {
        return {
          ok: false,
          creados,
          existian,
          motivo:
            'no se pudo copiar la llave maestra al portapapeles, y no se muestra en pantalla. No se guardó: corre el script desde un equipo con portapapeles.',
        };
      }
      mundo.decir(
        'La llave maestra de la Tienda está en tu portapapeles. Pégala ahora en tu gestor de contraseñas, con el nombre «Tienda · llave maestra · ' +
          ambiente +
          '». Sin esa copia, si un día se pierde la de GitHub, los datos cifrados de los comercios no se recuperan.',
      );
      const respuesta = (
        await mundo.preguntar('¿La guardaste en tu gestor de contraseñas? (sí/no): ')
      )
        .trim()
        .toLowerCase();
      mundo.copiar('');
      if (respuesta !== 'sí' && respuesta !== 'si') {
        return {
          ok: false,
          creados,
          existian,
          motivo:
            'sin la copia fuera de línea la llave maestra no se guarda. Vuelve a correr el script cuando tengas el gestor de contraseñas a mano.',
        };
      }
    }
    const guardar = mundo.gh(['secret', 'set', secreto, '--env', ambiente], valor);
    if (!guardar.ok) {
      return {
        ok: false,
        creados,
        existian,
        motivo: `gh no pudo guardar ${secreto} en «${ambiente}»: ${guardar.salida.trim().slice(0, 200)}`,
      };
    }
    creados.push(secreto);
  }
  return { ok: true, creados, existian };
}

function mundoReal(): Mundo {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    gh(argumentos, entrada) {
      const r = spawnSync('gh', argumentos, {
        encoding: 'utf8',
        ...(entrada === undefined ? {} : { input: entrada }),
      });
      return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
    },
    copiar(texto) {
      const comando = comandoDelPortapapeles(process.platform);
      if (!comando) return false;
      return spawnSync(comando[0], comando[1], { input: texto }).status === 0;
    },
    preguntar: async (pregunta) => {
      const r = await rl.question(pregunta);
      return r;
    },
    decir: (texto) => console.log(texto),
    aleatorio: (n) => crypto.getRandomValues(new Uint8Array(n)),
  };
}

if (process.argv[1]?.endsWith('generar-secretos.ts')) {
  const i = process.argv.indexOf('--ambiente');
  const ambiente = process.argv[i + 1] as Ambiente | undefined;
  if (i < 0 || !ambiente || !AMBIENTES.includes(ambiente)) {
    console.error('❌ Uso: node scripts/tienda/generar-secretos.ts --ambiente staging|produccion');
    process.exit(1);
  }
  const r = await generar(ambiente, mundoReal());
  if (r.creados.length > 0) console.log(`✅ Guardados en «${ambiente}»: ${r.creados.join(', ')}`);
  if (r.existian.length > 0) console.log(`ℹ️ Ya existían y no se tocaron: ${r.existian.join(', ')}`);
  if (!r.ok) console.error(`❌ ${r.motivo}`);
  process.exit(r.ok ? 0 : 1);
}
