/** Resumen de un registro en una línea, en palabras de finca. Lo usan Registrar e Historial (P2). */
import { formatearKPa, formatearPct } from '@gestionagro/agro-calc';
import type { Registro } from '@gestionagro/agro-schema';
import type { DatosAplicacionGuardada } from '../almacen/aplicaciones.ts';
import type { DatosClimaGuardado } from '../almacen/clima.ts';
import type { DatosCosechaGuardada } from '../almacen/cosecha.ts';
import type { DatosDespacho } from '../almacen/despachos.ts';
import type { DatosLote } from '../almacen/lotes.ts';
import type { DatosMonitoreoGuardado } from '../almacen/monitoreo.ts';
import type { DatosRiegoGuardado } from '../almacen/riego.ts';

export function resumenDe(r: Registro, nombres: ReadonlyMap<string, string>): string {
  const coma = (n: number) => String(n).replace('.', ',');
  if (r.tipo === 'clima') {
    const d = r.datos as DatosClimaGuardado;
    const hoja = d.temperaturaHojaC !== null ? ` · hoja ${coma(d.temperaturaHojaC)} °C` : '';
    return `Clima · ${coma(d.temperaturaC)} °C · ${coma(d.humedadRelativaPct)} % · DPV ${formatearKPa(d.dpvKPa)}${hoja}`;
  }
  if (r.tipo === 'riego') {
    const d = r.datos as DatosRiegoGuardado;
    const unidad = d.unidad === 'mL_gotero' ? 'mL por gotero' : 'L por área';
    const drenaje =
      d.drenajePct === null ? 'drenaje no medido' : `drenaje ${formatearPct(d.drenajePct)}`;
    const ce = d.ceEntradaDsM === null ? '' : ` · CE ${coma(d.ceEntradaDsM)} dS/m`;
    const ph = d.phEntrada === null ? '' : ` · pH ${coma(d.phEntrada)}`;
    // Los riegos v1 no tienen duración.
    const min = r.v >= 2 ? d.duracionMin : null;
    const duracion = min === null ? '' : ` · ${coma(min)} min`;
    return `Riego · ${coma(d.volumenAplicado)} ${unidad}${duracion} · ${drenaje}${ce}${ph}`;
  }
  if (r.tipo === 'labor') {
    const d = r.datos as { labor: string; horasPorPersona: number };
    const quienes = r.persona_ids.map((id) => nombres.get(id) ?? 'Persona').join(', ');
    return `Labor · ${d.labor} · ${coma(d.horasPorPersona)} h por persona · ${quienes}`;
  }
  if (r.tipo === 'aplicacion') {
    const d = r.datos as DatosAplicacionGuardada;
    const quienes = r.persona_ids.map((id) => nombres.get(id) ?? 'Persona').join(', ');
    return `Aplicación · ${d.insumo} · ${coma(d.dosis)} ${d.dosisUnidad} · ${quienes}`;
  }
  if (r.tipo === 'cosecha') {
    const d = r.datos as DatosCosechaGuardada;
    const descarte = d.descarte === null ? '' : ` · descarte ${coma(d.descarte)}`;
    const carencia = d.carenciaConfirmada ? ' · cosechada en carencia' : '';
    return `Cosecha · ${coma(d.cantidad)} ${d.unidad} · ${d.categoria}${descarte}${carencia}`;
  }
  if (r.tipo === 'lote_venta') {
    const d = r.datos as DatosLote;
    const n = d.cosecha_ids.length;
    return `Lote ${d.codigo} · ${coma(d.cantidad)} ${d.unidad} · ${n} ${n === 1 ? 'cosecha' : 'cosechas'}`;
  }
  if (r.tipo === 'monitoreo') {
    const d = r.datos as DatosMonitoreoGuardado;
    const metodo = { trampa: 'trampa', conteo: 'conteo', observacion: 'observación' }[d.metodo];
    const cantidad = d.cantidad === null ? '' : ` · ${d.cantidad} individuos`;
    const foto = d.foto_id ? ' · con foto' : '';
    return `Monitoreo · ${d.plaga} · nivel ${d.nivel} · ${metodo}${cantidad}${foto}`;
  }
  if (r.tipo === 'despacho') {
    const d = r.datos as DatosDespacho;
    const cantidad = d.lineas.reduce((s, l) => s + l.cantidad, 0);
    const precio =
      d.precio_unitario_cop === null
        ? 'sin precio anotado'
        : `$ ${d.precio_unitario_cop.toLocaleString('es-CO')} por ${d.unidad}`;
    return `Despacho · ${d.cliente.nombre} · ${coma(cantidad)} ${d.unidad} · ${precio}`;
  }
  return r.tipo;
}
