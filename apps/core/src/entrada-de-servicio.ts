/**
 * La entrada de servicio del CORE (HU-C5.6): lo que una celda le pide por su service binding, con
 * RPC. No tiene URL: ningún navegador ni nadie fuera de la cuenta la alcanza, así que no hay token
 * que guardar ni comparar (cambio de forma de CA1, bitácora core). La celda la nombra en su
 * configuración (`services` con `entrypoint: 'ServicioDelCore'`, de `generar-wrangler.ts`).
 */
import { WorkerEntrypoint } from 'cloudflare:workers';
import type { BaseD1 } from '@ed1/d1';
import { catalogoDelDestino } from './productos.ts';
import { type PlanDeOrganizacion, planesDeLaCelda } from './servicio.ts';

interface EnvDelServicio {
  DB: BaseD1;
  DESTINO?: string;
}

export class ServicioDelCore extends WorkerEntrypoint<EnvDelServicio> {
  /** Los planes de las organizaciones de `celda`; con `desde`, solo los que cambiaron por un pago. */
  async planes(celda: string, desde: string | null): Promise<PlanDeOrganizacion[]> {
    return planesDeLaCelda(
      this.env.DB,
      catalogoDelDestino(this.env.DESTINO),
      celda,
      Date.now(),
      desde ?? undefined,
    );
  }
}
