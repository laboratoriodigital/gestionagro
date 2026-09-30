/**
 * Las dos fincas de prueba (ARQUITECTURA §10, P4). Toda prueba que toque datos de finca
 * corre con las dos: una hortaliza ecológica en naves y una de flores convencional en bloques.
 * El modelo definitivo llega con `packages/agro-schema` (HU-E3.2); estos tipos son su adelanto.
 */

import dos from './finca-ensayo-dos.json' with { type: 'json' };
import uno from './finca-ensayo-uno.json' with { type: 'json' };

export interface FincaDePrueba {
  finca: { id: string; nombre: string; municipio: string; regimen: 'ecologico' | 'convencional' };
  cultivo: { nombre: string; variedad: string; unidad_cosecha: 'kg' | 'tallos' | 'cajas' };
  areas: {
    id: string;
    tipo: 'nave' | 'bloque' | 'lote';
    nombre: string;
    area_m2: number;
    plantas: number;
  }[];
  personas: { id: string; nombre: string; rol: 'operario' | 'supervisor' | 'propietario' }[];
}

export const FINCA_ENSAYO_UNO = uno as FincaDePrueba;
export const FINCA_ENSAYO_DOS = dos as FincaDePrueba;
export const FINCAS_DE_PRUEBA: readonly FincaDePrueba[] = [FINCA_ENSAYO_UNO, FINCA_ENSAYO_DOS];
