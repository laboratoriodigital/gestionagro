/**
 * El inicio de la caja: las estadías abiertas por hora de entrada, con el tiempo corriendo, y un
 * buscador por placa que filtra al escribir, sin red (HU-Q3.4 CA1). Lee `estadias` directo de
 * Dexie: lo que pinta el inicio no carga zod (bitácora parqueadero 14).
 */
import { useEffect, useState } from 'preact/hooks';
import type { BaseDeLaCaja, Estadia } from './datos.ts';
import { horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import type { Vista } from './vistas.tsx';

/** «1 h 05 min», «12 min». */
export function duracion(desde: number, hasta: number): string {
  const min = Math.max(0, Math.ceil((hasta - desde) / 60_000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

interface Props {
  readonly db: BaseDeLaCaja;
  readonly reloj: () => number;
  readonly ir: (v: Vista) => void;
}

export function Estadias({ db, reloj, ir }: Props) {
  const estadias = useConsulta<Estadia[] | null>(() => db.estadias.orderBy('id').toArray(), null);
  const [buscar, setBuscar] = useState('');
  const [ahora, setAhora] = useState(reloj);

  useEffect(() => {
    const t = setInterval(() => setAhora(reloj()), 30_000);
    return () => clearInterval(t);
  }, [reloj]);

  const filtro = buscar.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const vistas = (estadias ?? []).filter((e) => e.placa.includes(filtro));

  return (
    <section class="tarjeta" data-prueba="estadias">
      <h2>Adentro {estadias ? `(${estadias.length})` : ''}</h2>
      <div class="dos">
        <button
          type="button"
          class="boton boton-principal"
          onClick={() => ir({ es: 'entrada' })}
          data-prueba="nueva-entrada"
        >
          Nueva entrada
        </button>
        <button type="button" class="boton" onClick={() => ir({ es: 'escanear' })}>
          Escanear recibo
        </button>
      </div>
      {estadias && estadias.length > 0 && (
        <div class="campo">
          <label for="buscar-placa">Buscar por placa</label>
          <input
            id="buscar-placa"
            value={buscar}
            autoComplete="off"
            autoCapitalize="characters"
            onInput={(e) => setBuscar(e.currentTarget.value)}
          />
        </div>
      )}
      {estadias?.length === 0 && <p class="ayuda">No hay vehículos adentro.</p>}
      {estadias && estadias.length > 0 && vistas.length === 0 && (
        <p class="ayuda">Ninguna placa adentro tiene «{filtro}».</p>
      )}
      <ul class="lista-estadias">
        {vistas.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              class="estadia"
              onClick={() => ir({ es: 'salida', estadiaId: e.id })}
              data-prueba="estadia"
            >
              <span class="placa-chica">{e.placa}</span>
              <span>
                Entró {horaBogota(e.entrada)} · {duracion(e.entrada, ahora)}
              </span>
              <span class="ayuda">{e.numero}</span>
            </button>
          </li>
        ))}
      </ul>
      <div class="dos">
        <button type="button" class="boton boton-secundario" onClick={() => ir({ es: 'ajustes' })}>
          Ajustes del parqueadero
        </button>
        <button type="button" class="boton boton-secundario" onClick={() => ir({ es: 'aviso' })}>
          Aviso de privacidad
        </button>
        <button type="button" class="boton boton-secundario" onClick={() => ir({ es: 'respaldo' })}>
          Respaldo
        </button>
        <button type="button" class="boton boton-secundario" onClick={() => ir({ es: 'abonados' })}>
          Abonados
        </button>
      </div>
    </section>
  );
}
