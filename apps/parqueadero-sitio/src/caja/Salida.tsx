/**
 * La salida y el cobro (HU-Q3.5, PARQUEADERO §5.1): arriba la placa y el tiempo, en el centro el
 * total con su detalle plegado, abajo los medios de pago y «Cobrar». El total se calcula al abrir
 * y es el que se cobra (`registrarSalida` con su instante). ED1 no toca el dinero: el QR o la
 * transferencia son los del propio parqueadero.
 */
import { formatearPesos } from '@ed1/dinero';
import { conceptoDeLinea } from '@ed1/parqueadero-recibos';
import { ErrorDeValidacion, type Registro } from '@ed1/parqueadero-schema';
import { useEffect, useState } from 'preact/hooks';
import { Anular } from './Anular.tsx';
import { abrirFormulario } from './actividad.ts';
import {
  type Contexto,
  type Cotizacion,
  CotizacionVencida,
  cotizar,
  type DatosDelCobro,
  EstadiaCerrada,
  registrarSalida,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { duracion } from './Estadias.tsx';
import { horaBogota } from './fecha.ts';
import { pesosEscritos } from './turno.ts';

type Medio = DatosDelCobro['medio'];

const MEDIOS: readonly (readonly [Medio, string])[] = [
  ['efectivo', 'Efectivo'],
  ['transferencia', 'QR o transferencia'],
  ['datafono', 'Datáfono'],
  ['cortesia', 'Cortesía'],
];

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly estadiaId: string;
  readonly alCobrar: (r: Registro) => void;
  readonly alVolver: () => void;
}

export function Salida({ db, ctx, estadiaId, alCobrar, alVolver }: Props) {
  const [perdido, setPerdido] = useState(false);
  const [q, setQ] = useState<Cotizacion | null>(null);
  const [medio, setMedio] = useState<Medio | null>(null);
  const [recibido, setRecibido] = useState('');
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => abrirFormulario(), []);

  async function calcular(conPerdido: boolean) {
    try {
      setQ(await cotizar(db, estadiaId, ctx.reloj(), conPerdido));
      setAviso('');
    } catch (e) {
      setQ(null);
      setAviso(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void calcular(false);
  }, [estadiaId]);

  if (!q) {
    return (
      <section class="tarjeta" data-prueba="salida">
        <h1>Salida</h1>
        {aviso ? (
          <p class="error" role="alert">
            {aviso}
          </p>
        ) : (
          <p aria-busy="true">Calculando…</p>
        )}
        <button type="button" class="boton boton-secundario" onClick={alVolver}>
          Volver al inicio
        </button>
      </section>
    );
  }

  const { estadia, liquidacion: liq, tarifa } = q;
  const efectivo = pesosEscritos(recibido);
  const falta =
    medio === null
      ? 'Elija el medio de pago'
      : medio === 'efectivo' && (efectivo === null || efectivo < liq.total)
        ? `Lo recibido no alcanza: el total es ${formatearPesos(liq.total)}`
        : medio === 'cortesia' && !motivo.trim()
          ? 'Escriba el motivo de la cortesía'
          : '';

  async function cobrar(e: Event) {
    e.preventDefault();
    if (falta || !medio || !q) return;
    setCobrando(true);
    try {
      const r = await registrarSalida(
        db,
        estadiaId,
        {
          perdido,
          medio,
          recibido: medio === 'efectivo' ? efectivo : null,
          motivoCortesia: medio === 'cortesia' ? motivo : null,
        },
        ctx,
        q.salida,
      );
      alCobrar(r);
    } catch (error) {
      if (error instanceof CotizacionVencida) {
        await calcular(perdido);
        setAviso('Pasaron más de 10 minutos: revise el total nuevo antes de cobrar.');
      } else if (error instanceof ErrorDeValidacion || error instanceof EstadiaCerrada) {
        setAviso(error.message);
      } else {
        setAviso(`No se cobró: ${String(error)}. La estadía sigue abierta.`);
      }
    } finally {
      setCobrando(false);
    }
  }

  return (
    <>
      <form class="tarjeta" onSubmit={cobrar} data-prueba="salida">
        <h1>Salida</h1>
        <p class="placa">{estadia.placa}</p>
        <p>
          Entró {horaBogota(estadia.entrada)} · {duracion(estadia.entrada, q.salida)} · recibo{' '}
          {estadia.numero}
        </p>

        <p class="total-grande" data-prueba="total">
          {formatearPesos(liq.total)}
        </p>
        <details>
          <summary>Ver el detalle</summary>
          <dl class="filas" data-prueba="detalle">
            {liq.lineas.map((l) => (
              <div key={`${l.concepto}-${l.minutos}`}>
                <dt>{conceptoDeLinea(l, tarifa)}</dt>
                <dd>{formatearPesos(l.valor)}</dd>
              </div>
            ))}
            {liq.redondeo > 0 && (
              <div>
                <dt>Redondeo</dt>
                <dd>−{formatearPesos(liq.redondeo)}</dd>
              </div>
            )}
          </dl>
        </details>

        {tarifa.perdido !== null && (
          <label class="casilla">
            <input
              class="casilla-marca"
              type="checkbox"
              checked={perdido}
              onChange={(e) => {
                setPerdido(e.currentTarget.checked);
                void calcular(e.currentTarget.checked);
              }}
            />
            <span>Tiquete perdido (+{formatearPesos(tarifa.perdido)}). Pida un documento.</span>
          </label>
        )}

        <fieldset>
          <legend>Medio de pago</legend>
          <div class="opciones">
            {MEDIOS.map(([m, nombre]) => (
              <button
                key={m}
                type="button"
                class="opcion"
                aria-pressed={medio === m}
                onClick={() => setMedio(m)}
              >
                {nombre}
              </button>
            ))}
          </div>
        </fieldset>

        {medio === 'efectivo' && (
          <div class="campo">
            <label for="recibido">Recibido</label>
            <input
              id="recibido"
              inputMode="numeric"
              autoComplete="off"
              value={recibido}
              onInput={(e) => setRecibido(e.currentTarget.value)}
            />
            {efectivo !== null && efectivo >= liq.total && (
              <p data-prueba="cambio">Cambio: {formatearPesos(efectivo - liq.total)}</p>
            )}
          </div>
        )}
        {medio === 'transferencia' && <QrDePago db={db} />}
        {medio === 'cortesia' && (
          <div class="campo">
            <label for="motivo-cortesia">Motivo de la cortesía</label>
            <input
              id="motivo-cortesia"
              maxLength={80}
              value={motivo}
              onInput={(e) => setMotivo(e.currentTarget.value)}
            />
          </div>
        )}

        {aviso && (
          <p class="error" role="alert" data-prueba="aviso-salida">
            {aviso}
          </p>
        )}
        <button type="submit" class="boton boton-principal" disabled={Boolean(falta) || cobrando}>
          {falta || `Cobrar ${formatearPesos(liq.total)}`}
        </button>
        <button type="button" class="boton boton-secundario" onClick={alVolver}>
          Volver al inicio
        </button>
      </form>
      {/* Una entrada mal hecha (otra placa, un vehículo que no entró) se anula, no se cobra. */}
      <section class="tarjeta">
        <Anular db={db} ctx={ctx} registro={q.entrada} alAnular={alVolver} />
      </section>
    </>
  );
}

/** El QR de pagos del propio parqueadero, si lo cargó en Ajustes (HU-Q3.5 CA2). */
function QrDePago({ db }: { db: BaseDeLaCaja }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let creada: string | null = null;
    void db.meta.get('qr_pago').then((m) => {
      creada = m?.clave === 'qr_pago' ? URL.createObjectURL(m.datos) : null;
      setUrl(creada);
    });
    return () => (creada ? URL.revokeObjectURL(creada) : undefined);
  }, [db]);
  if (url === undefined) return null;
  return url ? (
    <img class="qr-pago" src={url} alt="QR de pagos del parqueadero" data-prueba="qr-pago" />
  ) : (
    <p class="ayuda">Muestre el QR de su banco. Puede cargar su imagen en Ajustes.</p>
  );
}
