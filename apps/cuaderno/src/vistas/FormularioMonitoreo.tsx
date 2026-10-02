/**
 * Monitoreo de plagas y enfermedades (HU-E3.11): qué se vio, cómo se midió, el nivel y, si hace
 * falta, una foto. Los nombres ya anotados se sugieren al escribir (catálogo editable, CA1). La
 * foto se comprime aquí a ≤ 150 KB antes de guardarla (CA2) y se dice «x de y fotos este mes» (CA3).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import { type Area, ErrorDeValidacion, type Registro } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { comprimirFoto } from '../almacen/fotos.ts';
import {
  cuotaDeFotos,
  type DatosMonitoreo,
  type DatosMonitoreoGuardado,
  guardarMonitoreo,
  plagasConocidas,
} from '../almacen/monitoreo.ts';
import { Campo, CampoSeleccion, Opciones } from '../componentes/Campo.tsx';
import { AccionesDeFormulario, EventoQueSeCorrige } from '../componentes/Correccion.tsx';

const CLASES = [
  { valor: 'plaga', texto: 'Plaga' },
  { valor: 'enfermedad', texto: 'Enfermedad' },
] as const;
const METODOS = [
  { valor: 'trampa', texto: 'Trampa' },
  { valor: 'conteo', texto: 'Conteo en plantas' },
  { valor: 'observacion', texto: 'Observación' },
] as const;
const NIVELES = [
  { valor: 'bajo', texto: 'Bajo' },
  { valor: 'medio', texto: 'Medio' },
  { valor: 'alto', texto: 'Alto' },
] as const;

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export function FormularioMonitoreo(props: {
  fincaId: string;
  areas: Area[];
  alGuardar: () => void;
  corrige?: Registro | undefined;
  alCancelar?: () => void;
}) {
  const antes = props.corrige?.datos as DatosMonitoreoGuardado | undefined;
  const vacio = {
    areaId:
      props.corrige?.area_ids[0] ?? (props.areas.length === 1 ? (props.areas[0]?.id ?? '') : ''),
    plaga: antes?.plaga ?? '',
    clase: antes?.clase ?? ('' as DatosMonitoreo['clase']),
    metodo: antes?.metodo ?? ('' as DatosMonitoreo['metodo']),
    nivel: antes?.nivel ?? ('' as DatosMonitoreo['nivel']),
    cantidad:
      antes?.cantidad === null || antes?.cantidad === undefined ? '' : String(antes.cantidad),
    nota: antes?.nota ?? '',
  };
  const [v, setV] = useState(vacio);
  const [foto, setFoto] = useState<{ datos: Blob; tipo: string } | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [conocidas, setConocidas] = useState<{ nombre: string; clase: string }[]>([]);
  const [cuota, setCuota] = useState<{ usadas: number; limite: number } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = () => {
    const db = cuaderno();
    void plagasConocidas(db, props.fincaId).then(setConocidas);
    void cuotaDeFotos(db).then(setCuota);
  };
  useEffect(cargar, [props.fincaId]);
  const tieneAlgo = Boolean(v.plaga || v.clase || v.metodo || v.nivel || foto);
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  const elegirPlaga = (nombre: string) => {
    const conocida = conocidas.find(
      (c) => c.nombre.toLocaleLowerCase('es') === nombre.trim().toLocaleLowerCase('es'),
    );
    setV({ ...v, plaga: nombre, clase: (conocida?.clase as DatosMonitoreo['clase']) ?? v.clase });
  };

  const elegirFoto = async (archivo: File | undefined) => {
    setErrores({ ...errores, foto: '' });
    if (!archivo) return setFoto(null);
    setComprimiendo(true);
    try {
      setFoto(await comprimirFoto(archivo));
    } catch (e) {
      setFoto(null);
      setErrores({
        ...errores,
        foto:
          e instanceof ErrorDeValidacion
            ? (e.campos[0]?.motivo ?? e.message)
            : 'No se pudo leer la foto.',
      });
    } finally {
      setComprimiendo(false);
    }
  };

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!v.areaId) err['areaId'] = 'Elige el área.';
    let cantidad: number | null = null;
    if (v.metodo !== 'observacion' && v.cantidad.trim()) {
      const leida = leerNumero(v.cantidad);
      if (!leida.ok || !Number.isInteger(leida.valor) || leida.valor < 0) {
        err['cantidad'] = 'Escribe un número entero, o déjalo vacío.';
      } else cantidad = leida.valor;
    }
    setErrores(err);
    setGuardado(null);
    if (Object.keys(err).length > 0) return;
    try {
      await guardarMonitoreo(
        cuaderno(),
        props.fincaId,
        { ...v, cantidad, foto },
        { corrige: props.corrige },
      );
      setV({
        ...vacio,
        areaId: v.areaId,
        plaga: '',
        clase: '',
        metodo: '',
        nivel: '',
        cantidad: '',
        nota: '',
      });
      setFoto(null);
      setGuardado('Monitoreo guardado en este teléfono.');
      cargar();
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeValidacion) {
        setErrores(
          Object.fromEntries(
            error.campos.map((c) => [
              c.campo,
              `${c.motivo[0]?.toUpperCase()}${c.motivo.slice(1)}.`,
            ]),
          ),
        );
      } else {
        setErrores({ general: 'No se pudo guardar en el teléfono. Inténtalo otra vez.' });
      }
    }
  };

  const sinCupo = cuota !== null && cuota.usadas >= cuota.limite;
  return (
    <form
      class="formulario-area"
      onSubmit={(e) => void guardar(e)}
      noValidate
      data-prueba="formulario-monitoreo"
    >
      <h2>{props.corrige ? 'Corregir monitoreo' : 'Monitoreo'}</h2>
      {props.corrige ? (
        <EventoQueSeCorrige registro={props.corrige} areas={props.areas} />
      ) : (
        <CampoSeleccion
          id="monitoreo-area"
          etiqueta="Área"
          indicacion="Elige el área"
          opciones={props.areas.map((a) => ({ valor: a.id, texto: a.nombre }))}
          valor={v.areaId}
          error={errores['areaId']}
          alCambiar={(x) => setV({ ...v, areaId: x })}
        />
      )}
      <div class="campo">
        <label for="monitoreo-plaga">Qué viste</label>
        <p id="monitoreo-plaga-ayuda" class="ayuda">
          La plaga o enfermedad. Las que ya anotaste aparecen al escribir.
        </p>
        <input
          id="monitoreo-plaga"
          type="text"
          autoComplete="off"
          list="monitoreo-plagas"
          value={v.plaga}
          aria-describedby="monitoreo-plaga-ayuda"
          aria-invalid={errores['plaga'] ? 'true' : 'false'}
          onInput={(e) => elegirPlaga((e.currentTarget as HTMLInputElement).value)}
        />
        <datalist id="monitoreo-plagas">
          {conocidas.map((c) => (
            <option key={c.nombre} value={c.nombre} />
          ))}
        </datalist>
        {errores['plaga'] && <p class="error">{errores['plaga']}</p>}
      </div>
      <Opciones
        nombre="monitoreo-clase"
        leyenda="Es una"
        opciones={CLASES}
        valor={v.clase}
        error={errores['clase']}
        alCambiar={(x) => setV({ ...v, clase: x })}
      />
      <Opciones
        nombre="monitoreo-metodo"
        leyenda="Cómo lo mediste"
        opciones={METODOS}
        valor={v.metodo}
        error={errores['metodo']}
        alCambiar={(x) => setV({ ...v, metodo: x })}
      />
      {v.metodo && v.metodo !== 'observacion' && (
        <Campo
          id="monitoreo-cantidad"
          etiqueta={
            v.metodo === 'trampa'
              ? 'Individuos en la trampa (opcional)'
              : 'Individuos contados (opcional)'
          }
          decimal
          valor={v.cantidad}
          error={errores['cantidad']}
          alCambiar={(x) => setV({ ...v, cantidad: x })}
        />
      )}
      <Opciones
        nombre="monitoreo-nivel"
        leyenda="Nivel"
        opciones={NIVELES}
        valor={v.nivel}
        error={errores['nivel']}
        alCambiar={(x) => setV({ ...v, nivel: x })}
      />
      <div class="campo">
        <label for="monitoreo-foto">Foto (opcional)</label>
        <p class="ayuda" data-prueba="cuota-fotos">
          {cuota
            ? `${cuota.usadas} de ${cuota.limite} fotos este mes en este teléfono. Se guarda liviana (máximo 150 KB) y se queda en el teléfono.`
            : 'Cargando…'}
        </p>
        <input
          id="monitoreo-foto"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={sinCupo || comprimiendo}
          onChange={(e) => void elegirFoto((e.currentTarget as HTMLInputElement).files?.[0])}
        />
        {comprimiendo && <p class="ayuda">Preparando la foto…</p>}
        {foto && (
          <p class="ayuda" data-prueba="foto-lista">
            Foto lista: {kb(foto.datos.size)}.
          </p>
        )}
        {errores['foto'] && <p class="error">{errores['foto']}</p>}
      </div>
      <Campo
        id="monitoreo-nota"
        etiqueta="Nota (opcional)"
        valor={v.nota}
        error={errores['nota']}
        alCambiar={(x) => setV({ ...v, nota: x })}
      />
      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      {guardado && (
        <p class="exito" role="status">
          {guardado}
        </p>
      )}
      <AccionesDeFormulario
        corrigiendo={Boolean(props.corrige)}
        texto="Guardar monitoreo"
        alCancelar={props.alCancelar}
      />
    </form>
  );
}
