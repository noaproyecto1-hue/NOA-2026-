import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator, 
  Percent, 
  Receipt,
  User,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
  ShoppingBag
} from "lucide-react";
import { formatCurrency, getCurrencySymbol } from '@/components/utils/currencyHelper';
import { formatDateInUserTz, localToUTC, getUserTimezone } from '@/components/utils/timezoneHelper';
import { formatInTimeZone } from 'date-fns-tz';

const defaultPaymentMethods = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'otro', label: 'Otro' }
];

const saleTypes = [
  { value: 'local', label: 'Local' },
  { value: 'delivery', label: 'Delivery' }
];

export default function SaleEditForm({
  sale,
  restaurants = [],
  inventory = [],
  employees = [],
  currency = 'USD',
  user,
  onSubmit,
  onCancel,
  isLoading = false
}) {
  const currencySymbol = getCurrencySymbol(currency);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    restaurant_id: sale?.restaurant_id || '',
    transaction_id: sale?.transaction_id || '',
    date_time: (() => {
      const tz = getUserTimezone(user);
      if (sale?.date_time) {
        return formatInTimeZone(new Date(sale.date_time), tz, "yyyy-MM-dd'T'HH:mm");
      }
      return formatInTimeZone(new Date(), tz, "yyyy-MM-dd'T'HH:mm");
    })(),
    customer_name: sale?.customer_name || '',
    table_number: sale?.table_number || '',
    room: sale?.room || '',
    num_guests: sale?.num_guests || '',
    waiter_name: sale?.waiter_name || '',
    payment_method: sale?.payment_method || 'efectivo',
    sale_type: sale?.sale_type || 'local',
    delivery_source: sale?.delivery_source || '',
    // Preservar is_extra de productos importados desde CSV
    products: (sale?.products || []).map(p => ({ ...p, is_extra: p.is_extra || false, is_combo_container: p.is_combo_container || false })),
    discount_amount: sale?.discount_amount || 0,
    discount_percentage: sale?.discount_percentage || 0,
    applies_tax: sale?.applies_tax !== false,
    tax_rate: sale?.tax_rate || (() => {
      const rest = restaurants.find(r => r.id === (sale?.restaurant_id || ''));
      return rest?.config?.default_tax_rate || 19;
    })(),
    tip_amount: sale?.tip_amount || 0,
    is_cancelled: sale?.is_cancelled || false,
    notes: sale?.notes || ''
  });

  // Calcular totales automáticamente
  // IMPORTANTE: Los precios de venta YA INCLUYEN IVA
  const calculations = useMemo(() => {
    // Suma de productos (precio YA incluye IVA)
    const totalProductos = formData.products.reduce((sum, p) => {
      if (p.is_cancelled) return sum;
      return sum + ((p.unit_price || 0) * (p.quantity || 1));
    }, 0);

    // Calcular descuento
    let descuento = formData.discount_amount || 0;
    if (formData.discount_percentage > 0) {
      descuento = totalProductos * (formData.discount_percentage / 100);
    }

    // Total a cobrar (lo que paga el cliente)
    const totalCobrar = totalProductos - descuento;

    // Desglose fiscal (extraer neto e IVA del total)
    const taxMultiplier = formData.applies_tax ? (1 + formData.tax_rate / 100) : 1;
    const ventaNeta = Math.round(totalCobrar / taxMultiplier);
    const iva = formData.applies_tax ? Math.round(totalCobrar - ventaNeta) : 0;

    return {
      totalProductos,
      descuento,
      totalCobrar,
      ventaNeta,
      iva,
      totalConPropina: totalCobrar + (formData.tip_amount || 0)
    };
  }, [formData.products, formData.discount_amount, formData.discount_percentage, formData.applies_tax, formData.tax_rate, formData.tip_amount]);

  // Productos del restaurante seleccionado
  const availableProducts = useMemo(() => {
    if (!formData.restaurant_id) return [];
    return inventory.filter(i => 
      i.restaurant_id === formData.restaurant_id && 
      i.item_type === 'product' && 
      i.is_active !== false
    );
  }, [inventory, formData.restaurant_id]);

  // Empleados del restaurante
  const availableEmployees = useMemo(() => {
    if (!formData.restaurant_id) return employees;
    const restaurant = restaurants.find(r => r.id === formData.restaurant_id);
    return restaurant?.config?.employees?.filter(e => e.is_active !== false) || employees;
  }, [restaurants, formData.restaurant_id, employees]);

  // Salas del restaurante
  const availableRooms = useMemo(() => {
    if (!formData.restaurant_id) return [];
    const restaurant = restaurants.find(r => r.id === formData.restaurant_id);
    return restaurant?.config?.rooms || [];
  }, [restaurants, formData.restaurant_id]);

  // Métodos de pago del restaurante
  const availablePaymentMethods = useMemo(() => {
    if (!formData.restaurant_id) return defaultPaymentMethods;
    const restaurant = restaurants.find(r => r.id === formData.restaurant_id);
    const configMethods = restaurant?.config?.payment_methods;
    if (configMethods && configMethods.length > 0) {
      return configMethods.map(m => ({ value: m.toLowerCase(), label: m }));
    }
    return defaultPaymentMethods;
  }, [restaurants, formData.restaurant_id]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addProduct = (isExtra = false) => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, {
        product_name: '',
        category: '',
        quantity: 1,
        unit_price: 0,
        zone: '',
        is_cancelled: false,
        is_extra: isExtra
      }]
    }));
  };

  const updateProduct = (index, field, value) => {
    setFormData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };
      
      // Auto-completar precio si se selecciona un producto
      if (field === 'product_name') {
        const product = availableProducts.find(p => p.product_name === value);
        if (product) {
          newProducts[index].unit_price = product.unit_price || 0;
          newProducts[index].category = product.category || '';
          newProducts[index].zone = product.zone || '';
        }
      }
      
      return { ...prev, products: newProducts };
    });
  };

  const removeProduct = (index) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const dataToSubmit = {
      ...formData,
      date_time: localToUTC(formData.date_time, user).toISOString(),
      subtotal: calculations.ventaNeta,       // Venta NETA (sin IVA) para reportes fiscales
      tax_amount: calculations.iva,           // IVA extraído
      total_amount: calculations.totalCobrar, // Total cobrado al cliente
      num_guests: formData.num_guests ? parseInt(formData.num_guests) : null,
      discount_amount: calculations.descuento,
      tip_amount: parseFloat(formData.tip_amount) || 0
    };

    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información básica */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Restaurante *</Label>
          <Select value={formData.restaurant_id} onValueChange={(v) => updateField('restaurant_id', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fecha y Hora *</Label>
          <Input 
            type="datetime-local" 
            value={formData.date_time}
            onChange={(e) => updateField('date_time', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>ID Transacción</Label>
          <Input 
            value={formData.transaction_id}
            onChange={(e) => updateField('transaction_id', e.target.value)}
            placeholder="Auto-generado"
          />
        </div>
        <div>
          <Label>Tipo de Venta</Label>
          <Select value={formData.sale_type} onValueChange={(v) => updateField('sale_type', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {saleTypes.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formData.sale_type === 'delivery' && (
          <div>
            <Label>Origen Delivery</Label>
            <Input 
              value={formData.delivery_source}
              onChange={(e) => updateField('delivery_source', e.target.value)}
              placeholder="Uber, Rappi, etc."
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Información del servicio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label className="flex items-center gap-2">
            <User className="w-4 h-4" /> Camarero
          </Label>
          {availableEmployees.length > 0 ? (
            <Select value={formData.waiter_name} onValueChange={(v) => updateField('waiter_name', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.map(e => (
                  <SelectItem key={e.id || e.name} value={e.name}>{e.name}</SelectItem>
                ))}
                {formData.waiter_name && !availableEmployees.find(e => e.name === formData.waiter_name) && (
                  <SelectItem value={formData.waiter_name}>{formData.waiter_name} (FUDO)</SelectItem>
                )}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              value={formData.waiter_name}
              onChange={(e) => updateField('waiter_name', e.target.value)}
              placeholder="Nombre del camarero"
            />
          )}
        </div>
        <div>
          <Label>Sala</Label>
          {availableRooms.length > 0 ? (
            <Select value={formData.room} onValueChange={(v) => updateField('room', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map(room => (
                  <SelectItem key={room} value={room}>{room}</SelectItem>
                ))}
                {formData.room && !availableRooms.includes(formData.room) && (
                  <SelectItem value={formData.room}>{formData.room} (FUDO)</SelectItem>
                )}
              </SelectContent>
            </Select>
          ) : (
            <Input 
              value={formData.room}
              onChange={(e) => updateField('room', e.target.value)}
              placeholder="Ej: Terraza"
            />
          )}
        </div>
        <div>
          <Label>Mesa</Label>
          <Input 
            value={formData.table_number}
            onChange={(e) => updateField('table_number', e.target.value)}
            placeholder="Ej: 5"
          />
        </div>
        <div>
          <Label>Personas</Label>
          <Input 
            type="number"
            min="1"
            value={formData.num_guests}
            onChange={(e) => updateField('num_guests', e.target.value)}
            placeholder="Ej: 4"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Cliente (opcional)</Label>
          <Input 
            value={formData.customer_name}
            onChange={(e) => updateField('customer_name', e.target.value)}
            placeholder="Nombre del cliente"
          />
        </div>
        <div>
          <Label className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Método de Pago
          </Label>
          <Select value={formData.payment_method} onValueChange={(v) => updateField('payment_method', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {availablePaymentMethods.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
              {formData.payment_method && !availablePaymentMethods.find(m => m.value === formData.payment_method) && (
                <SelectItem value={formData.payment_method}>{formData.payment_method}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Productos</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addProduct(false)}>
              <Plus className="w-4 h-4 mr-1" /> Producto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addProduct(true)} className="text-purple-600 border-purple-200 hover:bg-purple-50">
              <Plus className="w-4 h-4 mr-1" /> Selección del menú
            </Button>
          </div>
        </div>
        
        {formData.products.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-gray-500">
              No hay productos. Agrega productos o ingresa el subtotal manualmente.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(() => {
              // Build grouped display: combo parents followed by their CONSECUTIVE children
              // When multiple combos share the same name, children are assigned by proximity (position)
              const rendered = new Set();
              const elements = [];
              
              for (let i = 0; i < formData.products.length; i++) {
                if (rendered.has(i)) continue;
                const product = formData.products[i];
                
                // If this is a combo container, render it + consecutive children after it
                if (product.is_combo_container) {
                  rendered.add(i);
                  elements.push({ product, index: i });
                  
                  // Collect consecutive is_extra items that follow this combo with matching parent_product
                  const parentName = product.product_name?.toUpperCase();
                  for (let j = i + 1; j < formData.products.length; j++) {
                    const child = formData.products[j];
                    // Stop at the next combo container or non-extra item without matching parent
                    if (child.is_combo_container) break;
                    if (child.is_extra && (!child.parent_product || child.parent_product.toUpperCase() === parentName)) {
                      rendered.add(j);
                      elements.push({ product: child, index: j, isGroupedChild: true });
                    } else if (!child.is_extra) {
                      // Non-extra item breaks the consecutive chain
                      break;
                    }
                  }
                }
              }
              
              // Add remaining items (non-combo, non-grouped children)
              for (let i = 0; i < formData.products.length; i++) {
                if (!rendered.has(i)) {
                  elements.push({ product: formData.products[i], index: i });
                }
              }
              
              return elements.map(({ product, index, isGroupedChild }) => (
              <Card key={index} className={`${product.is_cancelled ? 'bg-red-50 border-red-200' : product.is_extra ? 'bg-purple-50 border-purple-200 border-l-4 border-l-purple-400' : ''} ${isGroupedChild ? 'ml-6' : ''}`}>
                <CardContent className="p-3">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-xs flex items-center gap-1">
                        {product.is_extra && <span className="text-purple-600">↳</span>}
                        {product.is_extra ? 'Selección del menú' : 'Producto'}
                      </Label>
                      <Input
                        className="h-9"
                        value={product.product_name || ''}
                        onChange={(e) => updateProduct(index, 'product_name', e.target.value)}
                        placeholder="Nombre del producto"
                        list={`products-list-${index}`}
                      />
                      <datalist id={`products-list-${index}`}>
                        {availableProducts.map(p => (
                          <option key={p.id} value={p.product_name}>
                            {p.product_name} - {formatCurrency(p.unit_price || 0, currency)}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Cant.</Label>
                      <Input 
                        type="number"
                        min="1"
                        className="h-9"
                        value={product.quantity}
                        onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Precio</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currencySymbol}</span>
                        <Input 
                          type="number"
                          step="0.01"
                          className="h-9 pl-7 text-sm"
                          value={product.unit_price}
                          onChange={(e) => updateProduct(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <Label className="text-xs">Subtotal</Label>
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency((product.quantity || 1) * (product.unit_price || 0), currency)}
                      </p>
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => removeProduct(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={product.is_extra || false}
                          onCheckedChange={(v) => updateProduct(index, 'is_extra', v)}
                        />
                        <span className="text-xs text-purple-600">Selección del menú</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={product.is_combo_container || false}
                          onCheckedChange={(v) => updateProduct(index, 'is_combo_container', v)}
                        />
                        <span className="text-xs text-orange-600">Producto combo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={product.is_cancelled}
                          onCheckedChange={(v) => updateProduct(index, 'is_cancelled', v)}
                        />
                        <span className="text-xs text-gray-500">Cancelado</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {product.is_combo_container && <Badge className="text-xs bg-orange-100 text-orange-700">Combo</Badge>}
                      {product.is_extra && <Badge className="text-xs bg-purple-100 text-purple-700">Selección</Badge>}
                      {product.is_cancelled && <Badge variant="destructive" className="text-xs">Cancelado</Badge>}
                    </div>
                    </div>
                </CardContent>
              </Card>
              ));
            })()}
          </div>
        )}
      </div>

      <Separator />

      {/* Resumen de Totales - SIMPLIFICADO */}
      <Card className="bg-gradient-to-br from-slate-50 to-gray-100 border-slate-200">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <Label className="text-base font-semibold">Resumen de Venta</Label>
          </div>

          {/* Total de productos */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Productos</span>
            <span className="text-lg font-medium">{formatCurrency(calculations.totalProductos, currency)}</span>
          </div>

          {/* Descuento */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded-lg border">
            <div>
              <Label className="text-xs text-gray-500">Descuento %</Label>
              <Input 
                type="number"
                min="0"
                max="100"
                className="h-8 text-sm"
                value={formData.discount_percentage || ''}
                onChange={(e) => {
                  updateField('discount_percentage', parseFloat(e.target.value) || 0);
                  updateField('discount_amount', 0);
                }}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">o Monto fijo</Label>
              <Input 
                type="number"
                className="h-8 text-sm"
                value={formData.discount_amount || ''}
                onChange={(e) => {
                  updateField('discount_amount', parseFloat(e.target.value) || 0);
                  updateField('discount_percentage', 0);
                }}
                placeholder="0"
              />
            </div>
            <div className="flex items-end justify-end">
              {calculations.descuento > 0 && (
                <span className="text-red-600 font-medium">-{formatCurrency(calculations.descuento, currency)}</span>
              )}
            </div>
          </div>

          {/* Propina */}
          <div className="flex items-center gap-4 p-3 bg-white rounded-lg border">
            <div className="flex-1">
              <Label className="text-xs text-gray-500 flex items-center gap-1">
                <Receipt className="w-3 h-3" /> Propina
              </Label>
              <Input 
                type="number"
                className="h-8 text-sm"
                value={formData.tip_amount || ''}
                onChange={(e) => updateField('tip_amount', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            {formData.tip_amount > 0 && (
              <span className="text-emerald-600 font-medium">+{formatCurrency(formData.tip_amount, currency)}</span>
            )}
          </div>

          {/* TOTAL A COBRAR - Destacado */}
          <div className="bg-emerald-600 text-white rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-emerald-100">Total a Cobrar</span>
              <span className="text-2xl font-bold">{formatCurrency(calculations.totalConPropina, currency)}</span>
            </div>
            {formData.tip_amount > 0 && (
              <div className="flex justify-between text-emerald-200 text-sm mt-1">
                <span>Sin propina</span>
                <span>{formatCurrency(calculations.totalCobrar, currency)}</span>
              </div>
            )}
          </div>

          {/* Desglose Fiscal - Colapsable/Informativo */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
                <Calculator className="w-3 h-3" /> Desglose Fiscal (IVA {formData.tax_rate}%)
              </span>
              <Switch 
                checked={formData.applies_tax}
                onCheckedChange={(v) => updateField('applies_tax', v)}
              />
            </div>
            {formData.applies_tax && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between text-amber-700">
                  <span>Venta Neta:</span>
                  <span>{formatCurrency(calculations.ventaNeta, currency)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>IVA:</span>
                  <span>{formatCurrency(calculations.iva, currency)}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estado y notas */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
          <Switch 
            checked={formData.is_cancelled}
            onCheckedChange={(v) => updateField('is_cancelled', v)}
          />
          <div>
            <Label className="text-sm">Venta cancelada</Label>
            <p className="text-xs text-gray-500">Marcar si esta venta fue anulada</p>
          </div>
          {formData.is_cancelled && (
            <Badge variant="destructive" className="ml-auto">CANCELADA</Badge>
          )}
        </div>

        <div>
          <Label>Notas</Label>
          <Textarea 
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Observaciones adicionales..."
            rows={3}
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || !formData.restaurant_id}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar Venta'
          )}
        </Button>
      </div>
    </form>
  );
}