## Qué cambia

<!-- Historia (HU-…) y una o dos líneas. -->

## Control negativo

<!-- Obligatorio (P5, BACKLOG §2.2). Qué defecto se puso a propósito y cómo se vio en rojo.
     «No aplica» solo si el cambio no agrega ni modifica ninguna comprobación. -->

## ¿Cambió algo que un documento afirma?

<!-- P18. Si sí: qué documento y en qué sección, actualizado en este mismo PR. Si no: «No». -->

## Definición de Terminado

- [ ] Título y commits con `tipo(alcance): descripción`, de 72 caracteres o menos y sin la marca de Claude Code (la guardia del CI lo revisa, HU-C0.2)
- [ ] CI en verde: lint, typecheck, contratos, pruebas, build y licencias
- [ ] Pruebas unitarias para la lógica nueva, con casos reales resueltos
- [ ] Probado con las dos fincas de prueba; ningún nombre real (P4)
- [ ] Flujos de interfaz con e2e en 360 px (y sin conexión si toca datos), o no aplica
- [ ] Versión y `CHANGELOG.md` actualizados
- [ ] Si algo se rompió en el camino, hay entrada en `docs/BITACORA.md`
