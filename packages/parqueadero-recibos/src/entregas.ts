/**
 * Por dónde llegó cada recibo (HU-Q3.6, HU-Q8.6): una vez, por el mejor camino. Papel si salió al
 * menos una vez (envíos menos los «No salió», como `vecesImpreso` de la caja); si no, WhatsApp si
 * se abrió y nadie dijo después «No se envió»; si no, pantalla si el conductor lo escaneó. Lo usan
 * el cierre de turno y lo que ahorra el parqueadero: los dos cuentan igual (P2).
 */
import type { DatosDeEntrega, Registro } from '@ed1/parqueadero-schema';

export type CanalDelRecibo = 'papel' | 'whatsapp' | 'pantalla' | 'sin_entrega';

export interface Entregas {
  /** El canal de un recibo por su id. */
  readonly canalDe: (reciboId: string) => CanalDelRecibo;
  /** Copias reimpresas que salieron. */
  readonly copias: number;
}

const antes = (a: Registro, b: Registro) =>
  a.instante_evento < b.instante_evento
    ? -1
    : a.instante_evento > b.instante_evento
      ? 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0;

export function entregasDeLosRecibos(registros: readonly Registro[]): Entregas {
  const papel = new Map<string, number>();
  const whatsapp = new Map<string, number>();
  const pantalla = new Set<string>();
  let copias = 0;
  const entregas = registros.filter((r) => r.tipo === 'entrega_recibo').sort(antes);
  for (const e of entregas) {
    const d = e.datos as DatosDeEntrega;
    const id = d.recibo_id;
    if (d.canal === 'papel') {
      papel.set(id, (papel.get(id) ?? 0) + (d.resultado === 'fallido' ? -1 : 1));
      if (d.copia && d.resultado !== 'fallido') copias++;
    } else if (d.canal === 'whatsapp') {
      // HU-Q8.6 CA3: «No se envió» desmiente el «Abierto en WhatsApp» de antes.
      const n = whatsapp.get(id) ?? 0;
      whatsapp.set(id, d.resultado === 'no_enviado' ? Math.max(0, n - 1) : n + 1);
    } else if (d.canal === 'pantalla') {
      pantalla.add(id);
    }
  }
  return {
    canalDe: (id) =>
      (papel.get(id) ?? 0) > 0
        ? 'papel'
        : (whatsapp.get(id) ?? 0) > 0
          ? 'whatsapp'
          : pantalla.has(id)
            ? 'pantalla'
            : 'sin_entrega',
    copias,
  };
}
