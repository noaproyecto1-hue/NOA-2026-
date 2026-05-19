import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sparkles, Store, Mail, Save, CheckCircle2, AlertCircle, Eye, EyeOff, Loader, FileKey, Building2, Copy } from 'lucide-react';
import {
  AI_PROVIDERS, loadIntegrations, updateIntegration, isConfigured,
} from '@/lib/integrations';

function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function StatusBadge({ ok }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" /> Configurado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
      <AlertCircle className="w-3 h-3" /> Sin configurar
    </span>
  );
}

function SiiSection({ siiCfg, onPatch }) {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showOverrides, setShowOverrides] = useState(false);

  async function refreshStatus() {
    setLoadingStatus(true);
    try {
      const r = await fetch('/__sii/status');
      setStatus(await r.json());
    } catch (e) {
      setStatus({ error: e.message });
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => { refreshStatus(); }, []);

  // Si hay algún override seteado, abre el panel automáticamente.
  useEffect(() => {
    const hasAnyOverride = Object.values(siiCfg || {}).some((v) => v && String(v).trim() !== '');
    if (hasAnyOverride) setShowOverrides(true);
  }, []);

  function buildOverridePayload() {
    const out = {};
    for (const k of ['rutEmpresa', 'rutCertificado', 'password', 'apiKey', 'ambiente', 'certBase64']) {
      if (siiCfg?.[k]) out[k] = siiCfg[k];
    }
    return out;
  }

  async function testSii() {
    setTesting(true);
    setTestResult(null);
    try {
      const overrides = buildOverridePayload();
      const res = await fetch('/__sii/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleCertUpload(file) {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // btoa(String.fromCharCode(...bytes)) puede romper para archivos grandes
      // (límite de argumentos). Iteramos en chunks para evitar el problema.
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      if (base64.length < 100) throw new Error('Archivo demasiado pequeño, ¿es un .pfx válido?');

      // Guardamos el cert en localStorage como override (igual que los otros
      // campos). En cada request al SII viaja como parte del body.
      // Esto funciona tanto en local como en Vercel sin tocar el filesystem.
      onPatch({ certBase64: base64, certFileName: file.name, certSize: buf.byteLength });

      setUploadResult({
        ok: true,
        message: `Certificado cargado en este navegador (${(buf.byteLength / 1024).toFixed(1)} KB). Quedó como override local — se enviará al servidor en cada request.`,
      });
    } catch (err) {
      setUploadResult({ ok: false, message: err.message });
    } finally {
      setUploading(false);
    }
  }

  const certAvailable = Boolean(siiCfg?.certBase64) || status?.certExists;
  const passwordAvailable = Boolean(siiCfg?.password) || status?.passwordSet;
  const rutEmpresaAvailable = Boolean(siiCfg?.rutEmpresa) || status?.rutEmpresa;
  const rutCertAvailable = Boolean(siiCfg?.rutCertificado) || status?.rutCertificado;
  const isConfigured = certAvailable && passwordAvailable && rutEmpresaAvailable && rutCertAvailable;
  const fmtBytes = (n) => `${(n / 1024).toFixed(1)} KB`;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('es-CL') : '—';

  // Cuál es el valor "efectivo" (lo que se enviará): override si existe, sino el del .env mostrado en status.
  const eff = (k, fallback) => (siiCfg?.[k] && String(siiCfg[k]).trim()) || fallback || '—';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle>SII — Servicio de Impuestos Internos (Chile)</CardTitle>
              <CardDescription>Consulta el RCV (Registro de Compras y Ventas) vía SimpleAPI con tu certificado digital.</CardDescription>
            </div>
          </div>
          <StatusBadge ok={isConfigured} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="border-emerald-200 bg-emerald-50">
          <FileKey className="w-4 h-4 text-emerald-700" />
          <AlertTitle className="text-sm">Cómo conseguir las credenciales</AlertTitle>
          <AlertDescription className="text-xs space-y-2 mt-1">
            <div>
              <p className="font-semibold">1) Certificado digital (.pfx)</p>
              <p>
                Compra un certificado tributario en{' '}
                <a className="underline" href="https://www.e-certchile.cl" target="_blank" rel="noreferrer">E-CERTCHILE</a>,{' '}
                <a className="underline" href="https://www.acepta.com" target="_blank" rel="noreferrer">Acepta</a>{' '}
                u otra entidad acreditada. Te entregarán un archivo <code>.pfx</code> y una contraseña.
                Es el mismo certificado que usas para firmar Documentos Tributarios Electrónicos.
              </p>
            </div>
            <div>
              <p className="font-semibold">2) API Key de SimpleAPI</p>
              <p>
                Regístrate en <a className="underline" href="https://simpleapi.cl" target="_blank" rel="noreferrer">simpleapi.cl</a>{' '}
                y obtén tu API Key desde el panel. SimpleAPI hace de puente entre NOA y el SII.
              </p>
            </div>
            <div>
              <p className="font-semibold">3) RUTs y datos</p>
              <ul className="list-disc pl-5">
                <li><strong>RUT empresa</strong>: el RUT del local que quieres consultar.</li>
                <li><strong>RUT certificado</strong>: el RUT del titular del .pfx (persona natural — viene dentro del certificado).</li>
                <li><strong>Contraseña</strong>: la del archivo <code>.pfx</code> (la entrega quien emite el certificado).</li>
                <li><strong>Ambiente</strong>: 1 = producción, 2 = certificación.</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        <Alert variant="default" className="border-blue-200 bg-blue-50">
          <AlertCircle className="w-4 h-4 text-blue-700" />
          <AlertTitle className="text-sm">Cómo configurarlo en NOA</AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-1">
            <p>
              Las credenciales del SII viven en el archivo <code>.env</code> y el certificado en{' '}
              <code>certs/sii-cert.pfx</code> (en la raíz del proyecto). En modo local no se ingresan
              por la UI porque incluyen un archivo binario.
            </p>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Copia tu <code>.pfx</code> al folder <code>certs/</code> con el nombre <code>sii-cert.pfx</code>.</li>
              <li>Edita <code>.env</code> y completa <code>SII_RUT_EMPRESA</code>, <code>SII_RUT_CERTIFICADO</code>,
                <code>SII_PASSWORD</code>, <code>SIMPLEAPI_API_KEY</code>.</li>
              <li>Reinicia el servidor (<code>npm run dev</code>) para que cargue los nuevos valores.</li>
            </ol>
          </AlertDescription>
        </Alert>

        {loadingStatus ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader className="w-4 h-4 animate-spin" /> Leyendo estado del servidor...
          </div>
        ) : status?.error ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-700 text-sm">{status.error}</AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <p className="text-xs font-semibold px-3 py-2 border-b bg-gray-50 text-gray-700">
              Configuración efectiva (lo que se usará al consultar el SII)
            </p>
            <div className="divide-y text-sm">
              <SiiRow label="RUT empresa" value={eff('rutEmpresa', status.rutEmpresa)} ok={Boolean(status.rutEmpresa || siiCfg?.rutEmpresa)} overridden={Boolean(siiCfg?.rutEmpresa)} />
              <SiiRow label="RUT del certificado" value={eff('rutCertificado', status.rutCertificado)} ok={Boolean(status.rutCertificado || siiCfg?.rutCertificado)} overridden={Boolean(siiCfg?.rutCertificado)} />
              <SiiRow label="Contraseña del .pfx" value={(siiCfg?.password || status.passwordSet) ? '•••••••• (definida)' : 'No definida'} ok={Boolean(siiCfg?.password) || status.passwordSet} overridden={Boolean(siiCfg?.password)} />
              <SiiRow
                label="Certificado .pfx"
                value={
                  siiCfg?.certBase64
                    ? `${siiCfg.certFileName || 'cert local'} (${fmtBytes(siiCfg.certSize || 0)}, override en este navegador)`
                    : status.certExists
                      ? `${status.certPath}${status.certSize ? ` (${fmtBytes(status.certSize)}${status.certMtime ? `, ${fmtDate(status.certMtime)}` : ''})` : ''}`
                      : `No encontrado en ${status.certPath || 'el servidor'}`
                }
                ok={Boolean(siiCfg?.certBase64) || status.certExists}
                overridden={Boolean(siiCfg?.certBase64)}
              />
              <SiiRow label="API Key SimpleAPI" value={siiCfg?.apiKey ? `${siiCfg.apiKey.slice(0, 4)}••••${siiCfg.apiKey.slice(-4)}` : (status.apiKey || '—')} ok={Boolean(status.apiKey || siiCfg?.apiKey)} overridden={Boolean(siiCfg?.apiKey)} />
              <SiiRow label="Ambiente" value={(siiCfg?.ambiente || status.ambiente) == 2 ? 'Certificación (2)' : 'Producción (1)'} ok={Boolean(siiCfg?.ambiente || status.ambiente)} overridden={Boolean(siiCfg?.ambiente)} />
            </div>
          </div>
        )}

        {/* Toggle del panel de overrides */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900">Usar otras credenciales</p>
            <p className="text-xs text-gray-500">Útil si pasas el programa a otro usuario o local con su propio RUT y certificado.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOverrides((s) => !s)}
          >
            {showOverrides ? 'Ocultar' : 'Cambiar credenciales'}
          </Button>
        </div>

        {showOverrides && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
            <p className="text-xs text-emerald-800">
              Los campos vacíos heredan del <code>.env</code>. Solo se usan los que completes aquí.
              Para volver al original, vacía el campo y guarda. Para borrar todo de golpe, usa el botón al final.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sii-rut-empresa">RUT empresa</Label>
                <Input
                  id="sii-rut-empresa"
                  value={siiCfg?.rutEmpresa || ''}
                  onChange={(e) => onPatch({ rutEmpresa: e.target.value.trim() })}
                  placeholder={status?.rutEmpresa || '77123456-7'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sii-rut-cert">RUT del certificado</Label>
                <Input
                  id="sii-rut-cert"
                  value={siiCfg?.rutCertificado || ''}
                  onChange={(e) => onPatch({ rutCertificado: e.target.value.trim() })}
                  placeholder={status?.rutCertificado || '12345678-9'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sii-password">Contraseña del .pfx</Label>
                <PasswordInput
                  id="sii-password"
                  value={siiCfg?.password || ''}
                  onChange={(v) => onPatch({ password: v })}
                  placeholder="contraseña que entrega la entidad certificadora"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sii-apikey">API Key SimpleAPI</Label>
                <PasswordInput
                  id="sii-apikey"
                  value={siiCfg?.apiKey || ''}
                  onChange={(v) => onPatch({ apiKey: v.trim() })}
                  placeholder={status?.apiKey || 'XXXX-XXXX-XXXX-XXXX'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sii-ambiente">Ambiente</Label>
                <Select
                  value={siiCfg?.ambiente ? String(siiCfg.ambiente) : ''}
                  onValueChange={(v) => onPatch({ ambiente: v })}
                >
                  <SelectTrigger><SelectValue placeholder={`heredar del .env (${status?.ambiente === 2 ? 'Certificación' : 'Producción'})`} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Producción (1)</SelectItem>
                    <SelectItem value="2">Certificación (2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-emerald-200">
              <Label className="text-sm font-medium">Reemplazar certificado .pfx</Label>
              <p className="text-xs text-gray-600">
                Sube el archivo <code>.pfx</code> de la nueva persona. Se guarda en este navegador
                (<code>localStorage</code>) y viaja con cada consulta al SII como override del cert
                que esté en el servidor.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  onChange={(e) => handleCertUpload(e.target.files?.[0])}
                  disabled={uploading}
                  className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 file:cursor-pointer"
                />
                {uploading && <Loader className="w-4 h-4 animate-spin text-emerald-600" />}
              </div>
              {uploadResult && (
                <Alert className={uploadResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <AlertCircle className={`w-4 h-4 ${uploadResult.ok ? 'text-green-600' : 'text-red-600'}`} />
                  <AlertDescription className={uploadResult.ok ? 'text-green-700 text-xs' : 'text-red-700 text-xs'}>
                    {uploadResult.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-emerald-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('¿Borrar todos los overrides locales? Volverá a usar lo del .env / Vercel env vars.')) {
                    onPatch({ rutEmpresa: '', rutCertificado: '', password: '', apiKey: '', ambiente: '', certBase64: '', certFileName: '', certSize: 0 });
                  }
                }}
              >
                Borrar overrides locales
              </Button>
            </div>
          </div>
        )}

        <Button
          onClick={testSii}
          disabled={testing || !isConfigured}
          className="w-full"
          variant={testResult?.ok ? 'default' : 'outline'}
        >
          {testing ? (
            <><Loader className="w-4 h-4 mr-2 animate-spin" /> Consultando SII (puede tardar 10-30s)...</>
          ) : (
            'Probar conexión SII'
          )}
        </Button>

        {testResult && (
          <Alert className={testResult.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertCircle className={`w-4 h-4 ${testResult.ok ? 'text-green-600' : 'text-red-600'}`} />
            <AlertDescription className={testResult.ok ? 'text-green-700 text-sm' : 'text-red-700 text-sm'}>
              {testResult.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SiiRow({ label, value, ok, overridden }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="text-xs text-gray-500 min-w-[140px]">{label}</span>
      <div className="flex items-center gap-2 flex-1 justify-end text-right">
        <span className="text-xs font-mono text-gray-800 break-all">{value}</span>
        {overridden && (
          <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded px-1.5 py-0.5 shrink-0">
            override
          </span>
        )}
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
      </div>
    </div>
  );
}

function FudoTestButton({ cfg }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  async function testConnection() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/__fudo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: cfg.apiKey || undefined,
          apiSecret: cfg.apiSecret || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || `Error ${res.status}` });
      } else {
        setResult({ ok: true, message: data.message || 'Conexión exitosa' });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  const hasCreds = cfg.apiKey && cfg.apiSecret;

  return (
    <div className="space-y-2">
      <Button
        onClick={testConnection}
        disabled={!hasCreds || testing}
        className="w-full"
        variant={result?.ok ? 'default' : 'outline'}
      >
        {testing ? (
          <>
            <Loader className="w-4 h-4 mr-2 animate-spin" /> Probando...
          </>
        ) : (
          'Probar conexión Fudo'
        )}
      </Button>
      {result && (
        <Alert className={result.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <AlertCircle className={`w-4 h-4 ${result.ok ? 'text-green-600' : 'text-red-600'}`} />
          <AlertDescription className={result.ok ? 'text-green-700' : 'text-red-700'}>
            {result.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default function IntegrationsSettings() {
  const [cfg, setCfg] = useState(loadIntegrations());
  const [savedAt, setSavedAt] = useState(null);
  const [serverSync, setServerSync] = useState({ available: false, lastPushedAt: null, lastError: null });
  const pushTimerRef = useRef(null);

  // Al montar: 1) leer localStorage; 2) leer config compartida del server; merge.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const local = loadIntegrations();
      if (cancelled) return;
      setCfg(local);

      try {
        const res = await fetch('/__config');
        const data = await res.json();
        if (cancelled) return;
        if (!data.available) {
          setServerSync({ available: false, lastPushedAt: null, lastError: null });
          return;
        }
        setServerSync({ available: true, lastPushedAt: null, lastError: null });
        // Server gana SOLO para campos que el server tiene definidos.
        // Esto permite a un usuario nuevo entrar y heredar todo sin configurar nada.
        const merged = { ...local };
        for (const section of ['sii', 'fudo', 'ai', 'gmail', 'agent']) {
          if (data.config?.[section]) {
            merged[section] = { ...(local[section] || {}), ...data.config[section] };
          }
        }
        // Persiste el merge en localStorage para que se vea reflejado.
        for (const section of Object.keys(merged)) {
          updateIntegration(section, merged[section]);
        }
        setCfg(merged);
      } catch (err) {
        // El endpoint puede no existir en local dev sin esos cambios; lo ignoramos.
        if (!cancelled) setServerSync({ available: false, lastPushedAt: null, lastError: err.message });
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Push debounced a /api/config (solo si KV está disponible).
  function schedulePushToServer(fullCfg) {
    if (!serverSync.available) return;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/__config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullCfg),
        });
        const data = await res.json();
        setServerSync((s) => ({ ...s, lastPushedAt: Date.now(), lastError: data.ok ? null : data.message }));
      } catch (err) {
        setServerSync((s) => ({ ...s, lastError: err.message }));
      }
    }, 1000);
  }

  function patch(section, patch) {
    const next = updateIntegration(section, patch);
    setCfg(next);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
    schedulePushToServer(next);
  }

  const aiOk = isConfigured('ai');
  const fudoOk = isConfigured('fudo');
  const gmailOk = isConfigured('gmail');

  return (
    <div className="space-y-6">
      {savedAt && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg">
          <CheckCircle2 className="w-4 h-4" /> Guardado
        </div>
      )}

      {serverSync.available ? (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <AlertTitle className="text-emerald-900">Sincronización compartida activa</AlertTitle>
          <AlertDescription className="text-sm text-emerald-800">
            Las credenciales se guardan en el servidor (Vercel KV) y se cargan automáticamente
            para cualquier usuario que abra sesión. Cambios locales se sincronizan al server
            tras 1 segundo de inactividad.
            {serverSync.lastPushedAt && (
              <span className="text-xs block mt-1 text-emerald-700">
                Última sincronización: {new Date(serverSync.lastPushedAt).toLocaleTimeString('es-CL')}
              </span>
            )}
            {serverSync.lastError && (
              <span className="text-xs block mt-1 text-red-700">⚠ {serverSync.lastError}</span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Solo guardado local</AlertTitle>
          <AlertDescription className="text-sm">
            Las credenciales se guardan en <code>localStorage</code> de este navegador y NO se
            comparten con otros usuarios. Para sincronizar entre todos los usuarios, activa{' '}
            <strong>Vercel KV</strong>: Vercel Dashboard → Storage → Create Database → KV →
            Connect to project. Después de un redeploy, esta sección se pondrá en verde.
          </AlertDescription>
        </Alert>
      )}

      {/* IA Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Inteligencia Artificial (NOA Copilot)</CardTitle>
                <CardDescription>Provee la API key del proveedor de IA que quieras usar.</CardDescription>
              </div>
            </div>
            <StatusBadge ok={aiOk} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <Select
                value={cfg.ai.provider}
                onValueChange={(v) => patch('ai', { provider: v, model: AI_PROVIDERS.find((p) => p.id === v)?.defaultModel || '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-model">Modelo (opcional)</Label>
              <Input
                id="ai-model"
                value={cfg.ai.model}
                onChange={(e) => patch('ai', { model: e.target.value })}
                placeholder={AI_PROVIDERS.find((p) => p.id === cfg.ai.provider)?.defaultModel || ''}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-key">API Key</Label>
            <PasswordInput
              id="ai-key"
              value={cfg.ai.apiKey}
              onChange={(v) => patch('ai', { apiKey: v })}
              placeholder={cfg.ai.provider === 'anthropic' ? 'sk-ant-...' : cfg.ai.provider === 'openai' ? 'sk-...' : 'API key'}
            />
            <p className="text-xs text-gray-500">
              {cfg.ai.provider === 'anthropic' && <>Obtén tu key en <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a></>}
              {cfg.ai.provider === 'openai' && <>Obtén tu key en <a className="underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com</a></>}
              {cfg.ai.provider === 'gemini' && <>Obtén tu key en <a className="underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com</a></>}
              {cfg.ai.provider === 'deepseek' && <>Obtén tu key en <a className="underline" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">platform.deepseek.com</a></>}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Fudo POS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <Store className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Fudo POS</CardTitle>
                <CardDescription>Sincronización de ventas desde tu sistema de punto de venta Fudo.</CardDescription>
              </div>
            </div>
            <StatusBadge ok={fudoOk} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="border-blue-200 bg-blue-50">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle className="text-sm">Cómo conseguir las credenciales</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1">
              <p>
                1. Inicia sesión en el panel de Fudo y ve a{' '}
                <strong>Administración → Aplicaciones Externas → Nueva Aplicación Externa</strong>.
              </p>
              <p>2. Asigna un nombre (ej. <em>"NOA"</em>) y selecciona el usuario administrador.</p>
              <p>3. Fudo te entregará dos valores: un <strong>Client ID</strong> (corto, codificado) y un <strong>Client Secret</strong> (largo, alfanumérico).</p>
            </AlertDescription>
          </Alert>

          <Alert variant="default" className="border-amber-300 bg-amber-50">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <AlertTitle className="text-sm text-amber-900">⚠️ Importante: los campos van invertidos</AlertTitle>
            <AlertDescription className="text-xs text-amber-900 mt-1">
              Fudo etiqueta los campos al revés en su panel. Para que la conexión funcione,
              copia los valores así:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>API Key</strong> aquí abajo = el "Client Secret" largo del panel Fudo</li>
                <li><strong>API Secret</strong> aquí abajo = el "Client ID" corto del panel Fudo</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="fudo-key">API Key (string corto, base64)</Label>
              <PasswordInput
                id="fudo-key"
                value={cfg.fudo.apiKey || ''}
                onChange={(v) => patch('fudo', { apiKey: v.trim() })}
                placeholder="ej: 12 caracteres tipo XxXxAMTkxNDcz"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fudo-secret">API Secret (string largo, alfanumérico)</Label>
              <PasswordInput
                id="fudo-secret"
                value={cfg.fudo.apiSecret || ''}
                onChange={(v) => patch('fudo', { apiSecret: v.trim() })}
                placeholder="ej: 32 caracteres alfanuméricos"
              />
            </div>
          </div>

          <div className="pt-2">
            <FudoTestButton cfg={cfg.fudo} />
          </div>

          <details className="text-xs text-gray-600 pt-2">
            <summary className="cursor-pointer hover:text-gray-900 font-medium">
              ¿Cómo verificó NOA estas credenciales? (detalle técnico)
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
              <p>NOA hace <code className="text-orange-700">POST https://auth.fu.do/api</code> con
                el body <code className="text-orange-700">{'{"apiKey": "...", "apiSecret": "..."}'}</code>,
                igual que el integrador oficial. Recibe un token JWT válido por 23 horas y lo usa para
                consultar <code>/sales</code> y <code>/products</code> en <code>api.fu.do/v1alpha1</code>.
              </p>
              <p>El token contiene el ID de tu cuenta y usuario, así que si ves "Conexión exitosa"
                significa que las credenciales pertenecen a un usuario válido de tu local Fudo.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* SII (Chile) */}
      <SiiSection siiCfg={cfg.sii} onPatch={(p) => patch('sii', p)} />

      {/* Gmail SMTP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Email vía Gmail</CardTitle>
                <CardDescription>Envío de notificaciones e invitaciones por correo.</CardDescription>
              </div>
            </div>
            <StatusBadge ok={gmailOk} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="border-blue-200 bg-blue-50">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Necesitas <strong>App Password</strong> de Google (no tu clave normal de Gmail).
              Activa 2FA y luego genera una en{' '}
              <a className="underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
                myaccount.google.com/apppasswords
              </a>.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="gmail-user">Correo Gmail</Label>
              <Input
                id="gmail-user"
                type="email"
                value={cfg.gmail.user}
                onChange={(e) => patch('gmail', { user: e.target.value })}
                placeholder="tu-correo@gmail.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gmail-pass">App Password</Label>
              <PasswordInput
                id="gmail-pass"
                value={cfg.gmail.appPassword}
                onChange={(v) => patch('gmail', { appPassword: v })}
                placeholder="16 caracteres sin espacios"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gmail-from">Nombre del remitente</Label>
            <Input
              id="gmail-from"
              value={cfg.gmail.fromName}
              onChange={(e) => patch('gmail', { fromName: e.target.value })}
              placeholder="NOA Copilot"
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500 text-center">
        Los cambios se guardan automáticamente al modificar un campo.
      </p>
    </div>
  );
}
