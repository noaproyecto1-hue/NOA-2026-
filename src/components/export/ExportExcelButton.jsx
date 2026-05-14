import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';

export default function ExportExcelButton({ 
  data, 
  filename = 'export',
  sheetName = 'Datos',
  buttonText = 'Exportar Excel',
  variant = 'outline',
  className = ''
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } catch (error) {
      console.error('Error exportando Excel:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleExport}
      disabled={loading || !data?.length}
      className={`gap-2 ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
      {buttonText}
    </Button>
  );
}