-- El soporte que el dueño le da a cada comercio (HU-T14.7, HU-T0.3 «soporte por comercio»): un
-- renglón por atención, con sus minutos y su tema, que el dueño anota con el flujo
-- «anotar-soporte-tienda». Sin texto libre: ningún dato de una persona llega aquí. El reporte semanal
-- suma la semana con el índice por día.
CREATE TABLE soporte (
  id INTEGER PRIMARY KEY,
  org_id TEXT NOT NULL,
  dia TEXT NOT NULL CHECK (length(dia) = 10),
  minutos INTEGER NOT NULL CHECK (minutos BETWEEN 1 AND 600),
  tema TEXT NOT NULL CHECK (tema IN ('alta', 'catalogo', 'pedidos', 'cobro', 'dominio', 'otro')),
  anotado TEXT NOT NULL
);
CREATE INDEX soporte_por_dia ON soporte (dia);
