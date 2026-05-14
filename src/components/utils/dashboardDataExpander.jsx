/**
 * Expands compressed dashboard data from the backend.
 * Backend sends short field names to reduce payload size.
 * This module maps them back to full names for frontend consumption.
 */

export function expandSale(s) {
  if (!s || s.total_amount !== undefined) return s; // already expanded
  return {
    date_time: s.dt,
    total_amount: s.t || 0,
    tax_rate: s.tr || 19,
    applies_tax: s.at !== false,
    sale_type: s.st === 'd' ? 'delivery' : 'local',
    delivery_source: s.ds || '',
    num_guests: s.ng || 0,
    tip_amount: s.ti || 0,
    discount_amount: s.di || 0,
    payment_method: s.pm || '',
  };
}

export function expandPrevSale(s) {
  if (!s || s.total_amount !== undefined) return s;
  return {
    date_time: s.dt,
    total_amount: s.t || 0,
    tax_rate: s.tr || 19,
    applies_tax: s.at !== false,
    sale_type: s.st === 'd' ? 'delivery' : 'local',
    delivery_source: s.ds || '',
    tip_amount: s.ti || 0,
    discount_amount: s.di || 0,
  };
}

export function expandSupplyCost(c) {
  if (!c || c.supply_category !== undefined) return c;
  return {
    supply_category: c.sc,
    supply_item_name: c.si,
    total_cost: c.tc || 0,
    subtotal: c.sb || 0,
    date: c.d,
    supplier: c.s,
    notes: c.n,
    invoice_items: c.ii ? c.ii.map(i => ({ name: i.n, subtotal: i.sb || 0, category: i.c })) : undefined,
    payment_status: 'pagado',
  };
}

export function expandPrevSupplyCost(c) {
  if (!c || c.supply_category !== undefined) return c;
  return {
    supply_category: c.sc,
    total_cost: c.tc || 0,
    date: c.d,
  };
}

export function expandOpex(o) {
  if (!o || o.type !== undefined) return o;
  return {
    type: o.ty,
    cost_center_name: o.cc,
    category: o.ca,
    description: o.de,
    amount: o.a || 0,
    date: o.d,
    payment_status: 'pagado',
  };
}

export function expandPrevOpex(o) {
  if (!o || o.type !== undefined) return o;
  return {
    type: o.ty,
    cost_center_name: o.cc,
    category: o.ca,
    amount: o.a || 0,
    date: o.d,
  };
}

export function expandAllSupplyCost(c) {
  if (!c || c.supply_category !== undefined) return c;
  return {
    supply_category: c.sc,
    supply_item_name: c.si,
    total_cost: c.tc || 0,
    subtotal: c.sb || 0,
    date: c.d,
    notes: c.n,
    supplier: c.s,
  };
}

export function expandAllOpex(o) {
  if (!o || o.type !== undefined) return o;
  return {
    type: o.ty,
    cost_center_name: o.cc,
    category: o.ca,
    description: o.de,
    amount: o.a || 0,
    date: o.d,
  };
}