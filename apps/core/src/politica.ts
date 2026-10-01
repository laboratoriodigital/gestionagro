/**
 * Versión vigente de la política de tratamiento de datos (HU-E0.5), de la misma fuente que la
 * página /agro/privacidad/ (P2). Entrar con Google exige haberla aceptado; el CORE guarda en el
 * usuario qué versión aceptó y cuándo (CA3).
 */
import politica from '../../../content/agro/privacidad/politica.json' with { type: 'json' };

export const POLITICA_VIGENTE: string = politica.version;
