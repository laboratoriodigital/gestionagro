# Runbook · El bucket de las fotos de la Tienda

**Cuándo:** una vez por ambiente, antes de que los comercios suban fotos (HU-T8.3). Hoy no se usa todavía.

**Por qué un bucket aparte** (HU-T5.6, bitácora tienda3 10): un dominio propio de R2 hace público **todo** el bucket. El almacén de la Tienda (`tienda-c1` y `tienda-c1-staging`) guarda también respaldos y exportaciones con datos personales, así que **nunca** lleva dominio propio ni acceso público. Las fotos viven en `tienda-c1-medios`, que solo tiene fotos.

## Pasos

1. En el panel de Cloudflare: **R2 → Create bucket** → `tienda-c1-medios-staging`. Repite con `tienda-c1-medios`.
2. Abre `tienda-c1-medios-staging` → **Settings → Custom Domains → Connect Domain** → `img--staging.laboratorio-digital.app`.
3. Abre `tienda-c1-medios` → lo mismo con `img.laboratorio-digital.app`.
4. Deja **Public access (r2.dev)** apagado en los dos: el dominio propio basta y se puede poner detrás de la caché.

## Lo que nunca se hace

- Conectar un dominio, o encender el acceso público, en `tienda-c1` o `tienda-c1-staging`.
- Darle al token de despliegue el permiso de R2: los Workers usan los buckets por sus enlaces, sin token (HU-C11.5).
