/**
 * Isla de la tabla de DPV imprimible (HU-E2.3). La persona elige el cultivo, los rangos y el
 * papel; el PDF se arma en el teléfono al tocar el botón. El generador (con pdf-lib) se carga
 * solo entonces, para que la página siga liviana.
 */
import { CULTIVOS_DPV } from '@gestionagro/agro-calc';
import { useState } from 'preact/hooks';
import {
  armarTabla,
  type CampoTabla,
  ENTRADAS_POR_DEFECTO,
  type EntradasTabla,
  PASO_HUMEDAD,
  PASO_TEMPERATURA,
} from './tabla-dpv.ts';
import type { Papel } from './tabla-dpv-pdf.ts';

const OPCIONES = CULTIVOS_DPV.flatMap((c) =>
  c.etapas.map((e) => ({ valor: `${c.id}:${e.id}`, texto: `${c.nombre} — ${e.nombre}` })),
);

function Numero(props: {
  id: CampoTabla;
  etiqueta: string;
  valor: string;
  error: string | undefined;
  alCambiar: (t: string) => void;
}) {
  const idError = `tabla-${props.id}-error`;
  return (
    <div class="campo">
      <label for={`tabla-${props.id}`}>{props.etiqueta}</label>
      <input
        id={`tabla-${props.id}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={props.valor}
        aria-invalid={props.error ? 'true' : 'false'}
        aria-describedby={props.error ? idError : undefined}
        onInput={(e) => props.alCambiar((e.currentTarget as HTMLInputElement).value)}
      />
      {props.error && (
        <p id={idError} class="error">
          {props.error}
        </p>
      )}
    </div>
  );
}

function descargar(nombre: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function TablaDpvImprimible() {
  const [e, setE] = useState<EntradasTabla>(ENTRADAS_POR_DEFECTO);
  const [papel, setPapel] = useState<Papel>('carta');
  const [estado, setEstado] = useState<'listo' | 'armando' | 'hecho' | 'fallo'>('listo');
  const { errores, tabla } = armarTabla(e);
  const cambiar = (campo: keyof EntradasTabla) => (valor: string) => {
    setE({ ...e, [campo]: valor });
    setEstado('listo');
  };

  const generar = async () => {
    if (!tabla) return;
    setEstado('armando');
    try {
      const { pdfDeTabla } = await import('./tabla-dpv-pdf.ts');
      const cultivo = OPCIONES.find((o) => o.valor === e.cultivoEtapa)?.texto ?? null;
      const bytes = await pdfDeTabla(tabla, papel, cultivo);
      const sufijo = e.cultivoEtapa ? `-${e.cultivoEtapa.replace(':', '-')}` : '';
      descargar(`tabla-dpv${sufijo}.pdf`, bytes);
      setEstado('hecho');
    } catch {
      setEstado('fallo');
    }
  };

  return (
    <form class="calculadora-dpv" onSubmit={(ev) => ev.preventDefault()} noValidate>
      <div class="campo">
        <label for="tabla-cultivo">Cultivo y etapa de la tabla</label>
        <select
          id="tabla-cultivo"
          value={e.cultivoEtapa}
          onChange={(ev) => cambiar('cultivoEtapa')((ev.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">Sin cultivo: solo los valores</option>
          {OPCIONES.map((o) => (
            <option value={o.valor} key={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>
      <fieldset class="rango">
        <legend>Temperatura del aire (°C), cada {PASO_TEMPERATURA}</legend>
        <Numero
          id="tMin"
          etiqueta="Desde"
          valor={e.tMin}
          error={errores.tMin}
          alCambiar={cambiar('tMin')}
        />
        <Numero
          id="tMax"
          etiqueta="Hasta"
          valor={e.tMax}
          error={errores.tMax}
          alCambiar={cambiar('tMax')}
        />
      </fieldset>
      <fieldset class="rango">
        <legend>Humedad relativa (%), cada {PASO_HUMEDAD}</legend>
        <Numero
          id="hrMin"
          etiqueta="Desde"
          valor={e.hrMin}
          error={errores.hrMin}
          alCambiar={cambiar('hrMin')}
        />
        <Numero
          id="hrMax"
          etiqueta="Hasta"
          valor={e.hrMax}
          error={errores.hrMax}
          alCambiar={cambiar('hrMax')}
        />
      </fieldset>
      <div class="campo">
        <label for="tabla-papel">Papel</label>
        <select
          id="tabla-papel"
          value={papel}
          onChange={(ev) => {
            setPapel((ev.currentTarget as HTMLSelectElement).value as Papel);
            setEstado('listo');
          }}
        >
          <option value="carta">Carta</option>
          <option value="a4">A4</option>
        </select>
      </div>
      <button
        type="button"
        class="boton-compartir"
        disabled={!tabla || estado === 'armando'}
        onClick={() => void generar()}
        data-prueba="descargar-tabla"
      >
        {estado === 'armando' ? 'Armando el PDF…' : 'Descargar tabla en PDF'}
      </button>
      <p class="privacidad" role="status">
        {estado === 'hecho'
          ? 'Listo: la tabla quedó en tus descargas. Sale en una hoja horizontal y se lee también en blanco y negro.'
          : estado === 'fallo'
            ? 'No se pudo armar el PDF en este teléfono. Inténtalo otra vez.'
            : tabla
              ? `${tabla.temperaturas.length} temperaturas × ${tabla.humedades.length} humedades, en una hoja horizontal.`
              : 'Corrige los rangos para armar la tabla.'}
      </p>
    </form>
  );
}
