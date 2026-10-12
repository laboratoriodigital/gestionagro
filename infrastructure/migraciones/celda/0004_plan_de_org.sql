-- La copia del plan de cada organización del shard (HU-C5.6, PLATAFORMA §4.13): la escribe la
-- vuelta programada de la celda con lo que dice el CORE, para que la celda sepa de un pago o de un
-- vencimiento aunque nadie haya entrado a la app. Una solicitud de usuario nunca la llena ni llama
-- al CORE por ella (CA4): el token trae su plan.
-- `plan_vence` ya trae la gracia del producto (ISO); nulo si no vence. `actualizado` es cuándo la
-- celda escribió la fila, no cuándo se pagó.
CREATE TABLE plan_de_org (
  org_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  plan_vence TEXT,
  actualizado TEXT NOT NULL
);
