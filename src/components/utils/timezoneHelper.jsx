/**
 * Timezone Helper - Utilidades para manejo de zonas horarias en todo el sistema
 * 
 * IMPORTANTE: Este helper centraliza TODO el manejo de fechas basado en la zona horaria del usuario.
 * Usar estas funciones en lugar de new Date() directamente para asegurar consistencia.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Zona horaria por defecto si el usuario no tiene configurada
export const DEFAULT_TIMEZONE = 'America/Santiago';

// Lista de zonas horarias disponibles con nombres amigables
export const AVAILABLE_TIMEZONES = [
  // América
  { value: 'America/New_York', label: 'Nueva York (EST/EDT)', region: 'América del Norte' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)', region: 'América del Norte' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)', region: 'América del Norte' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (PST/PDT)', region: 'América del Norte' },
  { value: 'America/Mexico_City', label: 'Ciudad de México', region: 'México' },
  { value: 'America/Cancun', label: 'Cancún', region: 'México' },
  { value: 'America/Bogota', label: 'Bogotá (Colombia)', region: 'Sudamérica' },
  { value: 'America/Lima', label: 'Lima (Perú)', region: 'Sudamérica' },
  { value: 'America/Santiago', label: 'Santiago (Chile)', region: 'Sudamérica' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (Argentina)', region: 'Sudamérica' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (Brasil)', region: 'Sudamérica' },
  { value: 'America/Caracas', label: 'Caracas (Venezuela)', region: 'Sudamérica' },
  { value: 'America/Guayaquil', label: 'Guayaquil (Ecuador)', region: 'Sudamérica' },
  { value: 'America/La_Paz', label: 'La Paz (Bolivia)', region: 'Sudamérica' },
  { value: 'America/Montevideo', label: 'Montevideo (Uruguay)', region: 'Sudamérica' },
  { value: 'America/Asuncion', label: 'Asunción (Paraguay)', region: 'Sudamérica' },
  { value: 'America/Panama', label: 'Panamá', region: 'Centroamérica' },
  { value: 'America/Costa_Rica', label: 'Costa Rica', region: 'Centroamérica' },
  { value: 'America/Guatemala', label: 'Guatemala', region: 'Centroamérica' },
  { value: 'America/El_Salvador', label: 'El Salvador', region: 'Centroamérica' },
  { value: 'America/Tegucigalpa', label: 'Honduras', region: 'Centroamérica' },
  { value: 'America/Managua', label: 'Nicaragua', region: 'Centroamérica' },
  { value: 'America/Santo_Domingo', label: 'Santo Domingo (Rep. Dominicana)', region: 'Caribe' },
  { value: 'America/Puerto_Rico', label: 'Puerto Rico', region: 'Caribe' },
  // Europa
  { value: 'Europe/Madrid', label: 'Madrid (España)', region: 'Europa' },
  { value: 'Europe/London', label: 'Londres (UK)', region: 'Europa' },
  { value: 'Europe/Paris', label: 'París (Francia)', region: 'Europa' },
  { value: 'Europe/Berlin', label: 'Berlín (Alemania)', region: 'Europa' },
  { value: 'Europe/Rome', label: 'Roma (Italia)', region: 'Europa' },
  { value: 'Europe/Lisbon', label: 'Lisboa (Portugal)', region: 'Europa' },
  // Otros
  { value: 'UTC', label: 'UTC (Tiempo Universal)', region: 'Universal' },
];

// Agrupar zonas horarias por región
export const TIMEZONES_BY_REGION = AVAILABLE_TIMEZONES.reduce((acc, tz) => {
  if (!acc[tz.region]) acc[tz.region] = [];
  acc[tz.region].push(tz);
  return acc;
}, {});

/**
 * Obtiene la zona horaria del usuario o la por defecto
 * @param {Object} user - Objeto usuario con campo timezone
 * @returns {string} Zona horaria IANA
 */
export const getUserTimezone = (user) => {
  return user?.timezone || DEFAULT_TIMEZONE;
};

/**
 * Obtiene la fecha/hora actual en la zona horaria del usuario
 * @param {Object} user - Objeto usuario
 * @returns {Date} Fecha actual en zona del usuario
 */
export const getCurrentDateInUserTz = (user) => {
  try {
    const tz = getUserTimezone(user);
    return toZonedTime(new Date(), tz);
  } catch (e) {
    return new Date();
  }
};

/**
 * Formatea una fecha en la zona horaria del usuario
 * @param {Date|string} date - Fecha a formatear
 * @param {string} formatStr - Formato de salida (date-fns)
 * @param {Object} user - Objeto usuario
 * @returns {string} Fecha formateada
 */
export const formatDateInUserTz = (date, formatStr, user) => {
  if (!date) return '';
  try {
    const tz = getUserTimezone(user);
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    return formatInTimeZone(dateObj, tz, formatStr, { locale: es });
  } catch (e) {
    return '';
  }
};

/**
 * Convierte una fecha local del usuario a UTC para guardar en DB
 * @param {Date|string} localDate - Fecha en zona del usuario
 * @param {Object} user - Objeto usuario
 * @returns {Date} Fecha en UTC
 */
export const localToUTC = (localDate, user) => {
  const tz = getUserTimezone(user);
  const dateObj = typeof localDate === 'string' ? parseISO(localDate) : localDate;
  return fromZonedTime(dateObj, tz);
};

/**
 * Convierte una fecha UTC a la zona horaria del usuario para mostrar
 * @param {Date|string} utcDate - Fecha en UTC
 * @param {Object} user - Objeto usuario
 * @returns {Date} Fecha en zona del usuario
 */
export const utcToLocal = (utcDate, user) => {
  const tz = getUserTimezone(user);
  const dateObj = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(dateObj, tz);
};

/**
 * Obtiene el inicio del día en la zona horaria del usuario (útil para filtros)
 * @param {Date} date - Fecha
 * @param {Object} user - Objeto usuario
 * @returns {Date} Inicio del día en UTC
 */
export const getStartOfDayInUserTz = (date, user) => {
  const tz = getUserTimezone(user);
  const localDate = toZonedTime(date, tz);
  localDate.setHours(0, 0, 0, 0);
  return fromZonedTime(localDate, tz);
};

/**
 * Obtiene el fin del día en la zona horaria del usuario (útil para filtros)
 * @param {Date} date - Fecha
 * @param {Object} user - Objeto usuario
 * @returns {Date} Fin del día en UTC
 */
export const getEndOfDayInUserTz = (date, user) => {
  const tz = getUserTimezone(user);
  const localDate = toZonedTime(date, tz);
  localDate.setHours(23, 59, 59, 999);
  return fromZonedTime(localDate, tz);
};

/**
 * Obtiene el nombre amigable de la zona horaria
 * @param {string} tzValue - Valor IANA de la zona horaria
 * @returns {string} Nombre amigable
 */
export const getTimezoneLabel = (tzValue) => {
  const found = AVAILABLE_TIMEZONES.find(tz => tz.value === tzValue);
  return found ? found.label : tzValue;
};

/**
 * Obtiene la hora actual formateada en la zona del usuario
 * @param {Object} user - Objeto usuario
 * @returns {string} Hora actual formateada
 */
export const getCurrentTimeInUserTz = (user) => {
  return formatDateInUserTz(new Date(), 'HH:mm', user);
};

/**
 * Obtiene la fecha actual formateada en la zona del usuario
 * @param {Object} user - Objeto usuario
 * @returns {string} Fecha actual formateada
 */
export const getTodayInUserTz = (user) => {
  return formatDateInUserTz(new Date(), 'yyyy-MM-dd', user);
};

/**
 * Prepara información de zona horaria para enviar al agente/chatbot
 * @param {Object} user - Objeto usuario
 * @returns {Object} Info de timezone para contexto del agente
 */
export const getTimezoneContextForAgent = (user) => {
  const tz = getUserTimezone(user);
  const now = getCurrentDateInUserTz(user);
  return {
    timezone: tz,
    timezone_label: getTimezoneLabel(tz),
    current_date: formatDateInUserTz(new Date(), 'yyyy-MM-dd', user),
    current_time: formatDateInUserTz(new Date(), 'HH:mm:ss', user),
    current_datetime: formatDateInUserTz(new Date(), "yyyy-MM-dd'T'HH:mm:ss", user),
    day_of_week: formatDateInUserTz(new Date(), 'EEEE', user),
  };
};