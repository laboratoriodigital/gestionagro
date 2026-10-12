/**
 * El aviso de tarifas, medios de pago y derechos, para imprimir en carta u oficio y poner en la
 * entrada (HU-Q11.3). Lo arma `letreroDeLaSede`; aquí el parqueadero marca los medios que recibe
 * y el papel, ve el aviso como saldrá y lo imprime.
 *
 * Al imprimir, el aviso se copia a la raíz de la página y la hoja de estilo de impresión quita todo
 * lo demás: `visibility: hidden` conserva el espacio y saca hojas en blanco (bitácora agro 28). El
 * tamaño del papel va en un `@page` de una hoja construida, solo mientras imprime: un `<style>`
 * en línea lo bloquea la CSP (`style-src 'self'`).
 */
import { juntar } from '@ed1/parqueadero-recibos';
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Ajustes, leerAjustes } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { useConsulta } from './ganchos.ts';
import {
  type Letrero as Armado,
  letraQueCabe,
  letreroDeLaSede,
  MARGEN_MM,
  MEDIOS_DEL_LETRERO,
  type MedioDelLetrero,
  PAPELES,
  type PapelDelLetrero,
} from './letrero.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly alAjustes: () => void;
  readonly alVolver: () => void;
}

const NOMBRE_DEL_BOTON: Readonly<Record<MedioDelLetrero, string>> = {
  efectivo: 'Efectivo',
  transferencia: 'QR o transferencia',
  datafono: 'Datáfono',
};

export function Letrero({ db, alAjustes, alVolver }: Props) {
  const ajustes = useConsulta<Ajustes | null>(() => leerAjustes(db), null);
  const conQr = useConsulta<boolean | null>(
    () => db.meta.get('qr_pago').then((m) => m?.clave === 'qr_pago'),
    null,
  );
  const [medios, setMedios] = useState<readonly MedioDelLetrero[] | null>(null);
  const [papel, setPapel] = useState<PapelDelLetrero>('carta');
  const hoja = useRef<HTMLElement>(null);

  // Lo que la caja ya sabe: cobra en efectivo, y con QR si el parqueadero subió el suyo.
  useEffect(() => {
    if (conQr !== null && medios === null)
      setMedios(conQr ? ['efectivo', 'transferencia'] : ['efectivo']);
  }, [conQr, medios]);

  if (!ajustes || medios === null) return <section class="tarjeta" aria-busy="true" />;
  const r = letreroDeLaSede(ajustes, medios);
  if (!r.ok) {
    return (
      <section class="tarjeta" data-prueba="letrero">
        <h1>Aviso de tarifas</h1>
        <p class="error" data-prueba="letrero-falta">
          El aviso lleva los datos del parqueadero y sus tarifas. Falta: {juntar(r.faltan)}.
        </p>
        <button type="button" class="boton boton-principal" onClick={alAjustes}>
          Completar los ajustes
        </button>
        <button type="button" class="boton boton-secundario" onClick={alVolver}>
          Volver al inicio
        </button>
      </section>
    );
  }

  const alternar = (m: MedioDelLetrero) =>
    setMedios(medios.includes(m) ? medios.filter((x) => x !== m) : [...medios, m]);

  return (
    <section class="tarjeta" data-prueba="letrero">
      <h1>Aviso de tarifas</h1>
      <p class="ayuda">
        Para la entrada, a la vista: el conductor ve las tarifas, los medios de pago y sus derechos
        antes de dejar el vehículo. Sale de los ajustes; si cambia una tarifa, imprímalo de nuevo.
      </p>
      <fieldset>
        <legend>Medios de pago que recibe</legend>
        <div class="opciones">
          {MEDIOS_DEL_LETRERO.map((m) => (
            <button
              key={m}
              type="button"
              class="opcion"
              aria-pressed={medios.includes(m)}
              onClick={() => alternar(m)}
            >
              {NOMBRE_DEL_BOTON[m]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Papel</legend>
        <div class="opciones">
          {(Object.keys(PAPELES) as PapelDelLetrero[]).map((p) => (
            <button
              key={p}
              type="button"
              class="opcion"
              aria-pressed={papel === p}
              onClick={() => setPapel(p)}
            >
              {PAPELES[p].nombre}
            </button>
          ))}
        </div>
      </fieldset>
      <HojaDelLetrero letrero={r.letrero} refHoja={hoja} />
      {medios.length === 0 && (
        <p class="error" data-prueba="letrero-sin-medios">
          Marque al menos un medio de pago: el aviso tiene que decir cómo se paga.
        </p>
      )}
      <button
        type="button"
        class="boton boton-principal"
        disabled={medios.length === 0}
        onClick={() => imprimirLetrero(hoja.current, papel)}
      >
        Imprimir en hoja {PAPELES[papel].nombre.toLowerCase()}
      </button>
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}

function HojaDelLetrero({
  letrero: l,
  refHoja,
}: {
  letrero: Armado;
  refHoja: RefObject<HTMLElement>;
}) {
  return (
    <article
      class="letrero"
      ref={refHoja}
      aria-label="Vista previa del aviso"
      data-prueba="hoja-letrero"
    >
      <header class="letrero-sede">
        <p class="letrero-nombre">{l.sede.nombre}</p>
        <p>{l.sede.lineas.join(' · ')}</p>
        {l.pie && <p>{l.pie}</p>}
      </header>
      <h2 class="letrero-titulo">{l.titulo}</h2>
      <section class="letrero-bloque">
        <h3>{l.tarifas.titulo}</h3>
        <div class="letrero-tarifas">
          {l.tarifas.vehiculos.map((v) => (
            <div key={v.nombre} class="letrero-vehiculo">
              <p class="letrero-vehiculo-nombre">{v.nombre}</p>
              <ul>
                {v.lineas.map((linea) => (
                  <li key={linea} class="cifra">
                    {linea}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section class="letrero-bloque">
        <h3>{l.medios.titulo}</h3>
        <p>{l.medios.lista.length ? l.medios.lista.join(' · ') : '—'}</p>
      </section>
      <section class="letrero-bloque">
        <h3>{l.derechos.titulo}</h3>
        <ol>
          {l.derechos.lista.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ol>
      </section>
      <footer class="letrero-pie">
        <p>{l.responsabilidad}</p>
        {l.poliza && <p>{l.poliza}</p>}
        <p class="letrero-whatsapp">{l.whatsapp}</p>
      </footer>
    </article>
  );
}

const hojasDePapel = new WeakSet<CSSStyleSheet>();
const MM = 96 / 25.4;

/**
 * Imprime solo el aviso, en el papel elegido y en una hoja; deja la página como estaba al terminar.
 * Antes, mide la copia con el ancho del papel y baja la letra hasta que quepa: un parqueadero con
 * más tarifas o un texto de responsabilidad largo no saca una segunda hoja con dos líneas.
 */
function imprimirLetrero(hoja: HTMLElement | null, papel: PapelDelLetrero): void {
  if (!hoja) return;
  for (const viejo of document.querySelectorAll('.letrero-impreso')) viejo.remove();
  const p = PAPELES[papel];
  const copia = document.createElement('div');
  copia.className = `letrero-impreso letrero-${papel} midiendo`;
  copia.append(hoja.cloneNode(true));
  document.body.append(copia);
  const estilo = new CSSStyleSheet();
  const reglas = (pt: number) =>
    `@page { size: ${p.tamano}; margin: ${MARGEN_MM}mm; }
     html .letrero-impreso.letrero-${papel} .letrero { font-size: ${pt}pt; }`;
  estilo.replaceSync(reglas(p.letra));
  const otras = document.adoptedStyleSheets.filter((h) => !hojasDePapel.has(h));
  hojasDePapel.add(estilo);
  document.adoptedStyleSheets = [...otras, estilo];
  // Un margen de 2 mm: el redondeo de Chromium al partir en hojas.
  const disponible = (p.alto - 2) * MM;
  let letra: number = p.letra;
  for (let i = 0; i < 4; i++) {
    const siguiente = letraQueCabe(letra, copia.scrollHeight, disponible);
    if (siguiente === letra) break;
    letra = siguiente;
    estilo.replaceSync(reglas(letra));
  }
  copia.classList.remove('midiendo');
  document.documentElement.classList.add('imprimiendo-letrero');
  const limpiar = () => {
    document.documentElement.classList.remove('imprimiendo-letrero');
    copia.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((h) => h !== estilo);
  };
  // En el teléfono el diálogo es asíncrono: se limpia cuando termina.
  window.addEventListener('afterprint', limpiar, { once: true });
  window.print();
}
