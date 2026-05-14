// Prueba de SimpleAPI RCV: consulta ventas y compras del mes actual.
//
// Uso (Node 20.6+):
//   node --env-file=.env scripts/test-simpleapi-rcv.js
//
// Node más viejo: instala dotenv y ajusta el require, o exporta las vars
// manualmente antes de correr.

import { createRcvClient } from '../server/simpleapi/rcv.js';

function summarize(label, data) {
  console.log(`\n===== ${label} =====`);
  if (data == null) {
    console.log('(sin datos)');
    return;
  }
  if (Array.isArray(data)) {
    console.log(`Items: ${data.length}`);
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
    if (data.length > 3) console.log(`... (${data.length - 3} más)`);
    return;
  }
  console.log(JSON.stringify(data, null, 2).slice(0, 4000));
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  console.log(`Consultando RCV período ${year}-${String(month).padStart(2, '0')}`);

  const client = createRcvClient();
  console.log('Configuración:', client._internals);

  try {
    const ventas = await client.getVentas({ year, month });
    summarize('VENTAS', ventas);
  } catch (err) {
    console.error('Error consultando ventas:', err.message);
    if (err.body) console.error('Respuesta SimpleAPI:', err.body);
  }

  try {
    const compras = await client.getCompras({ year, month });
    summarize('COMPRAS', compras);
  } catch (err) {
    console.error('Error consultando compras:', err.message);
    if (err.body) console.error('Respuesta SimpleAPI:', err.body);
  }
}

main().catch((err) => {
  console.error('Fallo inesperado:', err);
  process.exit(1);
});
