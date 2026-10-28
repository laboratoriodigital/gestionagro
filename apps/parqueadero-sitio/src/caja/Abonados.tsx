/**
 * Los abonados por placa (HU-Q3.11) y sus mensualidades (HU-Q8.4). La lista dice arriba las que
 * vencen en los próximos 5 días, para recordarlas en persona: la caja no guarda el WhatsApp del
 * abonado (ADR-38; dueño, 9 oct 2026). Agregar, renovar a mano o desactivar pide el PIN de
 * administrador (CA1 de HU-Q3.11); cobrar una mensualidad no: es un recibo con su número, como una
 * salida, dentro del turno, y su efectivo entra al cierre.
 */
import { formatearPesos } from '@ed1/dinero';
import { NOMBRE_DEL_MEDIO, papelDeLaMensualidad } from '@ed1/parqueadero-recibos';
import {
  type Abonado,
  type DatosDePagoAbonado,
  type DiasDeMensualidad,
  ErrorDeValidacion,
  numeroDeRecibo,
  type PeriodoDeMensualidad,
  PLANES_DE_ABONO,
  type PlanDeAbono,
  type Registro,
  VEHICULOS,
  type Vehiculo,
  vehiculoPorPlaca,
} from '@ed1/parqueadero-schema';
import { detalleDelProrrateo, finDelPeriodo } from '@ed1/parqueadero-tarifas';
import { useState } from 'preact/hooks';
import { VEHICULOS_DE_LA_CAJA } from './Ajustes.tsx';
import { Anular } from './Anular.tsx';
import {
  type CuentaDelAbonado,
  cuentaDelAbonado,
  fechaDelAbono,
  periodoPorCobrar,
  planDe,
  vencenPronto,
} from './abonados.ts';
import {
  type Contexto,
  cobrarMensualidad,
  guardarAbonado,
  leerAbonados,
  leerAjustes,
  NoSeCobra,
  PinIncorrecto,
  pagadoHastaDeLosAbonados,
  pagosDelAbonado,
  registrarEntrega,
  vecesImpreso,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { diaLocalBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import type { ControlDeImpresora } from './impresora.ts';
import { pesosEscritos, SinTurno } from './turno.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly control: ControlDeImpresora;
  /** El recibo de una mensualidad para reimprimir, desde las entregas pendientes. */
  readonly mensualidad?: Registro;
  readonly alVolver: () => void;
}

/** «Mes» o «Quincena», como lo lee el cajero. */
const NOMBRE_DEL_PLAN: Readonly<Record<PlanDeAbono, string>> = { mes: 'Mes', quincena: 'Quincena' };

const MEDIOS_DE_LA_MENSUALIDAD = ['efectivo', 'transferencia', 'datafono'] as const;
type MedioDeLaMensualidad = (typeof MEDIOS_DE_LA_MENSUALIDAD)[number];

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

interface Borrador {
  readonly id: string | null;
  readonly placa: string;
  readonly vehiculo: Vehiculo | null;
  readonly plan: PlanDeAbono;
  readonly referencia: string;
  readonly desde: string;
  readonly hasta: string;
  readonly valor: string;
  readonly activo: boolean;
}

function nuevo(hoy: string, periodo: PeriodoDeMensualidad): Borrador {
  return {
    id: null,
    placa: '',
    vehiculo: null,
    plan: 'mes',
    referencia: '',
    desde: hoy,
    hasta: finDelPeriodo('mes', hoy, periodo),
    valor: '',
    activo: true,
  };
}

const deAbonado = (a: Abonado): Borrador => ({
  id: a.id,
  placa: a.placa,
  vehiculo: a.vehiculo,
  plan: planDe(a),
  referencia: a.referencia ?? '',
  desde: a.desde,
  hasta: a.hasta,
  valor: String(a.valor),
  activo: a.activo,
});

const NOMBRE_DEL_CAMPO: Readonly<Record<string, string>> = {
  placa: 'Placa',
  vehiculo: 'Tipo',
  referencia: 'Referencia',
  desde: 'Desde',
  hasta: 'Hasta',
  valor: 'Valor',
};

type Vista =
  | { readonly es: 'lista' }
  | { readonly es: 'detalle'; readonly id: string }
  | { readonly es: 'cobrar'; readonly id: string; readonly primero: boolean }
  | { readonly es: 'cobrado'; readonly pago: Registro };

export function Abonados({ db, ctx, control, mensualidad, alVolver }: Props) {
  // Desde las entregas pendientes, abre el recibo de esa mensualidad (bitácora 42).
  const [vista, setVista] = useState<Vista>(
    mensualidad ? { es: 'cobrado', pago: mensualidad } : { es: 'lista' },
  );
  const ahora = ctx.reloj();
  const hoy = diaLocalBogota(ahora);
  const abonados = useConsulta<Abonado[] | null>(() => leerAbonados(db), null, [vista]);
  // HU-Q13.5: hasta dónde pagó cada uno en la caja, para decir quién debe y quién está al día.
  const pagado = useConsulta<Map<string, string>>(() => pagadoHastaDeLosAbonados(db), new Map(), [
    vista,
  ]);
  const cuenta = (a: Abonado) => cuentaDelAbonado(a, pagado.get(a.id) ?? null, hoy);
  // HU-Q13.4: los meses van de fecha a fecha, o del 1 al último día, según la sede.
  const periodo = useConsulta<PeriodoDeMensualidad>(
    () => leerAjustes(db).then((x) => x.sede?.periodo_mensualidad ?? 'fecha'),
    'fecha',
  );
  const [b, setB] = useState<Borrador | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (!abonados) return <section class="tarjeta" aria-busy="true" />;

  function abrir(borrador: Borrador) {
    setB(borrador);
    setPin('');
    setError('');
  }

  async function guardar(e: Event) {
    e.preventDefault();
    if (!b) return;
    const valor = pesosEscritos(b.valor);
    if (!b.vehiculo) return setError('Elija el tipo de vehículo');
    if (valor === null) return setError('Escriba el valor de la mensualidad en pesos');
    setGuardando(true);
    setError('');
    try {
      const guardado = await guardarAbonado(
        db,
        {
          placa: b.placa,
          vehiculo: b.vehiculo,
          plan: b.plan,
          referencia: b.referencia.trim() || null,
          desde: b.desde,
          hasta: b.hasta,
          valor,
          activo: b.activo,
        },
        b.id,
        pin,
        ctx,
      );
      setB(null);
      // Uno nuevo se cobra enseguida, o se deja si ya pagó en el talonario.
      setVista(
        b.id
          ? { es: 'detalle', id: guardado.id }
          : { es: 'cobrar', id: guardado.id, primero: true },
      );
    } catch (err) {
      setError(
        err instanceof PinIncorrecto
          ? err.message
          : err instanceof ErrorDeValidacion
            ? err.campos
                .map((c) => `${NOMBRE_DEL_CAMPO[c.campo] ?? c.campo}: ${c.motivo}`)
                .join('. ')
            : `No se guardó: ${String(err)}`,
      );
    } finally {
      setGuardando(false);
    }
  }

  if (b) {
    const poner = (cambio: Partial<Borrador>) => setB({ ...b, ...cambio });
    const falta = !b.placa ? 'Falta la placa' : !pin ? 'Falta el PIN' : '';
    return (
      <form class="tarjeta" onSubmit={guardar} noValidate data-prueba="abonado">
        <h1>{b.id ? `Abonado ${b.placa}` : 'Nuevo abonado'}</h1>
        <div class="campo">
          <label for="abonado-placa">Placa</label>
          <input
            id="abonado-placa"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={10}
            value={b.placa}
            onInput={(e) => {
              const placa = e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              const propuesto = vehiculoPorPlaca(placa);
              poner({
                placa,
                vehiculo:
                  propuesto && VEHICULOS_DE_LA_CAJA.includes(propuesto) ? propuesto : b.vehiculo,
              });
            }}
          />
        </div>
        <fieldset>
          <legend>Tipo de vehículo</legend>
          <div class="opciones">
            {VEHICULOS_DE_LA_CAJA.map((v) => (
              <button
                key={v}
                type="button"
                class="opcion"
                aria-pressed={b.vehiculo === v}
                onClick={() => poner({ vehiculo: v })}
              >
                {VEHICULOS[v].nombre}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Cada pago cubre</legend>
          <div class="opciones">
            {PLANES_DE_ABONO.map((p) => (
              <button
                key={p}
                type="button"
                class="opcion"
                aria-pressed={b.plan === p}
                onClick={() => poner({ plan: p, hasta: finDelPeriodo(p, b.desde, periodo) })}
              >
                {p === 'mes' ? 'Un mes' : 'Una quincena'}
              </button>
            ))}
          </div>
        </fieldset>
        <div class="campo">
          <label for="abonado-referencia">Referencia (opcional)</label>
          <input
            id="abonado-referencia"
            maxLength={40}
            value={b.referencia}
            onInput={(e) => poner({ referencia: e.currentTarget.value })}
          />
          <span class="ayuda">Un nombre de pila o un apartamento. Sin teléfono.</span>
        </div>
        <div class="dos">
          <div class="campo">
            <label for="abonado-desde">Desde</label>
            <input
              id="abonado-desde"
              type="date"
              value={b.desde}
              onInput={(e) => {
                const desde = e.currentTarget.value;
                poner(desde ? { desde, hasta: finDelPeriodo(b.plan, desde, periodo) } : { desde });
              }}
            />
          </div>
          <div class="campo">
            <label for="abonado-hasta">Hasta (incluido)</label>
            <input
              id="abonado-hasta"
              type="date"
              value={b.hasta}
              onInput={(e) => poner({ hasta: e.currentTarget.value })}
            />
          </div>
        </div>
        <div class="campo">
          <label for="abonado-valor">
            {b.plan === 'mes' ? 'Valor del mes' : 'Valor de la quincena'}
          </label>
          <input
            id="abonado-valor"
            inputMode="numeric"
            autoComplete="off"
            value={b.valor}
            onInput={(e) => poner({ valor: e.currentTarget.value })}
          />
        </div>
        {b.id && (
          <label class="casilla">
            <input
              class="casilla-marca"
              type="checkbox"
              checked={b.activo}
              onChange={(e) => poner({ activo: e.currentTarget.checked })}
            />
            <span>Activo. Sin marcar, la caja lo cobra como visitante.</span>
          </label>
        )}
        <div class="campo">
          <label for="abonado-pin">PIN de administrador</label>
          <input
            id="abonado-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onInput={(e) => setPin(e.currentTarget.value)}
          />
        </div>
        {error && (
          <p class="error" role="alert" data-prueba="aviso-abonado">
            {error}
          </p>
        )}
        <button type="submit" class="boton boton-principal" disabled={Boolean(falta) || guardando}>
          {falta || 'Guardar abonado'}
        </button>
        <button type="button" class="boton boton-secundario" onClick={() => setB(null)}>
          Cancelar
        </button>
      </form>
    );
  }

  const volverALaLista = () => setVista({ es: 'lista' });
  const elegido = 'id' in vista ? abonados.find((a) => a.id === vista.id) : undefined;

  if (vista.es === 'detalle' && elegido) {
    return (
      <Detalle
        db={db}
        ctx={ctx}
        a={elegido}
        estado={textoDeLaCuenta(cuenta(elegido))}
        alCobrar={() => setVista({ es: 'cobrar', id: elegido.id, primero: false })}
        alImprimir={(pago) => setVista({ es: 'cobrado', pago })}
        alEditar={() => abrir(deAbonado(elegido))}
        alVolver={volverALaLista}
      />
    );
  }
  if (vista.es === 'cobrar' && elegido) {
    return (
      <Cobrar
        db={db}
        ctx={ctx}
        a={elegido}
        hoy={hoy}
        primero={vista.primero}
        pagadoHasta={pagado.get(elegido.id) ?? null}
        alCobrar={(pago) => setVista({ es: 'cobrado', pago })}
        alVolver={() => setVista({ es: 'detalle', id: elegido.id })}
      />
    );
  }
  if (vista.es === 'cobrado') {
    return (
      <Cobrado db={db} ctx={ctx} control={control} pago={vista.pago} alVolver={volverALaLista} />
    );
  }

  const pronto = vencenPronto(abonados, hoy);
  const fila = (a: Abonado, c: CuentaDelAbonado, texto?: string) => (
    <li key={a.id}>
      <button
        type="button"
        class="estadia"
        onClick={() => setVista({ es: 'detalle', id: a.id })}
        data-prueba="abonado-fila"
      >
        <span class="placa-chica">{a.placa}</span>
        <span>
          {VEHICULOS[a.vehiculo].nombre}
          {a.referencia ? ` · ${a.referencia}` : ''} · {formatearPesos(a.valor)}
        </span>
        <span class={`senal ${TONO_DE_LA_CUENTA[c.es]}`} data-prueba="cuenta-abonado">
          {texto ?? textoDeLaCuenta(c)}
        </span>
      </button>
    </li>
  );
  return (
    <>
      <section class="tarjeta" data-prueba="abonados">
        <h1>Abonados</h1>
        <p class="ayuda">
          La caja reconoce la placa de un abonado vigente y no le cobra la salida. Toque un abonado
          para cobrar su mensualidad.
        </p>
        <button
          type="button"
          class="boton boton-principal"
          onClick={() => abrir(nuevo(hoy, periodo))}
        >
          Agregar abonado
        </button>
        {abonados.length === 0 && <p class="ayuda">Todavía no hay abonados.</p>}
        <ul class="lista-estadias">{abonados.map((a) => fila(a, cuenta(a)))}</ul>
      </section>
      {pronto.length > 0 && (
        <section class="seccion" aria-labelledby="vencen-pronto" data-prueba="vencen-pronto">
          <h2 class="etiqueta" id="vencen-pronto">
            Vencen en los próximos 5 días
          </h2>
          <p class="ayuda">Recuérdeselo cuando llegue.</p>
          <ul class="lista-estadias">
            {pronto.map((a) =>
              fila(
                a,
                cuenta(a),
                a.hasta === hoy ? 'Vence hoy' : `Vence el ${fechaDelAbono(a.hasta)}`,
              ),
            )}
          </ul>
        </section>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </>
  );
}

function Detalle({
  db,
  ctx,
  a,
  estado,
  alCobrar,
  alImprimir,
  alEditar,
  alVolver,
}: {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly a: Abonado;
  readonly estado: string;
  readonly alCobrar: () => void;
  /** El recibo del último pago, para imprimirlo o reimprimirlo (HU-Q13.10). */
  readonly alImprimir: (pago: Registro) => void;
  readonly alEditar: () => void;
  readonly alVolver: () => void;
}) {
  const pagos = useConsulta<Registro[] | null>(() => pagosDelAbonado(db, a.id), null, [a.id]);
  const ultimo = pagos?.[0];
  return (
    <section class="tarjeta" data-prueba="detalle-abonado">
      <h1>
        Abonado <span class="exacto">{a.placa}</span>
      </h1>
      <dl class="filas">
        <div>
          <dt>Vehículo</dt>
          <dd>{VEHICULOS[a.vehiculo].nombre}</dd>
        </div>
        {a.referencia && (
          <div>
            <dt>Referencia</dt>
            <dd>{a.referencia}</dd>
          </div>
        )}
        <div>
          <dt>{NOMBRE_DEL_PLAN[planDe(a)]}</dt>
          <dd class="cifra">{formatearPesos(a.valor)}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd data-prueba="estado-abonado">{estado}</dd>
        </div>
        {ultimo?.serie && ultimo.consecutivo !== null && (
          <div>
            <dt>Último pago en la caja</dt>
            <dd>
              <span class="exacto">{numeroDeRecibo(ultimo.serie, ultimo.consecutivo)}</span> ·{' '}
              {fechaDelAbono((ultimo.datos as DatosDePagoAbonado).desde)} a{' '}
              {fechaDelAbono((ultimo.datos as DatosDePagoAbonado).hasta)}
            </dd>
          </div>
        )}
      </dl>
      {a.activo ? (
        <button type="button" class="boton boton-principal" onClick={alCobrar}>
          Cobrar mensualidad
        </button>
      ) : (
        <p class="ayuda">Está inactivo: actívelo en «Editar» antes de cobrar.</p>
      )}
      {ultimo?.serie && ultimo.consecutivo !== null && (
        <button type="button" class="boton" onClick={() => alImprimir(ultimo)}>
          Imprimir recibo
        </button>
      )}
      <button type="button" class="boton" onClick={alEditar}>
        Editar
      </button>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver a abonados
      </button>
      {ultimo && <Anular db={db} ctx={ctx} registro={ultimo} alAnular={alVolver} />}
    </section>
  );
}

function Cobrar({
  db,
  ctx,
  a,
  hoy,
  primero,
  pagadoHasta,
  alCobrar,
  alVolver,
}: {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly a: Abonado;
  readonly hoy: string;
  readonly primero: boolean;
  /** Hasta dónde pagó en la caja; `null`, nunca (HU-Q13.5). */
  readonly pagadoHasta: string | null;
  readonly alCobrar: (pago: Registro) => void;
  readonly alVolver: () => void;
}) {
  const [finDeMes, setFinDeMes] = useState(false);
  const [medio, setMedio] = useState<MedioDeLaMensualidad | null>(null);
  const [error, setError] = useState('');
  const [cobrando, setCobrando] = useState(false);
  // HU-Q13.3 y HU-Q13.4: los días que cuenta el prorrateo y cómo van los meses, los de la sede.
  const sede = useConsulta<{ cuenta: DiasDeMensualidad; periodo: PeriodoDeMensualidad }>(
    () =>
      leerAjustes(db).then((x) => ({
        cuenta: x.sede?.dias_mensualidad ?? 'calendario',
        periodo: x.sede?.periodo_mensualidad ?? 'fecha',
      })),
    { cuenta: 'calendario', periodo: 'fecha' },
  );
  const p = periodoPorCobrar(a, hoy, { primero, hastaFinDeMes: finDeMes, pagadoHasta, ...sede });
  // HU-Q13.5: cómo se llegó al total, tramo por tramo.
  const tramos = detalleDelProrrateo(
    a.valor,
    planDe(a),
    p.desde,
    p.hasta,
    sede.cuenta,
    sede.periodo,
  );
  // Cortar en fin de mes solo cambia algo si el periodo cruza de mes; del 1 al último, ya lo hace.
  const cruzaDeMes =
    !primero && planDe(a) === 'mes' && sede.periodo === 'fecha' && !p.desde.endsWith('-01');

  async function cobrar(e: Event) {
    e.preventDefault();
    if (!medio) return;
    setCobrando(true);
    setError('');
    try {
      alCobrar(await cobrarMensualidad(db, a.id, { ...p, medio }, ctx));
    } catch (err) {
      setError(
        err instanceof SinTurno || err instanceof NoSeCobra
          ? err.message
          : `No se cobró: ${String(err)}`,
      );
    } finally {
      setCobrando(false);
    }
  }

  return (
    <form class="tarjeta" onSubmit={cobrar} data-prueba="cobrar-mensualidad">
      <h1>
        Mensualidad de <span class="exacto">{a.placa}</span>
      </h1>
      {primero && (
        <p class="ayuda">Si ya la pagó en el talonario, no la cobre otra vez: vuelva a abonados.</p>
      )}
      <dl class="filas">
        <div>
          <dt>Desde</dt>
          <dd>{fechaDelAbono(p.desde)}</dd>
        </div>
        <div>
          <dt>Hasta (incluido)</dt>
          <dd>{fechaDelAbono(p.hasta)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd class="cifra" data-prueba="total-mensualidad">
            {formatearPesos(p.valor)}
          </dd>
        </div>
      </dl>
      {p.valor < a.valor && (
        <div data-prueba="prorrateo">
          <p class="ayuda">
            Proporcional a los días: el {NOMBRE_DEL_PLAN[planDe(a)].toLowerCase()} completo vale{' '}
            {formatearPesos(a.valor)}.
          </p>
          <dl class="filas" data-prueba="tramos">
            {tramos.map((t) => (
              <div key={t.desde}>
                <dt>
                  {fechaDelAbono(t.desde).slice(0, 5)} al {fechaDelAbono(t.hasta).slice(0, 5)} ·{' '}
                  {t.entero
                    ? `${NOMBRE_DEL_PLAN[planDe(a)].toLowerCase()} completo`
                    : `${t.dias} de ${t.completo} días${t.habiles ? ' hábiles' : ''}`}
                </dt>
                <dd class="cifra">{formatearPesos(t.valor)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {cruzaDeMes && (
        <label class="casilla">
          <input
            class="casilla-marca"
            type="checkbox"
            checked={finDeMes}
            onChange={(e) => setFinDeMes(e.currentTarget.checked)}
          />
          <span>Solo hasta fin de mes, y desde el 1.° cobrar el mes completo</span>
        </label>
      )}
      <fieldset>
        <legend>Medio de pago</legend>
        <div class="opciones">
          {MEDIOS_DE_LA_MENSUALIDAD.map((m) => (
            <button
              key={m}
              type="button"
              class="opcion"
              aria-pressed={medio === m}
              onClick={() => setMedio(m)}
            >
              {mayuscula(NOMBRE_DEL_MEDIO[m])}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p class="error" role="alert" data-prueba="aviso-cobro">
          {error}
        </p>
      )}
      <button type="submit" class="boton boton-principal" disabled={!medio || cobrando}>
        {medio ? `Cobrar ${formatearPesos(p.valor)}` : 'Elija el medio de pago'}
      </button>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        {primero ? 'No cobrar ahora' : 'Cancelar'}
      </button>
    </form>
  );
}

function Cobrado({
  db,
  ctx,
  control,
  pago,
  alVolver,
}: {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly control: ControlDeImpresora;
  readonly pago: Registro;
  readonly alVolver: () => void;
}) {
  const [estado, setEstado] = useState('');
  // Las veces que salió en papel, en esta caja o antes: desde la ficha o las entregas pendientes,
  // un recibo ya impreso sale como copia (HU-Q13.10).
  const veces = useConsulta(() => vecesImpreso(db, pago), 0, [pago.id]);
  const d = pago.datos as DatosDePagoAbonado;
  const numero = pago.serie && pago.consecutivo ? numeroDeRecibo(pago.serie, pago.consecutivo) : '';

  async function imprimir() {
    setEstado('Enviando a la impresora…');
    const [impresora, { sede, ajuste }] = await Promise.all([
      db.impresora.get('actual'),
      leerAjustes(db),
    ]);
    const n = await vecesImpreso(db, pago);
    const copia = n > 0;
    const bloques = papelDeLaMensualidad(pago, sede, {
      columnas: impresora?.columnas ?? 32,
      paginaDeCodigos: impresora?.paginaDeCodigos ?? 'cp850',
      pie: ajuste?.pie ?? null,
    });
    if (copia) bloques.unshift({ tipo: 'texto', texto: `*** COPIA ${n} ***`, alinear: 'centro' });
    const r = await control.imprimir(bloques, undefined, pago.id);
    if (r.ok) {
      await registrarEntrega(
        db,
        pago,
        { canal: 'papel', copia, camino: impresora?.camino ?? null, resultado: 'enviado' },
        ctx,
      );
    }
    setEstado(
      r.ok
        ? copia
          ? `Copia ${n} enviada a la impresora`
          : 'Enviado a la impresora'
        : 'No salió: la impresora no está conectada o no respondió.',
    );
  }

  return (
    <section class="tarjeta" data-prueba="mensualidad-cobrada">
      <h1>
        Mensualidad <span class="exacto">{numero}</span>
      </h1>
      <p class="exito">
        {d.placa} queda al día hasta el {fechaDelAbono(d.hasta)}: {formatearPesos(d.valor)} en{' '}
        {NOMBRE_DEL_MEDIO[d.medio_pago]}.
      </p>
      <output aria-live="polite" data-prueba="estado-del-papel">
        {estado}
      </output>
      <button type="button" class="boton boton-principal" onClick={() => void imprimir()}>
        {veces === 0 ? 'Imprimir recibo' : 'Reimprimir'}
      </button>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver a abonados
      </button>
    </section>
  );
}

/** Lo que la lista y el detalle dicen de la cuenta de un abonado (HU-Q13.5). */
function textoDeLaCuenta(c: CuentaDelAbonado): string {
  switch (c.es) {
    case 'inactivo':
      return 'Inactivo';
    case 'al-dia':
      return `Al día hasta el ${fechaDelAbono(c.hasta)}`;
    case 'debe':
      return `Debe desde el ${fechaDelAbono(c.desde)}`;
    case 'vencido':
      return `Venció el ${fechaDelAbono(c.hasta)}`;
  }
}

/** El color de la señal: verde al día, rojo debe, amarillo vencido (las de la cabecera). */
const TONO_DE_LA_CUENTA: Readonly<Record<CuentaDelAbonado['es'], string>> = {
  'al-dia': 'senal-bien',
  debe: 'senal-error',
  vencido: 'senal-aviso',
  inactivo: '',
};
