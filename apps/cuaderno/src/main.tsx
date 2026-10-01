import { render } from 'preact';
import { App } from './App.tsx';
import './estilos.css';

const raiz = document.getElementById('app');
if (!raiz) throw new Error('Falta el elemento #app en index.html');
render(<App />, raiz);
