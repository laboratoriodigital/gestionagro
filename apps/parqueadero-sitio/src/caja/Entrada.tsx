/**
 * La entrada en menos de 10 segundos (HU-Q3.3, PARQUEADERO §5.1): la placa con su teclado, el tipo
 * que propone el patrón, el estado del vehículo, fotos opcionales y «Registrar» abajo, a todo lo
 * ancho. Registrar no espera a la impresora ni a la red (§5.3 regla 1). El WhatsApp del conductor
 * es opcional y va con su casilla sin marcar (HU-Q4.1 CA1).
 */
import { ReciboIncompleto } from '@ed1/parqueadero-recibos';
import {
  type Abonado,
  NOVEDADES,
  type Registro,
  VEHICULOS,
  type Vehiculo,
  vehiculoPorPlaca,
} from '@ed1/parqueadero-schema';
import { WhatsAppInvalido } from '@ed1/whatsapp';
import { useEffect, useState } from 'preact/hooks';
import { abonoDeLaPlaca, fechaDelAbono, vencenPronto } from './abonados.ts';
import { abrirFormulario } from './actividad.ts';
import { type Contexto, EstadiaYaAbierta, registrarEntrada } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { diaLocalBogota } from './fecha.ts';
import { comprimirFoto, type FormatoDeFoto } from './fotos.ts';
import { CampoWhatsApp, faltaDelWhatsApp } from './whatsapp.tsx';

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
  /** La sede aceptó el aviso de privacidad: se puede pedir el número (HU-Q4.4 CA2). */
  readonly pideNumero: boolean;
  /** Para marcar la placa de un abonado (HU-Q3.11 CA2). */
  readonly abonados: readonly Abonado[];
  readonly alRegistrar: (r: Registro) => void;
  readonly alCancelar: () => void;
}

export function Entrada({
  db,
  ctx,
  vehiculos,
  pideNumero,
  abonados,
  alRegistrar,
  alCancelar,
}: Props) {
  const [placa, setPlaca] = useState('');
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(
    vehiculos.length === 1 ? (vehiculos[0] ?? null) : null,
  );
  const [aMano, setAMano] = useState(false);
  const [confirmada, setConfirmada] = useState(false);
  const [conNovedad, setConNovedad] = useState(false);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [nueva, setNueva] = useState({ tipo: '', parte: '', nota: '' });
  const [fotos, setFotos] = useState<{ tipo: FormatoDeFoto; datos: Blob }[]>([]);
  const [numero, setNumero] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => abrirFormulario(), []);

  function escribir(nuevaPlaca: string) {
    setPlaca(nuevaPlaca);
    setConfirmada(false);
    setAviso('');
    if (!aMano) {
      const propuesto = vehiculoPorPlaca(nuevaPlaca);
      setVehiculo(
        propuesto && vehiculos.includes(propuesto)
          ? propuesto
          : vehiculos.length === 1
            ? (vehiculos[0] ?? null)
            : null,
      );
    }
  }
  const tecla = (t: string) => escribir((placa + t).slice(0, 10));
  const borrar = () => escribir(placa.slice(0, -1));

  const fueraDePatron = placa.length > 0 && vehiculoPorPlaca(placa) === null;
  const abono = abonoDeLaPlaca(abonados, placa, ctx.reloj());
  // HU-Q8.4 CA2: el recordatorio es en persona, cuando el abonado llega.
  const vencePronto =
    abono.vigente !== null && vencenPronto([abono.vigente], diaLocalBogota(ctx.reloj())).length > 0;
  const listo =
    placa.length >= 2 &&
    vehiculo !== null &&
    (!fueraDePatron || confirmada) &&
    (!conNovedad || novedades.length > 0);
  // Sin número no falta nada: el WhatsApp es opcional en la entrada.
  const faltaWhatsApp = numero.trim() ? faltaDelWhatsApp(numero, autoriza) : '';

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
    if (!listo || !vehiculo || faltaWhatsApp) return;
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
          whatsapp: numero.trim() && autoriza ? numero : null,
        },
        ctx,
      );
      alRegistrar(r);
    } catch (error) {
      setAviso(
        error instanceof EstadiaYaAbierta ||
          error instanceof ReciboIncompleto ||
          error instanceof WhatsAppInvalido
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
      <div class="campo">
        <label for="placa-entrada">Placa</label>
        <input
          id="placa-entrada"
          class="placa"
          data-prueba="placa"
          value={placa}
          maxLength={10}
          autoComplete="off"
          autoCapitalize="characters"
          spellcheck={false}
          placeholder="ABC123"
          enterKeyHint="done"
          onInput={(e) => escribir(e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
      </div>
      <details class="opcional">
        <summary>Usar teclado en pantalla</summary>
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
      </details>

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

      {abono.vigente && (
        <p class="exito" data-prueba="abonado-entrada">
          Abonado hasta el {fechaDelAbono(abono.vigente.hasta)}
          {abono.vigente.referencia ? ` · ${abono.vigente.referencia}` : ''}
          {vencePronto ? '. Vence pronto: recuérdeselo' : ''}
        </p>
      )}
      {abono.vencido && (
        <p class="error" data-prueba="abonado-entrada">
          El abono venció el {fechaDelAbono(abono.vencido.hasta)}: entra como visitante.
        </p>
      )}

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

      <details class="opcional" data-prueba="datos-opcionales">
        <summary>
          Foto o WhatsApp{fotos.length > 0 || numero.trim() ? ' · con datos' : ' (opcional)'}
        </summary>
        <div class="grupo">
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

          <CampoWhatsApp
            pideNumero={pideNumero}
            numero={numero}
            autoriza={autoriza}
            alEscribir={setNumero}
            alAutorizar={setAutoriza}
          />
        </div>
      </details>

      {aviso && (
        <p class="error" role="alert" data-prueba="aviso-entrada">
          {aviso}
        </p>
      )}
      <button
        type="submit"
        class="boton boton-principal"
        disabled={!listo || Boolean(faltaWhatsApp) || guardando}
      >
        {guardando ? 'Registrando…' : faltaWhatsApp || 'Registrar'}
      </button>
      <button type="button" class="boton boton-secundario" onClick={alCancelar}>
        Cancelar
      </button>
    </form>
  );
}
