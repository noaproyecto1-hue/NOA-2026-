import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Búsqueda robusta de entidades por nombre.
 * Hace matching case-insensitive, sin acentos, con soporte fuzzy (partial/token match).
 *
 * Payload:
 * {
 *   entityType: 'Recipe' | 'SupplyItem' | 'Supplier' | 'Customer',
 *   query: 'zapallo asado',
 *   restaurantId: '<id>' (opcional — si no, busca en todos los del usuario),
 *   limit: 5 (default)
 * }
 *
 * Respuesta:
 * {
 *   matches: [
 *     { id, name, score, ...campos clave },
 *     ...
 *   ],
 *   total_found: N
 * }
 */

// Normaliza: minúsculas + quita acentos + quita caracteres especiales + colapsa espacios
function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')    // solo letras, números, espacios
    .replace(/\s+/g, ' ')             // colapsa espacios
    .trim();
}

// Calcula score de similitud entre query y candidato (0 a 100)
function matchScore(queryNorm, candidateNorm) {
  if (!queryNorm || !candidateNorm) return 0;

  // 1. Match exacto = 100
  if (queryNorm === candidateNorm) return 100;

  // 2. Candidato contiene query entero = 90
  if (candidateNorm.includes(queryNorm)) return 90;

  // 3. Query contiene candidato entero = 85
  if (queryNorm.includes(candidateNorm)) return 85;

  // 4. Match por tokens (palabras)
  const queryTokens = queryNorm.split(' ').filter(t => t.length >= 2);
  const candTokens = candidateNorm.split(' ').filter(t => t.length >= 2);
  if (queryTokens.length === 0 || candTokens.length === 0) return 0;

  let matchedTokens = 0;
  queryTokens.forEach(qt => {
    if (candTokens.some(ct => ct === qt || ct.includes(qt) || qt.includes(ct))) {
      matchedTokens++;
    }
  });

  const tokenScore = (matchedTokens / queryTokens.length) * 80;

  // 5. Bonus si todos los tokens del query están en el candidato
  const allMatch = matchedTokens === queryTokens.length;
  return allMatch ? Math.max(tokenScore, 75) : tokenScore;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityType, query, restaurantId, limit = 5 } = await req.json();

    if (!entityType || !query) {
      return Response.json({ error: 'entityType and query are required' }, { status: 400 });
    }

    const allowedEntities = ['Recipe', 'SupplyItem', 'Supplier', 'Customer'];
    if (!allowedEntities.includes(entityType)) {
      return Response.json({ error: `entityType must be one of: ${allowedEntities.join(', ')}` }, { status: 400 });
    }

    // Determinar restaurantes accesibles
    let accessibleIds = [];
    if (user.restaurant_ids?.length > 0) {
      accessibleIds = user.restaurant_ids;
    } else if (user.role === 'admin' || user.app_role === 'manager') {
      const owned = await base44.asServiceRole.entities.Restaurant.filter({
        is_active: true,
        created_by: user.email,
      });
      accessibleIds = owned.map(r => r.id);
    }

    if (accessibleIds.length === 0) {
      return Response.json({ matches: [], total_found: 0 });
    }

    const targetIds = restaurantId && restaurantId !== 'all' && accessibleIds.includes(restaurantId)
      ? [restaurantId]
      : accessibleIds;

    // Traer candidatos de todos los restaurantes objetivo
    const batches = await Promise.all(
      targetIds.map(id => base44.asServiceRole.entities[entityType].filter({ restaurant_id: id }))
    );
    const allCandidates = batches.flat();

    // Campo nombre según entidad
    const nameField = entityType === 'Recipe' ? 'dish_name' : 'name';
    const queryNorm = normalize(query);

    // Score cada candidato
    const scored = allCandidates
      .map(item => {
        const candName = item[nameField] || '';
        const score = matchScore(queryNorm, normalize(candName));
        return { item, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Formatear salida con campos clave según entidad
    const matches = scored.map(({ item, score }) => {
      const base = {
        id: item.id,
        name: item[nameField],
        score: Math.round(score),
        restaurant_id: item.restaurant_id,
      };
      if (entityType === 'Recipe') {
        return {
          ...base,
          category: item.category,
          sale_price: item.sale_price,
          servings: item.servings,
          ingredients_count: (item.ingredients || []).length,
          sub_recipes_count: (item.sub_recipes || []).length,
          is_active: item.is_active,
        };
      }
      if (entityType === 'SupplyItem') {
        return {
          ...base,
          category: item.category,
          unit: item.unit_of_measure,
          current_stock: item.current_stock,
          avg_cost: item.average_unit_cost,
        };
      }
      if (entityType === 'Supplier') {
        return {
          ...base,
          tax_id: item.tax_id,
          supplier_type: item.supplier_type,
        };
      }
      if (entityType === 'Customer') {
        return {
          ...base,
          email: item.email,
          phone: item.phone,
        };
      }
      return base;
    });

    return Response.json({
      matches,
      total_found: matches.length,
      query_normalized: queryNorm,
    });
  } catch (error) {
    console.error('findEntityByName error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});