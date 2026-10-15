import { render } from 'preact';
import '@ed1/ui/v2/fuentes.css';
import '@ed1/ui/v2/tokens.css';
import '@ed1/ui/v2/componentes.css';
import './panel.css';
import { App } from './App.tsx';

const raiz = document.getElementById('app');
if (!raiz) throw new Error('Falta el elemento #app en index.html');
raiz.replaceChildren();
render(<App />, raiz);
