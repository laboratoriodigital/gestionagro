-- CORE · auditoría (ED1 §5, PLATAFORMA §4.12, HU-C2.4). Era la propuesta 0008 de docs/plataforma/sql;
-- es la 0007 porque se construyó antes que entrar con correo. lo que toca seguridad o dinero, una fila por hecho. No se registran
-- lecturas ni refrescos (presupuesto de escrituras): entradas, invitaciones aceptadas, cambios de
-- rol, salidas, teléfonos retirados, pagos cerrados, cambios de plan y concesiones a agentes.
CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY,
  instante TEXT NOT NULL,
  producto TEXT REFERENCES producto (id),
  org_id TEXT,
  usuario_id TEXT REFERENCES usuario (id),
  accion TEXT NOT NULL,
  detalle TEXT CHECK (detalle IS NULL OR json_valid(detalle))
);
-- El propietario ve la auditoría de su organización. Costo: 1 fila por hecho con organización.
CREATE INDEX auditoria_por_org ON auditoria (org_id, id) WHERE org_id IS NOT NULL;
