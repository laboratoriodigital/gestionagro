/**
 * La política de tratamiento de datos de las cuentas de la Tienda (HU-T2.2), la que se acepta al
 * entrar (HU-T8.1). Sale de `content/tienda/privacidad/politica.json`, la misma fuente con la que el
 * CORE pide aceptarla (P2). Mientras sea borrador, lo dice arriba.
 */
import { datosQueHay, NOMBRE_DEL_ENCARGADO } from '@ed1/tienda-schema/comercio';
import { CORREO_DE_REPORTES } from '@ed1/tienda-schema/marca';
import politica from '../../../../../content/tienda/privacidad/politica.json' with { type: 'json' };

export function Privacidad() {
  const r = politica.responsable;
  // HU-T18.6 CA2: lo que falta del responsable no se muestra; mientras no esté su razón social, lo
  // nombra la marca de la empresa.
  const datos = datosQueHay({ ...r, nombre: r.nombre ?? NOMBRE_DEL_ENCARGADO });
  const fecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${politica.fecha}T00:00:00Z`),
  );
  return (
    <main class="contenido texto-legal">
      <h1>Política de tratamiento de datos de tu cuenta de TiendaPro</h1>
      <p>
        Versión {politica.version}, del {fecha}.
      </p>
      {politica.estado !== 'vigente' ? (
        <p class="texto-legal__aviso">
          <strong>Borrador: {politica.revision}.</strong> Algunos datos de quien responde se
          agregarán antes de que sea la política vigente.
        </p>
      ) : null}
      <p>
        Con tu cuenta entras al panel de tu tienda. Aquí te contamos qué guardamos de ti, para qué y
        cómo puedes consultarlo, corregirlo o pedir que lo borremos. De los datos de tus compradores
        responde tu tienda, con su propia política.
      </p>
      <h2>Quién responde por tus datos</h2>
      <dl class="datos">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <h2>Quiénes nos ayudan</h2>
      <ul>
        {politica.encargados.map((e) => (
          <li key={e.quien}>
            <strong>{e.quien}.</strong> {e.para}
          </li>
        ))}
      </ul>
      <p>{politica.transferencia}</p>
      <h2>Lo que guardamos en tu teléfono</h2>
      <ul>
        {politica.almacenamiento_en_el_telefono.map((t) => (
          <li key={t}>{t}</li>
        ))}
        {politica.cookies.map((c) => (
          <li key={c.nombre}>{c.texto}</li>
        ))}
      </ul>
      <h2>Tus derechos</h2>
      <p>
        Puedes conocer, actualizar y corregir tus datos, pedir que los borremos y revocar esta
        autorización. Escríbenos a {r.correo ?? CORREO_DE_REPORTES}: te respondemos las consultas en
        máximo 10 días hábiles y los reclamos en máximo 15 (Ley 1581 de 2012). Si no quedas
        conforme, puedes acudir a la Superintendencia de Industria y Comercio.
      </p>
      <p>
        <a href="/">Volver al panel</a>
      </p>
    </main>
  );
}
