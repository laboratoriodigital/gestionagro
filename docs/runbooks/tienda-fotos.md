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

## Frenar a quien pide fotos de más (bitácora tienda3 27)

**Por qué:** R2 no se detiene al pasarse de lo gratis: cobra a la tarjeta. Una foto que está en la caché no gasta R2, pero una dirección con algo después del `?`, o con un nombre que no existe, se salta la caché y lee R2 cada vez. Un robot que haga eso sin parar cuesta dinero. El freno de R2 de la Tienda no lo para, porque esas son lecturas, y apagar no las baja. Estas tres reglas se ponen en el panel de Cloudflare, una vez, y cubren los dos ambientes.

Una foto nuestra tiene siempre esta forma: `/<id de la tienda, 36 caracteres>/<huella, 64>/<400, 800 o 1600>.webp` o `.jpeg`. Mide 111 o 112 caracteres.

1. **Security → WAF → Custom rules → Create rule.** Nombre: `fotos: solo direcciones de foto`. Expresión (**Edit expression**):

   ```
   (http.host in {"img.laboratorio-digital.app" "img--staging.laboratorio-digital.app"}) and (
     not http.request.method in {"GET" "HEAD"}
     or http.request.uri.query ne ""
     or not (ends_with(http.request.uri.path, ".webp") or ends_with(http.request.uri.path, ".jpeg"))
     or not len(http.request.uri.path) in {111 112}
   )
   ```

   Acción: **Block**. **Deploy**.
2. **Security → WAF → Rate limiting rules → Create rule** (el plan gratuito trae una). Nombre: `fotos: tope por visitante`. Expresión: `(http.host in {"img.laboratorio-digital.app" "img--staging.laboratorio-digital.app"})`. Con las mismas características (IP), más de **300 solicitudes en 10 segundos**: **Block** durante 10 segundos. Una vitrina con 48 fotos por página pide unas 50; 300 en 10 segundos ya no es una persona.
3. **Caching → Cache Rules → Create rule.** Nombre: `fotos: caché`. Misma expresión del paso 2. **Cache eligibility: Eligible for cache**; **Edge TTL: Use cache-control header if present**; **Browser TTL: Respect origin**. Las fotos ya dicen un año (`immutable`).

**Verificar** (Git Bash), con la dirección de una foto que exista en staging:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://img--staging.laboratorio-digital.app/<la foto>"       # 200
curl -s -o /dev/null -w "%{http_code}\n" "https://img--staging.laboratorio-digital.app/<la foto>?x=1"   # 403
curl -s -o /dev/null -w "%{http_code}\n" "https://img--staging.laboratorio-digital.app/nada.webp"       # 403
```

Si el panel dice que una función o una opción no está en el plan gratuito, no la cambies por otra sin revisar: anota el mensaje exacto. Estas reglas se escribieron sin probarlas en el panel.
