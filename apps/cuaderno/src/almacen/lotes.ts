/**
 * Lotes de venta (HU-E6.2): cosechas enteras agrupadas con un código corto, para despacharlas y
 * rastrearlas.
 *
 * - **Código** (CA1): inicial del cultivo, día y mes, consecutivo: `T-2703-2`. Se arma sin señal,
 *   con lo que el teléfono conoce; el consecutivo nunca reutiliza uno visto, ni de un lote
 *   corregido. Si dos teléfonos sin señal arman el mismo código, al sincronizar el más reciente se
 *   muestra con una letra (`T-2703-2B`) y lo dice: nunca dos lotes se ven con el mismo código.
 * - **Un kilo en un solo lote** (CA2): armar un lote con una cosecha que ya está en otro se niega
 *   con un mensaje. Si dos teléfonos sin señal la ponen en lotes distintos, la cosecha se queda en
 *   el lote más antiguo y el otro lo avisa.
 * - **Origen** (CA3): cada lote dice de qué áreas y fechas vienen sus cosechas.
 * - Corregir un lote (cambiar sus cosechas) es un registro nuevo con `anula_id` y el mismo código.
 */
import { ErrorDeValidacion, fechaAgronomica, type Registro } from '@gestionagro/agro-schema';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';

export interface DatosLote {
  codigo: string;
  cosecha_ids: string[];
  cantidad: number;
  unidad: string;
  cultivo: string | null;
}

export interface CosechaParaLote {
  id: string;
  fecha: string;
  area: string;
  cultivo: string | null;
  categoria: string;
  /** Lo vendible: lo cosechado menos el descarte. */
  cantidad: number;
  unidad: string;
}

export interface Lote {
  registro: Registro;
  /** El código que se muestra: con letra si otro lote más antiguo ya tenía el mismo. */
  codigo: string;
  cantidad: number;
  unidad: string;
  cosechas: CosechaParaLote[];
  /** Áreas y fechas de donde viene (CA3). */
  origen: { area: string; fechas: string[] }[];
  avisos: string[];
}

interface DatosCosecha {
  cantidad: number;
  unidad: string;
  categoria: string;
  descarte: number | null;
}

const redondear = (n: number) => Math.round(n * 1000) / 1000;
const fechaCorta = (f: string) => f.split('-').reverse().slice(0, 2).join('/');

/** Inicial del código: la primera letra del cultivo, sin tilde; `M` si hay varios o ninguno. */
export function inicialDe(cultivos: readonly (string | null)[]): string {
  const distintos = new Set(cultivos.map((c) => c?.trim().toLocaleLowerCase('es') ?? ''));
  const [unico] = distintos;
  if (distintos.size !== 1 || !unico) return 'M';
  const letra = unico.normalize('NFD').replace(/[̀-ͯ]/g, '')[0]?.toUpperCase() ?? '';
  return /^[A-Z]$/.test(letra) ? letra : 'M';
}

async function lotesDe(db: CuadernoDb, fincaId: string) {
  const todos = await db.registro
    .where('tipo')
    .equals('lote_venta')
    .filter((r) => r.finca_id === fincaId)
    .toArray();
  // El más antiguo primero: decide a quién le queda una cosecha o un código repetido.
  const vigentes = (await soloVigentes(db, todos)).sort((a, b) => (a.id < b.id ? -1 : 1));
  return { todos, vigentes };
}

async function describirCosechas(db: CuadernoDb, cosechas: Registro[]): Promise<CosechaParaLote[]> {
  const areas = new Map((await db.area.toArray()).map((a) => [a.id, a.nombre]));
  const ciclos = new Map((await db.ciclo.toArray()).map((c) => [c.id, c.cultivo]));
  return cosechas.map((r) => {
    const d = r.datos as DatosCosecha;
    return {
      id: r.id,
      fecha: r.fecha_agronomica,
      area: r.area_ids.map((a) => areas.get(a) ?? 'Área sin nombre').join(', '),
      cultivo: r.ciclo_id ? (ciclos.get(r.ciclo_id) ?? null) : null,
      categoria: d.categoria,
      cantidad: redondear(d.cantidad - (d.descarte ?? 0)),
      unidad: d.unidad,
    };
  });
}

/** Cosechas vigentes de la finca que todavía no están en ningún lote, de la más reciente. */
export async function cosechasSinLote(db: CuadernoDb, fincaId: string): Promise<CosechaParaLote[]> {
  const enLote = new Set(
    (await lotesDe(db, fincaId)).vigentes.flatMap((l) => (l.datos as DatosLote).cosecha_ids),
  );
  const cosechas = await db.registro
    .where('tipo')
    .equals('cosecha')
    .filter((r) => r.finca_id === fincaId && !enLote.has(r.id))
    .toArray();
  const vigentes = (await soloVigentes(db, cosechas)).sort((a, b) => (a.id < b.id ? 1 : -1));
  return (await describirCosechas(db, vigentes)).filter((c) => c.cantidad > 0);
}

/** Los lotes vigentes de la finca, del más reciente al más antiguo, con su origen y avisos. */
export async function leerLotes(db: CuadernoDb, fincaId: string): Promise<Lote[]> {
  const { vigentes } = await lotesDe(db, fincaId);
  const ids = [...new Set(vigentes.flatMap((l) => (l.datos as DatosLote).cosecha_ids))];
  const cosechas = new Map(
    (
      await describirCosechas(
        db,
        (await db.registro.bulkGet(ids)).filter((r) => !!r),
      )
    ).map((c) => [c.id, c]),
  );
  const anuladas = new Set(
    (await db.registro.where('anula_id').anyOf(ids).toArray()).map((r) => r.anula_id),
  );
  const duenoDe = new Map<string, string>();
  const vecesDe = new Map<string, number>();
  const lotes = vigentes.map((registro): Lote => {
    const d = registro.datos as DatosLote;
    const avisos: string[] = [];
    const veces = (vecesDe.get(d.codigo) ?? 0) + 1;
    vecesDe.set(d.codigo, veces);
    const codigo = veces === 1 ? d.codigo : `${d.codigo}${String.fromCharCode(64 + veces)}`;
    if (veces > 1) {
      avisos.push(
        `Otro teléfono armó sin señal un lote con el código ${d.codigo}. Este se llama ${codigo} para no confundirlos.`,
      );
    }
    for (const id of d.cosecha_ids) {
      const otro = duenoDe.get(id);
      const c = cosechas.get(id);
      const cual = c ? `La cosecha de ${c.area} del ${fechaCorta(c.fecha)}` : 'Una cosecha';
      if (otro)
        avisos.push(
          `${cual} también está en el lote ${otro}, que se armó antes. Corrige este lote.`,
        );
      else duenoDe.set(id, codigo);
      if (anuladas.has(id))
        avisos.push(`${cual} se corrigió después de armar el lote. Revisa la cantidad.`);
    }
    const suyas = d.cosecha_ids.flatMap((id) => cosechas.get(id) ?? []);
    const porArea = new Map<string, Set<string>>();
    for (const c of suyas) porArea.set(c.area, (porArea.get(c.area) ?? new Set()).add(c.fecha));
    return {
      registro,
      codigo,
      cantidad: d.cantidad,
      unidad: d.unidad,
      cosechas: suyas,
      origen: [...porArea].map(([area, fechas]) => ({ area, fechas: [...fechas].sort() })),
      avisos,
    };
  });
  return lotes.reverse();
}

/**
 * Arma un lote con esas cosechas (o corrige uno, con `corrige`). Lanza `ErrorDeValidacion` con el
 * motivo en palabras si alguna ya está en otro lote, no existe, o mezcla unidades.
 */
export async function armarLote(
  db: CuadernoDb,
  fincaId: string,
  cosechaIds: readonly string[],
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro> {
  const ids = [...new Set(cosechaIds)];
  if (ids.length === 0) {
    throw new ErrorDeValidacion('Lote', [
      { campo: 'cosechas', motivo: 'elige al menos una cosecha' },
    ]);
  }
  const { todos, vigentes } = await lotesDe(db, fincaId);
  const ocupadas = new Map<string, string>();
  for (const l of vigentes) {
    if (l.id === corrige?.id) continue;
    for (const id of (l.datos as DatosLote).cosecha_ids)
      ocupadas.set(id, (l.datos as DatosLote).codigo);
  }
  const registros = await db.registro.bulkGet(ids);
  const vigentesIds = new Set(
    (
      await soloVigentes(
        db,
        registros.filter((r) => !!r),
      )
    ).map((r) => r.id),
  );
  const cosechas = await describirCosechas(
    db,
    registros.filter((r): r is Registro => !!r && r.tipo === 'cosecha' && r.finca_id === fincaId),
  );
  const motivos: string[] = [];
  for (const id of ids) {
    const c = cosechas.find((x) => x.id === id);
    if (!c || !vigentesIds.has(id)) {
      motivos.push('una de las cosechas ya no existe o se corrigió; vuelve a elegirlas');
      continue;
    }
    const lote = ocupadas.get(id);
    if (lote)
      motivos.push(`la cosecha de ${c.area} del ${fechaCorta(c.fecha)} ya está en el lote ${lote}`);
  }
  const unidades = new Set(cosechas.map((c) => c.unidad));
  if (unidades.size > 1) {
    motivos.push(`no se mezclan unidades en un lote (${[...unidades].join(' y ')})`);
  }
  if (motivos.length > 0) {
    throw new ErrorDeValidacion(
      'Lote',
      motivos.map((motivo) => ({ campo: 'cosechas', motivo })),
    );
  }
  const cantidad = redondear(cosechas.reduce((s, c) => s + c.cantidad, 0));
  if (cantidad <= 0) {
    throw new ErrorDeValidacion('Lote', [
      { campo: 'cosechas', motivo: 'todo lo elegido fue descarte; no queda nada para vender' },
    ]);
  }
  const cultivos = cosechas.map((c) => c.cultivo);
  const [primera] = cosechas;
  if (!primera) throw new Error('sin cosechas');
  const momento = ahora();
  const codigo = corrige
    ? (corrige.datos as DatosLote).codigo
    : siguienteCodigo(
        todos.map((l) => (l.datos as DatosLote).codigo),
        inicialDe(cultivos),
        fechaAgronomica(momento.getTime()),
      );
  const origen = registros.filter((r): r is Registro => !!r);
  const areaIds = [...new Set(origen.flatMap((r) => r.area_ids))];
  const ciclos = new Set(origen.map((r) => r.ciclo_id));
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: areaIds[0] ?? '',
    tipo: 'lote_venta',
    v: 1,
    personaIds: [],
    origen: 'manual',
    ahora: () => momento,
    corrige,
  });
  return guardarRegistro(
    db,
    {
      ...cabecera,
      area_ids: areaIds,
      ciclo_id: ciclos.size === 1 ? ([...ciclos][0] ?? null) : null,
      datos: {
        codigo,
        cosecha_ids: ids,
        cantidad,
        unidad: primera.unidad,
        cultivo: new Set(cultivos).size === 1 ? primera.cultivo : null,
      } satisfies DatosLote,
    },
    // Un lote junta cosechas ya anotadas: no es un registro nuevo dentro de un ciclo cerrado.
    { ahora, confirmarCicloCerrado: true },
  );
}

/** `T-2703-3`: el consecutivo sigue al mayor visto con esa inicial y ese día. */
export function siguienteCodigo(
  existentes: readonly string[],
  inicial: string,
  fecha: string,
): string {
  const [, mes, dia] = fecha.split('-');
  const prefijo = `${inicial}-${dia}${mes}-`;
  const mayor = existentes
    .filter((c) => c.startsWith(prefijo))
    .map((c) => Number(c.slice(prefijo.length)))
    .filter(Number.isInteger)
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefijo}${mayor + 1}`;
}
