import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Truck, Plus, Trash2, Search, Edit, X, Package, FileSpreadsheet, UserCircle, Phone
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import SupplierFormDialog from '@/components/suppliers/SupplierFormDialog';

const paymentMethodLabels = {
  efectivo: '💵 Efectivo',
  transferencia: '🏦 Transferencia',
  tarjeta: '💳 Tarjeta',
  cheque: '📄 Cheque'
};

const paymentTermsLabels = {
  contado: 'Al contado',
  '7_dias': '7 días',
  '15_dias': '15 días',
  '30_dias': '30 días'
};

const supplierTypeLabels = {
  supply: '🥬 Insumos (Food Cost)',
  opex: '🏢 Gasto Operativo',
  both: '🔄 Ambos'
};

export default function SupplierTab({
  suppliers = [],
  supplyCategories = [],
  costCenters = [],
  onAdd,
  onUpdate,
  onDelete,
  onImport,
  isLoading = false
}) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Normalize supply categories — can be objects or strings
  const categoryNames = useMemo(() => {
    return (supplyCategories || []).map(c => typeof c === 'object' && c !== null ? c.name : String(c)).filter(Boolean);
  }, [supplyCategories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers.filter(s => s.is_active !== false);
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.is_active !== false && (
        s.name?.toLowerCase().includes(q) ||
        s.tax_id?.toLowerCase().includes(q) ||
        s.supply_categories?.some(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase().includes(q))
      )
    );
  }, [suppliers, search]);

  const handleOpenNew = () => {
    setEditingSupplier(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleSubmit = (formData) => {
    if (editingSupplier) {
      onUpdate(editingSupplier.id, { ...formData, is_active: true });
    } else {
      onAdd({ ...formData, is_active: true });
    }
    setDialogOpen(false);
    setEditingSupplier(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-teal-900">Base de Datos de Proveedores</p>
            <p className="text-sm text-teal-700 mt-1">
              Centraliza tus proveedores para coherencia en compras y gastos.
            </p>
          </div>
          <Badge className="bg-teal-100 text-teal-700 border-0">
            {suppliers.filter(s => s.is_active !== false).length} activos
          </Badge>
        </div>
      </Card>

      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor por nombre, RUT o categoría..."
            className="pl-10 h-10"
          />
        </div>
        <div className="flex gap-2">
          {onImport && (
            <Button variant="outline" onClick={onImport} className="h-10 gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
          )}
          <Button onClick={handleOpenNew} className="h-10 bg-teal-600 hover:bg-teal-700 gap-2">
            <Plus className="w-4 h-4" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Sin proveedores registrados</p>
            <p className="text-xs">Agrega proveedores manualmente o importa desde Excel</p>
          </Card>
        ) : (
          filtered.map(supplier => (
            <motion.div
              key={supplier.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 bg-white hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {supplier.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{supplier.name}</p>
                        {supplier.tax_id && (
                          <span className="text-xs font-mono text-gray-400">{supplier.tax_id}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                        {supplier.payment_method && (
                          <span>{paymentMethodLabels[supplier.payment_method] || supplier.payment_method}</span>
                        )}
                        {supplier.payment_terms && supplier.payment_terms !== 'contado' && (
                          <span>{paymentTermsLabels[supplier.payment_terms] || supplier.payment_terms}</span>
                        )}
                      </div>
                      {/* Type badge */}
                      {supplier.supplier_type && (
                        <div className="mt-1.5">
                          <Badge variant="outline" className={`text-[10px] ${
                            supplier.supplier_type === 'supply' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            supplier.supplier_type === 'opex' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            'bg-purple-50 border-purple-200 text-purple-700'
                          }`}>
                            {supplierTypeLabels[supplier.supplier_type] || supplier.supplier_type}
                          </Badge>
                        </div>
                      )}
                      {/* Supply categories */}
                      {supplier.supply_categories?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {supplier.supply_categories.map(cat => (
                            <Badge key={typeof cat === 'string' ? cat : cat?.name || ''} variant="outline" className="text-[10px] bg-teal-50 border-teal-200 text-teal-700">
                              {typeof cat === 'string' ? cat : cat?.name || ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Opex categories */}
                      {supplier.opex_categories?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {supplier.opex_categories.map((oc, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">
                              {oc.cost_center}{oc.category ? ` → ${oc.category}` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Contacts / Vendedores */}
                      {supplier.contacts?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {supplier.contacts.filter(c => c.name).map((c, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                              <UserCircle className="w-3 h-3 text-teal-500" />
                              {c.name}
                              {c.phone && <><Phone className="w-2.5 h-2.5 ml-0.5" />{c.phone}</>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(supplier)} className="h-8 w-8 text-gray-400 hover:text-teal-600">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(supplier.id)} className="h-8 w-8 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        rawSupplyCategories={supplyCategories}
        costCenters={costCenters}
        onSubmit={handleSubmit}
      />
    </div>
  );
}