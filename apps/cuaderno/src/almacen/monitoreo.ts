/**
 * Monitoreo de plagas y enfermedades (HU-E3.11).
 *
 * - Qué se vio, si es plaga o enfermedad, cómo se midió (trampa, conteo u observación) y el nivel
 *   (bajo, medio, alto), con la cantidad si se contó (CA1).
 * - **Catálogo editable** sin tabla nueva: lo forman los nombres ya anotados en la finca, que se
 *   sugieren al escribir; uno nuevo entra al guardarlo. Arranca vacío: no hay plagas de fábrica.
 * - **Foto opcional** (CA2), ya comprimida (`fotos.ts`): se guarda en el teléfono junto con el
 *   registro, en la misma transacción. El registro solo lleva su id.
 * - **Cuota de fotos** por plan (CA3, ADR-15), de `content/agro/cuaderno/fotos.json`. Las fotos
 *   son de los planes pagos: el gratuito no adjunta (decisión del dueño). Mientras las fotos vivan
 *   solo aquí, se cuentan las de este teléfono en el mes de Colombia.
 */
import {
  ErrorDeValidacion,
  fechaAgronomica,
  type Registro,
  uuidv7,
  validarRegistro,
} from '@gestionagro/agro-schema';
import configFotos from '../../../../content/agro/cuaderno/fotos.json' with { type: 'json' };
import { conEscritura } from '../actividad.ts';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import { soloVigentes } from './consultas.ts';
import type { CuadernoDb, Foto } from './db.ts';

export interface DatosMonitoreoGuardado {
  plaga: string;
  clase: 'plaga' | 'enfermedad';
  metodo: 'trampa' | 'conteo' | 'observacion';
  nivel: 'bajo' | 'medio' | 'alto';
  cantidad: number | null;
  foto_id: string | null;
  nota: string | null;
}

export interface DatosMonitoreo {
  areaId: string;
  plaga: string;
  clase: DatosMonitoreoGuardado['clase'] | '';
  metodo: DatosMonitoreoGuardado['metodo'] | '';
  nivel: DatosMonitoreoGuardado['nivel'] | '';
  cantidad: number | null;
  nota: string;
  /** La foto ya comprimida, o null. */
  foto: { datos: Blob; tipo: string } | null;
}

export type Plan = keyof typeof configFotos.por_plan;

/** Un plan que no está en la configuración cuenta como el gratuito: sin fotos (P1). */
export const comoPlan = (plan: string): Plan =>
  plan in configFotos.por_plan ? (plan as Plan) : 'gratuito';
export const TAMANO_MAXIMO_FOTO = configFotos.tamano_maximo_kb * 1024;

const normal = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Plagas y enfermedades ya anotadas en la finca, la más reciente primero, sin repetir. */
export async function plagasConocidas(
  db: CuadernoDb,
  fincaId: string,
): Promise<{ nombre: string; clase: DatosMonitoreoGuardado['clase'] }[]> {
  const todas = await db.registro
    .where('tipo')
    .equals('monitoreo')
    .filter((r) => r.finca_id === fincaId)
    .toArray();
  const vistas = new Map<string, { nombre: string; clase: DatosMonitoreoGuardado['clase'] }>();
  for (const r of (await soloVigentes(db, todas)).sort((a, b) => (a.id < b.id ? 1 : -1))) {
    const d = r.datos as DatosMonitoreoGuardado;
    const clave = d.plaga.toLocaleLowerCase('es');
    if (!vistas.has(clave)) vistas.set(clave, { nombre: d.plaga, clase: d.clase });
  }
  return [...vistas.values()];
}

/** El mes de Colombia de un instante: `2026-10`. */
const mesDe = (instante: number) => fechaAgronomica(instante).slice(0, 7);

/** Fotos de este teléfono en el mes y cuántas da el plan: «x de y fotos este mes» (CA3). */
export async function cuotaDeFotos(
  db: CuadernoDb,
  plan: Plan = 'gratuito',
  ahora: () => Date = () => new Date(),
): Promise<{ usadas: number; limite: number }> {
  const mes = mesDe(ahora().getTime());
  const fotos = await db.foto.toArray();
  return {
    usadas: fotos.filter((f) => mesDe(Date.parse(f.creado)) === mes).length,
    limite: configFotos.por_plan[plan],
  };
}

export async function guardarMonitoreo(
  db: CuadernoDb,
  fincaId: string,
  datos: DatosMonitoreo,
  {
    ahora = () => new Date(),
    corrige,
    plan = 'gratuito',
  }: OpcionesDeRegistro & { plan?: Plan } = {},
): Promise<Registro> {
  const motivos: { campo: string; motivo: string }[] = [];
  const plaga = normal(datos.plaga);
  if (!plaga) motivos.push({ campo: 'plaga', motivo: 'escribe qué viste' });
  if (!datos.clase) motivos.push({ campo: 'clase', motivo: 'elige si es plaga o enfermedad' });
  if (!datos.metodo) motivos.push({ campo: 'metodo', motivo: 'elige cómo lo mediste' });
  if (!datos.nivel) motivos.push({ campo: 'nivel', motivo: 'elige el nivel' });
  if (datos.foto) {
    if (datos.foto.datos.size > TAMANO_MAXIMO_FOTO) {
      motivos.push({ campo: 'foto', motivo: 'la foto pesa más de 150 KB' });
    }
    const cuota = await cuotaDeFotos(db, plan, ahora);
    if (cuota.limite === 0) {
      motivos.push({ campo: 'foto', motivo: 'las fotos de monitoreo vienen con el plan Finca' });
    } else if (cuota.usadas >= cuota.limite) {
      motivos.push({
        campo: 'foto',
        motivo: `ya usaste las ${cuota.limite} fotos de este mes; guarda el monitoreo sin foto`,
      });
    }
  }
  if (motivos.length > 0) throw new ErrorDeValidacion('Monitoreo', motivos);

  const fotoId = datos.foto ? uuidv7(() => ahora().getTime()) : null;
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: datos.areaId,
    tipo: 'monitoreo',
    v: 1,
    personaIds: [],
    origen: 'manual',
    ahora,
    corrige,
  });
  const registro = validarRegistro({
    ...cabecera,
    datos: {
      plaga,
      clase: datos.clase as DatosMonitoreoGuardado['clase'],
      metodo: datos.metodo as DatosMonitoreoGuardado['metodo'],
      nivel: datos.nivel as DatosMonitoreoGuardado['nivel'],
      cantidad: datos.metodo === 'observacion' ? null : datos.cantidad,
      // Corregir sin foto nueva conserva la de antes.
      foto_id: fotoId ?? (corrige?.datos as DatosMonitoreoGuardado | undefined)?.foto_id ?? null,
      nota: normal(datos.nota) || null,
    } satisfies DatosMonitoreoGuardado,
  });
  const instante = ahora().toISOString();
  // El registro, su operación de salida y la foto: o quedan los tres o ninguno.
  await conEscritura(() =>
    db.transaction('rw', db.registro, db.outbox, db.foto, async () => {
      await db.registro.add(registro);
      await db.outbox.add({
        id: registro.id,
        entidad: 'registro',
        entidad_id: registro.id,
        version: 1,
        op: 'crear',
        creado: instante,
      });
      if (datos.foto && fotoId) {
        const foto: Foto = {
          id: fotoId,
          registro_id: registro.id,
          tipo: datos.foto.tipo,
          datos: datos.foto.datos,
          tamano: datos.foto.datos.size,
          creado: instante,
        };
        await db.foto.add(foto);
      }
    }),
  );
  return registro;
}

export const leerFoto = (db: CuadernoDb, id: string) => db.foto.get(id);
