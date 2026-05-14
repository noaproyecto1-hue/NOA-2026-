import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as XLSX from 'xlsx';

import { Download, ShoppingBag, Receipt, Carrot, HelpCircle, ChevronUp, Trash2, ChefHat } from "lucide-react";

const templateInstructions = {
  purchases: {
    title: 'Cómo usar la plantilla de Compras y Gastos',
    sections: [
      {
        subtitle: '¿Qué es esta plantilla?',
        content: 'Plantilla UNIFICADA para registrar todas las compras y gastos del negocio. El sistema clasifica automáticamente según el Centro de Costo.'
      },
      {
        subtitle: '⚠️ IMPORTANTE: Un insumo por fila',
        content: `Para que el stock se actualice correctamente, cada fila debe tener UN SOLO INSUMO.

❌ INCORRECTO: "Tomate, Lechuga, Cebolla" en una fila
✅ CORRECTO: 3 filas separadas, una para cada insumo

Si compras varios insumos en una factura, sepáralos en filas distintas.`
      },
      {
        subtitle: '⚠️ Clasificación Automática por Tipo',
        content: `La columna "tipo" determina dónde va cada registro:

🍽️ FOOD COST → Es una compra de insumos/suministros (actualiza stock e inventario)
💼 PAYROLL/RRHH, MARKETING, ADMINISTRACIÓN, etc. → Son gastos operativos (OpEx)

Los tipos disponibles corresponden a los Centros de Costo configurados en tu restaurante.`
      },
      {
        subtitle: 'Columnas principales',
        content: `• fecha: Fecha de la compra (15/01/2025 o 2025-01-15)
• proveedor: Nombre del proveedor
• rut_proveedor: RUT o identificación fiscal del proveedor
• numero_factura: Número de factura
• monto_neto: Monto SIN IVA (de este insumo específico)
• exento_iva: true/false (sueldos son exentos)
• iva: Monto del IVA
• detalles_compra: Nombre del insumo (debe coincidir con tu catálogo)
• cantidad: Cantidad comprada de este insumo
• unidad: Unidad de medida (kg, g, L, ml, unidad, etc.)
• tipo: FOOD COST, PAYROLL/RRHH, REAL STATE/RENTA, MARKETING, etc. (Centro de Costo)
• categoria: Para FOOD COST → categoría de insumo (FRUTAS Y VERDURAS, CARNES). Para otros centros → subcategoría del centro (COCINEROS, RENTA MENSUAL, etc.). Opcional.
• fecha_pago: Fecha de pago (si es diferente)
• estado_pago: pagado / pendiente
• comprador: Quién realizó la compra`
      },
      {
        subtitle: '🆕 Categoría automática y stock',
        content: `La CATEGORÍA (solo para FOOD COST) se resuelve automáticamente:
1. Si pones "categoria" en el XLSX, se usa directamente (ej: FRUTAS Y VERDURAS)
2. Si no, se busca el nombre del insumo (detalles_compra) en el catálogo y se toma su categoría
3. Esto alimenta correctamente el desglose de Food Cost en el Estado de Resultados

El STOCK se actualiza cuando:
1. El tipo es FOOD COST
2. El nombre en detalles_compra coincide con un insumo del catálogo
3. Tiene cantidad y unidad válidas`
      }
    ]
  },
  sales: {
    title: 'Cómo usar la plantilla de Ventas',
    sections: [
      {
        subtitle: '¿Qué es esta plantilla?',
        content: 'Permite importar ventas/transacciones con múltiples productos. Cada fila representa un producto dentro de una venta.'
      },
      {
        subtitle: '📋 Tutorial paso a paso',
        content: `1️⃣ DESCARGA la plantilla haciendo clic en "Ventas"
2️⃣ ABRE el archivo .xlsx en Excel o Google Sheets
3️⃣ ELIMINA las filas de ejemplo (fila 2 en adelante)
4️⃣ LLENA tus datos siguiendo estas reglas:
   • Cada FILA = un producto vendido
   • Si una venta tiene 3 productos, usa 3 filas con el MISMO id_transaccion
   • El descuento y propina van SOLO en la primera fila de cada venta
5️⃣ GUARDA como .xlsx
6️⃣ VE a "Ventas y Compras" → pestaña "Ventas" → "Importar Documento"
7️⃣ SUBE el archivo y confirma`
      },
      {
        subtitle: '🍽️ MENÚS EJECUTIVOS / COMBOS (paso a paso)',
        content: `Si vendes "MENÚ EJECUTIVO" que incluye entrada + plato + postre, hay que registrarlo así:

PASO 1: Asegúrate de tener "MENU EJECUTIVO" configurado como combo en Cocina → Menús/Combos

PASO 2: En el XLSX, usa estas columnas especiales:
   • es_combo → pon "true" en la fila del MENÚ EJECUTIVO
   • es_sub_item → pon "true" en cada selección del cliente
   • producto_padre → pon "MENU EJECUTIVO" en cada selección

EJEMPLO (ver filas de ejemplo TRX002 en la plantilla):
   Fila 1: nombre_producto="MENU EJECUTIVO", precio=12000, es_combo=true
   Fila 2: nombre_producto="Ensalada César", precio=0, es_sub_item=true, producto_padre="MENU EJECUTIVO"
   Fila 3: nombre_producto="Pastel de Choclo", precio=0, es_sub_item=true, producto_padre="MENU EJECUTIVO"
   Fila 4: nombre_producto="Flan Casero", precio=0, es_sub_item=true, producto_padre="MENU EJECUTIVO"

⚠️ El precio va SOLO en el MENÚ EJECUTIVO (fila con es_combo=true)
⚠️ Los sub-items llevan precio 0 (ya está incluido en el combo)
⚠️ NOA descuenta inventario SOLO de los sub-items (Ensalada, Pastel, Flan), NO del combo`
      },
      {
        subtitle: '🔄 EXTRAS / MODIFICADORES',
        content: `Si un producto tiene un extra (ej: Huevo Frito Extra):
   • En la misma fila del producto, llena "extra", "cantidad_extra" y "precio_extra"
   • El sistema lo detecta y descuenta inventario del extra también
   
Ejemplo: Pizza Margherita con 2 Huevos Extra a $1.500 c/u:
   nombre_producto="Pizza Margherita", precio=15000, extra="Huevo Frito Extra", cantidad_extra=2, precio_extra=1500`
      },
      {
        subtitle: 'Columnas principales',
        content: `• id_transaccion: ID único de la venta (agrupa productos de la misma transacción)
• fecha_hora: Fecha y hora de la venta (15/01/2025 12:30)
• nombre_cliente: Nombre del cliente (opcional)
• numero_mesa: Número de mesa
• sala: Sala del restaurante
• num_personas: Cantidad de comensales
• nombre_camarero: Nombre del camarero
• metodo_pago: efectivo, tarjeta, transferencia, mixto
• tipo_venta: local o delivery
• origen_delivery: Uber Eats, Rappi, PedidosYa, Directo (solo si es delivery)`
      },
      {
        subtitle: 'Columnas de productos',
        content: `• nombre_producto: Nombre del producto/receta vendido
• cantidad: Cantidad vendida
• extra: Nombre de receta o insumo extra (ej: Huevo Frito Extra, Queso Extra)
• cantidad_extra: Cantidad del extra (ej: 2 para "2 Huevos Extra")
• precio_extra: Precio unitario del extra
• precio_unitario: Precio unitario del producto
• zona: cocina, barra, pastelería
• producto_cancelado: true/false si ese producto fue cancelado`
      },
      {
        subtitle: 'Columnas de totales',
        content: `• descuento: Monto de descuento aplicado
• propina: Monto de propina
• venta_cancelada: true/false si toda la venta fue cancelada

💡 El TOTAL se calcula automáticamente sumando (precio_unitario × cantidad) de cada producto.`
      },
      {
        subtitle: '⚠️ Importante',
        content: `• Las filas con el mismo id_transaccion pertenecen a la misma venta
• El total y la propina solo se ponen en la primera fila de cada transacción
• Los productos cancelados se marcan individualmente
• El campo "extra" puede ser una receta o un insumo, el sistema lo detectará`
      }
    ]
  },
  waste: {
    title: 'Cómo usar la plantilla de Merma',
    sections: [
      {
        subtitle: '¿Qué es esta plantilla?',
        content: 'Plantilla para registrar la merma diaria de insumos. Cada fila representa un insumo que se perdió por algún motivo.'
      },
      {
        subtitle: 'Columnas principales',
        content: `• fecha: Fecha de la merma (15/01/2025 o 2025-01-15)
• insumo: Nombre del insumo (debe coincidir con tu catálogo)
• cantidad: Cantidad perdida/mermada
• unidad: Unidad de medida (kg, g, L, ml, unidad, etc.)
• motivo: vencimiento, daño, contaminacion, preparacion, otro
• notas: Detalle adicional (opcional)`
      },
      {
        subtitle: 'Ejemplo de uso',
        content: `Tu equipo llena esta planilla todos los días con lo que se perdió.
Al final del día o semana, la suben al sistema con el botón "Importar Documento" en la pestaña Merma del Inventario.

El sistema:
1. Detecta cada insumo y lo cruza con tu catálogo
2. Calcula el valor estimado de la pérdida
3. Descuenta el stock automáticamente
4. Registra el movimiento como merma`
      }
    ]
  },
  recipes: {
    title: 'Cómo usar la plantilla de Recetas',
    sections: [
      {
        subtitle: '¿Qué es esta plantilla?',
        content: 'Permite importar todas tus recetas de golpe: info general + ingredientes + sub-recetas. El archivo tiene 2 hojas.'
      },
      {
        subtitle: 'Hoja 1: "Recetas"',
        content: `Cada fila es una receta. Columnas:
• nombre_receta: Nombre del plato (obligatorio)
• categoria: Categoría (Comida, Bebidas, Postres, etc.)
• descripcion: Descripción corta del plato
• precio_venta: Precio de venta al público
• tiempo_preparacion: Tiempo en minutos
• porciones: Cuántas porciones rinde la receta
• unidad_porciones: porción, g, kg, ml, L, unidad
• es_sub_receta: true/false (si es base, salsa, masa, etc.)
• instrucciones: Paso a paso de preparación`
      },
      {
        subtitle: 'Hoja 2: "Ingredientes"',
        content: `Cada fila es un ingrediente o sub-receta usada. Columnas:
• nombre_receta: Nombre de la receta a la que pertenece (debe coincidir con Hoja 1)
• tipo: "ingrediente" o "sub_receta"
• nombre: Nombre del insumo (si es ingrediente) o de la sub-receta
• cantidad: Cantidad necesaria
• unidad: Unidad de medida (kg, g, L, ml, unidad, etc.)

💡 Los nombres de insumos se buscan automáticamente en tu catálogo (sin importar mayúsculas/tildes).
💡 Las sub-recetas se vinculan por nombre — deben existir en la Hoja 1 o ya estar creadas en el sistema.`
      },
      {
        subtitle: '⚠️ Importante',
        content: `• Las sub-recetas (es_sub_receta=true) se crean PRIMERO automáticamente
• No importa si escribes "TOMATE", "tomate" o "Tómate" — el sistema lo entiende igual
• Las fotos y PDFs se agregan manualmente después de importar
• Si una receta ya existe (mismo nombre), se omite para no duplicar`
      }
    ]
  },
  inventory: {
    title: 'Cómo usar la plantilla de Insumos',
    sections: [
      {
        subtitle: '¿Qué es esta plantilla?',
        content: 'Esta plantilla te permite crear tu catálogo de insumos para el inventario del restaurante.'
      },
      {
        subtitle: 'Columnas principales',
        content: `• nombre_insumo: Nombre del insumo (ej: Tomate, Carne Molida, Harina)
• categoria_insumo: Categoría del insumo (ej: Verduras, Carnes, Lácteos)
• area: Área/zona de preparación donde se almacena (ej: Cocina, Barra, Pastelería)
• proveedor: Proveedor principal del insumo (opcional)
• stock: Cantidad actual en inventario
• unidad: Unidad de medida (kg, g, L, ml, unidad, lb, oz, paquete, caja, docena, pieza, frasco)
• costo_unitario: Costo promedio por unidad de medida
• rendimiento: % de rendimiento del insumo (1-100). Ej: 80 = solo el 80% es utilizable. Si no se indica, se asume 100%.`
      },
      {
        subtitle: '🎯🟠🔴 Columnas opcionales de stock',
        content: `• stock_ideal: Cantidad objetivo que deberías mantener. Se usa para calcular cuánto comprar en la lista de compras.
• stock_advertencia: Stock mínimo para alerta naranja (advertencia). Opcional.
• stock_critico: Stock mínimo para alerta roja (crítico). Opcional.

Si no se incluyen, los valores quedan en 0 (sin alerta configurada).
Ejemplo: Si stock_ideal=25, stock_advertencia=10 y stock_critico=5, la lista de compras calculará que necesitas comprar (25 - stock_actual) unidades.`
      },
      {
        subtitle: 'Ejemplos',
        content: `• Tomate, Verduras, Cocina, Walmart, 15, kg, 2500, 5, 2
• Carne Molida, Carnes, Cocina, Carnicería Central, 8, lb, 12000, 3, 1
• Detergente, Limpieza, Bodega, , 3, unidad, 5500 (sin alertas)`
      },
      {
        subtitle: 'Importante',
        content: 'La categoría del insumo debe coincidir con las categorías configuradas en tu restaurante (ej: Verduras, Carnes, Lácteos).'
      }
    ]
  }
};

const templates = [
  {
    id: 'sales',
    name: 'Ventas',
    description: 'Plantilla para importar transacciones de ventas',
    icon: ShoppingBag,
    color: 'bg-emerald-100 text-emerald-600',
    available: true,
    format: 'xlsx',
    headers: [
      'id_transaccion',
      'fecha_hora',
      'nombre_cliente',
      'numero_mesa',
      'sala',
      'num_personas',
      'nombre_camarero',
      'metodo_pago',
      'tipo_venta',
      'origen_delivery',
      'nombre_producto',
      'categoria_producto',
      'cantidad',
      'precio_unitario',
      'extra',
      'cantidad_extra',
      'precio_extra',
      'zona',
      'producto_cancelado',
      'es_combo',
      'es_sub_item',
      'producto_padre',
      'descuento',
      'propina',
      'venta_cancelada',
      'notas'
    ],
    exampleRows: [
      ['TRX001', '15/01/2025 12:30', 'Juan Pérez', 5, 'Principal', 4, 'María', 'tarjeta', 'local', '', 'Hamburguesa Clásica', 'Burger', 2, 12500, '', '', '', 'cocina', 'false', '', '', '', 0, 2500, 'false', ''],
      ['TRX001', '', '', '', '', '', '', '', '', '', 'Coca Cola', 'Bebidas', 4, 2500, '', '', '', 'barra', 'false', '', '', '', '', '', '', ''],
      ['TRX002', '15/01/2025 13:15', '', '', '', 1, 'Carlos', 'efectivo', 'local', '', 'MENU EJECUTIVO', '', 1, 12000, '', '', '', '', 'false', 'true', '', '', 0, 0, 'false', ''],
      ['TRX002', '', '', '', '', '', '', '', '', '', 'Ensalada César', 'Entrada', 1, 0, '', '', '', 'cocina', 'false', '', 'true', 'MENU EJECUTIVO', '', '', '', ''],
      ['TRX002', '', '', '', '', '', '', '', '', '', 'Pastel de Choclo', 'Plato Fondo', 1, 0, '', '', '', 'cocina', 'false', '', 'true', 'MENU EJECUTIVO', '', '', '', ''],
      ['TRX002', '', '', '', '', '', '', '', '', '', 'Flan Casero', 'Postre', 1, 0, '', '', '', 'cocina', 'false', '', 'true', 'MENU EJECUTIVO', '', '', '', ''],
      ['TRX003', '15/01/2025 14:00', '', 3, '', 2, 'Pedro', 'efectivo', 'local', '', 'Pizza Margherita', 'Pizza', 1, 15000, 'Huevo Frito Extra', 2, 1500, 'cocina', 'false', '', '', '', 0, 0, 'false', '']
    ]
  },
  {
    id: 'purchases',
    name: 'Compras y Gastos',
    description: 'Plantilla UNIFICADA para compras y gastos (clasifica automáticamente)',
    icon: Receipt,
    color: 'bg-blue-100 text-blue-600',
    available: true,
    format: 'xlsx',
    headers: [
      'fecha',
      'proveedor',
      'rut_proveedor',
      'numero_factura',
      'monto_neto',
      'exento_iva',
      'iva',
      'detalles_compra',
      'cantidad',
      'unidad',
      'tipo',
      'categoria',
      'fecha_pago',
      'estado_pago',
      'comprador'
    ],
    exampleRows: [
      ['15/01/2025', 'Walmart', '76.xxx.xxx-x', 'FAC-001', 50000, 'false', 9500, 'Tomate', 10, 'kg', 'FOOD COST', 'FRUTAS Y VERDURAS', '', 'pagado', 'Juan'],
      ['15/01/2025', 'Walmart', '76.xxx.xxx-x', 'FAC-001', 30000, 'false', 5700, 'Lechuga', 15, 'unidad', 'FOOD COST', 'FRUTAS Y VERDURAS', '', 'pagado', 'Juan'],
      ['15/01/2025', 'Walmart', '76.xxx.xxx-x', 'FAC-001', 25000, 'false', 4750, 'Cebolla', 8, 'kg', 'FOOD COST', 'FRUTAS Y VERDURAS', '', 'pagado', 'Juan'],
      ['15/01/2025', 'Carniceria Central', '77.xxx.xxx-x', 'FAC-002', 280000, 'false', 53200, 'Carne Molida', 15, 'kg', 'FOOD COST', 'CARNES', '', 'pagado', 'Juan'],
      ['15/01/2025', 'Movistar', '99.xxx.xxx-x', 'SRV-123', 45000, 'false', 8550, 'Plan internet mensual', '', '', 'ADMINISTRACIÓN', '', '20/01/2025', 'pendiente', ''],
      ['15/01/2025', '', '', '', 850000, 'true', 0, 'Liquidacion Maria Gonzalez', '', '', 'PAYROLL/RRHH', 'COCINEROS', '20/01/2025', 'pagado', ''],
      ['15/01/2025', '', '', '', 1200000, 'false', 0, 'Arriendo local comercial', '', '', 'REAL STATE/RENTA', 'RENTA MENSUAL', '01/01/2025', 'pagado', ''],
      ['15/01/2025', 'Proveedor Limpieza', '78.xxx.xxx-x', 'FAC-055', 35000, 'false', 6650, 'Detergente', 5, 'unidad', 'FOOD COST', 'LIMPIEZA', '', 'pagado', ''],
      ['15/01/2025', 'Ferreteria', '79.xxx.xxx-x', 'FAC-789', 120000, 'false', 22800, 'Reparacion horno industrial', '', '', 'GASTOS FIJOS', '', '', 'pendiente', 'Carlos']
    ]
  },

  {
    id: 'waste',
    name: 'Merma Diaria',
    description: 'Plantilla para registrar merma/pérdida diaria de insumos',
    icon: Trash2,
    color: 'bg-orange-100 text-orange-600',
    available: true,
    format: 'xlsx',
    headers: [
      'fecha',
      'insumo',
      'cantidad',
      'unidad',
      'motivo',
      'notas'
    ],
    exampleRows: [
      ['15/01/2025', 'Tomate', 2.5, 'kg', 'vencimiento', 'Llegaron muy maduros'],
      ['15/01/2025', 'Lechuga', 3, 'unidad', 'daño', 'Hojas marchitas'],
      ['15/01/2025', 'Carne Molida', 1.2, 'kg', 'contaminacion', 'Se cortó la cadena de frío'],
      ['15/01/2025', 'Queso Mozzarella', 0.5, 'kg', 'preparacion', 'Error en porcionado'],
      ['15/01/2025', 'Aceite de Oliva', 0.3, 'L', 'otro', 'Derrame accidental']
    ]
  },
  {
    id: 'recipes',
    name: 'Recetas',
    description: 'Plantilla para importar recetas con ingredientes y sub-recetas',
    icon: ChefHat,
    color: 'bg-orange-100 text-orange-600',
    available: true,
    format: 'xlsx',
    multiSheet: true,
    sheets: [
      {
        name: 'Recetas',
        headers: [
          'nombre_receta',
          'categoria',
          'descripcion',
          'precio_venta',
          'tiempo_preparacion',
          'porciones',
          'unidad_porciones',
          'es_sub_receta',
          'instrucciones'
        ],
        rows: [
          ['Salsa Bolognesa', 'Comida', 'Salsa italiana clásica', '', 45, 10, 'porción', 'true', 'Sofreír cebolla y ajo. Agregar carne molida...'],
          ['Hamburguesa Clásica', 'Comida', 'Hamburguesa con queso y lechuga', 12500, 15, 1, 'porción', 'false', '1. Formar la carne en disco. 2. Cocinar a la plancha...'],
          ['Pasta Bolognesa', 'Comida', 'Pasta con salsa bolognesa casera', 11000, 20, 1, 'porción', 'false', '1. Hervir la pasta. 2. Calentar la salsa...'],
          ['Limonada Natural', 'Bebidas', 'Limonada con azúcar', 4500, 5, 1, 'porción', 'false', 'Exprimir limones, agregar agua y azúcar']
        ]
      },
      {
        name: 'Ingredientes',
        headers: [
          'nombre_receta',
          'tipo',
          'nombre',
          'cantidad',
          'unidad'
        ],
        rows: [
          ['Salsa Bolognesa', 'ingrediente', 'Carne Molida', 2, 'kg'],
          ['Salsa Bolognesa', 'ingrediente', 'Tomate', 1.5, 'kg'],
          ['Salsa Bolognesa', 'ingrediente', 'Cebolla', 0.3, 'kg'],
          ['Salsa Bolognesa', 'ingrediente', 'Aceite de Oliva', 0.05, 'L'],
          ['Hamburguesa Clásica', 'ingrediente', 'Carne Molida', 0.2, 'kg'],
          ['Hamburguesa Clásica', 'ingrediente', 'Queso Mozzarella', 0.05, 'kg'],
          ['Hamburguesa Clásica', 'ingrediente', 'Lechuga', 0.03, 'kg'],
          ['Pasta Bolognesa', 'ingrediente', 'Pasta Seca', 0.15, 'kg'],
          ['Pasta Bolognesa', 'sub_receta', 'Salsa Bolognesa', 1, 'porción'],
          ['Limonada Natural', 'ingrediente', 'Limón', 3, 'unidad'],
          ['Limonada Natural', 'ingrediente', 'Azúcar', 0.05, 'kg']
        ]
      }
    ]
  },
  {
    id: 'inventory',
    name: 'Insumos',
    description: 'Plantilla para importar insumos al inventario',
    icon: Carrot,
    color: 'bg-green-100 text-green-600',
    available: true,
    format: 'xlsx',
    headers: [
      'nombre_insumo',
      'categoria_insumo',
      'area',
      'proveedor',
      'stock',
      'unidad',
      'costo_unitario',
      'stock_ideal',
      'stock_advertencia',
      'stock_critico',
      'rendimiento'
    ],
    exampleRows: [
      ['Tomate', 'Verduras', 'Cocina', 'Walmart', 15, 'kg', 2500, 25, 5, 2, 90],
      ['Carne Molida', 'Carnes', 'Cocina', 'Carnicería Central', 8, 'lb', 12000, 15, 3, 1, 85],
      ['Lechuga', 'Verduras', 'Cocina', 'Walmart', 10, 'kg', 1800, 20, 4, 2, 70],
      ['Queso Mozzarella', 'Lácteos', 'Cocina', '', 5, 'kg', 8500, 10, 2, 1, 100],
      ['Aceite de Oliva', 'Aceites', 'Cocina', '', 3, 'L', 15000, 5, '', '', 100],
      ['Detergente', 'Limpieza', 'Bodega', 'Proveedor Limpieza', 4, 'unidad', 5500, 8, 2, 1, 100],
      ['Servilletas', 'Desechables', 'Bodega', '', 20, 'paquete', 3200, 30, '', '', 100]
    ]
  }
];

export default function TemplatesDownloadDialog({ open, onOpenChange }) {
  const [expandedInstructions, setExpandedInstructions] = useState(null);

  const toggleInstructions = (templateId, e) => {
    e.stopPropagation();
    setExpandedInstructions(expandedInstructions === templateId ? null : templateId);
  };

  const downloadTemplate = (template) => {
    if (!template.available) return;

    // Multi-sheet template (e.g. Recetas)
    if (template.multiSheet && template.sheets) {
      const wb = XLSX.utils.book_new();
      for (const sheet of template.sheets) {
        const data = [sheet.headers, ...sheet.rows];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const colWidths = sheet.headers.map((h, i) => {
          const maxLen = Math.max(h.length, ...sheet.rows.map(r => String(r[i] || '').length));
          return { wch: Math.min(maxLen + 2, 35) };
        });
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      }
      XLSX.writeFile(wb, `plantilla_${template.id}.xlsx`);
      return;
    }

    if (!template.headers) return;
    
    const rows = template.exampleRows || (template.exampleRow ? [template.exampleRow] : []);
    
    // Si el formato es XLSX, usar la librería xlsx
    if (template.format === 'xlsx') {
      const data = [template.headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
      
      // Ajustar ancho de columnas
      const colWidths = template.headers.map((h, i) => {
        const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
        return { wch: Math.min(maxLen + 2, 30) };
      });
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, `plantilla_${template.id}.xlsx`);
      return;
    }
    
    // Formato CSV por defecto
    let csvRows = [template.headers.join(',')];
    
    rows.forEach(row => {
      const formattedRow = row.map(cell => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('[')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
      csvRows.push(formattedRow);
    });
    
    const csvContent = csvRows.join('\n');
    
    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plantilla_${template.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Descargar Plantillas XLSX
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <div key={template.id} className="space-y-2">
                <Card 
                  className={`p-4 ${template.available ? 'hover:shadow-md cursor-pointer' : 'opacity-50'} transition-shadow`}
                  onClick={() => template.available && downloadTemplate(template)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${template.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        {!template.available && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Próximamente</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{template.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {template.available && templateInstructions[template.id] && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => toggleInstructions(template.id, e)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          {expandedInstructions === template.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <HelpCircle className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {template.available && (
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Instrucciones expandibles */}
                {expandedInstructions === template.id && templateInstructions[template.id] && (
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" />
                      {templateInstructions[template.id].title}
                    </h4>
                    <div className="max-h-64 overflow-y-auto">
                      <div className="space-y-4 pr-2">
                        {templateInstructions[template.id].sections.map((section, idx) => (
                          <div key={idx}>
                            <h5 className="font-medium text-blue-800 text-sm mb-1">{section.subtitle}</h5>
                            <p className="text-sm text-blue-700 whitespace-pre-line">{section.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Nota:</strong> Las plantillas incluyen una fila de ejemplo. Elimínala antes de importar tus datos reales.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}