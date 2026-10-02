/**
 * Carpeta de cumplimiento (HU-E9.2): los registros de la finca en un periodo, por secciones, listos
 * para el PDF. Las columnas son las mismas del CSV para Excel (P2); aquí solo se eligen los tipos,
 * se filtran por la fecha agronómica y se marcan los anulados (CA1).
 *
 * No afirma cumplir ninguna norma (CA2): dice «registros de la finca para el periodo». La
 * estructura se revisa contra la lista de verificación de la certificación que se elija (T-0.4).
 */
import type { Registro } from '@gestionagro/agro-schema';
import type { CuadernoDb } from './db.ts';
import { type DatosDespacho, leerDespachos } from './despachos.ts';
import { leerLotes } from './lotes.ts';
import type { Periodo } from './mano-de-obra.ts';
import { COLUMNAS_COMUNES, COLUMNAS_CSV, contextoDeRegistros } from './respaldo.ts';

export interface FilaDeCarpeta {
  celdas: string[];
  /** Fue corregido después: la versión nueva aparece como otra fila. */
  anulado: boolean;
}

export interface SeccionDeCarpeta {
  titulo: string;
  columnas: string[];
  filas: FilaDeCarpeta[];
  nota: string | null;
}

export interface Carpeta {
  finca: string;
  municipio: string;
  desde: string;
  hasta: string;
  secciones: SeccionDeCarpeta[];
}

/** Las secciones de registros, en el orden de una auditoría de buenas prácticas. */
export const TIPOS_DE_LA_CARPETA = [
  { tipo: 'aplicacion', titulo: 'Aplicaciones' },
  { tipo: 'riego', titulo: 'Riegos' },
  { tipo: 'monitoreo', titulo: 'Monitoreo de plagas y enfermedades' },
  { tipo: 'cosecha', titulo: 'Cosechas' },
] as const;

const NOTA_ANULADOS =
  'Una fila «anulado» es un registro que se corrigió después: la corrección aparece como otra fila vigente. Nada se borra.';

const fechaCorta = (f: string) => f.split('-').reverse().join('/');
const enPeriodo = (fecha: string, p: Periodo) =>
  (p.desde === null || fecha >= p.desde) && (p.hasta === null || fecha <= p.hasta);
const numero = (n: number) => String(n).replace('.', ',');

export async function armarCarpeta(
  db: CuadernoDb,
  fincaId: string,
  periodo: { desde: string; hasta: string },
): Promise<Carpeta> {
  const finca = await db.finca.get(fincaId);
  const secciones: SeccionDeCarpeta[] = [];

  for (const { tipo, titulo } of TIPOS_DE_LA_CARPETA) {
    const propias = COLUMNAS_CSV[tipo] ?? [];
    const columnas = [...COLUMNAS_COMUNES, ...propias];
    const registros: Registro[] = (
      await db.registro
        .where('tipo')
        .equals(tipo)
        .filter((r) => r.finca_id === fincaId && enPeriodo(r.fecha_agronomica, periodo))
        .toArray()
    ).sort(
      (a, b) => a.instante_evento.localeCompare(b.instante_evento) || a.id.localeCompare(b.id),
    );
    const contexto = await contextoDeRegistros(db, registros);
    secciones.push({
      titulo,
      columnas: columnas.map((c) => c.titulo),
      filas: registros.map((r) => ({
        celdas: columnas.map((c) => c.valor(r, contexto)),
        anulado: contexto.anulados.has(r.id),
      })),
      nota: registros.some((r) => contexto.anulados.has(r.id)) ? NOTA_ANULADOS : null,
    });
  }

  // Trazabilidad: lotes y despachos vigentes del periodo (HU-E6.2, HU-E6.3).
  const lotes = (await leerLotes(db, fincaId))
    .filter((l) => enPeriodo(l.registro.fecha_agronomica, periodo))
    .reverse();
  secciones.push({
    titulo: 'Lotes de venta',
    columnas: ['Fecha', 'Código', 'Cantidad', 'Unidad', 'De dónde viene'],
    filas: lotes.map((l) => ({
      celdas: [
        fechaCorta(l.registro.fecha_agronomica),
        l.codigo,
        numero(l.cantidad),
        l.unidad,
        l.origen.map((o) => `${o.area} (${o.fechas.map(fechaCorta).join(', ')})`).join('; '),
      ],
      anulado: false,
    })),
    nota: 'Cada lote en su versión vigente; sus cosechas están en la sección anterior.',
  });
  const despachos = (await leerDespachos(db, fincaId))
    .filter((d) => enPeriodo(d.registro.fecha_agronomica, periodo))
    .reverse();
  secciones.push({
    titulo: 'Despachos',
    columnas: ['Fecha', 'Cliente', 'Tipo de cliente', 'Lotes', 'Cantidad', 'Unidad'],
    filas: despachos.map((d) => {
      const datos: DatosDespacho = d.datos;
      return {
        celdas: [
          fechaCorta(d.registro.fecha_agronomica),
          datos.cliente.nombre,
          datos.cliente.tipo,
          d.codigos.join(', '),
          numero(d.cantidad),
          datos.unidad,
        ],
        anulado: false,
      };
    }),
    nota: 'Cada despacho en su versión vigente.',
  });

  return {
    finca: finca?.nombre ?? 'Finca',
    municipio: finca?.municipio ?? '',
    desde: periodo.desde,
    hasta: periodo.hasta,
    secciones,
  };
}
