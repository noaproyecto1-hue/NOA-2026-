# NOA — Copiloto de administración gastronómica

Plataforma local para administrar restaurantes/cafeterías: inventario, recetas, ventas, RRHH, dashboard, integraciones SII (Chile) y Fudo POS, y un copilot IA.

Originalmente una app Base44 hosted, migrada a **modo 100 % local** — corre todo en tu máquina sin depender de Base44, con un mock del SDK que persiste datos en `localStorage`.

## Quick start

```bash
git clone https://github.com/marcialsilvapacheco/noa-ai.git
cd noa-ai
npm install
cp .env.example .env       # completa los valores reales (ver más abajo)
npm run dev                # http://localhost:5173
```

Login por defecto: **`cesar` / `1234`** (rol manager). Puedes cambiarlo desde *Settings → Colaboradores*.

## Stack

- **Vite + React 18** (JavaScript/JSX) — frontend
- **Tailwind CSS** + Shadcn UI — sistema de diseño NOA
- **TanStack Query** — fetching/caching
- **localStorage** — DB local (mock del SDK Base44)
- **Vite middleware** — proxies server-side para llamadas con secretos (SII, Fudo, LLM, Email)

## Variables de entorno

Copia `.env.example` a `.env` y completa según uses cada integración. **Nunca commitees el `.env`** — está en `.gitignore`.

| Sistema | Variables |
|---|---|
| **SII (Chile)** | `SIMPLEAPI_API_KEY`, `SII_RUT_EMPRESA`, `SII_RUT_CERTIFICADO`, `SII_PASSWORD`, `SII_CERT_PATH`, `SII_AMBIENTE` |
| **Fudo POS** | `FUDO_API_KEY`, `FUDO_API_SECRET` |
| **Base44 (legacy)** | `VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL` (opcional, ignoradas en modo local) |

### SII — cómo conseguir las credenciales

1. **Certificado digital `.pfx`** — compra en [E-CERTCHILE](https://www.e-certchile.cl), [Acepta](https://www.acepta.com) u otra entidad acreditada. Te entregan el archivo y una contraseña. Es el mismo certificado para firmar DTEs.
2. **API Key SimpleAPI** — registro en [simpleapi.cl](https://simpleapi.cl). SimpleAPI hace de puente entre tu app y el SII.
3. **Pon el `.pfx` en `certs/sii-cert.pfx`** (la carpeta `certs/` está en `.gitignore`).
4. Llena `SII_RUT_EMPRESA` (la empresa a consultar) y `SII_RUT_CERTIFICADO` (RUT del titular del .pfx — viene dentro del certificado).
5. **Alternativa por UI**: corre la app, ve a **Settings → Integraciones → SII → Cambiar credenciales** y sube el `.pfx` desde el navegador. Quedan en `localStorage` como overrides del `.env`.

### Fudo — cómo conseguir las credenciales

1. En el panel Fudo: **Administración → Aplicaciones Externas → Nueva Aplicación Externa**.
2. Copia el **Client ID** (corto, base64) y el **Client Secret** (largo, alfanumérico).
3. **⚠️ Los campos van invertidos** respecto a las etiquetas del panel Fudo. En tu `.env` usa:
   - `FUDO_API_KEY` = el "Client Secret" del panel Fudo
   - `FUDO_API_SECRET` = el "Client ID" del panel Fudo
4. **Alternativa por UI**: ingrésalas en **Settings → Integraciones → Fudo POS** (la UI explica el intercambio en el card amarillo).

Verificado contra `auth.fu.do/api` con el mismo flujo que usaba Base44 originalmente.

### IA (NOA Copilot)

Compatible con Anthropic Claude, OpenAI, Google Gemini y DeepSeek. Configura tu API key en **Settings → Integraciones → Inteligencia Artificial**. Se guarda en `localStorage` (no en `.env`).

### Email (Gmail SMTP)

Activa 2FA en tu cuenta Google y genera un *App Password* en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Configúralo en **Settings → Integraciones → Email vía Gmail**.

## Conectar a una base de datos real

Por defecto la app usa `localStorage` como base de datos (clave `mock_b44_<Entity>`). Para migrar a una BD real (PostgreSQL, Supabase, etc.):

1. Reemplaza `src/api/base44-mock/store.js` por un cliente que apunte a tu BD.
2. Las entidades (`User`, `Restaurant`, `Sale`, `Recipe`, `SupplyItem`, etc.) están definidas en `base44/entities/*.jsonc` — úsalas como esquema de tablas.
3. La interfaz pública del SDK está en `src/api/base44-mock/index.js` — mantenla igual y solo cambia la implementación de `store`.
4. Migra `src/api/base44-mock/functions-local.js` (cloud functions) a serverless functions (Vercel, Supabase Edge, etc.) si quieres que corran server-side.

## Estructura del proyecto

```
src/
  api/base44-mock/    Mock del SDK Base44 (auth, entities, functions, agents)
  pages/              Rutas principales (Dashboard, Inventory, Sales, SII, Settings, ...)
  components/         Componentes UI agrupados por feature
  lib/                AuthContext, integrations helper, utils
server/
  simpleapi/rcv.js    Cliente Node para consultar SII vía SimpleAPI
  integrations/
    fudo.js           Cliente Fudo (auth.fu.do/api + api.fu.do/v1alpha1)
    llm.js            Cliente unificado de LLMs (Anthropic/OpenAI/Gemini/DeepSeek)
    email.js          Nodemailer + Gmail SMTP
base44/               Código original Base44 (functions, entities, agents) — referencia
certs/                Tu .pfx local (gitignored)
```

## Deploy a producción

Vite está configurado para `npm run build` → `dist/`. En Vercel:

1. Importa el repo.
2. Variables de entorno: copia las del `.env` al panel Vercel (Settings → Environment Variables).
3. Para los proxies server-side (`/__sii/*`, `/__fudo/*`, `/__llm/*`, `/__email/*`) hay que migrar el código de `vite.config.js > integrationsProxyPlugin` a serverless functions en `api/`.

## License

Privado. Uso interno.
