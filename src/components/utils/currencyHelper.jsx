// Helper para formatear moneda según el restaurante seleccionado
export const getCurrencySymbol = (currency) => {
  const symbols = {
    USD: 'US$',
    EUR: '€',
    MXN: 'MX$',
    COP: 'COP$',
    ARS: 'AR$',
    CLP: 'CLP$',
    PEN: 'S/'
  };
  return symbols[currency] || '$';
};

export const getCurrencyName = (currency) => {
  const names = {
    USD: 'Dólares',
    EUR: 'Euros',
    MXN: 'Pesos MX',
    COP: 'Pesos CO',
    ARS: 'Pesos AR',
    CLP: 'Pesos CL',
    PEN: 'Soles'
  };
  return names[currency] || currency;
};

// Obtener la moneda según el restaurante seleccionado
export const getSelectedCurrency = (selectedRestaurant, restaurants) => {
  if (selectedRestaurant === 'all' || !selectedRestaurant) {
    // Si hay restaurantes, usar la moneda del primero como referencia
    if (restaurants?.length > 0) {
      return restaurants[0].currency || 'USD';
    }
    return 'USD';
  }
  
  const restaurant = restaurants?.find(r => r.id === selectedRestaurant);
  return restaurant?.currency || 'USD';
};

// Formatear número como moneda (formato consistente para todos los países)
export const formatCurrency = (value, currency = 'USD', options = {}) => {
  const { 
    compact = false, 
    showSymbol = true,
    minimumFractionDigits = 0,
    maximumFractionDigits = 0
  } = options;

  const absValue = Math.abs(value || 0);
  const symbol = showSymbol ? getCurrencySymbol(currency) : '';
  const sign = value < 0 ? '-' : '';

  // Formato de número con separador de miles
  const formatNumber = (num, decimals = 0) => {
    return num.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  if (compact) {
    // Formato compacto para números grandes
    if (absValue >= 1000000) {
      return `${sign}${symbol}${(absValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `${sign}${symbol}${(absValue / 1000).toFixed(1)}K`;
    }
    return `${sign}${symbol}${formatNumber(absValue)}`;
  }

  // Formato estándar con símbolo consistente
  return `${sign}${symbol}${formatNumber(absValue, maximumFractionDigits)}`;
};