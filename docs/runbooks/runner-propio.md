# Runner propio de GitHub Actions (temporal)

**Para qué:** que el CI corra en el computador del dueño mientras GitHub Actions no arranca trabajos en sus propios equipos (incidente del 5 oct 2026, bitácora core, «Lo que el terreno enseñó»). Es **temporal**: se vuelve a los equipos de GitHub borrando una variable, sin tocar código.

**Qué corre ahí:** el CI de cada PR y de `main` (`ci.yml`) y la verificación de Windows (`scripts-windows.yml`). **Los despliegues no**: siguen en los equipos de GitHub, para que los secretos de producción no pasen por un equipo personal. Una prueba lo exige (`tests/repo/flujos.test.ts`).

## Antes de empezar

- El repositorio tiene que ser **privado**. Con un repositorio público, cualquiera podría abrir un PR desde un fork y correr su código en tu computador. Compruébalo con `gh repo view --json visibility`: debe decir `PRIVATE`.
- El token de registro lo da GitHub en Settings › Actions › Runners › New self-hosted runner, **vence en una hora** y sirve solo para registrar. Lo pegas tú en tu consola. No va en el chat, en un archivo ni en un commit (P13).

## 1. Instalar el runner (lo hace el dueño, en PowerShell)

En `C:\actions-runner`: la carpeta corta evita los problemas de rutas largas de Windows.

```powershell
mkdir C:\actions-runner; cd C:\actions-runner
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.337.0/actions-runner-win-x64-2.337.0.zip -OutFile actions-runner-win-x64-2.337.0.zip
if((Get-FileHash -Path actions-runner-win-x64-2.337.0.zip -Algorithm SHA256).Hash.ToUpper() -ne '1150692afa94e71f872017e254ea55b6eece1eece3fe7e3a6d4c93d0a1b85cfc'.ToUpper()){ throw 'Computed checksum did not match' }
Add-Type -AssemblyName System.IO.Compression.FileSystem ; [System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD/actions-runner-win-x64-2.337.0.zip", "$PWD")
```

La versión y la huella son las que publica GitHub en la página de «New self-hosted runner». Si esa página muestra otras, se usan las de la página.

## 2. Registrarlo

```powershell
./config.cmd --url https://github.com/laboratoriodigital/gestionagro --token <EL TOKEN DE LA PÁGINA>
```

A las preguntas: grupo, Enter; nombre, Enter (el del equipo); etiquetas, Enter (`self-hosted`, `Windows`, `X64`); carpeta de trabajo, Enter. A «¿correr como servicio?»: **N**. Así corre solo cuando lo abres y no queda prendido sin que lo sepas.

## 3. Prenderlo cuando haga falta

```powershell
cd C:\actions-runner; ./run.cmd
```

Debe decir `Listening for Jobs`. Mientras esa ventana esté abierta, el runner toma trabajos; al cerrarla, deja de tomarlos y quedan en cola.

## 4. Mandar el CI a ese runner

Variable del repositorio `RUNNER_CI` = `self-hosted` (Settings › Secrets and variables › Actions › pestaña Variables, o en consola):

```bash
gh variable set RUNNER_CI --body self-hosted --repo laboratoriodigital/gestionagro
```

Desde ese momento, todo CI nuevo corre en tu equipo, con el Edge que ya tiene instalado (la descarga de Chromium de Playwright no funciona ahí: bitácora agro, «Lo que el terreno enseñó»). Una corrida que ya estaba en cola esperando a GitHub no cambia de equipo: se relanza.

## 5. Volver a GitHub

Cuando githubstatus.com no tenga incidentes en Actions:

```bash
gh variable delete RUNNER_CI --repo laboratoriodigital/gestionagro
```

Y, si no se va a usar más, se quita el runner: `./config.cmd remove --token <token de quitar>` en `C:\actions-runner`, con el token que da la misma página de Runners.

## Lo que cambia mientras se usa

- Los minutos del CI no se cobran a la organización: corren en tu equipo.
- Las capturas y tiempos del e2e son los de tu equipo. Las pruebas de tiempo (`@rendimiento`) corren solas y con un worker, como siempre (bitácora agro 20).
- Un solo runner toma un trabajo a la vez: `ci` y `scripts-windows` esperan su turno.
