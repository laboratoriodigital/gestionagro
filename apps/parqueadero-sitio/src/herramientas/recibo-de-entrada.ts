/**
 * El generador de recibo de entrada (HU-Q11.4) en el navegador: lee el formulario, arma el recibo
 * con `reciboDelGenerador` (`@ed1/parqueadero-recibos`) y lo entrega por el diálogo de impresión
 * del sistema o por `wa.me` (CA2). Sin cuenta: los datos del parqueadero, la tarifa y el próximo
 * número se recuerdan en este navegador (`localStorage`) para el recibo siguiente; la placa y el
 * WhatsApp del conductor no se guardan.
 *
 * Eventos (HU-Q11.5 CA2, `@ed1/eventos`): `tool.opened` al abrir, `tool.completed` con el primer
 * recibo, `tool.shared` al mandarlo y `tool.next_step` al ir a la caja, en un lote a `/_m`.
 */
import { type Colector, crearColector, entornoDelNavegador } from '@ed1/eventos';
import {
  type DatosDelGenerador,
  juntar,
  pantalla,
  ReciboIncompleto,
  reciboDelGenerador,
  textoWhatsApp,
} from '@ed1/parqueadero-recibos';
import { MODOS, type Modo, NOMBRES_DE_VEHICULO, type Vehiculo } from '@ed1/parqueadero-schema';
import { enlaceConNumero, normalizarNumero } from '@ed1/whatsapp';
import { hoja } from '../hoja.ts';

/** Bogotá no cambia de hora: UTC−5 todo el año. */
const DESFASE_MS = 5 * 60 * 60 * 1000;
const RECUERDO = 'parqueadero-generador';
const DEL_PARQUEADERO = [
  'nombre',
  'nit',
  'direccion',
  'ciudad',
  'telefono',
  'aseguradora',
  'poliza',
  'modo',
  'valor',
  'fraccion',
] as const;

/** `2026-10-08T09:30` en la hora de Bogotá, para el campo `datetime-local`. */
export const horaLocal = (ms: number): string =>
  new Date(ms - DESFASE_MS).toISOString().slice(0, 16);

/** El instante de un `datetime-local` leído en la hora de Bogotá; `NaN` si no es una hora. */
export function desdeHoraLocal(valor: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (!m) return Number.NaN;
  const [, a, me, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return Date.UTC(a, me - 1, d, h, mi) + DESFASE_MS;
}

const entero = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : Number.NaN);

/** Lo que dice el formulario, como lo pide `reciboDelGenerador`. */
export function datosDelFormulario(campos: (nombre: string) => string): DatosDelGenerador {
  const aseguradora = campos('aseguradora').trim();
  const numeroPoliza = campos('poliza').trim();
  const modo = (MODOS as readonly string[]).includes(campos('modo'))
    ? (campos('modo') as Modo)
    : 'minuto';
  const vehiculo = (NOMBRES_DE_VEHICULO as readonly string[]).includes(campos('vehiculo'))
    ? (campos('vehiculo') as Vehiculo)
    : 'carro';
  return {
    sede: {
      nombre: campos('nombre'),
      nit: campos('nit'),
      direccion: campos('direccion'),
      ciudad: campos('ciudad'),
      telefono: campos('telefono'),
      // Sin las dos partes, no tiene póliza: el recibo no la menciona.
      poliza: aseguradora && numeroPoliza ? { aseguradora, numero: numeroPoliza } : null,
    },
    numero: campos('numero'),
    placa: campos('placa'),
    vehiculo,
    entrada: desdeHoraLocal(campos('entrada')),
    estado: campos('estado').split('\n'),
    tarifa: {
      modo,
      valor: entero(campos('valor')),
      fraccion_min: modo === 'fraccion' ? entero(campos('fraccion')) : null,
    },
  };
}

/** El número siguiente del talonario, con los mismos ceros: `0457` → `0458`. */
export const siguienteNumero = (n: string): string =>
  /^\d{1,8}$/.test(n) ? String(Number(n) + 1).padStart(n.length, '0') : '';

function leerRecuerdo(): Record<string, string> {
  try {
    const r: unknown = JSON.parse(localStorage.getItem(RECUERDO) ?? '{}');
    return r && typeof r === 'object' ? (r as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function guardarRecuerdo(valores: Record<string, string>): void {
  try {
    localStorage.setItem(RECUERDO, JSON.stringify(valores));
  } catch {
    // Sin almacenamiento (ventana privada): la página sirve igual, sin recordar.
  }
}

export function iniciarGenerador(documento: Document, ahora: () => number = Date.now): Colector {
  const $ = <T extends HTMLElement>(id: string) => documento.getElementById(id) as T;
  const form = $<HTMLFormElement>('generador');
  // La página dice su producto (`contenido.ts`): el código no carga el texto del sitio.
  const colector = crearColector({
    producto: form.dataset['producto'] ?? '',
    endpoint: '/_m',
    entorno: entornoDelNavegador(),
  });
  colector.registrar('tool.opened');
  const campo = (n: string) =>
    form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const valor = (n: string) => campo(n)?.value ?? '';
  const fraccion = form.querySelector<HTMLElement>('[data-fraccion]');
  const resultado = $<HTMLElement>('resultado');
  const faltan = $<HTMLElement>('faltan');
  const enviar = $<HTMLAnchorElement>('enviar');
  const whatsapp = $<HTMLInputElement>('whatsapp');
  const autoriza = $<HTMLInputElement>('autoriza');
  const whatsappFalta = $<HTMLElement>('whatsapp-falta');
  let texto = '';

  const recuerdo = leerRecuerdo();
  for (const n of [...DEL_PARQUEADERO, 'numero']) if (recuerdo[n]) campo(n).value = recuerdo[n];
  campo('entrada').value = horaLocal(ahora());
  const mostrarFraccion = () => {
    if (fraccion) fraccion.hidden = valor('modo') !== 'fraccion';
  };
  campo('modo').addEventListener('change', mostrarFraccion);
  mostrarFraccion();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let recibo: ReturnType<typeof reciboDelGenerador>;
    try {
      recibo = reciboDelGenerador(datosDelFormulario(valor));
    } catch (error) {
      if (!(error instanceof ReciboIncompleto)) throw error;
      faltan.textContent = `Para hacer el recibo falta ${juntar(error.faltan)}.`;
      faltan.hidden = false;
      return;
    }
    faltan.hidden = true;
    texto = textoWhatsApp(recibo, null);
    $<HTMLElement>('hoja').replaceChildren(hoja(pantalla(recibo)));
    resultado.hidden = false;
    form.hidden = true;
    colector.registrar('tool.completed');
    guardarRecuerdo({
      ...Object.fromEntries(DEL_PARQUEADERO.map((n) => [n, valor(n)])),
      numero: siguienteNumero(recibo.numero),
    });
    // El foco va al recibo: quien usa lector de pantalla oye que ya está.
    $<HTMLElement>('titulo-resultado').focus();
  });

  $<HTMLButtonElement>('imprimir').addEventListener('click', () => window.print());

  enviar.addEventListener('click', (e) => {
    let numero: string;
    try {
      numero = normalizarNumero(whatsapp.value);
    } catch {
      e.preventDefault();
      whatsappFalta.textContent = 'Escriba el WhatsApp del conductor, por ejemplo 300 123 4567.';
      whatsappFalta.hidden = false;
      return;
    }
    if (!autoriza.checked) {
      e.preventDefault();
      whatsappFalta.textContent = 'Marque que el conductor autoriza el envío por WhatsApp.';
      whatsappFalta.hidden = false;
      return;
    }
    whatsappFalta.hidden = true;
    enviar.href = enlaceConNumero(numero, texto);
    colector.registrar('tool.shared');
  });

  $<HTMLButtonElement>('otro').addEventListener('click', () => {
    for (const n of ['placa', 'estado']) campo(n).value = '';
    campo('numero').value = leerRecuerdo()['numero'] ?? '';
    campo('entrada').value = horaLocal(ahora());
    whatsapp.value = '';
    autoriza.checked = false;
    resultado.hidden = true;
    form.hidden = false;
    campo('placa').focus();
  });

  $<HTMLAnchorElement>('ir-a-la-caja').addEventListener('click', () =>
    colector.registrar('tool.next_step'),
  );
  return colector;
}
