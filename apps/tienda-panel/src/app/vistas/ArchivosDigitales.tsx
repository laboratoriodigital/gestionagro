/**
 * HU-P6.1 (sprint PF2): el archivo de cada combinación de un producto digital. Se sube cuando el
 * producto ya está guardado (sus combinaciones tienen id). El panel calcula la huella SHA-256 y R2
 * la verifica: un archivo que llega distinto no se guarda. Topes: 50 MB por archivo y 1 GB por tienda.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';

const TIPOS = 'application/pdf,application/zip,audio/mpeg,video/mp4,image/jpeg,image/png';
const TOPE = 50_000_000;

interface Archivo {
  variante: string;
  nombre: string;
  bytes: number;
}

/** «12,4 MB», con coma decimal. */
export const enMegas = (bytes: number) => `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`;

async function huellaDe(archivo: Blob): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function ArchivosDigitales({
  conexion,
  variantes,
  alVencer,
}: {
  conexion: Conexion;
  /** Las combinaciones guardadas: su id y cómo se llaman («PDF», «PDF + audio»). */
  variantes: readonly { id: string; nombre: string }[];
  alVencer: (motivo: string) => void;
}) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [uso, setUso] = useState<{ total: number; tope: number } | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'peligro'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<{ archivos: Archivo[]; total: number; tope: number }>(
      conexion,
      'digitales',
    );
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo === 'ok') {
      setArchivos(r.datos.archivos);
      setUso({ total: r.datos.total, tope: r.datos.tope });
    }
  }, [conexion, alVencer]);
  useEffect(() => void cargar(), [cargar]);

  const subir = async (variante: string, archivo: File) => {
    setAviso(null);
    if (archivo.size > TOPE) {
      setAviso({ tono: 'peligro', texto: 'El archivo puede pesar hasta 50 MB.' });
      return;
    }
    setSubiendo(variante);
    try {
      const r = await pedirAlPanel<{ nombre: string }>(
        conexion,
        `digitales?variante=${encodeURIComponent(variante)}`,
        {
          archivo: {
            datos: archivo,
            cabeceras: {
              'x-nombre': encodeURIComponent(archivo.name),
              'x-huella': await huellaDe(archivo),
            },
          },
        },
      );
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') {
        setAviso({ tono: 'peligro', texto: r.problemas?.[0]?.mensaje ?? r.motivo });
        return;
      }
      setAviso({ tono: 'exito', texto: `Listo: «${r.datos.nombre}» quedó guardado.` });
      await cargar();
    } finally {
      setSubiendo(null);
    }
  };

  return (
    <fieldset class="ed1-grupo" id="archivos-digitales">
      <legend class="ed1-grupo__titulo">El archivo de cada combinación</legend>
      <p class="nota">
        PDF, ZIP, MP3, MP4, JPG o PNG, de hasta 50 MB. Tu cliente lo descarga cuando su pago queda
        confirmado. Guarda tus originales: estos archivos no entran en «Descargar todo».
      </p>
      {variantes.length === 0 ? (
        <p class="nota">Guarda el producto para poder subir sus archivos.</p>
      ) : null}
      {aviso ? (
        <Aviso tono={aviso.tono} titulo={aviso.tono === 'exito' ? 'Archivo guardado' : 'Revisa'}>
          {aviso.texto}
        </Aviso>
      ) : null}
      {variantes.map((v) => {
        const a = archivos.find((x) => x.variante === v.id);
        return (
          <div class="ed1-campo" key={v.id}>
            <label class="ed1-campo__etiqueta" for={`archivo-${v.id}`}>
              {v.nombre}
            </label>
            <p class="nota">{a ? `${a.nombre} · ${enMegas(a.bytes)}` : 'Todavía sin archivo.'}</p>
            <input
              class="ed1-campo__control"
              id={`archivo-${v.id}`}
              type="file"
              accept={TIPOS}
              disabled={subiendo !== null}
              aria-busy={subiendo === v.id ? 'true' : undefined}
              onChange={(e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) void subir(v.id, f);
              }}
            />
          </div>
        );
      })}
      {uso ? (
        <p class="nota">
          Tu tienda lleva {enMegas(uso.total)} de {enMegas(uso.tope)}.
        </p>
      ) : null}
    </fieldset>
  );
}
