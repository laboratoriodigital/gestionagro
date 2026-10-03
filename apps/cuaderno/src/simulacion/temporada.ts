/**
 * Simulación de una temporada de tomate orgánico bajo invernadero (pedido del dueño, 2 oct 2026):
 * el día a día de una finca, escrito con las mismas funciones del almacén que usa la app, para
 * validar coherencia, cálculos y precisión con un oráculo aparte (`temporada.test.ts`).
 *
 * La finca (ficticia, «Ensayo»: el repositorio es público):
 * - 4 naves de 600 m², cada una con 8 camas de sustrato de 40 m² y 180 plantas (1.440 por nave),
 *   riego por goteo con un gotero de 2 L/h por planta.
 * - Propietaria, supervisor y dos operarias. Lunes a viernes de 7:00 a 15:00; sábado de 7:00 a 12:00.
 * - Trasplante el lunes 1 de junio de 2026; cosecha lunes, miércoles y viernes desde el 10 de agosto;
 *   la temporada llega hasta el viernes 2 de octubre de 2026 con los ciclos activos, para que al
 *   importarla haya carencias vigentes.
 * - Errores y casos a propósito, para probar lo que la app debe decir (revisión del dueño, 3 oct
 *   2026): un insecticida no permitido en ecológico, un producto sin carencia ni reentrada en la
 *   etiqueta, neem el jueves 1 de octubre (en carencia el sábado 3), una aplicación sin compra que
 *   deja la bodega en negativo, una compra sin precio, una cosecha corregida después de armar su
 *   lote, una cosecha dentro de la carencia confirmada, clima extremo y un drenaje alto.
 *
 * Todo sale de un generador con semilla: la misma semilla da la misma temporada. El `Libro` que
 * devuelve es la verdad de la simulación (lo que «pasó» en la finca), contra la que se comparan
 * los cálculos de la app.
 */
import {
  type Area,
  instanteEnColombia,
  type Persona,
  type Registro,
  sumarDias,
} from '@gestionagro/agro-schema';
import { cantidadSugerida, guardarAplicacion } from '../almacen/aplicaciones.ts';
import { registrarMovimiento } from '../almacen/bodega.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from '../almacen/ciclos.ts';
import { guardarClima } from '../almacen/clima.ts';
import { guardarCosecha } from '../almacen/cosecha.ts';
import type { CuadernoDb } from '../almacen/db.ts';
import { registrarDespacho } from '../almacen/despachos.ts';
import { crearFincaConAreas, crearSubarea } from '../almacen/finca.ts';
import { crearInsumo } from '../almacen/insumos.ts';
import { guardarLabor } from '../almacen/labores.ts';
import { armarLote } from '../almacen/lotes.ts';
import { guardarMonitoreo } from '../almacen/monitoreo.ts';
import { crearPersona, definirJornal, definirJornalGeneral } from '../almacen/personas.ts';
import { guardarRiego } from '../almacen/riego.ts';

export const INICIO = '2026-06-01';
export const FIN = '2026-10-02';
export const PRIMERA_COSECHA = '2026-08-10';
export const AREA_NAVE = 600;
export const CAMAS_POR_NAVE = 8;
export const PLANTAS_POR_CAMA = 180;
export const PLANTAS_POR_NAVE = CAMAS_POR_NAVE * PLANTAS_POR_CAMA;
/** Caudal de la nave: un gotero de 2 L/h por planta. */
export const CAUDAL_L_H = PLANTAS_POR_NAVE * 2;
export const JORNADA = { semana: 8, sabado: 5 } as const;

/** Azar repetible (mulberry32). */
export function azar(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Día de la semana de una fecha agronómica: 0 domingo … 6 sábado. */
export const diaDeSemana = (fecha: string) => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};
export const semanaDe = (fecha: string) =>
  Math.floor((Date.parse(fecha) - Date.parse(INICIO)) / (7 * 86_400_000)) + 1;

const momento = (fecha: string, hora: string) => {
  const ms = instanteEnColombia(fecha, hora);
  if (ms === null) throw new Error(`Fecha u hora inválida: ${fecha} ${hora}`);
  return () => new Date(ms);
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const medioKilo = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);

// ——— El libro de la temporada: lo que pasó, para el oráculo ———

export interface CompraLibro {
  fecha: string;
  instante: string;
  insumo: string;
  cantidad: number;
  precio: number | null;
}
export interface AplicacionLibro {
  fecha: string;
  instante: string;
  insumo: string;
  /** Por nave, en la unidad del insumo. */
  cantidadPorNave: Map<string, number>;
  carenciaDias: number | null;
  reentradaHoras: number | null;
}
export interface LaborLibro {
  fecha: string;
  nave: string;
  personaId: string;
  horas: number;
}
export interface CosechaLibro {
  id: string;
  fecha: string;
  nave: string;
  categoria: string;
  cantidad: number;
  descarte: number;
  /** Horas de cada operaria; solo en la Primera, como la anotaría la finca. */
  horasPorPersona: number | null;
  personaIds: string[];
  enCarencia: boolean;
}
export interface DespachoLibro {
  fecha: string;
  loteId: string;
  cantidad: number;
  precio: number | null;
  cliente: string;
}
export interface LoteLibro {
  id: string;
  fecha: string;
  categoria: string;
  cosechaIds: string[];
  cantidad: number;
}
export interface Libro {
  fincaId: string;
  naves: Area[];
  camas: Area[];
  ciclos: Map<string, string>;
  personas: { propietaria: Persona; supervisor: Persona; operarias: Persona[] };
  insumos: Map<
    string,
    { id: string; unidad: string; carencia: number | null; reentrada: number | null }
  >;
  jornales: { general: { desde: string; valor: number }[]; supervisor: number };
  compras: CompraLibro[];
  aplicaciones: AplicacionLibro[];
  labores: LaborLibro[];
  cosechas: CosechaLibro[];
  /** Una nave que tocaba cosechar y no se cosechó por la carencia. */
  saltadas: { fecha: string; nave: string; hasta: string }[];
  lotes: LoteLibro[];
  despachos: DespachoLibro[];
  riegos: { fecha: string; nave: string; aplicado: number; drenado: number }[];
  climas: number;
  monitoreos: number;
  correcciones: number;
}

const INSUMOS = [
  {
    clave: 'bt',
    nombre: 'Bioinsumo Ensayo Bt',
    tipo: 'bioinsumo' as const,
    unidad: 'g',
    carencia: 0,
    reentrada: 4,
    empaque: 1000,
    precio: 180_000,
  },
  {
    clave: 'neem',
    nombre: 'Extracto Ensayo de Neem',
    tipo: 'fitosanitario' as const,
    unidad: 'mL',
    carencia: 3,
    reentrada: 12,
    empaque: 1000,
    precio: 95_000,
  },
  {
    clave: 'azufre',
    nombre: 'Azufre Ensayo Mojable',
    tipo: 'fitosanitario' as const,
    unidad: 'g',
    carencia: 1,
    reentrada: 24,
    empaque: 1000,
    precio: 25_000,
  },
  {
    clave: 'trichoderma',
    nombre: 'Trichoderma Ensayo',
    tipo: 'bioinsumo' as const,
    unidad: 'g',
    carencia: 0,
    reentrada: 0,
    empaque: 1000,
    precio: 120_000,
  },
  {
    clave: 'fertilizante',
    nombre: 'Abono Ensayo Líquido',
    tipo: 'fertilizante' as const,
    unidad: 'mL',
    carencia: 0,
    reentrada: 0,
    empaque: 20_000,
    precio: 260_000,
  },
  {
    clave: 'convencional',
    nombre: 'Insecticida Ensayo Convencional',
    tipo: 'fitosanitario' as const,
    unidad: 'mL',
    carencia: 7,
    reentrada: 24,
    empaque: 1000,
    precio: 85_000,
    ecologico: false,
  },
  {
    clave: 'sinetiqueta',
    nombre: 'Producto Ensayo Sin Etiqueta',
    tipo: 'otro' as const,
    unidad: 'mL',
    carencia: null,
    reentrada: null,
    empaque: 1000,
    precio: 40_000,
  },
];

/** Kilos por nave en un día de cosecha: sube 5 semanas y se sostiene. */
function kilosDelDia(fecha: string, aleatorio: () => number) {
  const dias = (Date.parse(fecha) - Date.parse(PRIMERA_COSECHA)) / 86_400_000;
  const base = 60 + Math.min(dias, 35) * 6;
  return base * (0.85 + aleatorio() * 0.3);
}

export async function simularTemporada(db: CuadernoDb, semilla = 2026): Promise<Libro> {
  const al = azar(semilla);
  const preparar = momento('2026-05-25', '08:00');

  const { finca, areas: naves } = await crearFincaConAreas(
    db,
    { nombre: 'Finca Ensayo Orgánica', municipio: 'Municipio Ensayo', regimen: 'ecologico' },
    [1, 2, 3, 4].map((n) => ({
      tipo: 'nave' as const,
      nombre: `Nave ${n}`,
      area_m2: AREA_NAVE,
      capacidad_plantas: PLANTAS_POR_NAVE,
    })),
    { ahora: preparar },
  );
  const camas: Area[] = [];
  for (const nave of naves) {
    for (let k = 1; k <= CAMAS_POR_NAVE; k++) {
      camas.push(
        await crearSubarea(
          db,
          nave.id,
          { tipo: 'cama', nombre: `Cama ${k}`, area_m2: 40, capacidad_plantas: PLANTAS_POR_CAMA },
          { ahora: preparar },
        ),
      );
    }
  }
  const propietaria = await crearPersona(
    db,
    finca.id,
    { nombre: 'Propietaria Ensayo', rol: 'propietario' },
    { ahora: preparar },
  );
  const supervisor = await crearPersona(
    db,
    finca.id,
    { nombre: 'Supervisor Ensayo', rol: 'supervisor' },
    { ahora: preparar },
  );
  const operarias = [
    await crearPersona(
      db,
      finca.id,
      { nombre: 'Operaria Ensayo Uno', rol: 'operario' },
      { ahora: preparar },
    ),
    await crearPersona(
      db,
      finca.id,
      { nombre: 'Operaria Ensayo Dos', rol: 'operario' },
      { ahora: preparar },
    ),
  ];
  const jornales = {
    general: [
      { desde: '2026-01-01', valor: 70_000 },
      { desde: '2026-08-01', valor: 73_000 },
    ],
    supervisor: 95_000,
  };
  for (const j of jornales.general) {
    await definirJornalGeneral(db, finca.id, j.valor, j.desde, { ahora: preparar });
  }
  await definirJornal(db, supervisor.id, jornales.supervisor, '2026-01-01', { ahora: preparar });

  const insumos = new Map<
    string,
    { id: string; unidad: string; carencia: number | null; reentrada: number | null }
  >();
  for (const [i, x] of INSUMOS.entries()) {
    const creado = await crearInsumo(
      db,
      finca.id,
      {
        nombre_comercial: x.nombre,
        tipo: x.tipo,
        registro_ica: `ICA-ENSAYO-00${i + 1}`,
        ingrediente_activo: null,
        unidad: x.unidad,
        carencia_dias: x.carencia,
        reentrada_horas: x.reentrada,
        permitido_ecologico: 'ecologico' in x ? (x.ecologico ?? null) : true,
      },
      { ahora: preparar },
    );
    insumos.set(x.clave, {
      id: creado.id,
      unidad: x.unidad,
      carencia: x.carencia,
      reentrada: x.reentrada,
    });
  }

  const tomate = await agregarCultivo(db, finca.id, 'Tomate', { ahora: preparar });
  await agregarVariedad(db, tomate.id, 'Chonto orgánico', { ahora: preparar });
  const ciclos = new Map<string, string>();
  for (const nave of naves) {
    const c = await iniciarCiclo(
      db,
      {
        fincaId: finca.id,
        areaId: nave.id,
        cultivo: 'Tomate',
        variedad: 'Chonto orgánico',
        fechaTrasplante: INICIO,
        plantas: PLANTAS_POR_NAVE,
      },
      { ahora: momento(INICIO, '07:00') },
    );
    ciclos.set(nave.id, c.id);
  }

  const libro: Libro = {
    fincaId: finca.id,
    naves,
    camas,
    ciclos,
    personas: { propietaria, supervisor, operarias },
    insumos,
    jornales,
    compras: [],
    aplicaciones: [],
    labores: [],
    cosechas: [],
    saltadas: [],
    lotes: [],
    despachos: [],
    riegos: [],
    climas: 0,
    monitoreos: 0,
    correcciones: 0,
  };
  const existencia = new Map<string, number>(INSUMOS.map((x) => [x.clave, 0]));
  /** Primer día en que se puede cosechar cada nave, según lo aplicado (para decidir en la finca). */
  const cosecharDesde = new Map<string, string>(naves.map((n) => [n.id, INICIO]));
  const pendientes = new Map<string, number>(naves.map((n) => [n.id, 0]));
  const nombre = (n: Area) => n.nombre;

  let compraSinPrecio = false;
  const comprarSiFalta = async (clave: string, necesita: number, fecha: string) => {
    const x = INSUMOS.find((i) => i.clave === clave);
    const ins = insumos.get(clave);
    if (!x || !ins) throw new Error(clave);
    while ((existencia.get(clave) ?? 0) < necesita) {
      const empaques = 2;
      const cantidad = x.empaque * empaques;
      // Una compra de fertilizante se anotó sin precio: el costo queda «sin dato» (P1).
      const sinPrecio = clave === 'fertilizante' && semanaDe(fecha) >= 9 && !compraSinPrecio;
      if (sinPrecio) compraSinPrecio = true;
      const precio = sinPrecio ? null : x.precio * empaques;
      const ahora = momento(fecha, '07:15');
      await registrarMovimiento(
        db,
        finca.id,
        { insumoId: ins.id, clase: 'compra', cantidad, precioTotal: precio, nota: '' },
        { ahora },
      );
      libro.compras.push({
        fecha,
        instante: ahora().toISOString(),
        insumo: clave,
        cantidad,
        precio,
      });
      existencia.set(clave, (existencia.get(clave) ?? 0) + cantidad);
    }
  };

  const aplicar = async (
    clave: string,
    navesAplicadas: Area[],
    fecha: string,
    hora: string,
    dosis: number,
    litrosPorNave: number,
    sinComprar = false,
  ) => {
    const ins = insumos.get(clave);
    if (!ins) throw new Error(clave);
    const unidadDosis = `${ins.unidad}/L`;
    const litros = litrosPorNave * navesAplicadas.length;
    const cantidad = cantidadSugerida(dosis, unidadDosis, litros, ins.unidad);
    if (cantidad === null) throw new Error(`Sin cantidad sugerida para ${clave}`);
    if (!sinComprar) await comprarSiFalta(clave, cantidad, fecha);
    const ahora = momento(fecha, hora);
    await guardarAplicacion(
      db,
      finca.id,
      navesAplicadas.map((n) => n.id),
      {
        insumoId: ins.id,
        dosis,
        dosisUnidad: unidadDosis,
        volumenMezclaL: litros,
        equipo: 'Bomba de motor',
        personaIds: [operarias[0]?.id ?? '', supervisor.id],
        cantidadUsada: cantidad,
      },
      { ahora },
    );
    existencia.set(clave, (existencia.get(clave) ?? 0) - cantidad);
    libro.aplicaciones.push({
      fecha,
      instante: ahora().toISOString(),
      insumo: clave,
      // Las naves son iguales: se reparte por m² en partes iguales.
      cantidadPorNave: new Map(navesAplicadas.map((n) => [n.id, cantidad / navesAplicadas.length])),
      carenciaDias: ins.carencia,
      reentradaHoras: ins.reentrada,
    });
    for (const n of navesAplicadas) {
      // Sin carencia en la etiqueta no se sabe cuándo cosechar: la finca no vuelve a cosechar ahí.
      const desde = ins.carencia === null ? '9999-12-31' : sumarDias(fecha, ins.carencia);
      if (desde > (cosecharDesde.get(n.id) ?? INICIO)) cosecharDesde.set(n.id, desde);
    }
  };

  const labor = async (
    nave: Area,
    nombreLabor: string,
    personaIds: string[],
    horas: number,
    fecha: string,
    hora: string,
  ) => {
    await guardarLabor(
      db,
      finca.id,
      { areaId: nave.id, labor: nombreLabor, personaIds, horasPorPersona: horas },
      { ahora: momento(fecha, hora) },
    );
    for (const p of personaIds) libro.labores.push({ fecha, nave: nave.id, personaId: p, horas });
  };

  const laborDeLaSemana = (semana: number, k: number) => {
    const fase =
      semana <= 2
        ? ['Limpieza', 'Tutorado']
        : semana <= 10
          ? ['Tutorado', 'Deshoje', 'Poda', 'Polinización']
          : ['Deshoje', 'Poda', 'Limpieza'];
    return fase[k % fase.length] ?? 'Limpieza';
  };

  let oidioPendiente: Area[] = [];
  let corregidoRiego = false;
  let corregidaCosecha = false;
  let cosechaConfirmada = false;

  for (let fecha = INICIO; fecha <= FIN; fecha = sumarDias(fecha, 1)) {
    const dia = diaDeSemana(fecha);
    if (dia === 0) continue; // domingo: nadie anota
    const sabado = dia === 6;
    const semana = semanaDe(fecha);
    const cosechaHoy =
      fecha >= PRIMERA_COSECHA && (dia === 1 || dia === 3 || dia === 5 || fecha === FIN);

    // 7:00 y 13:00 (sábado 11:30): clima de cada nave.
    for (const nave of naves) {
      for (const [hora, t, hr] of [
        ['07:00', 13 + (al() - 0.5) * 3, 91 + (al() - 0.5) * 10],
        [sabado ? '11:30' : '13:00', 28.5 + (al() - 0.5) * 5, 55 + (al() - 0.5) * 20],
      ] as const) {
        // Dos lecturas extremas: mediodía muy seco (Nave 1) y madrugada saturada (Nave 2).
        const extremo =
          fecha === '2026-09-15' && hora !== '07:00' && nave === naves[0]
            ? { t: 34.5, hr: 32 }
            : fecha === '2026-09-16' && hora === '07:00' && nave === naves[1]
              ? { t: 15, hr: 99 }
              : null;
        await guardarClima(
          db,
          finca.id,
          nave.id,
          {
            temperaturaC: extremo?.t ?? r1(t),
            humedadRelativaPct: extremo?.hr ?? Math.round(hr),
            temperaturaHojaC: null,
          },
          { ahora: momento(fecha, hora) },
        );
        libro.climas += 1;
      }
    }

    // 7:30: riego por goteo de cada nave, con su drenaje, CE y pH.
    const lPorPlanta = Math.min(2.2, 0.6 + (semana - 1) * 0.2);
    for (const nave of naves) {
      const aplicado = Math.round(PLANTAS_POR_NAVE * lPorPlanta * (0.95 + al() * 0.1));
      // Un día de drenaje muy alto en la Nave 3 (45 %), con la CE del drenaje subida.
      const drenajeAlto = fecha === '2026-09-10' && nave === naves[2];
      const drenado = Math.round(aplicado * (drenajeAlto ? 0.45 : 0.15 + al() * 0.13));
      const datos = {
        unidad: 'L_area' as const,
        volumenAplicado: aplicado,
        duracionMin: Math.round((aplicado / CAUDAL_L_H) * 60),
        volumenDrenado: drenado,
        ceEntradaDsM: r1(1.8 + (al() - 0.5) * 0.4),
        phEntrada: r1(6.3 + (al() - 0.5) * 0.4),
        ceDrenajeDsM: drenajeAlto ? 3.6 : r1(2.3 + (al() - 0.5) * 0.4),
        phDrenaje: r1(6.5 + (al() - 0.5) * 0.4),
      };
      // Un error de digitación el día 10 en la Nave 1 (un cero de más), corregido a las 8:00.
      if (!corregidoRiego && semana === 2 && dia === 3 && nave === naves[0]) {
        const [malo] = await guardarRiego(
          db,
          finca.id,
          [nave.id],
          { ...datos, volumenAplicado: aplicado * 10, duracionMin: (datos.duracionMin ?? 0) * 10 },
          { ahora: momento(fecha, '07:30') },
        );
        await guardarRiego(db, finca.id, [nave.id], datos, {
          ahora: momento(fecha, '08:00'),
          corrige: malo,
        });
        corregidoRiego = true;
        libro.correcciones += 1;
      } else {
        await guardarRiego(db, finca.id, [nave.id], datos, { ahora: momento(fecha, '07:30') });
      }
      libro.riegos.push({ fecha, nave: nave.id, aplicado, drenado });
    }

    // Aplicaciones del calendario de manejo.
    if (semana % 4 === 1 && dia === 2) {
      // La última (semana 17) va con más dosis y sin anotar la compra: la bodega queda en negativo.
      await aplicar(
        'trichoderma',
        naves,
        fecha,
        '08:00',
        semana === 17 ? 2.5 : 2,
        200,
        semana === 17,
      );
    }
    if (dia === 1 && !cosechaHoy) await aplicar('fertilizante', naves, fecha, '08:00', 3, 500);
    if (dia === 1 && cosechaHoy) await aplicar('fertilizante', naves, fecha, '14:00', 3, 500);
    if (semana >= 3 && dia === 2) await aplicar('bt', naves, fecha, '08:30', 1, 200);
    // Una sola vez, un insecticida que no está permitido en producción ecológica (Nave 3).
    if (semana === 7 && dia === 3) {
      await aplicar('convencional', [naves[2] as Area], fecha, '08:30', 1, 200);
    }
    if (sabado && oidioPendiente.length > 0) {
      await aplicar('azufre', oidioPendiente, fecha, '07:45', 2, 200);
      oidioPendiente = [];
    }

    // Jueves 7:45: monitoreo de cada nave; el neem va donde la mosca blanca está alta.
    if (dia === 4) {
      const altas: Area[] = [];
      for (const nave of naves) {
        const mosca = Math.round(5 + al() * 25 + Math.min(semana, 12) * 2.5);
        const nivel = mosca < 15 ? 'bajo' : mosca < 40 ? 'medio' : 'alto';
        await guardarMonitoreo(
          db,
          finca.id,
          {
            areaId: nave.id,
            plaga: 'Mosca blanca',
            clase: 'plaga',
            metodo: 'trampa',
            nivel,
            cantidad: mosca,
            nota: '',
            foto: null,
          },
          { ahora: momento(fecha, '07:45'), plan: 'finca' },
        );
        libro.monitoreos += 1;
        if (nivel === 'alto') altas.push(nave);
        const tuta = Math.round(al() * 18);
        await guardarMonitoreo(
          db,
          finca.id,
          {
            areaId: nave.id,
            plaga: 'Tuta absoluta',
            clase: 'plaga',
            metodo: 'trampa',
            nivel: tuta < 8 ? 'bajo' : tuta < 14 ? 'medio' : 'alto',
            cantidad: tuta,
            nota: '',
            foto: null,
          },
          { ahora: momento(fecha, '08:00'), plan: 'finca' },
        );
        libro.monitoreos += 1;
        if (semana >= 6 && al() < 0.12) {
          await guardarMonitoreo(
            db,
            finca.id,
            {
              areaId: nave.id,
              plaga: 'Oídio',
              clase: 'enfermedad',
              metodo: 'observacion',
              nivel: 'medio',
              cantidad: null,
              nota: 'Manchas en hojas bajas de las camas 3 y 4',
              foto: null,
            },
            { ahora: momento(fecha, '08:15'), plan: 'finca' },
          );
          libro.monitoreos += 1;
          oidioPendiente.push(nave);
        }
      }
      // El último jueves (1 de octubre) la Nave 2 lleva neem: sigue en carencia el sábado 3.
      if (fecha === '2026-10-01') altas.splice(0, altas.length, naves[1] as Area);
      if (altas.length > 0) await aplicar('neem', altas, fecha, '13:30', 2.5, 200);
    }

    // Cosecha: lunes, miércoles y viernes, y el último sábado. Una nave en carencia no se cosecha
    // ese día (lo dice el calendario de la finca) y su fruta se suma a la siguiente.
    const cosechadoHoy: CosechaLibro[] = [];
    const horasCosecha = new Map<string, number>(operarias.map((o) => [o.id, 0]));
    if (cosechaHoy) {
      for (const nave of naves) {
        const desde = cosecharDesde.get(nave.id) ?? INICIO;
        const kilos = kilosDelDia(fecha, al) + (pendientes.get(nave.id) ?? 0);
        const enCarencia = fecha < desde;
        // Una sola vez, la finca cosecha dentro de la carencia por un pedido y lo confirma.
        const confirmar = enCarencia && !cosechaConfirmada && semana >= 13;
        if (enCarencia && !confirmar) {
          libro.saltadas.push({ fecha, nave: nave.id, hasta: desde });
          pendientes.set(nave.id, kilos * 0.85); // parte se sobremadura y se pierde
          continue;
        }
        if (confirmar) cosechaConfirmada = true;
        pendientes.set(nave.id, 0);
        const reparto = [
          ['Primera', 0.6 + (al() - 0.5) * 0.08],
          ['Segunda', 0.28 + (al() - 0.5) * 0.06],
        ] as const;
        const primera = medioKilo(kilos * reparto[0][1]);
        const segunda = medioKilo(kilos * reparto[1][1]);
        const tercera = medioKilo(Math.max(0.5, kilos - primera - segunda));
        for (const [categoria, cantidad] of [
          ['Primera', primera],
          ['Segunda', segunda],
          ['Tercera', tercera],
        ] as const) {
          const descarte = medioKilo(cantidad * (0.04 + al() * 0.06));
          const horas = categoria === 'Primera' ? 1 : null;
          const r = await guardarCosecha(
            db,
            finca.id,
            {
              areaId: nave.id,
              cantidad,
              unidad: 'kg',
              categoria,
              descarte: Math.min(descarte, cantidad),
              personaIds: operarias.map((o) => o.id),
              horasPorPersona: horas,
              confirmarCarencia: confirmar,
            },
            { ahora: momento(fecha, '10:00') },
          );
          const entrada: CosechaLibro = {
            id: r.id,
            fecha,
            nave: nave.id,
            categoria,
            cantidad,
            descarte: Math.min(descarte, cantidad),
            horasPorPersona: horas,
            personaIds: operarias.map((o) => o.id),
            enCarencia: confirmar,
          };
          cosechadoHoy.push(entrada);
          libro.cosechas.push(entrada);
        }
        for (const o of operarias) horasCosecha.set(o.id, (horasCosecha.get(o.id) ?? 0) + 1);
      }
      // Una cosecha mal pesada el primer día de septiembre, corregida antes de armar los lotes.
      if (!corregidaCosecha && fecha >= '2026-09-02' && cosechadoHoy[0]) {
        const vieja = cosechadoHoy[0];
        const registro = (await db.registro.get(vieja.id)) as Registro;
        const corregida = await guardarCosecha(
          db,
          finca.id,
          {
            areaId: vieja.nave,
            cantidad: vieja.cantidad + 5,
            unidad: 'kg',
            categoria: vieja.categoria,
            descarte: vieja.descarte,
            personaIds: vieja.personaIds,
            horasPorPersona: vieja.horasPorPersona,
            confirmarCarencia: vieja.enCarencia,
          },
          { ahora: momento(fecha, '10:30'), corrige: registro },
        );
        libro.cosechas[libro.cosechas.indexOf(vieja)] = {
          ...vieja,
          id: corregida.id,
          cantidad: vieja.cantidad + 5,
        };
        cosechadoHoy[0] = { ...vieja, id: corregida.id, cantidad: vieja.cantidad + 5 };
        corregidaCosecha = true;
        libro.correcciones += 1;
      }
      // 14:30: un lote por calidad con lo cosechado hoy.
      for (const categoria of ['Primera', 'Segunda', 'Tercera']) {
        const suyas = cosechadoHoy.filter((c) => c.categoria === categoria);
        if (suyas.length === 0) continue;
        const lote = await armarLote(
          db,
          finca.id,
          suyas.map((c) => c.id),
          { ahora: momento(fecha, '14:30') },
        );
        libro.lotes.push({
          id: lote.id,
          fecha,
          categoria,
          cosechaIds: suyas.map((c) => c.id),
          cantidad: r2(suyas.reduce((s, c) => s + c.cantidad - c.descarte, 0)),
        });
      }
    }

    // Despachos del día siguiente hábil (martes, jueves, sábado) a las 8:30, de los lotes de ayer.
    const ayer = sumarDias(fecha, -1);
    for (const lote of libro.lotes.filter((l) => l.fecha === ayer)) {
      const ventas: [string, 'restaurante' | 'tienda' | 'consumidor', number, number | null][] =
        lote.categoria === 'Primera'
          ? [
              ['Restaurante Ensayo', 'restaurante', 0.55, 4_200],
              ['Tienda Ensayo', 'tienda', 0.45, 3_900],
            ]
          : lote.categoria === 'Segunda'
            ? [['Mercado Ensayo', 'tienda', 1, 2_300]]
            : [['Consumidor Ensayo', 'consumidor', 0.5, 1_200]];
      let quedan = lote.cantidad;
      for (const [cliente, tipo, parte, precio] of ventas) {
        const cantidad = r2(Math.min(quedan, Math.round(lote.cantidad * parte * 10) / 10));
        if (cantidad <= 0) continue;
        // Una entrega a un comedor comunitario se anotó sin precio.
        const sinPrecio =
          lote.categoria === 'Tercera' && libro.despachos.every((d) => d.precio !== null);
        const precioFinal = sinPrecio ? null : precio;
        await registrarDespacho(
          db,
          finca.id,
          {
            cliente: { nombre: sinPrecio ? 'Comedor Ensayo' : cliente, tipo },
            lineas: [{ loteId: lote.id, cantidad }],
            precioUnitario: precioFinal,
            medioPago: tipo === 'restaurante' ? 'credito' : 'efectivo',
          },
          { ahora: momento(fecha, '08:30') },
        );
        libro.despachos.push({
          fecha,
          loteId: lote.id,
          cantidad,
          precio: precioFinal,
          cliente: sinPrecio ? 'Comedor Ensayo' : cliente,
        });
        quedan = r2(quedan - cantidad);
      }
    }

    if (fecha === FIN) {
      await aplicar('sinetiqueta', [naves[3] as Area], fecha, '14:00', 1, 200);
    }
    // Una cosecha corregida después de armar su lote (21 de septiembre): el lote lo avisa.
    if (fecha === '2026-09-21' && cosechadoHoy[0]) {
      const vieja = cosechadoHoy[0];
      const registro = (await db.registro.get(vieja.id)) as Registro;
      const corregida = await guardarCosecha(
        db,
        finca.id,
        {
          areaId: vieja.nave,
          cantidad: vieja.cantidad - 3,
          unidad: 'kg',
          categoria: vieja.categoria,
          descarte: Math.min(vieja.descarte, vieja.cantidad - 3),
          personaIds: vieja.personaIds,
          horasPorPersona: vieja.horasPorPersona,
          confirmarCarencia: vieja.enCarencia,
        },
        { ahora: momento(fecha, '14:50'), corrige: registro },
      );
      libro.cosechas[libro.cosechas.indexOf(vieja)] = {
        ...vieja,
        id: corregida.id,
        cantidad: vieja.cantidad - 3,
      };
      libro.correcciones += 1;
    }

    // Labores: lo que queda de la jornada de cada operaria, repartido por naves; el supervisor
    // revisa cada nave una hora (media en sábado).
    const jornada = sabado ? JORNADA.sabado : JORNADA.semana;
    for (const [i, o] of operarias.entries()) {
      let quedan = jornada - (horasCosecha.get(o.id) ?? 0);
      let k = i;
      while (quedan > 0) {
        const nave = naves[(Number(fecha.slice(8)) + k) % naves.length] as Area;
        const horas = Math.min(2, quedan);
        await labor(nave, laborDeLaSemana(semana, k), [o.id], horas, fecha, '11:00');
        quedan -= horas;
        k += 1;
      }
    }
    for (const nave of naves) {
      await labor(nave, 'Supervisión', [supervisor.id], sabado ? 0.5 : 1, fecha, '09:00');
    }
    void nombre;
  }

  return libro;
}
