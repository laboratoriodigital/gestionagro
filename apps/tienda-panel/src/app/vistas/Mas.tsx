/** «Más» (HU-T8.1): lo que no cabe en la navegación de abajo, cambiar de tienda y salir. */
export function Mas({
  correo,
  variasTiendas,
  alCambiar,
  alSalir,
}: {
  correo: string;
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
