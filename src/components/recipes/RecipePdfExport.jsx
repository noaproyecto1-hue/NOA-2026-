import React from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { jsPDF } from 'jspdf';
import { formatCurrency } from '../utils/currencyHelper';
import { getYieldAdjustedCost } from '../utils/yieldCostHelper';

export default function RecipePdfExport({ recipe, supplyItems = [], currency = 'USD' }) {
  const [generating, setGenerating] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  // Si tiene PDF importado, permitir descargarlo directamente
  const hasImportedPdf = !!recipe.pdf_url;

  const calculateCost = () => {
    return (recipe.ingredients || []).reduce((total, ing) => {
      const supply = supplyItems.find(s => s.name === ing.supply_name || s.id === ing.supply_id);
      return total + (getYieldAdjustedCost(supply) * (ing.quantity || 0));
    }, 0);
  };

  // Descargar PDF original importado
  const downloadImportedPdf = async () => {
    setDownloading(true);
    try {
      const response = await fetch(recipe.pdf_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receta_${recipe.dish_name.replace(/\s+/g, '_')}_Original.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Error descargando PDF:', error);
      // Fallback: abrir en nueva pestaña
      window.open(recipe.pdf_url, '_blank');
    }
    setDownloading(false);
  };

  const generatePdf = async () => {
    setGenerating(true);
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Si hay foto, intentar cargarla
    let imageLoaded = false;
    if (recipe.photo_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = recipe.photo_url;
        });
        
        // Agregar imagen centrada en la parte superior
        const imgWidth = 60;
        const imgHeight = 45;
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(img, 'JPEG', imgX, y, imgWidth, imgHeight);
        y += imgHeight + 10;
        imageLoaded = true;
      } catch (e) {
        console.log('No se pudo cargar la imagen');
      }
    }

    // Header - Título
    doc.setFillColor(234, 88, 12); // Orange
    doc.rect(0, y, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(recipe.dish_name, margin, y + 15);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(recipe.category || 'Sin categoría', margin, y + 28);

    y += 45;

    // Descripción
    if (recipe.description) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(11);
      doc.setFont(undefined, 'italic');
      const descLines = doc.splitTextToSize(recipe.description, pageWidth - margin * 2);
      doc.text(descLines, margin, y);
      y += descLines.length * 6 + 10;
    }

    // Info Box - Solo tiempo y porciones
    doc.setFillColor(254, 243, 199); // Amber light
    doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 3, 3, 'F');
    
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    
    const boxY = y + 8;
    const colWidth = (pageWidth - margin * 2) / 2;
    
    doc.text('TIEMPO DE PREPARACIÓN', margin + 15, boxY);
    doc.text('PORCIONES', margin + colWidth + 15, boxY);
    
    doc.setFontSize(12);
    doc.text(`${recipe.preparation_time || '—'} minutos`, margin + 15, boxY + 10);
    doc.text(`${recipe.servings || 1} ${recipe.servings_unit || 'porción'}`, margin + colWidth + 15, boxY + 10);

    y += 32;

    // Ingredientes
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('INGREDIENTES', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    (recipe.ingredients || []).forEach((ing, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFillColor(idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 251 : 255);
      doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
      
      doc.setTextColor(50, 50, 50);
      doc.text(`• ${ing.supply_name}`, margin + 2, y);
      doc.setTextColor(180, 83, 9);
      doc.text(`${ing.quantity} ${ing.unit}`, pageWidth - margin - 30, y);
      
      y += 8;
    });

    y += 12;

    // Preparación
    if (recipe.preparation_instructions) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('INSTRUCCIONES DE PREPARACIÓN', margin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      
      // Limpiar HTML tags si existen
      const cleanText = recipe.preparation_instructions
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      
      const instructions = cleanText.split('\n').filter(line => line.trim());
      instructions.forEach((line) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const wrapped = doc.splitTextToSize(line.trim(), pageWidth - margin * 2);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 3;
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Receta: ${recipe.dish_name} | Generado: ${new Date().toLocaleDateString()}`,
        margin,
        doc.internal.pageSize.getHeight() - 10
      );
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth - margin - 20,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    // Descargar
    doc.save(`Receta_${recipe.dish_name.replace(/\s+/g, '_')}.pdf`);
    setGenerating(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botón para descargar PDF importado (si existe) */}
      {hasImportedPdf && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={downloadImportedPdf}
          disabled={downloading}
          className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          PDF Original
        </Button>
      )}
      
      {/* Botón para generar PDF con datos actuales */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={generatePdf}
        disabled={generating}
        className="gap-2"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        {hasImportedPdf ? 'Generar PDF' : 'Exportar PDF'}
      </Button>
    </div>
  );
}