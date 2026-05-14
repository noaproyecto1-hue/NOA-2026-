import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Filter } from "lucide-react";

const supplyTypeLabels = {
  ingredients: "Ingredientes",
  packaging: "Empaque",
  cleaning: "Limpieza",
  equipment: "Equipos",
  uniforms: "Uniformes",
  other: "Otros"
};

export default function SupplyFilter({ 
  supplyCosts = [], 
  currency = "USD",
  totalSales = 0
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', { 
      style: 'currency', 
      currency,
      minimumFractionDigits: 0
    }).format(value);
  };

  // Group and calculate totals - usando supply_category y total_cost
  const groupedSupplies = supplyCosts.reduce((acc, cost) => {
    const key = cost.supply_category || 'Sin categoría';
    if (!acc[key]) {
      acc[key] = {
        name: cost.supply_category || 'Sin categoría',
        type: cost.supply_type || 'other',
        total: 0,
        count: 0
      };
    }
    acc[key].total += cost.total_cost || 0;
    acc[key].count += 1;
    return acc;
  }, {});

  const supplies = Object.values(groupedSupplies)
    .filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || s.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => b.total - a.total);

  const totalCost = supplies.reduce((sum, s) => sum + s.total, 0);

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-500" />
          Gastos por Categoría de Suministro
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-gray-50"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] bg-gray-50">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(supplyTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Supply List */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {supplies.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No hay suministros para mostrar</p>
          ) : (
            supplies.map((supply) => {
              const percentage = totalSales > 0 ? (supply.total / totalSales) * 100 : 0;
              return (
                <div 
                  key={supply.name}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{supply.name}</span>
                      <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                        {supplyTypeLabels[supply.type]}
                      </Badge>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(supply.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{supply.count} compras</span>
                    <span className={percentage > 5 ? 'text-red-500 font-medium' : ''}>
                      {percentage.toFixed(1)}% de ventas
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${percentage > 5 ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(percentage * 5, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Total */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm text-gray-600">Total suministros</span>
          <div className="text-right">
            <span className="text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</span>
            {totalSales > 0 && (
              <p className="text-xs text-gray-500">
                {((totalCost / totalSales) * 100).toFixed(1)}% de ventas
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}