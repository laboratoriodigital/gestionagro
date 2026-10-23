# Runbook · La copia semanal en tu Google Drive

**Para qué:** si la cuenta de Cloudflare queda suspendida o se pierde, los datos de todos los productos siguen en tu Google Drive, cifrados con una llave que solo tú guardas (HU-C11.4, ADR-30, ED1 §20.3).

**Cómo funciona:** cada lunes (hora de Bogotá) el cron del CORE exporta la base del CORE y cada shard de `infrastructure/celdas.json`, una por vuelta de 15 minutos. Cada copia se cifra antes de salir, se sube a la carpeta **«Laboratorio Digital · copias semanales»** de tu Drive (en staging, la que termina en «(staging)») y se vuelve a bajar para comprobar que abre. Cuando están todas, rota las viejas (quedan las 8 semanas más recientes y una por mes, hasta 12 meses) y mira cuánto espacio queda. Te avisa por Telegram si una base falla 3 veces seguidas o si el Drive pasa del 70 %.

**El permiso es solo `drive.file`:** la app ve únicamente los archivos que ella crea. No puede leer nada más de tu Drive.

**Qué guarda** en el ambiente de GitHub (ARQUITECTURA §7.5):

| Secreto | Qué es | Quién lo pone |
|---|---|---|
| `COPIA_LLAVE` | La llave de cifrado (32 bytes) | El script, la primera vez |
| `COPIA_DRIVE_CLIENTE_ID` | El cliente de OAuth «de escritorio» de las copias | El script |
| `COPIA_DRIVE_CLIENTE_SECRETO` | Su secreto | El script |
| `COPIA_DRIVE_REFRESH` | El permiso duradero sobre tu Drive | El script |
| `COPIA_CF_TOKEN` | El token de Cloudflare de propósito «copia», solo para exportar bases | Tú, a mano (abajo) |

Sin todos, la copia no se hace y no escribe nada. El resto sigue igual.

## 1. Una sola vez en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con **tu** cuenta de Google, la del Drive donde quieres las copias. Crea un proyecto aparte: «Laboratorio Digital · copias».
2. **APIs y servicios › Biblioteca:** busca «Google Drive API» y actívala.
3. **Pantalla de consentimiento de OAuth:** tipo «Externo», nombre «Laboratorio Digital · copias». Agrega el permiso `…/auth/drive.file`. En **Público**, pulsa **Publicar la app** para que quede «En producción»: *en «prueba», el permiso vence a los 7 días.* Google avisará que la app no está verificada: es normal, solo la usa tu cuenta.
4. **Credenciales › Crear credenciales › ID de cliente de OAuth**, tipo **App de escritorio**, nombre «Copias del CORE». Deja abierta la ventana con el id y el secreto.

## 2. El permiso y la llave (por ambiente: staging primero)

1. En una terminal, en la carpeta del repositorio:

   ```bash
   gh auth status
   ```

2. Corre el script:

   ```bash
   node scripts/copia/permiso-de-drive.ts --ambiente staging
   ```

3. Pega el id del cliente y su secreto (el secreto no se ve al pegarlo). Se abre el navegador: entra con tu cuenta y acepta.
4. **La primera vez, el script muestra la llave de la copia una sola vez.** Cópiala en tu gestor de contraseñas con el nombre «Llave de la copia · staging». GitHub no deja leerla de vuelta y, sin ella, ninguna copia se abre.
5. Repite con `--ambiente produccion` y guarda esa llave aparte («Llave de la copia · producción»).

Volver a correr el script renueva el permiso y **no cambia la llave**. Para cambiarla, agrega `--llave-nueva`. Las copias de antes siguen abriéndose solo con la llave con que se hicieron: no borres la vieja de tu gestor hasta que roten (12 meses).

## 3. El token de Cloudflare de la copia

1. En el panel de Cloudflare: **Perfil › API Tokens › Create Token › Custom token**.
2. Nombre: «copia del CORE». Permiso: **Account › D1 › Edit**. Recursos: solo tu cuenta. Sin nada más. *La documentación de la exportación de D1 no dice qué permiso pide (revisado el 23 oct 2026): Edit es el que seguro sirve. Si en staging funciona con **D1 › Read**, déjalo en Read.*
3. Guárdalo en cada ambiente de GitHub:

   ```bash
   gh secret set COPIA_CF_TOKEN --env staging
   ```

   ```bash
   gh secret set COPIA_CF_TOKEN --env produccion
   ```

   `gh` pide el valor; pégalo y pulsa Enter.

## 4. Comprobar

1. Despliega staging (el flujo `desplegar` de siempre).
2. El lunes siguiente, después de las 3 a. m., abre tu Drive: en «Laboratorio Digital · copias semanales (staging)» debe haber un archivo `<fecha>_<base>.sql.ed1` por cada base. Si no lo hay, el log del Worker `agro-core-staging` dice por qué («la copia de … no salió»).

## 5. El simulacro de restaurar (cada trimestre)

1. En tu Drive, abre la carpeta de las copias y descarga los archivos de la semana más reciente a una carpeta de tu computador, por ejemplo `C:\copias\2026-10-26`.
2. Corre:

   ```bash
   node scripts/copia/simulacro.ts --carpeta C:\copias\2026-10-26
   ```

3. Pega la llave del ambiente (no se ve). Cada archivo debe salir con ✅ y «todas cuadran». Uno con ❌ dice la causa: la llave no es la de esa copia, el archivo se dañó o una tabla no tiene las filas que la copia dice traer.
4. Anota el resultado en la bitácora del CORE y borra la carpeta de tu computador.

El simulacro no usa Cloudflare ni GitHub: es lo mismo que harías el día que la cuenta no responda.

## Si algo falla

- **«el permiso del Drive del dueño no sirve»:** el permiso venció o lo quitaste. Vuelve al paso 2 (sin `--llave-nueva`).
- **«el token de la copia no puede exportar»:** revisa el paso 3.
- **«el volcado de … pasa de 50 MB»:** esa base ya no cabe en una vuelta del plan gratuito. Hay que partirla o activar Workers Paid: avísale al asistente.
- **El Drive pasa del 70 %:** libera espacio o amplía el plan de Google One antes de que las copias dejen de caber.

**Pendiente de revisión con abogado** (WI-C11.4.4): son copias de datos de terceros en una cuenta personal. Ver `docs/runbooks/datos-del-responsable.md`.
