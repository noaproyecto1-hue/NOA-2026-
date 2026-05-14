import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ExportFullPdfButton({ 
  sections = [], // Array of { ref, title }
  filename = 'export',
  buttonText = 'Exportar PDF',
  variant = 'outline',
  className = '',
  mainTitle = '',
  mainSubtitle = ''
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!sections.length) return;
    
    setLoading(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      
      let isFirstPage = true;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (!section.ref?.current) continue;

        const element = section.ref.current;
        
        // Capturar el contenido
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#f8fafc'
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        if (!isFirstPage) {
          pdf.addPage();
        }
        
        let yPos = margin;
        
        // Header en primera página
        if (isFirstPage && mainTitle) {
          pdf.setFontSize(20);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 41, 59);
          pdf.text(mainTitle, pageWidth / 2, yPos, { align: 'center' });
          yPos += 8;
          
          if (mainSubtitle) {
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100);
            pdf.text(mainSubtitle, pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
          }
          
          pdf.setFontSize(9);
          pdf.setTextColor(150);
          pdf.text(`Generado: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, yPos, { align: 'center' });
          yPos += 12;
        }
        
        // Título de sección
        if (section.title) {
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(59, 130, 246);
          pdf.text(section.title, margin, yPos);
          yPos += 8;
        }
        
        // Calcular dimensiones de la imagen
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const availableHeight = pageHeight - yPos - margin;
        
        if (imgHeight <= availableHeight) {
          pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        } else {
          // Paginación para contenido largo
          let remainingHeight = imgHeight;
          let sourceY = 0;
          let isFirstChunk = true;
          
          while (remainingHeight > 0) {
            if (!isFirstChunk) {
              pdf.addPage();
              yPos = margin;
            }
            
            const chunkAvailableHeight = isFirstChunk ? availableHeight : pageHeight - margin * 2;
            const chunkHeight = Math.min(chunkAvailableHeight, remainingHeight);
            const sourceHeight = (chunkHeight / imgHeight) * canvas.height;
            
            const partialCanvas = document.createElement('canvas');
            partialCanvas.width = canvas.width;
            partialCanvas.height = sourceHeight;
            const ctx = partialCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
            
            pdf.addImage(partialCanvas.toDataURL('image/png'), 'PNG', margin, yPos, imgWidth, chunkHeight);
            
            sourceY += sourceHeight;
            remainingHeight -= chunkHeight;
            isFirstChunk = false;
          }
        }
        
        isFirstPage = false;
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