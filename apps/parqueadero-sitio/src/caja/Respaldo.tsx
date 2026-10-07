/**
 * Respaldo y restauración (HU-Q3.10, PARQUEADERO §5.3 regla 6): todo lo de la caja en un archivo
 * que se comparte al correo o a Drive, y un archivo que se une a esta caja sin borrar nada.
 */
import { useState } from 'preact/hooks';
import {
  anotarRespaldo,
  armarRespaldo,
  type Contexto,
  RespaldoInvalido,
  restaurar,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly alVolver: () => void;
}

/** Comparte los archivos si el teléfono puede (correo, Drive); si no, los descarga. */
async function entregar(archivos: readonly File[]): Promise<'compartido' | 'descargado'> {
  const datos = { files: [...archivos], title: 'Respaldo del parqueadero' };
  if (navigator.canShare?.(datos)) {
    await navigator.share(datos);
    return 'compartido';
  }
  for (const a of archivos) {
    const url = URL.createObjectURL(a);
    const enlace = Object.assign(document.createElement('a'), { href: url, download: a.name });
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'descargado';
}

export function Respaldo({ db, ctx, alVolver }: Props) {
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function respaldar() {
    setOcupado(true);
    setError('');
    try {
      const r = await armarRespaldo(db, ctx, __VERSION_CAJA__);
      const como = await entregar([
        new File([JSON.stringify(r.json)], `${r.nombre}.json`, { type: 'application/json' }),
        new File([r.csv], `${r.nombre}.csv`, { type: 'text/csv' }),
      ]);
      await anotarRespaldo(db, ctx.reloj());
      setEstado(
        como === 'compartido'
          ? 'Respaldo compartido. Guárdelo en su correo o en su Drive.'
          : `Respaldo descargado: ${r.nombre}.json y su copia para Excel.`,
      );
    } catch (e) {
      // Cerrar el menú de compartir no es un error: el respaldo no salió y se dice.
      setError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'No se compartió: el respaldo no salió del teléfono.'
          : `No se pudo hacer el respaldo: ${String(e)}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function cargar(archivo: File | undefined) {
    if (!archivo) return;
    setOcupado(true);
    setError('');
    setEstado('');
    try {
      const r = await restaurar(db, JSON.parse(await archivo.text()));
      setEstado(
        `Listo: se agregaron ${r.agregados} datos y ${r.yaEstaban} ya estaban. No se borró nada.`,
      );
    } catch (e) {
      setError(
        e instanceof RespaldoInvalido
          ? `Este archivo no se puede usar, y la caja quedó como estaba: ${e.message}.`
          : e instanceof SyntaxError
            ? 'Este archivo no es un respaldo del parqueadero, y la caja quedó como estaba.'
            : `No se pudo restaurar: ${String(e)}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section class="tarjeta" data-prueba="respaldo">
      <h1>Respaldo</h1>
      <p>
        Todo lo de la caja queda en este teléfono. Haga un respaldo al cerrar cada turno y guárdelo
        en su correo o en su Drive: si se pierde el teléfono, la caja vuelve con él.
      </p>
      <p class="ayuda">
        Las fotos de los vehículos no van en el respaldo: se quedan en este teléfono.
      </p>
      <button
        type="button"
        class="boton boton-principal"
        disabled={ocupado}
        onClick={() => void respaldar()}
      >
        Hacer el respaldo
      </button>
      <div class="campo">
        <label for="restaurar">Restaurar un respaldo (se une a lo que hay; no borra nada)</label>
        <input
          id="restaurar"
          type="file"
          accept=".json,application/json"
          disabled={ocupado}
          onChange={(e) => void cargar(e.currentTarget.files?.[0])}
        />
      </div>
      <output aria-live="polite" data-prueba="estado-del-respaldo">
        {estado}
      </output>
      {error && (
        <p class="error" role="alert" data-prueba="aviso-respaldo">
          {error}
        </p>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
