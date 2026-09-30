/**
 * `pnpm validar:productos`: valida todos los `product.yaml` del repositorio (HU-E1.3).
 * Lista todas las fallas con su archivo y sale con código 1 si hay alguna.
 */
import { esContrato, validarArchivos } from './lib/productos.ts';
import { listarArchivos } from './lib/repo.ts';

const archivos = listarArchivos(esContrato);
const errores = validarArchivos(archivos);

if (archivos.length === 0) {
  console.error('❌ No se encontró ningún product.yaml.');
  process.exitCode = 1;
} else if (errores.length === 0) {
  console.log(`✅ ${archivos.length} contratos válidos: ${archivos.join(', ')}`);
} else {
  for (const e of errores) console.error(`❌ ${e.archivo}: ${e.mensaje}`);
  console.error(`\n${errores.length} fallas en ${archivos.length} contratos.`);
  process.exitCode = 1;
}
