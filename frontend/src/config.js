/**
 * Configurazione centralizzata dell'applicazione.
 * In sviluppo locale usa http://localhost:3001 come fallback,
 * in produzione (GitHub Pages) legge la variabile d'ambiente VITE_API_URL.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Gestore ed esplicatore dell'errore "Load failed" / "Failed to fetch".
 *
 * NOTA SULL'ERRORE "Load failed" / "Failed to fetch":
 * Questo errore viene sollevato dal browser (es. Safari/Chrome) quando una richiesta fetch() fallisce
 * a livello di rete prima di ricevere una risposta HTTP. Le cause principali sono:
 * 1. STANDBY DI RENDER (Cold Start): Il piano gratuito di Render spegne il server dopo 15 minuti di inattività.
 *    Il risveglio (primo fetch) richiede 50-60 secondi, durante i quali le richieste possono fallire.
 * 2. URL ERRATO: L'URL in frontend/.env.production (VITE_API_URL) non corrisponde al dominio reale del backend su Render.
 * 3. BLOCCO CORS: L'indirizzo del frontend (es. https://alesx99.github.io) non è abilitato nel backend.
 * 4. SERVER OFFLINE: Il server locale o remoto è spento.
 */
export const handleFetchError = (err, operationDescription) => {
  console.error(`[API Error] During: ${operationDescription}`, err);
  const errMsg = err.message || String(err);
  
  const isNetworkError = 
    errMsg.toLowerCase().includes('failed to fetch') || 
    errMsg.toLowerCase().includes('load failed') || 
    err instanceof TypeError;

  if (isNetworkError) {
    return `${operationDescription} fallito.\n\n` +
           `🔍 DIAGNOSTICA ERRORE ("Load failed" / "Failed to fetch"):\n` +
           `- Il backend su Render si sta riattivando (piano gratuito): attendi ~60 secondi e riprova.\n` +
           `- Controlla che l'indirizzo VITE_API_URL in 'frontend/.env.production' sia corretto.\n` +
           `- Assicurati che l'origine del sito sia autorizzata nelle regole CORS del backend.\n` +
           `- Verifica che la tua connessione internet sia attiva.`;
  }
  
  return `${operationDescription} fallito: ${errMsg}`;
};
