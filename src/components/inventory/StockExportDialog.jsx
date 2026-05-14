import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, AlertTriangle } from "lucide-react";
import { jsPDF } from 'jspdf';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatDateInUserTz } from '@/components/utils/timezoneHelper';

export default function StockExportDialog({
  open,
  onOpenChange,
  supplyItems = [],
  getStockStatus,
  restaurantName = '',
  currency = 'CLP'
}) {
  const [includeWarning, setIncludeWarning] = useState(true);
  const [includeCritical, setIncludeCritical] = useState(true);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const filteredItems = useMemo(() => {
    return supplyItems.filter(item => {
      const status = getStockStatus(item.current_stock, item.min_stock, item.warning_stock);
      if (status === 'critical' && includeCritical) return true;
      if (status === 'warning' && includeWarning) return true;
      return false;
    }).sort((a, b) => {
      const sa = getStockStatus(a.current_stock, a.min_stock, a.warning_stock);
      const sb = getStockStatus(b.current_stock, b.min_stock, b.warning_stock);
      if (sa === 'critical' && sb !== 'critical') return -1;
      if (sa !== 'critical' && sb === 'critical') return 1;
      return (a.name || '').localeCompare(b.name || '', 'es');
    });
  }, [supplyItems, includeWarning, includeCritical, getStockStatus]);

  const criticalCount = supplyItems.filter(i => getStockStatus(i.current_stock, i.min_stock, i.warning_stock) === 'critical').length;
  const warningCount = supplyItems.filter(i => getStockStatus(i.current_stock, i.min_stock, i.warning_stock) === 'warning').length;

  const handleExport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    let y = 22;

    // Fecha y hora en timezone del usuario (Chile)
    const fechaStr = formatDateInUserTz(new Date(), "dd 'de' MMMM yyyy", user);
    const horaStr = formatDateInUserTz(new Date(), 'HH:mm', user);

    // ── Title ──
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Lista de Compras', margin, y);
    y += 8;

    // Subtitle line
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(2);
    doc.line(margin, y, margin + 45, y);
    y += 10;

    // Info
    doc.setFontSize(9.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    if (restaurantName) {
      doc.text(`Restaurante: ${restaurantName}`, margin, y);
      y += 5.5;
    }
    doc.text(`Fecha: ${fechaStr}  •  ${horaStr} hrs`, margin, y);
    y += 5.5;
    doc.text(`Total insumos: ${filteredItems.length}`, margin, y);
    y += 12;

    // ── Table header ──
    const col1X = margin;
    const col2X = margin + 10;
    const col3X = margin + 80;
    const col4X = margin + 135;

    const drawTableHeader = () => {
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 13, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(100);
      doc.text('#', col1X + 3, y + 3);
      doc.text('INSUMO', col2X + 4, y + 3);
      doc.text('PROVEEDOR', col3X, y + 3);
      doc.text('A COMPRAR', col4X, y + 3);
      y += 15;
    };
    drawTableHeader();

    // ── Rows ──
    doc.setFontSize(9.5);

    filteredItems.forEach((item, idx) => {
      if (y > 268) {
        doc.addPage();
        y = 20;
        drawTableHeader();
      }

      const status = getStockStatus(item.current_stock, item.min_stock, item.warning_stock);

      // Alternating row
      if (idx % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 11, 'F');
      }

      // Number
      doc.setFont(undefined, 'normal');
      doc.setTextColor(160);
      doc.text(String(idx + 1), col1X + 3, y + 1);

      // Status dot
      if (status === 'critical') {
        doc.setFillColor(239, 68, 68);
      } else {
        doc.setFillColor(245, 158, 11);
      }
      doc.circle(col2X + 1, y, 2, 'F');

      // Item name
      doc.setTextColor(30);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8.5);
      doc.text((item.name || '').substring(0, 40), col2X + 6, y + 1);

      // Supplier
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80);
      doc.setFontSize(8);
      doc.text((item.supplier || '—').substring(0, 30), col3X, y + 1);

      // Cantidad a comprar
      const idealStock = item.ideal_stock || 0;
      const toBuy = idealStock > 0 ? Math.max(0, idealStock - (item.current_stock || 0)) : 0;
      if (toBuy > 0) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(`${toBuy} ${item.unit_of_measure || ''}`, col4X, y + 1);
      } else {
        doc.setFont(undefined, 'normal');
        doc.setTextColor(180);
        doc.text('—', col4X, y + 1);
      }

      doc.setFontSize(9.5);
      y += 11;
    });

    // ── Footer ──
    y += 10;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setDrawColor(220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFontSize(7.5);
    doc.setTextColor(170);
    doc.setFont(undefined, 'italic');
    doc.text('Generado por NOA — Neural Operations Assistant', margin, y);

    doc.save(`lista_compras_${formatDateInUserTz(new Date(), 'yyyy-MM-dd', user)}.pdf`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Exportar Lista de Compras
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-600">
            Selecciona qué estados deseas incluir en el PDF:
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/50">
              <div className="flex items-center gap-3">
                <Checkbox id="critical" checked={includeCritical} onCheckedChange={setIncludeCritical} />
                <Label htmlFor="critical" className="cursor-pointer flex items-center gap-2">
                  <Badge className="bg-red-500 text-white border-0">🔴 Crítico</Badge>
                  <span className="text-sm text-gray-600">Stock mínimo</span>
                </Label>
              </div>
              <span className="text-sm font-bold text-red-600">{criticalCount}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-3">
                <Checkbox id="warning" checked={includeWarning} onCheckedChange={setIncludeWarning} />
                <Label htmlFor="warning" className="cursor-pointer flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white border-0">🟠 Bajo</Badge>
                  <span className="text-sm text-gray-600">Stock advertencia</span>
                </Label>
              </div>
              <span className="text-sm font-bold text-amber-600">{warningCount}</span>
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Vista previa: {filteredItems.length} insumos
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredItems.slice(0, 10).map(item => {
                  const status = getStockStatus(item.current_stock, item.min_stock, item.warning_stock);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${status === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <span className="text-gray-700 font-medium truncate">{item.name}</span>
                      </div>
                      <span className="text-gray-400 text-[11px] ml-2 truncate max-w-[120px]">{item.supplier || '—'}</span>
                    </div>
                  );
                })}
                {filteredItems.length > 10 && (
                  <p className="text-xs text-gray-400 text-center pt-1">...y {filteredItems.length - 10} más</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Selecciona al menos un estado</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleExport}
            disabled={filteredItems.length === 0}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar PDF ({filteredItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}