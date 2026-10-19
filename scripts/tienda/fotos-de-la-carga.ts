/**
 * HU-T12.3: las fotos de una carga, desde la máquina del operador (TIENDA §17.2, ADR-18). Para cada
 * foto del archivo `tienda-import/1`: la baja de su dirección, le saca la huella al original, hace
 * las derivadas de 400, 800 y 1600 px con `sharp` y las sube por la API del panel, igual que el
 * teléfono (HU-T8.3): mismo nombre por huella, mismo formulario (`apps/tienda-panel/src/app/fotos.ts`,
 * P2). El original no se sube.
 *
 * - **CA3.** Una foto que no se puede bajar, abrir o subir se dice con su producto y su dirección, y
 *   las demás siguen. El resumen dice cuántas faltaron.
 * - **CA2.** Corre en Windows: `sharp` trae sus binarios por plataforma, y la prueba lo usa de
 *   verdad (`tests/repo/tienda-fotos-de-la-carga.test.ts`, en el trabajo `scripts-windows`).
 */

import {
  type Codificar,
  derivar,
  FotoInvalida,
  formularioDeFoto,
  huellaDe,
} from '../../apps/tienda-panel/src/app/fotos.ts';
import { type CargaTienda, idDelProductoCargado } from '../../packages/tienda-schema/src/carga.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Lo que pesa como mucho un original que se baja: 25 MB. */
export const BYTES_DEL_ORIGINAL = 25_000_000;

/** Abre un original y devuelve sus medidas, derecho, y cómo codificarlo: con `sharp`. */
export type Abrir = (
  bytes: Uint8Array,
) => Promise<{ ancho: number; alto: number; codificar: Codificar }>;

/** Con `sharp`, que se carga solo cuando hace falta: la API y el panel no lo usan. */
export const abrirConSharp: Abrir = async (bytes) => {
  const { default: sharp } = await import('sharp');
  // `rotate()` sin ángulo endereza la foto según su EXIF, como el teléfono.
  const derecha = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true });
  return {
    ancho: derecha.info.width,
    alto: derecha.info.height,
    codificar: async (ancho, alto, tipo, calidad) => {
      const base = sharp(derecha.data).resize(ancho, alto, { fit: 'fill' });
      const q = Math.round(calidad * 100);
      const salida =
        tipo === 'image/webp'
          ? await base.webp({ quality: q }).toBuffer()
          : tipo === 'image/jpeg'
            ? await base.jpeg({ quality: q, mozjpeg: true }).toBuffer()
            : null;
      return salida ? new Blob([new Uint8Array(salida)], { type: tipo }) : null;
    },
  };
};

export interface OpcionesDeLasFotos {
  carga: CargaTienda;
  panel: string;
  token: string;
  fetch?: Fetch;
  abrir?: Abrir;
  decir?: (linea: string) => void;
}

/** Sube las fotos de la carga. Devuelve cuántas subieron y cuántas faltaron. */
export async function subirFotosDeLaCarga(
  o: OpcionesDeLasFotos,
): Promise<{ subidas: number; faltaron: number }> {
  const f = o.fetch ?? fetch;
  const abrir = o.abrir ?? abrirConSharp;
  const decir = o.decir ?? ((l: string) => console.log(l));
  let subidas = 0;
  let faltaron = 0;
  for (const p of o.carga.productos) {
    for (const m of p.medios) {
      const falta = (motivo: string) => {
        faltaron++;
        decir(`  ❌ ${p.nombre} (${p.refExterna}): ${m.url}: ${motivo}`);
      };
      let original: Uint8Array<ArrayBuffer>;
      try {
        const r = await f(m.url);
        if (!r.ok) {
          falta(`no se pudo bajar (HTTP ${r.status})`);
          continue;
        }
        original = new Uint8Array(await r.arrayBuffer());
      } catch (e) {
        falta(`no se pudo bajar (${e instanceof Error ? e.message : String(e)})`);
        continue;
      }
      if (original.length > BYTES_DEL_ORIGINAL) {
        falta(`pesa ${Math.ceil(original.length / 1_000_000)} MB: el tope es 25`);
        continue;
      }
      let formulario: FormData;
      try {
        const foto = await abrir(original);
        const derivadas = await derivar({ ancho: foto.ancho, alto: foto.alto }, foto.codificar);
        formulario = formularioDeFoto({
          producto: idDelProductoCargado(p.refExterna),
          huella: await huellaDe(new Blob([original])),
          alt: m.alt,
          original: { ancho: foto.ancho, alto: foto.alto },
          derivadas,
        });
      } catch (e) {
        falta(
          e instanceof FotoInvalida
            ? e.message
            : `no se pudo abrir como foto (${e instanceof Error ? e.message : String(e)})`,
        );
        continue;
      }
      try {
        const r = await f(`${o.panel.replace(/\/$/, '')}/api/panel/v1/medios/subir`, {
          method: 'POST',
          headers: { authorization: `Bearer ${o.token}` },
          body: formulario,
        });
        if (!r.ok) {
          const cuerpo = (await r.json().catch(() => ({}))) as {
            motivo?: string;
            problemas?: { mensaje: string }[];
          };
          falta(
            `el panel no la guardó (${r.status}: ${cuerpo.problemas?.map((x) => x.mensaje).join('; ') ?? cuerpo.motivo ?? 'sin detalle'})`,
          );
          continue;
        }
        subidas++;
      } catch (e) {
        falta(`el panel no respondió (${e instanceof Error ? e.message : String(e)})`);
      }
    }
  }
  decir(
    faltaron === 0
      ? `✅ ${subidas} fotos subidas.`
      : `⚠️ ${subidas} fotos subidas; faltaron ${faltaron}: vuelve a correr el comando cuando las arregles.`,
  );
  return { subidas, faltaron };
}
