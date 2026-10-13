import '@ed1/ui/v2/fuentes.css';
import '@ed1/ui/v2/tokens.css';
import '../hoja-recibo.css';
import './estilos.css';
import type { BluetoothBle, SerialWeb } from '@ed1/impresion';
import { liveQuery } from 'dexie';
import { render } from 'preact';
import { App } from './App.tsx';
import { abrirBase } from './datos.ts';
import { esProduccion, urlDelCore } from './entorno.ts';
import { crearControl } from './impresora.ts';
import { programarEnvios } from './medicion.ts';
import { crearNube } from './nube.ts';
import { capacidadesDelNavegador, proponerCamino } from './senales.ts';

const raiz = document.getElementById('caja');
if (!raiz) throw new Error('Falta el elemento #caja en index.html');

// Cada pantalla empieza arriba: recargar tras un formulario largo no esconde las acciones.
history.scrollRestoration = 'manual';

const reloj = () => Date.now();
const db = abrirBase();
const capacidades = capacidadesDelNavegador(navigator);
const control = crearControl(db, {
  bluetooth: (navigator as Navigator & { bluetooth?: BluetoothBle }).bluetooth,
  serial: (navigator as Navigator & { serial?: SerialWeb }).serial,
  // HU-Q2.5: el diálogo de impresión del equipo; en iPhone no llega a la térmica.
  sistema: capacidades.ios ? undefined : window,
  hostname: location.hostname,
  reloj,
  nuevoId: () => crypto.randomUUID(),
  guardado: (() => {
    try {
      return localStorage;
    } catch {
      return undefined;
    }
  })(),
});

// Al cerrar o recargar la caja, la conexión se suelta a propósito: si Android la deja viva sin
// dueño, la impresora no acepta la siguiente (bitácora parqueadero 21).
addEventListener('pagehide', () => control.soltar());

// HU-Q5.3: los conteos de recibos y fallos salen a `/_m` cuando hay red; sin red, esperan.
programarEnvios(db, window);

// HU-Q7.5: con la caja vinculada a la nube, lo registrado sube solo y baja lo de las otras cajas.
// Al vincularse (HU-Q7.6) arranca; cada operación nueva en la cola sale a los pocos segundos.
const nube = crearNube(db, {
  reloj,
  app: __VERSION_CAJA__,
  core: urlDelCore(location.hostname),
  ventana: window,
});
let vinculada = false;
liveQuery(() => db.meta.get('nube')).subscribe((m) => {
  const ahora = m?.clave === 'nube';
  if (ahora && !vinculada) void nube.ahora();
  vinculada = ahora;
});
let enCola = 0;
liveQuery(() => db.outbox.count()).subscribe((n) => {
  if (n > enCola) nube.registrado();
  enCola = n;
});

// HU-Q7.6: al volver de la cuenta, el código de un uso sale de la barra antes de canjearlo, para
// que no quede en el historial. Lo mismo con el permiso de Google Drive (HU-Q10.1) y con la orden
// que vuelve de Bold (`?pago=`, HU-Q7.10), que «Cuenta y nube» confirma con el CORE.
const orden = new URLSearchParams(location.search).get('pago');
const regreso = /^#(entrar|entrar-error|drive|drive-error)=/.test(location.hash)
  ? location.hash
  : orden
    ? `#pago=${encodeURIComponent(orden)}`
    : undefined;
if (regreso)
  history.replaceState(
    null,
    '',
    orden ? location.pathname : `${location.pathname}${location.search}`,
  );

render(
  <App
    db={db}
    control={control}
    propuesta={proponerCamino(capacidades)}
    prueba={!esProduccion(location.hostname)}
    reloj={reloj}
    nube={nube}
    {...(regreso ? { regreso } : {})}
  />,
  raiz,
);
