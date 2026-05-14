// Modo local: el cliente real de Base44 está reemplazado por un mock que
// vive en `./base44-mock/`. Datos en localStorage, usuario fijo demo@local,
// cloud functions y agentes stubeados.
//
// Para volver al SDK real:
//   1. import { createClient } from '@base44/sdk'
//   2. Reescribir esta exportación como antes.
//   3. Configurar VITE_BASE44_APP_ID y VITE_BASE44_APP_BASE_URL.

export { base44 } from './base44-mock/index.js';
