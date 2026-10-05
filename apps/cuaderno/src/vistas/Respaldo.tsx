/**
 * Respaldo del cuaderno (HU-E3.13): descargar todo en un archivo, CSV para Excel, e importar.
 *
 * - Importar primero revisa el archivo completo y muestra qué agregaría; nada se escribe hasta
 *   confirmar, y si algo falla no queda nada a medias (CA2, P21).
 * - Funciona en un teléfono nuevo, sin finca: así se restaura el cuaderno al cambiar de teléfono.
 * - La última descarga se recuerda en `meta` para avisar si hace mucho que no se respalda.
 */
import { fechaAgronomica, type TablaExportada } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  analizarArchivo,
  csvDeTipo,
  ErrorDeImportacion,
  exportarTodo,
  importar,
  type ResumenDeImportacion,
  TIPOS_CSV,
} from '../almacen/respaldo.ts';
import { corto, descargar } from '../descargar.ts';
import { fechaHora } from '../formato.ts';
import { CarpetaCumplimiento } from './CarpetaCumplimiento.tsx';
import { usarFinca } from './usarFinca.tsx';

const CLAVE_ULTIMO = 'ultimo_respaldo';

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const NOMBRE_TABLA: Record<TablaExportada, string> = {
  finca: 'Finca',
  area: 'Áreas',
  cultivo: 'Cultivos',
  ciclo: 'Ciclos',
  persona: 'Personas',
  valor_jornal: 'Valores de jornal',
  insumo: 'Insumos',
  tipo_labor: 'Tipos de labor',
  categoria_calidad: 'Categorías de calidad',
  registro: 'Registros',
  historial: 'Versiones anteriores',
};

const NOMBRE_CSV: Record<string, string> = {
  clima: 'Clima',
  riego: 'Riego',
  labor: 'Labores',
  aplicacion: 'Aplicaciones',
  cosecha: 'Cosecha',
  monitoreo: 'Monitoreo',
};

export function Respaldo() {
  const estado = usarFinca();
  const finca = !estado.cargando ? estado.finca : null;
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [descargado, setDescargado] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenDeImportacion | null>(null);
  const [errores, setErrores] = useState<readonly string[]>([]);
  const [importado, setImportado] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    void cuaderno()
      .meta.get(CLAVE_ULTIMO)
      .then((m) => setUltimo(typeof m?.valor === 'string' ? m.valor : null));
  }, []);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;

  const hoy = fechaAgronomica(Date.now());

  const exportar = async () => {
    if (!finca) return;
    setTrabajando(true);
    try {
      const db = cuaderno();
      const archivo = await exportarTodo(db, { app: __VERSION_APP__ });
      const nombre = `cuaderno-${corto(finca.nombre)}-${hoy}.json`;
      descargar(nombre, JSON.stringify(archivo), 'application/json');
      await db.meta.put({
        clave: CLAVE_ULTIMO,
        valor: archivo.generado,
        actualizado: archivo.generado,
      });
      setUltimo(archivo.generado);
      setDescargado(nombre);
    } finally {
      setTrabajando(false);
    }
  };

  const exportarCsv = async (tipo: string) => {
    if (!finca) return;
    const csv = await csvDeTipo(cuaderno(), finca.id, tipo);
    descargar(`${tipo}-${corto(finca.nombre)}-${hoy}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const elegirArchivo = async (e: Event) => {
    const entrada = e.currentTarget as HTMLInputElement;
    const archivo = entrada.files?.[0];
    setResumen(null);
    setErrores([]);
    setImportado(null);
    if (!archivo) return;
    setTrabajando(true);
    try {
      setResumen(await analizarArchivo(cuaderno(), await archivo.text()));
    } catch (error) {
      setErrores(
        error instanceof ErrorDeImportacion
          ? error.motivos
          : ['no se pudo leer el archivo en este teléfono'],
      );
    } finally {
      setTrabajando(false);
      entrada.value = ''; // permite elegir el mismo archivo otra vez
    }
  };

  const confirmar = async () => {
    if (!resumen) return;
    setTrabajando(true);
    try {
      const agregadas = await importar(cuaderno(), resumen);
      const total = Object.values(agregadas).reduce((s, n) => s + n, 0);
      setImportado(
        total === 0
          ? 'No había nada nuevo: este teléfono ya tenía todo lo del archivo.'
          : `Importado: ${cuantos(agregadas.registro, 'registro', 'registros')} y ${cuantos(total - agregadas.registro, 'dato de la finca', 'datos de la finca')}.`,
      );
      setResumen(null);
    } catch {
      setErrores([
        'no se pudo guardar en este teléfono; no quedó nada a medias, inténtalo otra vez',
      ]);
    } finally {
      setTrabajando(false);
    }
  };

  const nuevas = resumen ? Object.values(resumen.tablas).reduce((s, t) => s + t.nuevas, 0) : 0;

  return (
    <section aria-labelledby="titulo-respaldo">
      <h1 id="titulo-respaldo">Respaldo</h1>
      <p>
        Tu cuaderno vive en este teléfono. Descarga un respaldo y guárdalo fuera de él (correo,
        Drive o un computador): si pierdes el teléfono, lo restauras en otro.
      </p>

      <h2>Descargar</h2>
      {finca ? (
        <>
          <p class="ayuda" data-prueba="ultimo-respaldo">
            {ultimo
              ? `Último respaldo: ${fechaHora(ultimo)}.`
              : 'Todavía no has descargado un respaldo.'}
          </p>
          <div class="acciones">
            <button type="button" disabled={trabajando} onClick={() => void exportar()}>
              Descargar respaldo completo
            </button>
          </div>
          {descargado && (
            <p class="exito" role="status">
              Descargado como {descargado}. Guárdalo fuera del teléfono.
            </p>
          )}
          <h3>Para Excel (CSV)</h3>
          <p class="ayuda">Un archivo por tipo de registro, con vigentes y corregidos.</p>
          <div class="acciones">
            {TIPOS_CSV.map((t) => (
              <button type="button" class="secundario" key={t} onClick={() => void exportarCsv(t)}>
                {NOMBRE_CSV[t] ?? t} (CSV)
              </button>
            ))}
          </div>
          <CarpetaCumplimiento fincaId={finca.id} nombreFinca={finca.nombre} />
        </>
      ) : (
        <p class="ayuda">
          Todavía no hay finca en este teléfono. Puedes restaurar un respaldo abajo.
        </p>
      )}

      <h2>Importar</h2>
      <p class="ayuda">
        Importar agrega lo que falta y no cambia nada de lo que ya está en este teléfono.
      </p>
      <div class="campo">
        <label for="respaldo-archivo">Archivo de respaldo (.json)</label>
        <input
          id="respaldo-archivo"
          type="file"
          accept=".json,application/json"
          disabled={trabajando}
          onChange={(e) => void elegirArchivo(e)}
        />
      </div>
      {errores.length > 0 && (
        <div class="error" role="alert" data-prueba="respaldo-errores">
          <p>No se importó nada:</p>
          <ul>
            {errores.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {resumen && (
        <div class="estado" data-prueba="respaldo-resumen">
          <p>Respaldo del {fechaHora(resumen.archivo.generado)}. Esto es lo que se agregaría:</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Datos</th>
                <th scope="col">Nuevos</th>
                <th scope="col">Ya estaban</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(resumen.tablas) as TablaExportada[]).map((t) => (
                <tr key={t}>
                  <th scope="row">{NOMBRE_TABLA[t]}</th>
                  <td>{resumen.tablas[t].nuevas}</td>
                  <td>{resumen.tablas[t].existentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="acciones">
            <button
              type="button"
              disabled={trabajando || nuevas === 0}
              onClick={() => void confirmar()}
            >
              {nuevas === 0 ? 'No hay nada nuevo' : `Importar ${nuevas} datos nuevos`}
            </button>
            <button type="button" class="secundario" onClick={() => setResumen(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {importado && (
        <p class="exito" role="status">
          {importado} <a href="/agro/app/">Ver la finca</a>
        </p>
      )}
    </section>
  );
}
