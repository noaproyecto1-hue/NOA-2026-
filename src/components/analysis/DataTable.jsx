import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function DataTable({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Buscar...",
  pageSize: initialPageSize = 25,
  onRowClick,
  onPageSizeChange,
  searchFn,
  selectable = false,
  selectedIds = [],
  onSelectionChange
}) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [pageSize, setPageSize] = useState(initialPageSize);
  
  // Reset page cuando cambia pageSize internamente
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(0);
    if (onPageSizeChange) onPageSizeChange(newSize);
  };

  // Filter data
  const filteredData = data.filter(row => {
    if (!search) return true;
    // Use custom search function if provided
    if (searchFn) return searchFn(row, search.toLowerCase());
    return columns.some(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(search.toLowerCase());
    });
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    const comparison = aVal < bVal ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Paginate data
  const paginatedData = sortedData.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (columnKey) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(0);
            }}
            className="pl-10 bg-white"
          />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedData.length > 0 && paginatedData.every(r => selectedIds.includes(r.id))}
                    onCheckedChange={(checked) => {
                      if (!onSelectionChange) return;
                      if (checked) {
                        const newIds = [...new Set([...selectedIds, ...paginatedData.map(r => r.id)])];
                        onSelectionChange(newIds);
                      } else {
                        const pageIds = new Set(paginatedData.map(r => r.id));
                        onSelectionChange(selectedIds.filter(id => !pageIds.has(id)));
                      }
                    }}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead 
                  key={column.key}
                  className={`font-semibold text-gray-700 ${column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable !== false && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0)} 
                  className="text-center py-8 text-gray-500"
                >
                  No se encontraron datos
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => (
                <TableRow 
                  key={row.id || index}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${selectable && selectedIds.includes(row.id) ? 'bg-red-50/50' : ''}`}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={(checked) => {
                          if (!onSelectionChange) return;
                          if (checked) {
                            onSelectionChange([...selectedIds, row.id]);
                          } else {
                            onSelectionChange(selectedIds.filter(id => id !== row.id));
                          }
                        }}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Siempre mostrar paginación si hay datos */}
      {sortedData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <div className="flex items-center gap-4">
            {selectable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!onSelectionChange) return;
                  const allFilteredIds = sortedData.map(r => r.id);
                  const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
                  if (allSelected) {
                    onSelectionChange([]);
                  } else {
                    onSelectionChange([...new Set([...selectedIds, ...allFilteredIds])]);
                  }
                }}
                className="text-xs"
              >
                {sortedData.every(r => selectedIds.includes(r.id)) ? 'Deseleccionar todo' : `Seleccionar todo (${sortedData.length})`}
              </Button>
            )}
            <p className="text-sm text-gray-500">
              Mostrando {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, sortedData.length)} de {sortedData.length}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filas:</span>
              <Select 
                value={String(pageSize)} 
                onValueChange={(val) => handlePageSizeChange(Number(val))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="hidden sm:flex"
            >
              Primera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[100px] text-center">
              Pág. {currentPage + 1} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="hidden sm:flex"
            >
              Última
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}