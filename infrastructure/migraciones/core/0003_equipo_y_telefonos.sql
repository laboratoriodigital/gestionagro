-- Revocar un teléfono o una persona (HU-E4.6). Dos búsquedas nuevas, raras pero que no deben
-- recorrer tablas que crecen con cada persona y cada teléfono (ARQUITECTURA §6.2):
-- - El equipo de una finca: lo abre quien la administra, en Cuenta. Una fila más por membresía,
--   que se escribe una vez al aceptar una invitación.
CREATE INDEX membresia_por_finca ON membresia (org_id);
-- - Los teléfonos de una cuenta: lo abre la persona, en Cuenta. Una fila más por sesión creada;
--   rotar el refresh no cambia `usuario_id`, así que no la vuelve a escribir.
CREATE INDEX sesion_por_usuario ON sesion (usuario_id);
