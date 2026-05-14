# SimpleAPI RCV — cliente

Módulo Node para consultar el **Registro de Compras y Ventas (RCV)** del SII de Chile vía [SimpleAPI](https://www.simpleapi.cl/Productos/SimpleRCV).

## ⚠️ Importante: server-side ÚNICAMENTE

Este proyecto es un frontend Vite/React. **No importes este módulo desde `src/`.**
Vite empaqueta cualquier código bajo `src/` y enviaría tu API key + clave SII al
navegador, donde cualquier visitante puede leerlas con DevTools.

Úsalo solo desde:
- Scripts Node locales (como `scripts/test-simpleapi-rcv.js`)
- Un backend / función serverless propio que actúe de proxy

## Configuración

1. Copia el template:

   ```sh
   cp .env.example .env
   ```

2. Edita `.env` con tus valores reales (RUT empresa, clave SII, API key SimpleAPI).
   El archivo `.env` está en `.gitignore` — **nunca** lo subas al repo.

Variables:

| Variable | Requerida | Descripción |
|---|---|---|
| `SIMPLEAPI_BASE_URL` | no | Por defecto `https://api.simpleapi.cl` |
| `SIMPLEAPI_API_KEY` | sí | API key emitida por SimpleAPI |
| `SII_RUT_EMPRESA` | sí | RUT de la empresa (formato `12345678-9`) |
| `SII_PASSWORD` | sí | Clave SII de la empresa |
| `SII_RUT_USUARIO` | no | RUT del usuario que firma en SII si es distinto al de la empresa |
| `SII_AMBIENTE` | no | `1` producción (default), `0` certificación |
| `SIMPLEAPI_VENTAS_PATH` | no | Path con placeholder `{periodo}`. Por defecto `/sii/rcv/ventas/resumen/{periodo}` |
| `SIMPLEAPI_COMPRAS_PATH` | no | Análogo para compras |

## Uso programático

```js
import { createRcvClient } from './server/simpleapi/rcv.js';

const client = createRcvClient(); // lee credenciales desde process.env

// Ventas de marzo 2026
const ventas = await client.getVentas({ year: 2026, month: 3 });

// Compras de marzo 2026
const compras = await client.getCompras({ year: 2026, month: 3 });
```

También puedes pasar credenciales explícitas en vez de leerlas del entorno:

```js
const client = createRcvClient({
  apiKey: '...',
  rutEmpresa: '11111111-1',
  password: '...',
});
```

## Script de prueba

Requiere Node 20.6+ (para `--env-file`):

```sh
node --env-file=.env scripts/test-simpleapi-rcv.js
```

En Node más antiguo, instala `dotenv` y carga manualmente, o exporta las variables
antes de correr (`$env:SIMPLEAPI_API_KEY="..."` en PowerShell).

El script consulta el mes actual y muestra ventas y compras (resumen + primeros
3 items si la respuesta es una lista).

## Verificar contra la documentación oficial

Las rutas de endpoint por defecto (`/sii/rcv/ventas/resumen/{periodo}`,
`/sii/rcv/compras/resumen/{periodo}`) siguen la convención común de SimpleAPI,
**pero no fueron verificadas contra la documentación oficial al momento de
escribir este módulo** (la doc vive en un Postman SPA que requiere navegador).

Si recibes 404 o 405:
1. Abre [documentacion.simpleapi.cl](https://documentacion.simpleapi.cl/) en el navegador.
2. Busca los endpoints de RCV (ventas / compras) y copia el path exacto.
3. Sobreescribe en tu `.env`:
   ```
   SIMPLEAPI_VENTAS_PATH=/ruta/correcta/{periodo}
   SIMPLEAPI_COMPRAS_PATH=/ruta/correcta/{periodo}
   ```
   (mantén `{periodo}` como placeholder; el cliente lo reemplaza por `YYYYMM`).

Si la doc oficial usa otros nombres de campos en el body (p.ej. `Rut` en vez de
`RutEmpresa`), edita la función `request()` en [rcv.js](rcv.js).

## Estructura de respuesta

SimpleAPI devuelve JSON tal como lo expone el portal RCV del SII. La forma
exacta depende del endpoint (resumen vs detalle); el cliente devuelve el JSON
parseado tal cual sin transformarlo.
