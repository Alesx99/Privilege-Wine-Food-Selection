/**
 * Configurazione centralizzata dell'applicazione.
 * In sviluppo locale usa http://localhost:3001 come fallback,
 * in produzione (GitHub Pages) legge la variabile d'ambiente VITE_API_URL.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
