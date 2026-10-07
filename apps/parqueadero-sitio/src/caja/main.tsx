import '@ed1/ui/v2/fuentes.css';
import '@ed1/ui/v2/tokens.css';
import './estilos.css';
import type { BluetoothBle, SerialWeb } from '@ed1/impresion';
import { render } from 'preact';
import { App } from './App.tsx';
import { abrirBase } from './datos.ts';
import { esProduccion } from './entorno.ts';
import { crearControl } from './impresora.ts';
import { capacidadesDelNavegador, proponerCamino } from './senales.ts';

const raiz = document.getElementById('caja');
if (!raiz) throw new Error('Falta el elemento #caja en index.html');

const reloj = () => Date.now();
const db = abrirBase();
const control = crearControl(db, {
  bluetooth: (navigator as Navigator & { bluetooth?: BluetoothBle }).bluetooth,
  serial: (navigator as Navigator & { serial?: SerialWeb }).serial,
  hostname: location.hostname,
  reloj,
  nuevoId: () => crypto.randomUUID(),
});

render(
  <App
    db={db}
    control={control}
    propuesta={proponerCamino(capacidadesDelNavegador(navigator))}
    prueba={!esProduccion(location.hostname)}
    reloj={reloj}
  />,
  raiz,
);
