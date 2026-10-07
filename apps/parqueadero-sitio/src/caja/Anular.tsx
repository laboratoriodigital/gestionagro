/**
 * Anular una entrada o una salida (HU-Q3.7, PARQUEADERO §10.2): con su motivo y el PIN de
 * administrador. Queda anotada; nada se borra (P21). No es un `<form>`: vive junto al cobro, y un
 * Enter en el PIN no puede cobrar.
 */
import type { Registro } from '@ed1/parqueadero-schema';
import { useState } from 'preact/hooks';
import { anular, type Contexto, NoSeAnula, operadorActual } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly registro: Registro;
  readonly alAnular: () => void;
}

export function Anular({ db, ctx, registro, alAnular }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const que = registro.tipo === 'salida' ? 'la salida' : 'la entrada';

  if (!abierto) {
    return (
      <button type="button" class="boton boton-secundario" onClick={() => setAbierto(true)}>
        Anular {que}
      </button>
    );
  }

  async function confirmar() {
    setOcupado(true);
    setError('');
    try {
      await anular(db, registro.id, { motivo, pin, operador: await operadorActual(db, ctx) }, ctx);
      alAnular();
    } catch (e) {
      setError(e instanceof NoSeAnula ? e.message : `No se pudo anular: ${String(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div class="anular" data-prueba="anular">
      <h2>Anular {que}</h2>
      <p class="ayuda">
        La anulación queda anotada con su motivo y cuenta en el cierre del turno; nada se borra.{' '}
        {registro.tipo === 'salida'
          ? 'El vehículo vuelve a quedar adentro.'
          : 'El vehículo sale de la lista de adentro.'}
      </p>
      <div class="campo">
        <label for="motivo-anulacion">Motivo</label>
        <input
          id="motivo-anulacion"
          maxLength={140}
          value={motivo}
          onInput={(e) => setMotivo(e.currentTarget.value)}
        />
      </div>
      <div class="campo">
        <label for="pin-anulacion">PIN de administrador</label>
        <input
          id="pin-anulacion"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          onInput={(e) => setPin(e.currentTarget.value)}
        />
      </div>
      {error && (
        <p class="error" role="alert" data-prueba="aviso-anulacion">
          {error}
        </p>
      )}
      <button
        type="button"
        class="boton boton-principal"
        disabled={!motivo.trim() || !pin || ocupado}
        onClick={() => void confirmar()}
      >
        {motivo.trim() ? (pin ? `Anular ${que}` : 'Falta el PIN') : 'Falta el motivo'}
      </button>
      <button type="button" class="boton boton-secundario" onClick={() => setAbierto(false)}>
        No anular
      </button>
    </div>
  );
}
