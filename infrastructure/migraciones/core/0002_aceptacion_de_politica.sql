-- Aceptación de la política de tratamiento de datos (HU-E0.5, CA3; Ley 1581 de 2012, prueba de
-- la autorización). Qué versión aceptó cada persona y cuándo. Se expande la tabla `usuario`, sin
-- tablas nuevas (HU-E4.1, CA1). Nulo = cuenta creada antes de esta migración, que no aceptó
-- ninguna versión: se le pide al volver a entrar.
ALTER TABLE usuario ADD COLUMN politica_version TEXT;
ALTER TABLE usuario ADD COLUMN politica_aceptada TEXT;
