// Prueba del esquema propuesto de la Tienda 3.0 (shard y control) con node:sqlite.
// Cada «lote» se corre como corre un batch de D1: todo o nada.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const [archivoShard, archivoControl] = process.argv.slice(2);
let fallas = 0;
const ok = (cond, msg) => {
  if (!cond) fallas++;
  console.log(`${cond ? 'ok  ' : 'FALLA'} ${msg}`);
};

const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.exec('BEGIN');
db.exec(readFileSync(archivoShard, 'utf8'));
db.exec('COMMIT');
ok(true, 'el esquema del shard se aplica');

const lote = (sentencias) => {
  db.exec('BEGIN');
  try {
    for (const [sql, ...p] of sentencias) db.prepare(sql).run(...p);
    db.exec('COMMIT');
    return { ok: true };
  } catch (e) {
    db.exec('ROLLBACK');
    return { ok: false, error: e.message };
  }
};
const uno = (sql, ...p) => db.prepare(sql).get(...p);
const T = '2026-10-05T15:00:00.000Z';
const mas = (min) => new Date(Date.parse(T) + min * 60000).toISOString();

// Dos comercios de prueba, con datos distintos (P4).
const semilla = lote([
  ["INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES ('A', 'ensayo-uno', 'Comercio Ensayo Uno', 'abierta', 'entrada', ?, ?)", T, T],
  ["INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES ('B', 'ensayo-dos', 'Comercio Ensayo Dos', 'abierta', 'gratis', ?, ?)", T, T],
  ["INSERT INTO producto (org_id, id, slug, nombre, estado, opciones, creado, actualizado) VALUES ('A', 'p1', 'vestido', 'Vestido', 'activo', '[{\"nombre\":\"Talla\",\"valores\":[\"S\",\"M\"]}]', ?, ?)", T, T],
  ["INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado) VALUES ('A', 'v1', 'p1', 'S', 80000, 1, ?)", T],
  ["INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado) VALUES ('A', 'v2', 'p1', 'M', 80000, 5, ?)", T],
  ["INSERT INTO producto (org_id, id, slug, nombre, estado, creado, actualizado) VALUES ('B', 'q1', 'pan', 'Pan de bono', 'activo', ?, ?)", T, T],
  ["INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado) VALUES ('B', 'w1', 'q1', '', 1500, NULL, ?)", T],
]);
ok(semilla.ok, `semilla de dos comercios ${semilla.error ?? ''}`);

// Pedido + cobro + apartados en un lote, como `POST /api/v1/cobros`.
const pedirEnLinea = (codigo, numero, variante, cantidad, ahora, venceMin = 15) => {
  const pid = `ped-${codigo}`;
  const cid = `${codigo}-1`;
  return lote([
    // Vencimiento perezoso: lo vencido de esas variantes se libera antes de apartar.
    ["UPDATE apartado SET estado = 'vencido', cerrado = ? WHERE org_id = 'A' AND variante_id = ? AND estado = 'activo' AND vence <= ?", ahora, variante, ahora],
    ["UPDATE tienda SET ultimo_numero = ultimo_numero + 1 WHERE org_id = 'A'"],
    [`INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado, terminos_huella, aceptado)
      VALUES ('A', ?, ?, (SELECT ultimo_numero FROM tienda WHERE org_id = 'A'), 'por_pagar', 'en_linea', 'en_linea', ?, ?, 'comprador', ?, ?, ?, ?)`, pid, codigo, 80000 * cantidad, 80000 * cantidad, ahora, ahora, 'a'.repeat(64), ahora],
    ["INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, precio_unitario_cop, cantidad, total_cop) VALUES ('A', ?, 1, 'p1', ?, 'Vestido', 80000, ?, ?)", pid, variante, cantidad, 80000 * cantidad],
    ["INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado) VALUES ('A', ?, ?, 'bold', 'pruebas', ?, 'esperando', ?, ?, ?, ?)", cid, pid, 80000 * cantidad, `tok-${codigo}`, mas(venceMin), ahora, ahora],
    ["INSERT INTO apartado (org_id, cobro_id, variante_id, cantidad, estado, vence, creado) VALUES ('A', ?, ?, ?, 'activo', ?, ?)", cid, variante, cantidad, mas(venceMin), ahora],
  ]);
};
const variante = (id) => uno("SELECT stock, reservado FROM variante WHERE org_id = 'A' AND id = ?", id);

// 1. La última unidad: el primero aparta, el segundo falla entero.
const c1 = pedirEnLinea('AAAAA1', 1001, 'v1', 1, T);
ok(c1.ok, `primer comprador aparta la última unidad ${c1.error ?? ''}`);
ok(variante('v1').reservado === 1, 'reservado = 1');
const c2 = pedirEnLinea('BBBBB2', 1002, 'v1', 1, mas(1));
ok(!c2.ok && /reservado <= stock/.test(c2.error), `segundo comprador falla por el CHECK: ${c2.error}`);
ok(uno("SELECT COUNT(*) n FROM pedido WHERE codigo = 'BBBBB2'").n === 0, 'el lote fallido no dejó pedido ni cobro (todo o nada)');
ok(uno("SELECT ultimo_numero n FROM tienda WHERE org_id = 'A'").n === 1001, 'el consecutivo no avanzó con el lote fallido');

// 2. El apartado del primero vence; un tercero entra a los 16 minutos.
const c3 = pedirEnLinea('CCCCC3', 1002, 'v1', 1, mas(16));
ok(c3.ok, `vencido el primero, el tercero aparta ${c3.error ?? ''}`);
ok(uno("SELECT estado FROM apartado WHERE cobro_id = 'AAAAA1-1'").estado === 'vencido', 'el apartado del primero quedó vencido');
ok(variante('v1').reservado === 1, 'reservado vuelve a 1 (el del tercero)');

// 3. Bold aprueba el pago del tercero: un lote cierra todo.
const aprobar = (codigo, ahora) => lote([
  ["UPDATE cobro SET estado = 'aprobado', transaccion = 'TX', actualizado = ? WHERE org_id = 'A' AND id = ? AND estado = 'esperando'", ahora, `${codigo}-1`],
  ["UPDATE apartado SET estado = 'consumido', cerrado = ? WHERE org_id = 'A' AND cobro_id = ? AND estado = 'activo'", ahora, `${codigo}-1`],
  [`UPDATE variante SET stock = stock - (SELECT cantidad FROM pedido_linea WHERE org_id = 'A' AND pedido_id = ? AND variante_id = variante.id),
          cambio_motivo = 'venta', cambio_ref = ?, actualizado = ?
     WHERE org_id = 'A' AND id IN (SELECT variante_id FROM pedido_linea WHERE org_id = 'A' AND pedido_id = ? AND descontado = 0)`, `ped-${codigo}`, `ped-${codigo}`, ahora, `ped-${codigo}`],
  ["UPDATE pedido_linea SET descontado = 1 WHERE org_id = 'A' AND pedido_id = ?", `ped-${codigo}`],
  ["UPDATE pedido SET estado = 'pagado', cambiado_por = 'sistema', actualizado = ?, version = version + 1 WHERE org_id = 'A' AND id = ?", ahora, `ped-${codigo}`],
]);
const a3 = aprobar('CCCCC3', mas(18));
ok(a3.ok, `aprobación del tercero ${a3.error ?? ''}`);
ok(variante('v1').stock === 0 && variante('v1').reservado === 0, 'stock 0 y reservado 0 tras la venta');
ok(uno("SELECT COUNT(*) n FROM movimiento_inventario WHERE variante_id = 'v1' AND motivo = 'venta' AND delta = -1").n === 1, 'el libro de inventario registra la venta');
ok(uno("SELECT COUNT(*) n FROM pedido_evento WHERE pedido_id = 'ped-CCCCC3' AND de = 'por_pagar' AND a = 'pagado' AND actor = 'sistema'").n === 1, 'el historial registra por_pagar → pagado');

// 4. Pago tardío: el primero pagó en Bold después de vencer, y ya no hay unidades.
const a1 = aprobar('AAAAA1', mas(20));
ok(!a1.ok && /stock >= 0/.test(a1.error), `aprobar el pago tardío como venta normal falla: ${a1.error}`);
const a1b = lote([
  ["UPDATE cobro SET estado = 'aprobado_sin_existencias', transaccion = 'TX1', actualizado = ? WHERE org_id = 'A' AND id = 'AAAAA1-1' AND estado = 'esperando'", mas(20)],
  ["UPDATE pedido SET estado = 'pagado', atencion = 'sin_existencias', cambiado_por = 'sistema', actualizado = ?, version = version + 1 WHERE org_id = 'A' AND id = 'ped-AAAAA1'", mas(20)],
]);
ok(a1b.ok, `el camino de respaldo deja el pago «aprobado sin existencias» y el pedido para atender ${a1b.error ?? ''}`);
ok(variante('v1').stock === 0, 'el inventario no queda negativo');

// 5. Transición inválida y cancelación que devuelve el inventario.
const malo = lote([["UPDATE pedido SET estado = 'entregado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-CCCCC3'", mas(30)]]);
ok(!malo.ok && /transicion-de-pedido-invalida/.test(malo.error), `pagado → entregado se rechaza: ${malo.error}`);
const cancelar = lote([
  ["UPDATE variante SET stock = stock + 1, cambio_motivo = 'cancelacion', cambio_ref = 'ped-CCCCC3', actualizado = ? WHERE org_id = 'A' AND id = 'v1'", mas(31)],
  ["UPDATE pedido_linea SET descontado = 0 WHERE org_id = 'A' AND pedido_id = 'ped-CCCCC3'"],
  ["UPDATE pedido SET estado = 'cancelado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-CCCCC3'", mas(31)],
]);
ok(cancelar.ok && variante('v1').stock === 1, `cancelar un pagado devuelve la unidad ${cancelar.error ?? ''}`);

// 6. Pedido por WhatsApp: sin apartar; confirmar descuenta.
const wa = lote([
  ["UPDATE tienda SET ultimo_numero = ultimo_numero + 1 WHERE org_id = 'A'"],
  ["INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, subtotal_cop, envio_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'ped-W', 'WWWWW4', (SELECT ultimo_numero FROM tienda WHERE org_id = 'A'), 'pendiente', 'whatsapp', 160000, 8000, 168000, 'comprador', ?, ?)", T, T],
  ["INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones, precio_unitario_cop, cantidad, total_cop) VALUES ('A', 'ped-W', 1, 'p1', 'v2', 'Vestido', 'Talla: M', 80000, 2, 160000)"],
]);
ok(wa.ok, `pedido por WhatsApp sin apartar ${wa.error ?? ''}`);
ok(variante('v2').reservado === 0, 'el pedido por WhatsApp no aparta');

// 6b. Un pago en línea rechazado: libera el apartado y el pedido vuelve a pendiente.
const r4 = pedirEnLinea('DDDDD8', 1004, 'v2', 1, mas(40));
const rechazo = lote([
  ["UPDATE cobro SET estado = 'rechazado', actualizado = ? WHERE org_id = 'A' AND id = 'DDDDD8-1'", mas(41)],
  ["UPDATE apartado SET estado = 'liberado', cerrado = ? WHERE org_id = 'A' AND cobro_id = 'DDDDD8-1' AND estado = 'activo'", mas(41)],
  ["UPDATE pedido SET estado = 'pendiente', cambiado_por = 'sistema', actualizado = ? WHERE org_id = 'A' AND id = 'ped-DDDDD8'", mas(41)],
]);
ok(r4.ok && rechazo.ok && variante('v2').reservado === 0, `un rechazo libera el apartado y el pedido vuelve a pendiente ${r4.error ?? ''}${rechazo.error ?? ''}`);
// Anulación (VOID) de una venta aprobada: el cobro pasa a reembolsado.
const anula = lote([["UPDATE cobro SET estado = 'reembolsado', actualizado = ? WHERE org_id = 'A' AND id = 'CCCCC3-1'", mas(50)]]);
ok(anula.ok, `una anulación aprobada deja el cobro reembolsado ${anula.error ?? ''}`);
const radicar = lote([
  ["UPDATE tienda SET ultima_solicitud = ultima_solicitud + 1 WHERE org_id = 'A'"],
  ["INSERT INTO solicitud (org_id, id, radicado, tipo, pedido_id, canal, estado, sobre, iv, llave_version, creada, vence) VALUES ('A', 'sol-1', (SELECT ultima_solicitud FROM tienda WHERE org_id = 'A'), 'retracto', 'ped-CCCCC3', 'web', 'radicada', x'00', x'000000000000000000000000', 1, ?, ?)", mas(60), mas(60 * 24 * 7)],
]);
ok(radicar.ok && uno("SELECT radicado FROM solicitud WHERE id = 'sol-1'").radicado === 1, `una solicitud de retracto recibe el radicado 1 ${radicar.error ?? ''}`);

// 6c. Link de pago (estudio v1.3 [C3]): un pedido que llegó por el chat se cobra en línea con el
//     Bold del comercio. Pasa a `en_linea` mientras está pendiente, aparta y espera como el botón.
const pedirPorChat = (id, codigo, forma, variante, cantidad, ahora) => lote([
  ["UPDATE tienda SET ultimo_numero = ultimo_numero + 1 WHERE org_id = 'A'"],
  [`INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, envio_cop, total_cop, cambiado_por, creado, actualizado, terminos_huella, aceptado)
    VALUES ('A', ?, ?, (SELECT ultimo_numero FROM tienda WHERE org_id = 'A'), 'pendiente', 'whatsapp', ?, ?, 10000, ?, 'comprador', ?, ?, ?, ?)`, id, codigo, forma, 80000 * cantidad, 80000 * cantidad + 10000, ahora, ahora, 'b'.repeat(64), ahora],
  ["INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, precio_unitario_cop, cantidad, total_cop) VALUES ('A', ?, 1, 'p1', ?, 'Vestido', 80000, ?, ?)", id, variante, cantidad, 80000 * cantidad],
]);
const pl = pedirPorChat('ped-KKKKK1', 'KKKKK1', 'a_convenir', 'v2', 1, mas(70));
const link = lote([
  ["UPDATE pedido SET forma_pago = 'en_linea', estado = 'por_pagar', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-KKKKK1'", mas(71)],
  ["INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado) VALUES ('A', 'KKKKK1-1', 'ped-KKKKK1', 'bold', 'pruebas', 90000, 'esperando', 'tok-K', ?, ?, ?)", mas(131), mas(71), mas(71)],
  ["INSERT INTO apartado (org_id, cobro_id, variante_id, cantidad, estado, vence, creado) VALUES ('A', 'KKKKK1-1', 'v2', 1, 'activo', ?, ?)", mas(131), mas(71)],
]);
ok(pl.ok && link.ok && variante('v2').reservado === 1, `un pedido del chat se cobra con un link de pago: pasa a en línea y aparta ${pl.error ?? ''}${link.error ?? ''}`);
const al = aprobar('KKKKK1', mas(90));
ok(al.ok && uno("SELECT estado FROM pedido WHERE id = 'ped-KKKKK1'").estado === 'pagado', `Bold aprueba el link y el pedido queda pagado ${al.error ?? ''}`);
const chatPagado = lote([["UPDATE pedido SET estado = 'pagado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-W'", mas(91)]]);
ok(!chatPagado.ok, `un pedido enviado al chat no figura como pagado sin Bold: ${chatPagado.error}`);

// 6d. Contraentrega (estudio v1.3 [C3][C7]): confirmar antes de despachar, despachar con guía,
//     recaudar al entregar y liquidar después; o devolver, con el flete de vuelta y la unidad de
//     regreso al inventario.
const confirmarDescontando = (id, variante, ahora) => lote([
  ["UPDATE variante SET stock = stock - 1, cambio_motivo = 'venta', cambio_ref = ?, actualizado = ? WHERE org_id = 'A' AND id = ?", id, ahora, variante],
  ["UPDATE pedido_linea SET descontado = 1 WHERE org_id = 'A' AND pedido_id = ?", id],
  ["UPDATE pedido SET estado = 'confirmado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = ?", ahora, id],
]);
const despachar = (id, guia, ahora) => lote([
  ["INSERT INTO contraentrega (org_id, pedido_id, estado, monto_cop, comision_cop, flete_ida_cop, cambiado_por, creado, actualizado) VALUES ('A', ?, 'por_recaudar', (SELECT total_cop FROM pedido WHERE org_id = 'A' AND id = ?), 3213, 10000, 'usuario:u1', ?, ?)", id, id, ahora, ahora],
  ["UPDATE pedido SET estado = 'despachado', transportadora = 'Transportadora Ensayo', guia = ?, cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = ?", guia, ahora, id],
]);
const ce1 = pedirPorChat('ped-CE1', 'CEEEE1', 'contraentrega', 'v2', 1, mas(100));
const conf1 = confirmarDescontando('ped-CE1', 'v2', mas(101));
ok(ce1.ok && conf1.ok, `un pedido contra entrega se confirma con el comprador antes de despachar, y descuenta ${ce1.error ?? ''}${conf1.error ?? ''}`);
const sinFila = lote([["UPDATE pedido SET estado = 'despachado', guia = 'G-1', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-CE1'", mas(102)]]);
ok(!sinFila.ok && /contraentrega-sin-guia/.test(sinFila.error), `despachar contra entrega sin la fila del recaudo se rechaza: ${sinFila.error}`);
const d1 = despachar('ped-CE1', 'G-0001', mas(103));
ok(d1.ok && uno("SELECT estado, monto_cop FROM contraentrega WHERE pedido_id = 'ped-CE1'").monto_cop === 90000, `despachar crea el recaudo por el total del pedido ${d1.error ?? ''}`);
const entregarSinRecaudo = lote([["UPDATE pedido SET estado = 'entregado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-CE1'", mas(104)]]);
ok(!entregarSinRecaudo.ok && /contraentrega-por-recaudar/.test(entregarSinRecaudo.error), `entregar con la plata por recaudar se rechaza: ${entregarSinRecaudo.error}`);
const entregar = lote([
  ["UPDATE contraentrega SET estado = 'recaudado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND pedido_id = 'ped-CE1'", mas(105)],
  ["UPDATE pedido SET estado = 'entregado', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-CE1'", mas(105)],
]);
ok(entregar.ok, `entregar y recaudar van en el mismo lote ${entregar.error ?? ''}`);
const liquidar = lote([["UPDATE contraentrega SET liquidado = ?, liquidacion_ref = 'LQ-77', actualizado = ? WHERE org_id = 'A' AND pedido_id = 'ped-CE1'", mas(60 * 48), mas(60 * 48)]]);
ok(liquidar.ok, `la liquidación de la transportadora se anota aparte ${liquidar.error ?? ''}`);
ok(uno("SELECT COUNT(*) n FROM pedido_evento WHERE pedido_id = 'ped-CE1' AND tipo = 'recaudo' AND de = 'por_recaudar' AND a = 'recaudado'").n === 1, 'el historial del pedido registra el recaudo');

const stockAntes = variante('v2').stock;
const ce2 = pedirPorChat('ped-CE2', 'CEEEE2', 'contraentrega', 'v2', 1, mas(110));
const conf2 = confirmarDescontando('ped-CE2', 'v2', mas(111));
const d2 = despachar('ped-CE2', 'G-0002', mas(112));
const devolver = lote([
  ["UPDATE contraentrega SET estado = 'devuelto', flete_vuelta_cop = 10000, cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND pedido_id = 'ped-CE2'", mas(60 * 72)],
  ["UPDATE variante SET stock = stock + 1, cambio_motivo = 'devolucion', cambio_ref = 'ped-CE2', actualizado = ? WHERE org_id = 'A' AND id = 'v2'", mas(60 * 72)],
  ["UPDATE pedido_linea SET descontado = 0 WHERE org_id = 'A' AND pedido_id = 'ped-CE2'"],
  ["UPDATE pedido SET estado = 'devuelto', cambiado_por = 'usuario:u1', actualizado = ? WHERE org_id = 'A' AND id = 'ped-CE2'", mas(60 * 72)],
]);
ok(ce2.ok && conf2.ok && d2.ok && devolver.ok && variante('v2').stock === stockAntes, `un pedido contra entrega devuelto regresa la unidad y anota el flete de vuelta ${devolver.error ?? ''}`);
ok(uno("SELECT COUNT(*) n FROM movimiento_inventario WHERE ref = 'ped-CE2' AND motivo = 'devolucion' AND delta = 1").n === 1, 'el libro de inventario registra la devolución');
const costo = uno("SELECT monto_cop - comision_cop - flete_ida_cop - flete_vuelta_cop m FROM contraentrega WHERE pedido_id = 'ped-CE2'");
ok(costo.m === 90000 - 3213 - 20000, `el margen del devuelto descuenta comisión y los dos fletes (${costo.m}; la plata no llegó)`);

const rechaza = (nombre, sql, patron) => {
  const r = lote([[sql]]);
  ok(!r.ok && (!patron || patron.test(r.error)), `se rechaza ${nombre}: ${r.error ?? 'NO FALLÓ'}`);
};
rechaza('liquidar un recaudo devuelto', "UPDATE contraentrega SET liquidado = 'x' WHERE org_id = 'A' AND pedido_id = 'ped-CE2'", /liquidado IS NULL OR estado = 'recaudado'/);
rechaza('un recaudo devuelto que vuelve a estar por recaudar', "UPDATE contraentrega SET estado = 'por_recaudar' WHERE org_id = 'A' AND pedido_id = 'ped-CE2'", /transicion-de-contraentrega-invalida/);
rechaza('una contraentrega para un pedido que no se paga así', "INSERT INTO contraentrega (org_id, pedido_id, estado, monto_cop, cambiado_por, creado, actualizado) VALUES ('A', 'ped-W', 'por_recaudar', 168000, 'x', 'x', 'x')", /pedido-sin-contraentrega/);
rechaza('cambiar la forma de pago de un pedido ya despachado', "UPDATE pedido SET forma_pago = 'a_convenir' WHERE org_id = 'A' AND id = 'ped-CE1'", /forma-de-pago-fija/);
rechaza('un pedido confirmado a mano como pago en línea', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'x4', 'XXXXX9', 1996, 'confirmado', 'panel', 'en_linea', 1000, 1000, 'usuario:u1', 'x', 'x')", /forma_pago <> 'en_linea'/);
rechaza('un pedido por pagar sin pago en línea', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado, terminos_huella, aceptado) VALUES ('A', 'x5', 'XXXXXA', 1995, 'por_pagar', 'whatsapp', 'transferencia', 1000, 1000, 'comprador', 'x', 'x', ?, 'x')".replace('?', `'${'c'.repeat(64)}'`), /forma_pago = 'en_linea'/);
rechaza('una forma de pago que no existe', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'x6', 'XXXXXB', 1994, 'pendiente', 'whatsapp', 'trueque', 1000, 1000, 'comprador', 'x', 'x')", /FOREIGN KEY/);
// 6e. Lo que crece entra con un INSERT (R1): un facturador, un canal nuevo.
const alegra = lote([["INSERT INTO credencial (org_id, proveedor, ambiente, campo, cifrado, iv, llave_version, huella, guardada) VALUES ('A', 'alegra', 'produccion', 'token', x'00', x'000000000000000000000000', 1, 'ab12', ?)", T]]);
ok(alegra.ok, `la credencial del facturador del comercio (Alegra) entra sin rehacer tablas ${alegra.error ?? ''}`);
const pos = lote([
  ["INSERT INTO ref_canal (id, exige_aceptacion) VALUES ('pos', 0)"],
  ["INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'ped-POS', 'PPPPP1', 1990, 'confirmado', 'pos', 'efectivo', 80000, 80000, 'usuario:u1', ?, ?)", T, T],
]);
ok(pos.ok, `un canal nuevo (punto de venta) es un INSERT, y su venta en efectivo no pide aceptación web ${pos.error ?? ''}`);
rechaza('un campo de credencial que el proveedor no tiene', "INSERT INTO credencial (org_id, proveedor, ambiente, campo, cifrado, iv, llave_version, huella, guardada) VALUES ('A', 'bold', 'pruebas', 'token', x'00', x'000000000000000000000000', 1, 'x', 'x')", /FOREIGN KEY/);
rechaza('un motivo de inventario que no existe (el libro lo rechaza y el cambio no queda)', "UPDATE variante SET stock = stock - 1, cambio_motivo = 'regalo' WHERE org_id = 'A' AND id = 'v2'", /FOREIGN KEY/);
rechaza('un pedido de un canal que no existe', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'x7', 'XXXXXC', 1993, 'pendiente', 'telegrama', 1000, 1000, 'comprador', 'x', 'x')", /FOREIGN KEY/);
rechaza('un nombre corto con «--» (es de la plataforma)', "INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES ('D', 'ensayo--staging', 'X', 'borrador', 'gratis', 'x', 'x')", /CHECK/);

// 7. Negativos de integridad.
const negativos = [
  ['un total que no cuadra', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'x1', 'XXXXX5', 1999, 'pendiente', 'whatsapp', 100, 90, 'comprador', 'x', 'x')"],
  ['una línea con la variante de OTRA tienda', "INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, precio_unitario_cop, cantidad, total_cop) VALUES ('A', 'ped-W', 2, 'q1', 'w1', 'Pan', 1500, 1, 1500)"],
  ['un código con letras ambiguas (I, L, O, U)', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'x2', 'ILOU12', 1998, 'pendiente', 'whatsapp', 0, 0, 'comprador', 'x', 'x')"],
  ['un segundo cobro esperando para el mismo pedido', "INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado) VALUES ('A', 'WWWWW4-1', 'ped-W', 'bold', 'pruebas', 168000, 'esperando', 't1', 'x', 'x', 'x'), ('A', 'WWWWW4-2', 'ped-W', 'bold', 'pruebas', 168000, 'esperando', 't2', 'x', 'x', 'x')"],
  ['un cobro por debajo del mínimo de Bold', "INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado) VALUES ('A', 'WWWWW4-3', 'ped-W', 'bold', 'pruebas', 900, 'esperando', 't3', 'x', 'x', 'x')"],
  ['un cupón usado más de lo permitido', "INSERT INTO cupon (org_id, codigo, tipo, valor, usos_maximos, usos) VALUES ('A', 'BIENVENIDA', 'porcentaje', 10, 5, 6)"],
  ['un cupón de porcentaje mayor a 100', "INSERT INTO cupon (org_id, codigo, tipo, valor) VALUES ('A', 'TODO', 'porcentaje', 150)"],
  ['un precio «antes» menor que el precio', "UPDATE variante SET precio_antes_cop = 1000 WHERE org_id = 'A' AND id = 'v2'"],
  ['cambiar la cantidad de un apartado', "UPDATE apartado SET cantidad = 9 WHERE cobro_id = 'CCCCC3-1'"],
  ['reactivar un apartado cerrado', "UPDATE apartado SET estado = 'activo' WHERE cobro_id = 'AAAAA1-1'"],
  ['dos publicaciones en curso', "INSERT INTO publicacion (org_id, version, estado, pedida_por, pedida) VALUES ('A', 1, 'en_cola', 'u1', 'x'), ('A', 2, 'horneando', 'u1', 'x')"],
  ['una sección de ajustes que no existe', "INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES ('A', 'inventada', 1, '{}', 'x', 'u1')"],
  ['un slug con mayúsculas', "INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES ('C', 'Ensayo', 'X', 'borrador', 'gratis', 'x', 'x')"],
  ['un pedido en línea sin la aceptación de los términos', "INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado) VALUES ('A', 'x3', 'XXXXX7', 1997, 'por_pagar', 'en_linea', 'en_linea', 1000, 1000, 'comprador', 'x', 'x')"],
  ['confirmar un pedido de WhatsApp que la persona no aceptó', "UPDATE pedido SET estado = 'confirmado', cambiado_por = 'usuario:u1' WHERE org_id = 'A' AND id = 'ped-W'"],
  ['un producto sin retracto y sin motivo', "INSERT INTO producto (org_id, id, slug, nombre, estado, retracto, creado, actualizado) VALUES ('A', 'p9', 'pastel', 'Pastel', 'activo', 'no_aplica', 'x', 'x')"],
  ['un cobro rechazado que pasa a aprobado', "UPDATE cobro SET estado = 'aprobado' WHERE org_id = 'A' AND id = 'DDDDD8-1'"],
  ['un cobro reembolsado que vuelve a esperar', "UPDATE cobro SET estado = 'esperando' WHERE org_id = 'A' AND id = 'CCCCC3-1'"],
  ['dos solicitudes con el mismo radicado', "INSERT INTO solicitud (org_id, id, radicado, tipo, canal, estado, sobre, iv, llave_version, creada, vence) VALUES ('A', 's1', 1, 'queja', 'web', 'radicada', x'00', x'000000000000000000000000', 1, 'x', 'y'), ('A', 's2', 1, 'reclamo', 'web', 'radicada', x'00', x'000000000000000000000000', 1, 'x', 'y')"],
  ['una solicitud de un tipo que no existe', "INSERT INTO solicitud (org_id, id, radicado, tipo, canal, estado, sobre, iv, llave_version, creada, vence) VALUES ('A', 's3', 3, 'felicitacion', 'web', 'radicada', x'00', x'000000000000000000000000', 1, 'x', 'y')"],
  ['un estado de pedido que no existe', "UPDATE pedido SET estado = 'perdido', cambiado_por = 'x' WHERE org_id = 'A' AND id = 'ped-W'"],
];
for (const [nombre, sql] of negativos) {
  const r = lote([[sql]]);
  ok(!r.ok, `se rechaza ${nombre}: ${r.error ?? 'NO FALLÓ'}`);
}

ok(db.prepare('PRAGMA foreign_key_check').all().length === 0, 'sin filas huérfanas');
ok(uno('PRAGMA integrity_check').integrity_check === 'ok', 'integrity_check = ok');
const sinOrg = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'ref_%' AND name NOT LIKE 'sqlite_%'").all()
  .map((t) => t.name).filter((t) => !db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'org_id'));
ok(sinOrg.length === 0, `toda tabla de datos lleva org_id ${sinOrg.join(', ')}`);
const cascadas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
  .flatMap((t) => db.prepare(`PRAGMA foreign_key_list(${t.name})`).all().filter((f) => f.on_delete !== 'NO ACTION').map((f) => `${t.name}→${f.table}`));
ok(cascadas.length === 0, `ninguna clave foránea con ON DELETE ${cascadas.join(', ')}`);

// Base de control.
const ctl = new DatabaseSync(':memory:');
ctl.exec(readFileSync(archivoControl, 'utf8'));
ctl.exec("INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado) VALUES ('ensayo-uno.laboratorio-digital.app', 'A', 'c1', 'plataforma', 'canonico', 'activo', 'x')");
const dosCanonicos = (() => { try { ctl.exec("INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado) VALUES ('www.ensayo-uno.example', 'A', 'c1', 'propio', 'canonico', 'activo', 'x')"); return false; } catch { return true; } })();
ok(dosCanonicos, 'la base de control no deja dos canónicos activos en una tienda');
const hostMalo = (() => { try { ctl.exec("INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado) VALUES ('Tienda.Example', 'A', 'c1', 'propio', 'alias', 'pendiente', 'x')"); return false; } catch { return true; } })();
ok(hostMalo, 'la base de control no acepta un hostname con mayúsculas');
const falla = (base, sql) => { try { base.exec(sql); return null; } catch (e) { return e.message; } };
ctl.exec("INSERT INTO slug (slug, org_id, celda_id, creado) VALUES ('ensayo-uno', 'A', 'c1', 'x')");
const tomarReservado = falla(ctl, "INSERT INTO slug (slug, org_id, celda_id, creado) VALUES ('panel', 'B', 'c1', 'x')");
ok(/slug-reservado/.test(tomarReservado ?? ''), `una tienda no toma un nombre reservado de la plataforma: ${tomarReservado}`);
const reservarTomado = falla(ctl, "INSERT INTO slug_reservado (slug, motivo) VALUES ('ensayo-uno', 'proyecto')");
ok(/slug-en-uso/.test(reservarTomado ?? ''), `un proyecto nuevo no reserva el nombre de una tienda que ya existe: ${reservarTomado}`);
ok(falla(ctl, "INSERT INTO slug_reservado (slug, motivo) VALUES ('proyecto-nuevo', 'proyecto')") === null, 'un proyecto nuevo reserva su nombre en <nombre>.laboratorio-digital.app');
const dobleGuion = falla(ctl, "INSERT INTO slug (slug, org_id, celda_id, creado) VALUES ('ensayo-dos--staging', 'B', 'c1', 'x')");
ok(/CHECK/.test(dobleGuion ?? ''), `un nombre con «--» queda para la plataforma: ${dobleGuion}`);
const motivoMalo = falla(ctl, "INSERT INTO slug_reservado (slug, motivo) VALUES ('otro', 'capricho')");
ok(/FOREIGN KEY/.test(motivoMalo ?? '') || /FOREIGN KEY/.test(String(motivoMalo)), `un motivo de reserva que no existe: ${motivoMalo}`);

console.log(fallas === 0 ? '\nTODO EN VERDE' : `\n${fallas} FALLA(S)`);
process.exit(fallas === 0 ? 0 : 1);
