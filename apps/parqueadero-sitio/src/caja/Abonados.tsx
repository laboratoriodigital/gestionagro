/**
 * Los abonados por placa (HU-Q3.11): la lista con su vigencia y el formulario para agregar,
 * renovar o desactivar uno, que solo guarda con el PIN de administrador (CA1). La caja no guarda
 * el WhatsApp del abonado en M0 (CA3, ADR-38); el cobro de la mensualidad llega en M2.
 */
import { formatearPesos } from '@ed1/dinero';
import {
  type Abonado,
  ErrorDeValidacion,
  VEHICULOS,
  type Vehiculo,
  vehiculoPorPlaca,
} from '@ed1/parqueadero-schema';
import { useState } from 'preact/hooks';
import { VEHICULOS_DE_LA_CAJA } from './Ajustes.tsx';
import { abonoDeLaPlaca, fechaDelAbono, unMesDesde } from './abonados.ts';
import { type Contexto, guardarAbonado, leerAbonados, PinIncorrecto } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { diaLocalBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import { pesosEscritos } from './turno.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly alVolver: () => void;
}

interface Borrador {
  readonly id: string | null;
  readonly placa: string;
  readonly vehiculo: Vehiculo | null;
  readonly referencia: string;
  readonly desde: string;
  readonly hasta: string;
  readonly valor: string;
  readonly activo: boolean;
}

function nuevo(hoy: string): Borrador {
  return {
    id: null,
    placa: '',
    vehiculo: null,
    referencia: '',
    desde: hoy,
    hasta: unMesDesde(hoy),
    valor: '',
    activo: true,
  };
}

const deAbonado = (a: Abonado): Borrador => ({
  id: a.id,
  placa: a.placa,
  vehiculo: a.vehiculo,
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

export function Abonados({ db, ctx, alVolver }: Props) {
  const abonados = useConsulta<Abonado[] | null>(() => leerAbonados(db), null);
  const [b, setB] = useState<Borrador | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const ahora = ctx.reloj();

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
      await guardarAbonado(
        db,
        {
          placa: b.placa,
          vehiculo: b.vehiculo,
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
              onInput={(e) => poner({ desde: e.currentTarget.value })}
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
          <label for="abonado-valor">Valor de la mensualidad</label>
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

  return (
    <section class="tarjeta" data-prueba="abonados">
      <h1>Abonados</h1>
      <p class="ayuda">
        La caja reconoce la placa de un abonado vigente y no le cobra la salida. La mensualidad se
        cobra aparte, como hoy.
      </p>
      <button
        type="button"
        class="boton boton-principal"
        onClick={() => abrir(nuevo(diaLocalBogota(ahora)))}
      >
        Agregar abonado
      </button>
      {abonados.length === 0 && <p class="ayuda">Todavía no hay abonados.</p>}
      <ul class="lista-estadias">
        {abonados.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              class="estadia"
              onClick={() => abrir(deAbonado(a))}
              data-prueba="abonado-fila"
            >
              <span class="placa-chica">{a.placa}</span>
              <span>
                {VEHICULOS[a.vehiculo].nombre}
                {a.referencia ? ` · ${a.referencia}` : ''} · {formatearPesos(a.valor)}
              </span>
              <span class="ayuda">{estadoDe(abonados, a, ahora)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}

function estadoDe(todos: readonly Abonado[], a: Abonado, ahora: number): string {
  const periodo = `${fechaDelAbono(a.desde)} a ${fechaDelAbono(a.hasta)}`;
  if (!a.activo) return `Inactivo · ${periodo}`;
  const { vigente } = abonoDeLaPlaca(todos, a.placa, ahora);
  if (vigente?.id === a.id) return `Vigente · ${periodo}`;
  return a.desde > diaLocalBogota(ahora) ? `Empieza · ${periodo}` : `Vencido · ${periodo}`;
}
