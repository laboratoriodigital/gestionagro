-- Lista de espera de planes con precio visible (HU-E0.6): «Me interesa» de quien administra una
-- finca. Una fila por persona, finca y plan: tocar dos veces no escribe dos veces (INSERT OR
-- IGNORE), así que crece con las fincas, no con los toques (≤ 50 escrituras al día, BACKLOG). No
-- hay cobro ni tarjeta: es la señal de que alguien pagaría. La clave primaria es la única búsqueda
-- de la pantalla; el reporte semanal cuenta la tabla entera una vez por semana.
CREATE TABLE interes_plan (
  usuario_id TEXT NOT NULL REFERENCES usuario (id),
  org_id TEXT NOT NULL REFERENCES organizacion (id),
  plan TEXT NOT NULL CHECK (plan IN ('finca', 'exportador', 'cadena')),
  creado TEXT NOT NULL,
  PRIMARY KEY (usuario_id, org_id, plan)
);
