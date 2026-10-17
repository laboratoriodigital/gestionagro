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

**Por qué:** R2 no se detiene al pasarse de lo gratis: cobra a la tarjeta. Una foto que está en la caché no gasta R2, pero una dirección con algo después del `?`, o con un nombre que no existe, se salta la caché y lee R2 cada vez. Un robot que haga eso sin parar cuesta dinero. El freno de R2 de la Tienda no lo para, porque esas son lecturas, y apagar no las baja. Estas reglas se ponen en el panel de Cloudflare, una vez, y cubren los dos ambientes.

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
2. **El tope por visitante no se pone.** En el plan gratuito una regla de *Rate limiting* no acepta el host en la expresión: el panel la da por inválida (el dueño, 17 oct 2026), y sin el host frenaría todo el dominio. Para R2 no hace falta: lo que cobra es saltarse la caché, y eso lo bloquea el paso 1.
3. **La caché, solo si hace falta.** Cloudflare guarda en caché los `.webp` y `.jpeg` por defecto, y las fotos dicen un año (`immutable`). Se comprueba pidiendo la misma foto dos veces: la segunda debe decir `cf-cache-status: HIT`. Si dice `DYNAMIC` o `BYPASS`: **Rules → Overview → Create rule → Cache Rule** (antes estaba en Caching → Cache Rules), con la expresión `(http.host in {"img.laboratorio-digital.app" "img--staging.laboratorio-digital.app"})`, **Eligible for cache**, **Edge TTL: Use cache-control header if present** y **Browser TTL: Respect origin**.

**Verificar** (Git Bash), con la dirección de una foto que exista en staging:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://img--staging.laboratorio-digital.app/<la foto>"       # 200
curl -s -o /dev/null -w "%{http_code}\n" "https://img--staging.laboratorio-digital.app/<la foto>?x=1"   # 403
curl -s -o /dev/null -w "%{http_code}\n" "https://img--staging.laboratorio-digital.app/nada.webp"       # 403
curl -sI "https://img--staging.laboratorio-digital.app/<la foto>" | grep -i cf-cache-status        # HIT la segunda vez
```

Si el panel dice que una función o una opción no está en el plan gratuito, no la cambies por otra sin revisar: anota el mensaje exacto. Estas reglas se escribieron sin probarlas en el panel.
