/**
 * Worker del CORE v0 (ADR-9, ARQUITECTURA §5.4), con Hono (ADR-12).
 *
 * Hoy atiende una sola ruta, `GET /api/core/salud`, que usa la prueba de humo del despliegue: dice
 * cuántas celdas activas tiene el directorio. Con 0 responde 503, porque un CORE sin celdas
 * activas no puede crear organizaciones y no debe parecer sano (P1). Crear usuarios y organizaciones
 * (`repositorio.ts`) se abre con el login de HU-E4.2, que trae también su kill switch: no hay
 * escrituras públicas sin sesión.
 */
import { Hono } from 'hono';
import type { BaseD1 } from './d1.ts';

export interface Env {
  /** Base D1 del CORE (`agro_core`); el despliegue agrega su id (ADR-6). */
  DB: BaseD1;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/core/salud', async (c) => {
  try {
    const fila = await c.env.DB.prepare(
      "SELECT count(*) AS n FROM celda WHERE estado = 'activa'",
    ).first<{ n: number }>();
    const celdas = fila?.n ?? 0;
    if (celdas === 0) {
      return c.json(
        {
          estado: 'sin-celdas',
          motivo: 'El directorio no tiene celdas activas: falta sincronizar celdas.json',
        },
        503,
      );
    }
    return c.json({ estado: 'ok', celdas });
  } catch (e) {
    console.error('agro-core: la base no respondió', e);
    return c.json({ estado: 'sin-base', motivo: 'La base del CORE no respondió' }, 503);
  }
});

app.notFound((c) => c.json({ estado: 'no-encontrado', motivo: 'Ruta del CORE desconocida' }, 404));

export default app;
