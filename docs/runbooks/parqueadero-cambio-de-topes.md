# Runbook: cambio anual de topes

**Para qué:** cuando una ciudad publica un tope nuevo de tarifa (en Bogotá, cada año por decreto), que la caja lo sepa y nadie cobre de más (PARQUEADERO §9.1 y §14.5, HU-Q1.2, HU-Q6.2).

**Cuándo:** apenas salga el decreto. Si el tope de una ciudad tiene más de 13 meses, el inicio de la caja avisa «El tope de Bogotá no está actualizado» y sigue cobrando con el tope que tiene cada tarifa.

## 1. Leer la norma

Del decreto se sacan: la ciudad, el nombre de la norma, desde qué día rige, y el máximo por minuto de cada vehículo, sin sello de oro y con sello de oro.

## 2. Cambiar el contenido, por PR

1. Rama corta desde `main`, por ejemplo `chore/topes-bogota-2027`.
2. En `content/parqueadero/topes.json`, en la ciudad: `norma`, `vigente_desde` (AAAA-MM-DD) y los valores de `topes`. Pesos enteros, sin puntos.
3. La prueba de los topes (`apps/parqueadero-sitio/src/caja/topes.test.ts`) fija los valores de Bogotá: actualícela con los nuevos.
4. Anote el cambio en «Sin publicar» de `apps/parqueadero-sitio/CHANGELOG.md` y suba la versión del parqueadero (el último número: `0.2.1` → `0.2.2`).

El CI rechaza un valor con decimales, una ciudad sin norma o una vigencia futura (`problemasDeTopes`). **Un decreto que rige más adelante se publica el día que empieza a regir, no antes.**

## 3. Publicar fuera del turno

Al fusionar, el parqueadero se publica solo. Las cajas instaladas reciben la versión nueva y la ofrecen con un botón: nunca se recargan en medio de un recibo. Pida al cajero tocar **«Actualizar»** después de cerrar el turno.

## 4. Verificar en la caja

1. El aviso del tope viejo ya no aparece en el inicio.
2. **«Ajustes del parqueadero»** → la tarifa de cada vehículo: si su tope quedó por encima del nuevo máximo, la caja no deja guardarla y dice el máximo y la norma. Corrija el tope y la tarifa con el cliente, y **«Guardar»**.
3. Si el tope bajó, una tarifa vieja con el tope anterior sigue cobrando con él hasta que se guarde de nuevo: el paso 2 no es opcional.
