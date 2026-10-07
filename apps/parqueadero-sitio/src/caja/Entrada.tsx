/**
 * La entrada en menos de 10 segundos (HU-Q3.3, PARQUEADERO §5.1): la placa con su teclado, el tipo
 * que propone el patrón, el estado del vehículo, fotos opcionales y «Registrar» abajo, a todo lo
 * ancho. Registrar no espera a la impresora ni a la red (§5.3 regla 1).
 */
import { ReciboIncompleto } from '@ed1/parqueadero-recibos';
import {
  NOVEDADES,
  type Registro,
  VEHICULOS,
  type Vehiculo,
  vehiculoPorPlaca,
} from '@ed1/parqueadero-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from './actividad.ts';
import { type Contexto, EstadiaYaAbierta, registrarEntrada } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { comprimirFoto, type FormatoDeFoto } from './fotos.ts';

const TECLAS = '1234567890QWERTYUIOPASDFGHJKLZXCVBNM';
const NOMBRE_NOVEDAD: Record<(typeof NOVEDADES)[number], string> = {
  rayon: 'Rayón',
  golpe: 'Golpe',
  vidrio: 'Vidrio',
  espejo: 'Espejo',
  llanta: 'Llanta',
  otro: 'Otro',
};

type Novedad = { tipo: (typeof NOVEDADES)[number]; parte: string | null; nota: string | null };

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  /** Los vehículos con tarifa: los demás no se pueden registrar. */
  readonly vehiculos: readonly Vehiculo[];
  readonly alRegistrar: (r: Registro) => void;
  readonly alCancelar: () => void;
}

export function Entrada({ db, ctx, vehiculos, alRegistrar, alCancelar }: Props) {
  const [placa, setPlaca] = useState('');
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [aMano, setAMano] = useState(false);
  const [confirmada, setConfirmada] = useState(false);
  const [conNovedad, setConNovedad] = useState(false);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [nueva, setNueva] = useState({ tipo: '', parte: '', nota: '' });
  const [fotos, setFotos] = useState<{ tipo: FormatoDeFoto; datos: Blob }[]>([]);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => abrirFormulario(), []);

  function escribir(nuevaPlaca: string) {
    setPlaca(nuevaPlaca);
    setConfirmada(false);
    setAviso('');
    if (!aMano) {
      const propuesto = vehiculoPorPlaca(nuevaPlaca);
      setVehiculo(propuesto && vehiculos.includes(propuesto) ? propuesto : null);
    }
  }
  const tecla = (t: string) => escribir((placa + t).slice(0, 10));
  const borrar = () => escribir(placa.slice(0, -1));

  // En un PC se escribe con el teclado de verdad.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      if (destino && ['INPUT', 'SELECT', 'TEXTAREA'].includes(destino.tagName)) return;
      if (e.key === 'Backspace') borrar();
      else if (/^[a-z0-9]$/i.test(e.key)) tecla(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  });

  const fueraDePatron = placa.length > 0 && vehiculoPorPlaca(placa) === null;
  const listo =
    placa.length >= 2 &&
    vehiculo !== null &&
    (!fueraDePatron || confirmada) &&
    (!conNovedad || novedades.length > 0);

  function agregarNovedad() {
    if (!nueva.tipo) return;
    setNovedades([
      ...novedades,
      {
        tipo: nueva.tipo as Novedad['tipo'],
        parte: nueva.parte.trim() || null,
        nota: nueva.nota.trim() || null,
      },
    ]);
    setNueva({ tipo: '', parte: '', nota: '' });
  }

  async function agregarFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    try {
      const foto = await comprimirFoto(archivo);
      setFotos((f) => [...f, foto].slice(0, 4));
    } catch {
      setAviso('No se pudo guardar la foto. La entrada se puede registrar sin ella.');
    }
  }

  async function registrar(e: Event) {
    e.preventDefault();
    if (!listo || !vehiculo) return;
    setGuardando(true);
    setAviso('');
    try {
      const r = await registrarEntrada(
        db,
        {
          placa,
          vehiculo,
          placaConfirmada: fueraDePatron,
          novedades: conNovedad ? novedades : [],
          fotos,
        },
        ctx,
      );
      alRegistrar(r);
    } catch (error) {
      setAviso(
        error instanceof EstadiaYaAbierta || error instanceof ReciboIncompleto
          ? error.message
          : `No se registró: ${String(error)}. El número no se gastó.`,
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form class="tarjeta" onSubmit={registrar} data-prueba="entrada">
      <h1>Nueva entrada</h1>
      <output class="placa" aria-live="polite" aria-label="Placa" data-prueba="placa">
        {placa || ' '}
      </output>
      <fieldset>
        <legend>Teclado de la placa</legend>
        <div class="teclado">
          {[...TECLAS].map((t) => (
            <button key={t} type="button" class="tecla" onClick={() => tecla(t)}>
              {t}
            </button>
          ))}
          <button
            type="button"
            class="tecla tecla-ancha"
            onClick={borrar}
            aria-label="Borrar la última letra"
          >
            Borrar
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Tipo de vehículo</legend>
        <div class="opciones">
          {vehiculos.map((v) => (
            <button
              key={v}
              type="button"
              class="opcion"
              aria-pressed={vehiculo === v}
              onClick={() => {
                setVehiculo(v);
                setAMano(true);
              }}
            >
              {VEHICULOS[v].nombre}
            </button>
          ))}
        </div>
      </fieldset>

      {fueraDePatron && (
        <label class="casilla" data-prueba="confirmar-placa">
          <input
            class="casilla-marca"
            type="checkbox"
            checked={confirmada}
            onChange={(e) => setConfirmada(e.currentTarget.checked)}
          />
          <span>
            La placa {placa} no es ni de carro (ABC123) ni de moto (ABC12D). Confirmo que está bien
            escrita.
          </span>
        </label>
      )}

      <fieldset>
        <legend>Estado del vehículo</legend>
        <div class="opciones">
          <button
            type="button"
            class="opcion"
            aria-pressed={!conNovedad}
            onClick={() => setConNovedad(false)}
          >
            Sin novedad
          </button>
          <button
            type="button"
            class="opcion"
            aria-pressed={conNovedad}
            onClick={() => setConNovedad(true)}
          >
            Agregar novedad
          </button>
        </div>
      </fieldset>
      {conNovedad && (
        <div class="grupo" data-prueba="novedades">
          {novedades.length > 0 && (
            <ul>
              {novedades.map((n, i) => (
                <li key={`${n.tipo}-${i}`}>
                  {[NOMBRE_NOVEDAD[n.tipo], n.parte, n.nota].filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          )}
          <div class="campo">
            <label for="novedad-tipo">Qué tiene</label>
            <select
              id="novedad-tipo"
              value={nueva.tipo}
              onChange={(e) => setNueva({ ...nueva, tipo: e.currentTarget.value })}
            >
              <option value="">Elija</option>
              {NOVEDADES.map((n) => (
                <option key={n} value={n}>
                  {NOMBRE_NOVEDAD[n]}
                </option>
              ))}
            </select>
          </div>
          <div class="dos">
            <div class="campo">
              <label for="novedad-parte">Dónde</label>
              <input
                id="novedad-parte"
                maxLength={30}
                value={nueva.parte}
                onInput={(e) => setNueva({ ...nueva, parte: e.currentTarget.value })}
              />
            </div>
            <div class="campo">
              <label for="novedad-nota">Nota</label>
              <input
                id="novedad-nota"
                maxLength={80}
                value={nueva.nota}
                onInput={(e) => setNueva({ ...nueva, nota: e.currentTarget.value })}
              />
            </div>
          </div>
          <button type="button" class="boton" disabled={!nueva.tipo} onClick={agregarNovedad}>
            Agregar a la lista
          </button>
        </div>
      )}

      <div class="campo">
        <label for="foto">
          Foto del vehículo (opcional{fotos.length ? `, ${fotos.length} de 4` : ''})
        </label>
        <input
          id="foto"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={fotos.length >= 4}
          onChange={(e) => void agregarFoto(e)}
        />
        <span class="ayuda">Fotografíe el vehículo, no a las personas.</span>
      </div>

      {aviso && (
        <p class="error" role="alert" data-prueba="aviso-entrada">
          {aviso}
        </p>
      )}
      <button type="submit" class="boton boton-principal" disabled={!listo || guardando}>
        Registrar
      </button>
      <button type="button" class="boton boton-secundario" onClick={alCancelar}>
        Cancelar
      </button>
    </form>
  );
}
