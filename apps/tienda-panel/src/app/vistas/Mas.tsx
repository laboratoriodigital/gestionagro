/**
 * «Más» (HU-T8.1): lo que no cabe en la navegación de abajo, cambiar de tienda y salir. «Equipo»
 * solo para quien lo puede manejar (HU-T10.5 CA2); «Descargar todo», para quien puede exportar (HU-T10.7);
 * «Datos de un comprador», para quien atiende sus derechos (HU-T7.3).
 */
import { puede } from '@ed1/tienda-schema/permisos';

export function Mas({
  correo,
  rol,
  variasTiendas,
  alCambiar,
  alSalir,
}: {
  correo: string;
  rol: string;
  variasTiendas: boolean;
  alCambiar: () => void;
  alSalir: () => void;
}) {
  return (
    <main class="contenido">
      <h1>Más</h1>
      <p>
        Entraste como <span class="cifra">{correo}</span>.
      </p>
      <ul class="mas">
        <li>
          <a href="/mas/publicar/">Publicar y versiones</a>
        </li>
        <li>
          <a href="/mas/venta/">Envíos y cupones</a>
        </li>
        <li>
          <a href="/mas/ajustes/">Ajustes de la tienda</a>
        </li>
        {puede(rol, 'equipo.gestionar') ? (
          <li>
            <a href="/mas/equipo/">Equipo</a>
          </li>
        ) : null}
        <li>
          <a href="/mas/registro/">Registro: quién cambió qué</a>
        </li>
        {puede(rol, 'exportar') ? (
          <li>
            <a href="/mas/datos/">Descargar todo</a>
          </li>
        ) : null}
        {puede(rol, 'titular.gestionar') ? (
          <li>
            <a href="/mas/titular/">Datos de un comprador</a>
          </li>
        ) : null}
        <li>
          <a href="/privacidad/">Política de tratamiento de datos</a>
        </li>
      </ul>
      <div class="acciones">
        {variasTiendas ? (
          <button class="ed1-boton ed1-boton--secundario" type="button" onClick={alCambiar}>
            Cambiar de tienda
          </button>
        ) : null}
        <button class="ed1-boton ed1-boton--texto" type="button" onClick={alSalir}>
          Salir de la cuenta en este teléfono
        </button>
      </div>
    </main>
  );
}
