/**
 * El aviso de privacidad a la vista (HU-Q4.4 CA2): en la PT-210, para pegarlo junto a la caja, o en
 * una hoja carta con la política completa. El texto sale de la plantilla con los datos de la sede.
 */
import { faltantesDeSede, juntar, nombresDeCampos } from '@ed1/parqueadero-recibos';
import { useState } from 'preact/hooks';
import { type Ajustes, leerAjustes } from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { useConsulta } from './ganchos.ts';
import type { ControlDeImpresora } from './impresora.ts';
import { avisoAceptado, avisoDeLaSede, bloquesDelAviso } from './privacidad.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly control: ControlDeImpresora;
  readonly alAjustes: () => void;
  readonly alVolver: () => void;
}

export function Aviso({ db, control, alAjustes, alVolver }: Props) {
  const ajustes = useConsulta<Ajustes | null>(() => leerAjustes(db), null);
  const [estado, setEstado] = useState('');
  if (!ajustes) return <section class="tarjeta" aria-busy="true" />;
  const { sede } = ajustes;
  const faltan = nombresDeCampos(faltantesDeSede(sede));
  if (!sede || faltan.length > 0) {
    return (
      <section class="tarjeta" data-prueba="aviso">
        <h1>Aviso de privacidad</h1>
        <p class="error">El aviso lleva los datos del parqueadero. Falta: {juntar(faltan)}.</p>
        <button type="button" class="boton boton-principal" onClick={alAjustes}>
          Completar los ajustes
        </button>
        <button type="button" class="boton boton-secundario" onClick={alVolver}>
          Volver al inicio
        </button>
      </section>
    );
  }
  const aviso = avisoDeLaSede(sede);

  async function aLaImpresora() {
    setEstado('Enviando a la impresora…');
    const r = await control.imprimir(bloquesDelAviso(aviso));
    setEstado(r.ok ? 'Enviado a la impresora' : `No salió: ${r.detalle}`);
  }

  return (
    <section class="tarjeta imprimible" data-prueba="aviso">
      <h1>{aviso.titulo}</h1>
      {!avisoAceptado(sede) && (
        <p class="error no-imprimir" data-prueba="aviso-sin-aceptar">
          El parqueadero todavía no acepta este aviso: la caja no guarda números de WhatsApp hasta
          que lo acepte en Ajustes.
        </p>
      )}
      {aviso.parrafos.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <p class="ayuda">Versión {aviso.version}</p>
      <h2>{aviso.politica.titulo}</h2>
      {aviso.politica.secciones.map(([titulo, texto]) => (
        <p key={titulo}>
          <strong>{titulo}.</strong> {texto}
        </p>
      ))}
      <div class="dos no-imprimir">
        <button type="button" class="boton" onClick={() => void aLaImpresora()}>
          Imprimir en la impresora
        </button>
        <button type="button" class="boton" onClick={() => window.print()}>
          Imprimir en hoja carta
        </button>
      </div>
      <output class="no-imprimir" aria-live="polite">
        {estado}
      </output>
      <button type="button" class="boton boton-secundario no-imprimir" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
