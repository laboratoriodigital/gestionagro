/**
 * HU-P4.1 (sprint PF3): los temas listos. Un tema es un dato, no código: una combinación de lo que
 * la sección `apariencia` ya guarda (acento, tinta, estilo, portada y forma de las fotos). Elegirlo
 * llena esos campos y cada uno se puede cambiar después; el modo claro u oscuro, el orden y la
 * bienvenida siguen como el comercio los dejó. Los acentos son los ocho del panel, que el horno ya
 * valida en claro y en oscuro (HU-T3.2): una prueba del horno pasa cada tema por la misma compuerta.
 */

export interface TemaListo {
  id: string;
  nombre: string;
  /** Para qué tipo de tienda se pensó, en una frase corta. */
  para: string;
  acento: string;
  /** El mismo acento, aclarado para una tienda solo oscura: el horno no lo ajusta en silencio. */
  acentoOscuro: string;
  tinta: 'negra' | 'azul';
  estilo: 'precision' | 'editorial';
  portada: 'editorial' | 'catalogo' | 'colecciones';
  proporcion: '4:5' | '1:1';
}

export const TEMAS_LISTOS: readonly TemaListo[] = [
  {
    id: 'panaderia',
    nombre: 'Panadería',
    para: 'Panes, postres y comida hecha en casa',
    acento: '#9c4a1a',
    acentoOscuro: '#ad6941',
    tinta: 'negra',
    estilo: 'editorial',
    portada: 'editorial',
    proporcion: '1:1',
  },
  {
    id: 'moda',
    nombre: 'Moda',
    para: 'Ropa, calzado y accesorios',
    acento: '#8a1c3c',
    acentoOscuro: '#ae6278',
    tinta: 'negra',
    estilo: 'editorial',
    portada: 'editorial',
    proporcion: '4:5',
  },
  {
    id: 'belleza',
    nombre: 'Belleza',
    para: 'Maquillaje, cuidado de la piel y perfumes',
    acento: '#5b2a86',
    acentoOscuro: '#8e6cac',
    tinta: 'negra',
    estilo: 'editorial',
    portada: 'catalogo',
    proporcion: '4:5',
  },
  {
    id: 'campo',
    nombre: 'Campo',
    para: 'Productos del campo, mercado y café',
    acento: '#1f5c3a',
    acentoOscuro: '#558369',
    tinta: 'negra',
    estilo: 'precision',
    portada: 'colecciones',
    proporcion: '1:1',
  },
  {
    id: 'tecnologia',
    nombre: 'Tecnología',
    para: 'Celulares, accesorios y electrónica',
    acento: '#14548a',
    acentoOscuro: '#4f7fa7',
    tinta: 'azul',
    estilo: 'precision',
    portada: 'catalogo',
    proporcion: '1:1',
  },
  {
    id: 'artesanias',
    nombre: 'Artesanías',
    para: 'Piezas hechas a mano y decoración',
    acento: '#9a3412',
    acentoOscuro: '#b2654b',
    tinta: 'negra',
    estilo: 'editorial',
    portada: 'colecciones',
    proporcion: '4:5',
  },
  {
    id: 'hogar',
    nombre: 'Hogar',
    para: 'Cocina, plantas y cosas para la casa',
    acento: '#5c5a17',
    acentoOscuro: '#7e7d48',
    tinta: 'negra',
    estilo: 'precision',
    portada: 'colecciones',
    proporcion: '1:1',
  },
  {
    id: 'minimal',
    nombre: 'Minimal',
    para: 'Cualquier tienda que quiera que hablen sus fotos',
    acento: '#1f1f1d',
    acentoOscuro: '#797977',
    tinta: 'negra',
    estilo: 'precision',
    portada: 'catalogo',
    proporcion: '1:1',
  },
];

/** Los campos de `apariencia` que un tema llena; los demás no los toca. */
export const CAMPOS_DEL_TEMA = ['acento', 'tinta', 'estilo', 'portada', 'proporcion'] as const;

/** Lo que el tema pone en `apariencia`, según el modo que la tienda ya tiene. */
export function valoresDelTema(t: TemaListo, modo: string | undefined): Record<string, string> {
  return {
    acento: modo === 'oscuro' ? t.acentoOscuro : t.acento,
    tinta: t.tinta,
    estilo: t.estilo,
    portada: t.portada,
    proporcion: t.proporcion,
  };
}

/** El tema que coincide con lo guardado, si alguno coincide en todo. */
export function temaDe(apariencia: Partial<Record<string, unknown>>): TemaListo | undefined {
  const modo = typeof apariencia['modo'] === 'string' ? apariencia['modo'] : undefined;
  return TEMAS_LISTOS.find((t) => {
    const v = valoresDelTema(t, modo);
    return CAMPOS_DEL_TEMA.every((c) => apariencia[c] === v[c]);
  });
}
