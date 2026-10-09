/**
 * Lo que ahorra el parqueadero (HU-Q8.6, PARQUEADERO §8.4 y §14.4): los recibos de un periodo por
 * el canal que llegaron y el papel que no se gastó, en pesos con el costo por recibo que declara la
 * sede. Sale de los registros `entrega_recibo`, sin teléfono ni texto (CA2).
 *
 * - Cada recibo cuenta una vez, por el mejor camino (`entregas.ts`), como en el cierre de turno.
 * - **CA3:** un WhatsApp que el operador marcó «No se envió» no cuenta como digital.
 * - **P1:** sin el costo por recibo de la sede no hay pesos: `pesos` es nulo, nunca 0.
 * - `anotadas` cuenta las entregas como las cuentan los eventos de HU-Q5.3, para cuadrar con ellos.
 */
import { type DatosDeEntrega, type Registro, TIPOS_DE_REGISTRO } from '@ed1/parqueadero-schema';
import { entregasDeLosRecibos } from './entregas.ts';

export interface AhorroDelPeriodo {
  /** Fechas de Bogotá, las dos incluidas. */
  readonly desde: string;
  readonly hasta: string;
  readonly recibos: number;
  readonly papel: number;
  readonly whatsapp: number;
  readonly pantalla: number;
  readonly sinEntrega: number;
  /** Recibos que llegaron por WhatsApp o en la pantalla y no gastaron papel. */
  readonly sinPapel: number;
  /** `sinPapel` por el costo de la sede; nulo si la sede no lo ha dicho. */
  readonly pesos: number | null;
  /** Las entregas anotadas en el periodo, como los eventos `recibo.*` de HU-Q5.3. */
  readonly anotadas: {
    readonly papel: number;
    readonly copia: number;
    readonly whatsapp: number;
    readonly pantalla: number;
  };
}

export function ahorroDelPeriodo(
  registros: readonly Registro[],
  desde: string,
  hasta: string,
  costoPorRecibo: number | null,
): AhorroDelPeriodo {
  const dentro = (r: Registro) => r.fecha_local >= desde && r.fecha_local <= hasta;
  const anulados = new Set(registros.filter((r) => r.tipo === 'anulacion').map((r) => r.anula_id));
  const recibos = registros.filter(
    (r) => TIPOS_DE_REGISTRO[r.tipo].lleva_numero && !anulados.has(r.id) && dentro(r),
  );
  const entregas = entregasDeLosRecibos(registros);
  const cuenta = { papel: 0, whatsapp: 0, pantalla: 0, sin_entrega: 0 };
  for (const r of recibos) cuenta[entregas.canalDe(r.id)]++;

  const anotadas = { papel: 0, copia: 0, whatsapp: 0, pantalla: 0 };
  for (const e of registros) {
    if (e.tipo !== 'entrega_recibo' || !dentro(e)) continue;
    const d = e.datos as DatosDeEntrega;
    if (d.canal === 'papel' && d.resultado === 'enviado') anotadas[d.copia ? 'copia' : 'papel']++;
    else if (d.canal === 'whatsapp' && d.resultado === 'abierto') anotadas.whatsapp++;
    else if (d.canal === 'pantalla' && d.resultado === 'confirmado') anotadas.pantalla++;
  }

  const sinPapel = cuenta.whatsapp + cuenta.pantalla;
  return {
    desde,
    hasta,
    recibos: recibos.length,
    papel: cuenta.papel,
    whatsapp: cuenta.whatsapp,
    pantalla: cuenta.pantalla,
    sinEntrega: cuenta.sin_entrega,
    sinPapel,
    pesos: costoPorRecibo === null ? null : sinPapel * costoPorRecibo,
    anotadas,
  };
}

const DIA_MS = 86_400_000;
const fecha = (t: number) => new Date(t).toISOString().slice(0, 10);
const ms = (f: string) => Date.parse(`${f}T00:00:00Z`);

export interface Periodo {
  readonly nombre: string;
  readonly desde: string;
  readonly hasta: string;
}

/** Esta semana (lunes a hoy), la pasada, este mes y el pasado, con `hoy` en la fecha de Bogotá. */
export function periodosDelAhorro(hoy: string): Periodo[] {
  const h = ms(hoy);
  const lunes = h - ((new Date(h).getUTCDay() + 6) % 7) * DIA_MS;
  const primero = `${hoy.slice(0, 8)}01`;
  const ultimoDelPasado = ms(primero) - DIA_MS;
  return [
    { nombre: 'Esta semana', desde: fecha(lunes), hasta: hoy },
    { nombre: 'Semana pasada', desde: fecha(lunes - 7 * DIA_MS), hasta: fecha(lunes - DIA_MS) },
    { nombre: 'Este mes', desde: primero, hasta: hoy },
    {
      nombre: 'Mes pasado',
      desde: `${fecha(ultimoDelPasado).slice(0, 8)}01`,
      hasta: fecha(ultimoDelPasado),
    },
  ];
}
