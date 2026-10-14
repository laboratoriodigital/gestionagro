/**
 * El turno (HU-Q3.9, PARQUEADERO §5.1 Turno): abrirlo con el operador y la base, anotar los
 * movimientos de caja y cerrarlo con el efectivo contado por billete y moneda. Arriba el total
 * contado en grande; debajo lo esperado y la diferencia, en verde o en rojo; «Cerrar e imprimir»
 * abajo. El cierre sale en la PT-210 como la maqueta del anexo B.
 */
import { formatearPesos } from '@ed1/dinero';
import { papelDelCierre, type ResumenDeTurno } from '@ed1/parqueadero-recibos';
import { ErrorDeValidacion } from '@ed1/parqueadero-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from './actividad.ts';
import {
  abrirTurno,
  type Contexto,
  cerrarTurno,
  dispositivo,
  leerAjustes,
  registrarMovimiento,
  resumenDelTurno,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import type { ControlDeImpresora } from './impresora.ts';
import { pesosEscritos, type Turno as TurnoAbierto, turnoAbierto } from './turno.ts';

/** Billetes y monedas de Colombia, de mayor a menor. */
export const DENOMINACIONES = [
  100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50,
] as const;

const $ = formatearPesos;

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly control: ControlDeImpresora;
  /** Tras abrir: la entrada que lo pidió sigue (CA4). */
  readonly alAbrir: () => void;
  /** Al cerrar, la caja ofrece el respaldo (HU-Q3.9 CA2). */
  readonly alRespaldo: () => void;
  readonly alVolver: () => void;
}

export function Turno({ db, ctx, control, alAbrir, alRespaldo, alVolver }: Props) {
  const turno = useConsulta<TurnoAbierto | null | undefined>(() => turnoAbierto(db), undefined);
  const [cerrado, setCerrado] = useState<Cerrado | null>(null);
  useEffect(() => abrirFormulario(), []);

  if (cerrado) {
    return (
      <TurnoCerrado
        db={db}
        ctx={ctx}
        control={control}
        c={cerrado}
        alRespaldo={alRespaldo}
        alVolver={alVolver}
      />
    );
  }
  if (turno === undefined) return <section class="tarjeta" aria-busy="true" />;
  if (turno === null) return <AbrirTurno db={db} ctx={ctx} alAbrir={alAbrir} alVolver={alVolver} />;
  return <CerrarTurno db={db} ctx={ctx} turno={turno} alCerrar={setCerrado} alVolver={alVolver} />;
}

export function AbrirTurno({
  db,
  ctx,
  alAbrir,
  alVolver,
}: Pick<Props, 'db' | 'ctx' | 'alAbrir' | 'alVolver'>) {
  const [operador, setOperador] = useState('');
  const [base, setBase] = useState('');
  const [error, setError] = useState('');
  const valor = pesosEscritos(base);
  const falta = !operador.trim()
    ? 'Falta quién abre el turno'
    : valor === null
      ? 'Falta la base de caja'
      : '';

  async function abrir(e: Event) {
    e.preventDefault();
    if (falta || valor === null) return;
    try {
      await abrirTurno(db, { operador, base: valor }, ctx);
      alAbrir();
    } catch (err) {
      setError(err instanceof ErrorDeValidacion ? err.message : `No se pudo abrir: ${String(err)}`);
    }
  }

  return (
    <form class="tarjeta" onSubmit={abrir} data-prueba="abrir-turno">
      <h1>Abrir el turno</h1>
      <p>Antes del primer recibo: quién atiende y con cuánto efectivo empieza la caja.</p>
      <div class="campo">
        <label for="turno-operador">Quién atiende</label>
        <input
          id="turno-operador"
          maxLength={30}
          autoComplete="off"
          value={operador}
          onInput={(e) => setOperador(e.currentTarget.value)}
        />
      </div>
      <div class="campo">
        <label for="turno-base">Base de caja (efectivo al empezar)</label>
        <input
          id="turno-base"
          inputMode="numeric"
          autoComplete="off"
          value={base}
          onInput={(e) => setBase(e.currentTarget.value)}
        />
      </div>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" class="boton boton-principal" disabled={Boolean(falta)}>
        {falta || 'Abrir turno'}
      </button>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </form>
  );
}

interface Cerrado {
  readonly resumen: ResumenDeTurno;
  readonly contado: number;
  readonly motivo: string | null;
  readonly cerro: number;
}

function CerrarTurno({
  db,
  ctx,
  turno,
  alCerrar,
  alVolver,
}: Pick<Props, 'db' | 'ctx' | 'alVolver'> & {
  readonly turno: TurnoAbierto;
  readonly alCerrar: (c: Cerrado) => void;
}) {
  const resumen = useConsulta<ResumenDeTurno | null>(() => resumenDelTurno(db, turno), null);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!resumen) return <section class="tarjeta" aria-busy="true" />;
  const contado = DENOMINACIONES.reduce(
    (suma, d) => suma + d * (pesosEscritos(cantidades[d] ?? '') ?? 0),
    0,
  );
  const diferencia = contado - resumen.esperado;
  const falta = diferencia !== 0 && !motivo.trim() ? 'Falta el motivo de la diferencia' : '';

  async function cerrar(e: Event) {
    e.preventDefault();
    if (falta) return;
    setOcupado(true);
    setError('');
    try {
      const r = await cerrarTurno(db, turno, { contado, motivo }, ctx);
      alCerrar({
        resumen: r.resumen,
        contado,
        motivo: motivo.trim() || null,
        cerro: Date.parse(r.cierre.instante_evento),
      });
    } catch (err) {
      setError(
        err instanceof ErrorDeValidacion ? err.message : `No se pudo cerrar: ${String(err)}`,
      );
      setOcupado(false);
    }
  }

  return (
    <>
      <section class="tarjeta" data-prueba="turno">
        <h1>
          Turno <span class="exacto">{resumen.numero}</span>
        </h1>
        <p>
          {turno.operador} · abrió a las {horaBogota(resumen.abrio)}
        </p>
        <dl class="filas">
          <div>
            <dt>Entradas</dt>
            <dd>{resumen.entradas}</dd>
          </div>
          <div>
            <dt>Salidas</dt>
            <dd>{resumen.salidas}</dd>
          </div>
          <div>
            <dt>Anulaciones</dt>
            <dd>{resumen.anulaciones}</dd>
          </div>
          <div>
            <dt>Base</dt>
            <dd>{$(resumen.base)}</dd>
          </div>
        </dl>
      </section>
      <Movimientos db={db} ctx={ctx} />
      <form class="tarjeta" onSubmit={cerrar} data-prueba="cerrar-turno">
        <h2>Cerrar el turno</h2>
        <p class="ayuda">Cuente el efectivo de la caja: cuántos billetes y monedas de cada uno.</p>
        <div class="conteo">
          {DENOMINACIONES.map((d) => (
            <div class="campo" key={d}>
              <label for={`conteo-${d}`}>{$(d)}</label>
              <input
                id={`conteo-${d}`}
                inputMode="numeric"
                autoComplete="off"
                value={cantidades[d] ?? ''}
                onInput={(e) => setCantidades({ ...cantidades, [d]: e.currentTarget.value })}
              />
            </div>
          ))}
        </div>
        <p>Contado</p>
        <p class="total-grande" data-prueba="contado">
          {$(contado)}
        </p>
        <p data-prueba="esperado">Efectivo esperado: {$(resumen.esperado)}</p>
        <p class={diferencia === 0 ? 'exito' : 'error'} data-prueba="diferencia" aria-live="polite">
          Diferencia: {$(diferencia)}
        </p>
        {diferencia !== 0 && (
          <div class="campo">
            <label for="turno-motivo">Motivo de la diferencia</label>
            <input
              id="turno-motivo"
              maxLength={80}
              value={motivo}
              onInput={(e) => setMotivo(e.currentTarget.value)}
            />
          </div>
        )}
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" class="boton boton-principal" disabled={Boolean(falta) || ocupado}>
          {falta || 'Cerrar e imprimir'}
        </button>
        <button type="button" class="boton boton-secundario" onClick={alVolver}>
          Volver al inicio
        </button>
      </form>
    </>
  );
}

/** Un ingreso o un gasto de la caja en medio del turno (CA1). */
function Movimientos({ db, ctx }: Pick<Props, 'db' | 'ctx'>) {
  const [clase, setClase] = useState<'ingreso' | 'gasto'>('gasto');
  const [valor, setValor] = useState('');
  const [concepto, setConcepto] = useState('');
  const [anotado, setAnotado] = useState('');
  const pesos = pesosEscritos(valor);
  const falta = !pesos ? 'Falta el valor' : !concepto.trim() ? 'Falta el concepto' : '';

  async function anotar(e: Event) {
    e.preventDefault();
    if (falta || !pesos) return;
    await registrarMovimiento(db, { clase, valor: pesos, concepto }, ctx);
    setAnotado(`${clase === 'gasto' ? 'Gasto' : 'Ingreso'} de ${$(pesos)} anotado.`);
    setValor('');
    setConcepto('');
  }

  return (
    <form class="tarjeta" onSubmit={anotar} data-prueba="movimientos">
      <h2>Entra o sale plata de la caja</h2>
      <fieldset class="grupo">
        <legend>¿Qué es?</legend>
        <div class="dos">
          {(['gasto', 'ingreso'] as const).map((c) => (
            <button
              key={c}
              type="button"
              class="boton"
              aria-pressed={clase === c}
              onClick={() => setClase(c)}
            >
              {c === 'gasto' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>
      </fieldset>
      <div class="campo">
        <label for="movimiento-valor">Valor</label>
        <input
          id="movimiento-valor"
          inputMode="numeric"
          autoComplete="off"
          value={valor}
          onInput={(e) => setValor(e.currentTarget.value)}
        />
      </div>
      <div class="campo">
        <label for="movimiento-concepto">Concepto</label>
        <input
          id="movimiento-concepto"
          maxLength={60}
          value={concepto}
          onInput={(e) => setConcepto(e.currentTarget.value)}
        />
      </div>
      <button type="submit" class="boton" disabled={Boolean(falta)}>
        {falta || 'Anotar'}
      </button>
      <output aria-live="polite">{anotado}</output>
    </form>
  );
}

/** Después de cerrar: el papel del cierre, y volver a imprimirlo si no salió. */
function TurnoCerrado({
  db,
  ctx,
  control,
  c,
  alRespaldo,
  alVolver,
}: Pick<Props, 'db' | 'ctx' | 'control' | 'alRespaldo' | 'alVolver'> & {
  readonly c: Cerrado;
}) {
  const [estado, setEstado] = useState('Enviando el cierre a la impresora…');
  const [salio, setSalio] = useState(false);

  async function imprimir() {
    setEstado('Enviando el cierre a la impresora…');
    const [impresora, { sede }, { serie }] = await Promise.all([
      db.impresora.get('actual'),
      leerAjustes(db),
      dispositivo(db, ctx),
    ]);
    const abiertas = await db.estadias.count();
    const bloques = papelDelCierre(
      c.resumen,
      {
        nombreDeLaSede: sede?.nombre ?? 'Parqueadero',
        serie,
        cerro: c.cerro,
        abiertas,
        contado: c.contado,
        motivo: c.motivo,
        version: __VERSION_CAJA__,
      },
      {
        columnas: impresora?.columnas ?? 32,
        paginaDeCodigos: impresora?.paginaDeCodigos ?? 'cp850',
        hora12: sede?.formato_hora === '12h',
      },
    );
    const r = await control.imprimir(bloques);
    setSalio(r.ok);
    setEstado(
      r.ok
        ? 'Cierre enviado a la impresora'
        : 'El cierre no salió: la impresora no está conectada o no respondió.',
    );
  }

  useEffect(() => {
    void imprimir();
  }, []);

  // HU-Q7.9 CA2: con la caja en la nube, el turno sube solo y el archivo deja de pedirse.
  const vinculada = useConsulta<boolean>(
    () => db.meta.get('nube').then((m) => m?.clave === 'nube'),
    false,
  );
  const enCola = useConsulta(() => db.outbox.count(), 0);
  const diferencia = c.contado - c.resumen.esperado;
  return (
    <section class="tarjeta" data-prueba="turno-cerrado">
      <h1>
        Turno <span class="exacto">{c.resumen.numero}</span> cerrado
      </h1>
      <p class={diferencia === 0 ? 'exito' : 'error'}>
        Contado {$(c.contado)} · diferencia {$(diferencia)}
      </p>
      <output aria-live="polite" data-prueba="estado-del-cierre">
        {estado}
      </output>
      {!salio && (
        <button type="button" class="boton" onClick={() => void imprimir()}>
          Imprimir el cierre otra vez
        </button>
      )}
      {vinculada ? (
        <p data-prueba="cierre-en-la-nube">
          {enCola === 0
            ? 'El turno ya está en la nube: no hace falta el archivo.'
            : `El turno sube solo a la nube; quedan ${enCola} esperando señal. No hace falta el archivo.`}
        </p>
      ) : (
        <>
          <p>
            Ahora guarde el respaldo del turno: si se pierde el teléfono, la caja vuelve con él.
          </p>
          <button type="button" class="boton boton-principal" onClick={alRespaldo}>
            Hacer el respaldo
          </button>
        </>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
