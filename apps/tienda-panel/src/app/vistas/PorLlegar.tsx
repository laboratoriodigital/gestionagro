/**
 * Una sección del panel que todavía no está hecha. Lo dice en palabras: una lista vacía haría creer
 * que la tienda no tiene pedidos (bitácora agro 17).
 */
import { Aviso } from '@ed1/ui/v2/componentes';

export function PorLlegar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main class="contenido">
      <h1>{titulo}</h1>
      <Aviso tono="info" titulo="Esta parte del panel está en camino">
        {texto}
      </Aviso>
    </main>
  );
}
