/**
 * Respaldo y restauración (HU-Q3.10, PARQUEADERO §5.3 regla 6): todo lo de la caja en un archivo
 * que se comparte al correo o a Drive, y un archivo que se une a esta caja sin borrar nada.
 *
 * Con la caja en la nube (HU-Q7.9): la pantalla dice desde cuándo está todo allá, y el archivo se
 * arma después de subir y bajar todo, con lo de todas las cajas del parqueadero. Antes de
 * entregarlo se compara con lo que la nube dice tener: el archivo dice si está completo.
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
import { fechaBogota, horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import type { Nube } from './nube.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly nube?: Nube;
  readonly alVolver: () => void;
}

const cifra = (n: number) => n.toLocaleString('es-CO');

/** Lo que el archivo tiene frente a la nube, en una frase. */
async function frenteALaNube(db: BaseDeLaCaja, nube: Nube | undefined): Promise<string> {
  if (!nube || (await db.meta.get('nube'))?.clave !== 'nube') return '';
  await nube.ahora();
  const { compararConLaNube } = await import('./cuenta.ts');
  const c = await compararConLaNube(db);
  if (!c) return ' No se pudo comparar con la nube: sin señal.';
  const [caja, enLaNube] = c.registros;
  return caja >= enLaNube && c.catalogos[0] >= c.catalogos[1]
    ? ` Tiene los ${cifra(enLaNube)} registros que hay en la nube.`
    : ` La nube tiene ${cifra(enLaNube)} registros y este archivo ${cifra(caja)}: con señal, vuelva a hacerlo para que lleve todo.`;
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

export function Respaldo({ db, ctx, nube, alVolver }: Props) {
  const vinculada = useConsulta<boolean>(
    () => db.meta.get('nube').then((m) => m?.clave === 'nube'),
    false,
  );
  const alDia = useConsulta<number | null>(
    () => db.meta.get('nube_al_dia').then((m) => (m?.clave === 'nube_al_dia' ? m.instante : null)),
    null,
  );
  const enCola = useConsulta(() => db.outbox.count(), 0);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function respaldar() {
    setOcupado(true);
    setError('');
    try {
      const completo = await frenteALaNube(db, nube);
      const r = await armarRespaldo(db, ctx, __VERSION_CAJA__);
      const como = await entregar([
        new File([JSON.stringify(r.json)], `${r.nombre}.json`, { type: 'application/json' }),
        new File([r.csv], `${r.nombre}.csv`, { type: 'text/csv' }),
      ]);
      await anotarRespaldo(db, ctx.reloj());
      setEstado(
        (como === 'compartido'
          ? 'Respaldo compartido. Guárdelo en su correo o en su Drive.'
          : `Respaldo descargado: ${r.nombre}.json y su copia para Excel.`) + completo,
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
      {vinculada ? (
        <>
          <p data-prueba="respaldo-en-la-nube">
            {enCola === 0 && alDia !== null
              ? `Todo está en la nube desde el ${fechaBogota(alDia).slice(0, 5)} a las ${horaBogota(alDia)}.`
              : enCola > 0
                ? `En la nube, salvo ${cifra(enCola)} que esperan señal en este teléfono.`
                : 'La caja está en la nube; todavía no termina la primera vuelta.'}{' '}
            Si se pierde el teléfono, lo del parqueadero vuelve al entrar con la cuenta en otro.
          </p>
          <p class="ayuda">
            El archivo es opcional: lleva lo de todas las cajas, para guardarlo donde usted quiera.
          </p>
        </>
      ) : (
        <p>
          Todo lo de la caja queda en este teléfono. Haga un respaldo al cerrar cada turno y
          guárdelo en su correo o en su Drive: si se pierde el teléfono, la caja vuelve con él.
        </p>
      )}
      <p class="ayuda">
        Las fotos de los vehículos no van en el respaldo: se quedan en este teléfono.
      </p>
      <button
        type="button"
        class="boton boton-principal"
        disabled={ocupado}
        onClick={() => void respaldar()}
      >
        {vinculada ? 'Descargar todo el parqueadero' : 'Hacer el respaldo'}
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
