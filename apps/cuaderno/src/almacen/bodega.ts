/**
 * Bodega de insumos y costo de lo aplicado (HU-E7.1), en el navegador (ADR-5) con `bodega` de
 * agro-calc.
 *
 * - **Entradas:** compras (cantidad y precio total, que puede no anotarse) y ajustes por conteo,
 *   como registros `movimiento_insumo`. Solo propietario y supervisor (llevan precios, §9).
 * - **Salidas:** la cantidad usada de cada aplicación vigente (v2). No hay registro de salida
 *   aparte (P2): corregir la aplicación corrige la bodega. Una aplicación sin cantidad (o v1) no
 *   descuenta ni suma costo, y se cuenta para decirlo.
 * - **Existencia negativa** se avisa sin bloquear nada en el campo (CA3).
 * - **Costo por nave y ciclo:** el costo de cada salida, por el área y el ciclo de su aplicación.
 *
 * Las cuentas viven en `@ed1/agro-schema` (HU-E0.12), las mismas del asistente de la finca; aquí
 * se leen los datos del teléfono y se registran las compras y los ajustes.
 */
import {
  type CostoDeArea,
  costoDeInsumosPorArea as costoDeInsumosPorAreaDe,
  type DatosMovimiento,
  ErrorDeValidacion,
  type ExistenciaDeInsumo,
  estadoDeBodega as estadoDeBodegaDe,
  type Registro,
} from '@ed1/agro-schema';
import { cabeceraDeRegistro } from './cabecera.ts';
import { datosDeLaFinca } from './datos-de-la-finca.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';

export type { CostoDeArea, DatosMovimiento, ExistenciaDeInsumo };

const TIPOS_DE_LA_BODEGA = ['movimiento_insumo', 'aplicacion'] as const;

export interface NuevoMovimiento {
  insumoId: string;
  clase: 'compra' | 'ajuste';
  /** Compra: lo que entró. Ajuste: con signo (−3 si faltaban 3). */
  cantidad: number;
  precioTotal: number | null;
  nota: string;
}

export async function registrarMovimiento(
  db: CuadernoDb,
  fincaId: string,
  nuevo: NuevoMovimiento,
  { ahora = () => new Date() }: { ahora?: () => Date } = {},
): Promise<Registro> {
  const insumo = await db.insumo.get(nuevo.insumoId);
  const motivos: { campo: string; motivo: string }[] = [];
  if (!insumo || insumo.finca_id !== fincaId)
    motivos.push({ campo: 'insumo', motivo: 'elige un insumo de la finca' });
  if (!(Number.isFinite(nuevo.cantidad) && nuevo.cantidad !== 0)) {
    motivos.push({ campo: 'cantidad', motivo: 'escribe la cantidad' });
  } else if (nuevo.clase === 'compra' && nuevo.cantidad < 0) {
    motivos.push({ campo: 'cantidad', motivo: 'una compra suma: escribe la cantidad sin signo' });
  }
  if (
    nuevo.precioTotal !== null &&
    (!Number.isInteger(nuevo.precioTotal) || nuevo.precioTotal < 1)
  ) {
    motivos.push({ campo: 'precio', motivo: 'el precio va en pesos enteros, mayor que 0' });
  }
  if (motivos.length > 0 || !insumo) throw new ErrorDeValidacion('Bodega', motivos);
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: '',
    tipo: 'movimiento_insumo',
    v: 1,
    personaIds: [],
    origen: 'manual',
    ahora,
  });
  return guardarRegistro(
    db,
    {
      ...cabecera,
      // De la bodega, no de un área ni de un ciclo.
      area_ids: [],
      ciclo_id: null,
      datos: {
        insumo_id: insumo.id,
        insumo: insumo.nombre_comercial,
        clase: nuevo.clase,
        cantidad: nuevo.cantidad,
        unidad: insumo.unidad,
        precio_total_cop: nuevo.clase === 'compra' ? nuevo.precioTotal : null,
        nota: nuevo.nota.trim() || null,
      } satisfies DatosMovimiento,
    },
    { ahora },
  );
}

/** Lo que hay de cada insumo con movimientos, por nombre. */
export async function estadoDeBodega(
  db: CuadernoDb,
  fincaId: string,
): Promise<ExistenciaDeInsumo[]> {
  return estadoDeBodegaDe(await datosDeLaFinca(db, fincaId, TIPOS_DE_LA_BODEGA));
}

/** Costo de los insumos aplicados por área y ciclo. */
export async function costoDeInsumosPorArea(
  db: CuadernoDb,
  fincaId: string,
): Promise<CostoDeArea[]> {
  return costoDeInsumosPorAreaDe(await datosDeLaFinca(db, fincaId, TIPOS_DE_LA_BODEGA));
}
