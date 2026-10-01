/**
 * Aviso de pausa bajo la cabecera, en todas las pantallas (HU-E8.6). Solo para las causas que la
 * persona no ve de otra forma y que duran: modo esencial, cuota agotada, mantenimiento y mudanza.
 * También el reloj del teléfono adelantado (HU-E5.6, P8), que no detiene nada pero hay que corregir.
 * «Sin señal» ya lo dice la cabecera con lo pendiente; el resto se ve en Cuenta. El texto sale del
 * catálogo (`mensajes-de-pausa.ts`).
 */
import { useEffect, useState } from 'preact/hooks';
import { AVISO_RELOJ, CAUSAS_CON_AVISO, causaDe, mensajeDePausa } from './mensajes-de-pausa.ts';
import { escucharSincronizacion, estadoDeSincronizacion } from './sincronizacion.ts';

export function AvisoDePausa() {
  const [estado, setEstado] = useState(estadoDeSincronizacion());
  useEffect(() => escucharSincronizacion(setEstado), []);
  if (
    estado.tipo === 'resultado' &&
    estado.resultado.estado === 'al-dia' &&
    estado.resultado.relojCorrido
  ) {
    return (
      <div class="aviso-actualizacion" role="status" data-prueba="aviso-reloj">
        <p>
          <strong>{AVISO_RELOJ.que}</strong> {AVISO_RELOJ.datos}
        </p>
        <p>{AVISO_RELOJ.hacer}</p>
      </div>
    );
  }
  const pausa = causaDe(estado);
  if (!pausa || !CAUSAS_CON_AVISO.has(pausa.causa)) return null;
  const m = mensajeDePausa(pausa.causa, { ahora: Date.now(), ...pausa });
  return (
    <div class="aviso-actualizacion" role="status" data-prueba="aviso-pausa">
      <p>
        <strong>{m.que}</strong> {m.datos}
      </p>
      <p>{m.hacer}</p>
    </div>
  );
}
