import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * testEbillConnection
 * 
 * Tests connection to eBill API by fetching company data.
 * eBill API docs: https://developers.ebill.cl/docs-page.html
 * 
 * Authentication: X-Api-Key + X-Access-Token headers
 * Environments:
 *   - Production: https://api.ebill.cl
 *   - Development: https://qaapi.ebill.cl
 * 
 * Endpoints used:
 *   GET /account/{Rut} — Fetch company info (validates credentials)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, restaurant_id, api_key, access_token, environment } = body;

    if (action === 'test_connection') {
      // Get restaurant to find its RUT
      const restaurants = await base44.entities.Restaurant.filter({ id: restaurant_id });
      const restaurant = restaurants?.[0];
      
      if (!restaurant) {
        return Response.json({ success: false, error: 'Restaurante no encontrado' });
      }

      const rut = restaurant.tax_id;
      if (!rut) {
        return Response.json({ 
          success: false, 
          error: 'El restaurante no tiene un RUT configurado. Ve a Configuración → Operación y agrega el RUT del restaurante primero.' 
        });
      }

      // Clean RUT: remove dots, keep dash
      const cleanRut = rut.replace(/\./g, '');
      
      // Determine API base URL
      const baseUrl = environment === 'development' 
        ? 'https://qaapi.ebill.cl' 
        : 'https://api.ebill.cl';

      // Call eBill API: GET /account/{Rut}
      const response = await fetch(`${baseUrl}/account/${cleanRut}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': api_key,
          'X-Access-Token': access_token,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        return Response.json({ 
          success: false, 
          error: 'Credenciales inválidas. Verifica tu X-Api-Key y X-Access-Token. Si el problema persiste, contacta a soporte@ebill.cl' 
        });
      }

      if (response.status === 404) {
        return Response.json({ 
          success: false, 
          error: `La empresa con RUT ${rut} no existe en eBill. Verifica que el RUT del restaurante coincida con el registrado en eBill.` 
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ 
          success: false, 
          error: `Error de eBill (HTTP ${response.status}): ${errorText}` 
        });
      }

      const data = await response.json();
      
      if (data.Code !== 200) {
        return Response.json({ 
          success: false, 
          error: `eBill respondió con código ${data.Code}: ${data.Status}` 
        });
      }

      // Success — return company info
      return Response.json({ 
        success: true, 
        company: data.Data,
        message: `Conexión exitosa con ${data.Data?.BusinessName || 'empresa'}`
      });
    }

    // Action: fetch_invoices (placeholder for future use)
    if (action === 'fetch_invoices') {
      return Response.json({ 
        success: false, 
        error: 'Función de obtención de facturas aún en desarrollo' 
      });
    }

    return Response.json({ error: 'Acción no reconocida' }, { status: 400 });

  } catch (error) {
    console.error('testEbillConnection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});