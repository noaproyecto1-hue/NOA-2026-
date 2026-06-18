import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Pencil, Trash2, Plus } from 'lucide-react';

const GRUPOS = ['GERENCIA', 'JEFES/ADMINISTRADORES', 'COCINEROS & AYUDANTES', 'AYUDANTES', 'GARZONES', 'CAJERO', 'BARISTA'];
const ESTADOS = ['Plazo fijo', 'Indefinido', 'Honorario', 'En prueba'];
const JORNADAS = ['Full-time', 'Part-time', 'Por turno'];

function seed() {
  return {
    'GERENCIA': [
      { id: 'e1', nombre: 'Nicolás Pacheco', estado: 'Plazo fijo', jornada: 'Full-time', ingreso: '2026-06-02', termino: '2027-06-02', liquido: 1000000, afp: 'Habitat', salud: 'Fonasa', seguros: 34000, bruto: 1334000 },
      { id: 'e2', nombre: 'Diego González', estado: 'Indefinido', jornada: 'Part-time', ingreso: '2026-06-02', termino: '', liquido: 600000, afp: 'Modelo', salud: 'Fonasa', seguros: 20000, bruto: 800000 },
    ],
    'JEFES/ADMINISTRADORES': [{ id: 'e3', nombre: 'Natalia Pozo', estado: 'Honorario', jornada: 'Full-time', ingreso: '2026-06-02', termino: '', liquido: 900000, afp: 'Cuprum', salud: 'Isapre', seguros: 30000, bruto: 1190000 }],
    'COCINEROS & AYUDANTES': [{ id: 'e4', nombre: 'Matías Fuentes', estado: 'Indefinido', jornada: 'Full-time', ingreso: '2026-03-01', termino: '', liquido: 650000, afp: 'Habitat', salud: 'Fonasa', seguros: 18000, bruto: 850000 }],
    'AYUDANTES': [],
    'GARZONES': [
      { id: 'e5', nombre: 'Camila Rojas', estado: 'Plazo fijo', jornada: 'Part-time', ingreso: '2026-04-01', termino: '2026-10-01', liquido: 450000, afp: 'Modelo', salud: 'Fonasa', seguros: 12000, bruto: 580000 },
      { id: 'e6', nombre: 'Fernanda Lagos', estado: 'En prueba', jornada: 'Por turno', ingreso: '2026-05-15', termino: '', liquido: 420000, afp: 'PlanVital', salud: 'Fonasa', seguros: 12000, bruto: 540000 },
    ],
    'CAJERO': [{ id: 'e7', nombre: 'Valentina Díaz', estado: 'Indefinido', jornada: 'Full-time', ingreso: '2026-02-01', termino: '', liquido: 550000, afp: 'Habitat', salud: 'Fonasa', seguros: 15000, bruto: 720000 }],
    'BARISTA': [{ id: 'e8', nombre: 'Sebastián Vera', estado: 'Plazo fijo', jornada: 'Full-time', ingreso: '2026-03-10', termino: '2026-09-10', liquido: 500000, afp: 'Modelo', salud: 'Fonasa', seguros: 14000, bruto: 650000 }],
  };
}

const clp = (n) => (Number(n) || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export default function EquipoTrabajo({ restaurantId }) {
  const key = `noa_equipo_${restaurantId || 'demo'}`;
  const [data, setData] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : seed(); } catch { return seed(); }
  });
  const [editing, setEditing] = useState(null);

  function persist(next) { setData(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch {} }
  function addEmp(grupo) { setEditing({ grupo, emp: { id: 'e' + Date.now(), nombre: '', estado: 'Plazo fijo', jornada: 'Full-time', ingreso: new Date().toISOString().slice(0, 10), termino: '', liquido: '', afp: '', salud: 'Fonasa', seguros: '', bruto: '' } }); }
  function saveEmp(grupo, emp) {
    const list = data[grupo] || [];
    const idx = list.findIndex((x) => x.id === emp.id);
    persist({ ...data, [grupo]: idx >= 0 ? list.map((x) => x.id === emp.id ? emp : x) : [...list, emp] });
    setEditing(null);
  }
  function removeEmp(grupo, id) { if (confirm('¿Eliminar este integrante?')) persist({ ...data, [grupo]: (data[grupo] || []).filter((x) => x.id !== id) }); }

  async function downloadContrato(emp) {
    try {
      const mod = await import('jspdf');
      const JsPDF = mod.default || mod.jsPDF;
      const doc = new JsPDF();
      doc.setFontSize(16); doc.text('CONTRATO DE TRABAJO', 105, 20, { align: 'center' });
      doc.setFontSize(11);
      const lines = [
        `Nombre: ${emp.nombre}`, `Estado contractual: ${emp.estado}`, `Jornada: ${emp.jornada}`,
        `Fecha de ingreso: ${emp.ingreso || '—'}`, `Fecha de término: ${emp.termino || 'Indefinido'}`,
        `Sueldo líquido: ${clp(emp.liquido)}`, `Sueldo bruto: ${clp(emp.bruto)}`,
        `AFP: ${emp.afp || '—'}`, `Salud: ${emp.salud || '—'}`, `Seguros: ${clp(emp.seguros)}`,
      ];
      let y = 40; for (const l of lines) { doc.text(l, 20, y); y += 10; }
      doc.text('Documento generado por NOA — Copiloto de Administración Gastronómica', 20, y + 10);
      doc.save(`contrato_${(emp.nombre || 'empleado').replace(/\s+/g, '_')}.pdf`);
    } catch (e) { alert('No se pudo generar el PDF: ' + e.message); }
  }

  const upd = (patch) => setEditing((s) => ({ ...s, emp: { ...s.emp, ...patch } }));

  return (
    <div className="space-y-4 font-sans">
      <Card className="bg-white border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-noa-navy">Equipo de trabajo</CardTitle>
          <p className="text-xs text-gray-400">Estructura de contratos por área. Descarga el contrato en PDF por integrante.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-3">Nombre</th><th className="py-2 px-2">Estado</th><th className="py-2 px-2">Jornada</th>
                <th className="py-2 px-2">Ingreso</th><th className="py-2 px-2">Término</th><th className="py-2 px-2 text-right">Líquido</th>
                <th className="py-2 px-2">AFP</th><th className="py-2 px-2">Salud</th><th className="py-2 px-2 text-right">Seguros</th>
                <th className="py-2 px-2 text-right">Bruto</th><th className="py-2 px-2 text-center">Contrato</th><th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map((grupo) => (
                <React.Fragment key={grupo}>
                  <tr className="bg-violet-50"><td colSpan={12} className="py-2 px-2 font-bold text-violet-800 text-xs uppercase tracking-wide">{grupo}</td></tr>
                  {(data[grupo] || []).map((e) => (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3 font-medium text-gray-900">{e.nombre}</td>
                      <td className="py-2 px-2"><Badge variant="outline" className="text-[10px]">{e.estado}</Badge></td>
                      <td className="py-2 px-2 text-xs">{e.jornada}</td>
                      <td className="py-2 px-2 text-xs">{e.ingreso || '—'}</td>
                      <td className="py-2 px-2 text-xs">{e.termino || '—'}</td>
                      <td className="py-2 px-2 text-xs text-right">{clp(e.liquido)}</td>
                      <td className="py-2 px-2 text-xs">{e.afp || '—'}</td>
                      <td className="py-2 px-2 text-xs">{e.salud || '—'}</td>
                      <td className="py-2 px-2 text-xs text-right">{clp(e.seguros)}</td>
                      <td className="py-2 px-2 text-xs text-right font-semibold">{clp(e.bruto)}</td>
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => downloadContrato(e)} title="Descargar contrato PDF" className="inline-flex text-red-600 hover:text-red-700">
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <button onClick={() => setEditing({ grupo, emp: e })} className="text-gray-400 hover:text-gray-700 mr-2 inline-flex"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removeEmp(grupo, e.id)} className="text-red-400 hover:text-red-600 inline-flex"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  <tr><td colSpan={12} className="py-1.5 px-2">
                    <button onClick={() => addEmp(grupo)} className="text-xs text-violet-600 hover:text-violet-800 font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar integrante</button>
                  </td></tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-bold text-lg text-noa-navy font-display">{editing.grupo}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2">Nombre<input className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.nombre} onChange={(ev) => upd({ nombre: ev.target.value })} /></label>
              <label>Estado<select className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.estado} onChange={(ev) => upd({ estado: ev.target.value })}>{ESTADOS.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label>Jornada<select className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.jornada} onChange={(ev) => upd({ jornada: ev.target.value })}>{JORNADAS.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label>Ingreso<input type="date" className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.ingreso} onChange={(ev) => upd({ ingreso: ev.target.value })} /></label>
              <label>Término<input type="date" className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.termino} onChange={(ev) => upd({ termino: ev.target.value })} /></label>
              <label>Sueldo líquido<input type="number" className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.liquido} onChange={(ev) => upd({ liquido: ev.target.value })} /></label>
              <label>Sueldo bruto<input type="number" className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.bruto} onChange={(ev) => upd({ bruto: ev.target.value })} /></label>
              <label>AFP<input className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.afp} onChange={(ev) => upd({ afp: ev.target.value })} /></label>
              <label>Salud<input className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.salud} onChange={(ev) => upd({ salud: ev.target.value })} /></label>
              <label>Seguros<input type="number" className="w-full border rounded px-2 py-1.5 mt-1" value={editing.emp.seguros} onChange={(ev) => upd({ seguros: ev.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="px-4 py-2 rounded border" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="px-4 py-2 rounded bg-noa-navy text-white" onClick={() => saveEmp(editing.grupo, { ...editing.emp, liquido: Number(editing.emp.liquido) || 0, bruto: Number(editing.emp.bruto) || 0, seguros: Number(editing.emp.seguros) || 0 })}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
