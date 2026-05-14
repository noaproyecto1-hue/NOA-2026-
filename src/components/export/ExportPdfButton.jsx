import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ExportPdfButton({ 
  targetRef,
  filename = 'export',
  buttonText = 'Exportar PDF',
  variant = 'outline',
  className = '',
  orientation = 'portrait',
  title = '',
  subtitle = '',
  onBeforeExport
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!targetRef?.current) return;
    
    // Ejecutar callback antes de exportar (ej: expandir elementos)
    if (onBeforeExport) {
      onBeforeExport();
      // Esperar a que se re-renderice
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setLoading(true);
    try {
      const element = targetRef.current;
      
      // Capturar el contenido
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      
      // Header
      let yPos = margin;
      if (title) {
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
      }
      if (subtitle) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100);
        pdf.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }
      
      // Fecha
      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text(`Generado: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      // Calcular dimensiones de la imagen
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Si la imagen es muy alta, dividir en páginas
      const availableHeight = pageHeight - yPos - margin;
      
      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
      } else {
        // Paginación para contenido largo
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let isFirstPage = true;
        
        while (remainingHeight > 0) {
          if (!isFirstPage) {
            pdf.addPage();
            yPos = margin;
          }
          
          const chunkHeight = Math.min(availableHeight, remainingHeight);
          const sourceHeight = (chunkHeight / imgHeight) * canvas.height;
          
          // Crear canvas parcial
          const partialCanvas = document.createElement('canvas');
          partialCanvas.width = canvas.width;
          partialCanvas.height = sourceHeight;
          const ctx = partialCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          
          pdf.addImage(partialCanvas.toDataURL('image/png'), 'PNG', margin, yPos, imgWidth, chunkHeight);
          
          sourceY += sourceHeight;
          remainingHeight -= chunkHeight;
          isFirstPage = false;
        }
      }
      
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error exportando PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleExport}
      disabled={loading}
      className={`gap-2 ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      {buttonText}
    </Button>
  );
}