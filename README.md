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

## Deploy a producción (Vercel)

El repo ya incluye **serverless functions** en `api/` que replican los endpoints server-side. En `npm run dev` se usan los middlewares de Vite; en Vercel se usan los archivos de `api/`. El frontend hace `fetch('/__fudo/...')` en ambos casos y un `vercel.json` con `rewrites` mapea esas rutas a `/api/__fudo/...`.

### Pasos para deployar

1. **Importa el repo en Vercel** (Framework: Vite, detectado automático).
2. **Configura las Environment Variables** en *Project Settings → Environment Variables*. Marca cada una para los 3 entornos (Production, Preview, Development) según necesites:

   | Variable | Ejemplo | Notas |
   |---|---|---|
   | `SIMPLEAPI_API_KEY` | `XXXX-XXXX-XXXX-XXXX-XXXX` | tu API key de SimpleAPI |
   | `SII_RUT_EMPRESA` | `77123456-7` | RUT de la empresa a consultar |
   | `SII_RUT_CERTIFICADO` | `12345678-9` | RUT del titular del .pfx |
   | `SII_PASSWORD` | `tu-clave-pfx` | contraseña del .pfx |
   | `SII_AMBIENTE` | `1` | 1=producción, 2=certificación |
   | `SII_CERT_BASE64` | `MIIKgQIBAzCC...` | **el .pfx codificado en base64** (ver abajo) |
   | `FUDO_API_KEY` | string corto base64 | el "Client Secret" del panel Fudo |
   | `FUDO_API_SECRET` | string largo alfanumérico | el "Client ID" del panel Fudo |

3. **Redeploy** después de guardar las variables (Vercel solo las aplica en builds nuevos).

### Cómo codificar el `.pfx` en base64

El filesystem de Vercel es read-only, así que el `.pfx` debe viajar como env var. En PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certs\sii-cert.pfx")) | clip
# Pega el contenido del clipboard en la variable SII_CERT_BASE64 de Vercel
```

En Linux/macOS:

```bash
base64 -w0 certs/sii-cert.pfx | xclip -selection clipboard
```

> Después del redeploy, en *Settings → Integraciones → SII* la app reportará `Cert source: base64-env` y podrás "Probar conexión SII".

### Limitaciones en Vercel

- **No se puede subir el `.pfx` desde la UI** (filesystem read-only). El endpoint `/__sii/upload-cert` devuelve un mensaje explicando cómo configurar `SII_CERT_BASE64`.
- **localStorage** sigue siendo la BD del frontend — cada navegador tiene sus propios datos. Para multi-usuario o multi-dispositivo necesitas migrar a una BD real (ver sección siguiente).

## License

Privado. Uso interno.
