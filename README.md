# Cantina Privilege - Gestionale ERP Commerciale Leggero

Benvenuto nel tuo nuovo framework di gestione commerciale su misura per il settore vinicolo (**Cantina Privilege**), ispirato alle funzionalità core di **InvoiceX** ma in una versione moderna, web-based e reattiva.

Il progetto è strutturato come segue:
- `/backend`: API server NestJS per la business logic dei listini, esportazione CSV e generazione PDF.
- `/frontend`: Applicazione React SPA costruita con Vite e stilizzata con un design premium in **Vanilla CSS** (Dark Theme, Glassmorphism, micro-animazioni).
- `/supabase`: Configurazione del database PostgreSQL, incluse le migrazioni con i trigger di magazzino.

---

## 🚀 Avvio Rapido (Senza Configurazione Supabase)

Per consentirti di testare subito l'applicazione ed effettuare l'importazione della fattura di test che hai fornito, il backend NestJS include un **Mock Store in memoria** automatico. Se le chiavi di Supabase non sono definite nel file `.env`, l'applicazione partirà pre-caricando i dati della tua cantina ed il listino prezzi.

### 1. Avvia il Backend (Porta 3001)
In una finestra del terminale, posizionati su `backend` ed esegui:
```bash
npm install
npm run start:dev
```
Il server sarà attivo su [http://localhost:3001](http://localhost:3001).

### 2. Avvia il Frontend (Porta 5173)
In un'altra finestra del terminale, posizionati su `frontend` ed esegui:
```bash
npm install
npm run dev
```
Apri il browser su [http://localhost:5173](http://localhost:5173).

---

## 🔐 Credenziali di Accesso

All'avvio dell'applicazione, verrai indirizzato a una schermata di login. Le credenziali supportate sono:
1. **Utente Master (Gestione ERP Completa)**:
   - **Identificativo**: `master`
   - **Password**: `master`
   - Consente l'accesso a tutte le funzionalità gestionali (Dashboard, Catalogo Vini, Anagrafiche, Documenti, Import Area, Costi e Margini).
2. **Utente Cliente (Solo Listino prezzi e disponibilità)**:
   - **Identificativo**: `cliente`
   - **Password**: `cliente`
   - Consente di consultare esclusivamente il catalogo vini con i prezzi di vendita lordi (IVA inclusa). Se un vino ha giacenza pari a 0, visualizza il badge rosso **"Non disponibile"** anziché il prezzo.

---

## 📂 Struttura del Database & Migrazioni (Supabase)

Se decidi di collegare l'applicazione ad un progetto live di Supabase, copia lo schema definito in:
👉 `[supabase/migrations/20260523000000_init.sql](file:///Users/alessio/Desktop/cartella%20senza%20nome/supabase/migrations/20260523000000_init.sql)`

Questo file contiene:
1. **Prodotti con Prezzi Calcolati Generati**: Le colonne `selling_price_net` e `selling_price_gross` sono colonne generate internamente a livello di PostgreSQL (`GENERATED ALWAYS AS STORED`). Questo garantisce coerenza immediata tra Costo Base, Ricarico e Prezzo Finale senza calcoli ridondanti.
2. **Workflow & Triggers d'Integrità Magazzino**:
   - `trg_document_items_lock`: Impedisce modifiche o cancellazioni accidentali di articoli legati a documenti già marcati come `completed`. Per effettuare modifiche, il documento deve essere prima riportato nello stato `draft` (Bozza).
   - `trg_document_stock_transition` & `trg_document_delete`: Aggiornano fisicamente lo `stock_quantity` dei prodotti quando un documento passa a `completed` (Carico/Scarico automatico) e invertono la transazione se il documento viene riportato a Bozza o eliminato.

Per collegare Supabase, crea un file `.env` all'interno della cartella `backend` con le seguenti variabili:
```env
SUPABASE_URL=la_tua_url_supabase
SUPABASE_KEY=la_tua_service_role_key_o_anon_key
```

---

## 🍷 Funzionalità Core Implementate

1. **Dashboard Commerciale**: Monitoraggio del fatturato, valore totale del magazzino (calcolato in base al costo base dei prodotti), alert scorte sotto la soglia minima e riepilogo documenti recenti.
2. **Magazzino Vini (Gestione Annate & Formati)**: I prodotti sono personalizzati per il settore vinicolo con campi per **Annata** (es. "2018", "NV") e **Formato** (0.375L, 0.75L, Magnum 1.5L).
3. **Logica Prezzo (Formula vs Manuale)**: All'interno della scheda prodotto è presente un flag `is_manual_price`. Se attivo, il prezzo finale viene definito a mano dall'utente; altrimenti, il sistema applica la formula automatica `Costo Base + Ricarico % + IVA`.
4. **Anagrafiche Clienti/Fornitori**: Gestione dei partner con validazione fiscale in tempo reale (Partita IVA italiana di 11 cifre, Codice SDI alfanumerico di 7 cifre) basata su **Zod**. Consente di associare un **Listino di Ricarico custom** a ciascun cliente (es. Listino HORECA +25%).
5. **Generatore di Documenti & Listini**: Creando un nuovo documento (DDT, Ordine, Fattura), all'inserimento di una riga prodotto il sistema interroga il backend che calcola in tempo reale il prezzo netto e lordo basandosi sul listino associato al cliente selezionato.
6. **Esportazione & Stampe (Fase 3)**:
   - **Download PDF**: Cliccando sull'icona di download in qualsiasi documento, il server genera in streaming un documento PDF fattura/DDT pulito e professionale con i dettagli della Cantina, del cliente e delle righe, tramite `pdfkit`.
   - **Backup CSV**: Pulsante per scaricare l'intero database dei prodotti o dei partner in formato CSV.

---

## 📥 Import Area SDI (La tua Fattura di Esempio)

Nella sezione **Import Area** del menu laterale, puoi testare il parser drag & drop con la tua fattura elettronica:
1. Trascina il file `IT016417907022026c_058ZM.xml` all'interno dell'area tratteggiata.
2. Il sistema esegue un parsing client-side immediato (tramite `DOMParser` nativo) e ti mostra l'anteprima:
   - **Fornitore Rilevato**: MEREGALLI GIUSEPPE SPA (Indirizzo, P.IVA ed SDI estratti dai tag).
   - **Dati Fattura**: Numero `10092/FE`, data `2026-05-20` ed importo lordo totale `905,30 €`.
   - **Articoli Estratti**: Rileva la riga 4 (`CUVEE PREMIERE CHASSENAY D'ARCE...`) con quantità 30, prezzo 25.50 e sconto del 3%, estraendone l'annata `NV` e formato `0.75L`. Rileva anche la riga 5 (omaggio a titolo di sconto con sconto 100%).
3. Cliccando su **Salva come Bozza**:
   - Viene creato il partner Meregalli Giuseppe SPA (se non presente).
   - Viene inserito il prodotto nel catalogo (se non presente, con SKU `6441MA` ed etichetta corrispondente).
   - Viene creata la fattura di acquisto collegata in stato **Bozza (draft)**.
4. Sarai reindirizzato alla pagina dei documenti per esaminarla. Cliccando su **Approva & Carica Stock**, lo stato passerà a `completed` ed il database caricherà fisicamente 36 bottiglie nel magazzino dei vini!

---

## 🔒 Proprietà e Licenza

Questo software è proprietà esclusiva di **Alesx99**. 
Tutti i diritti sono riservati. La copia, distribuzione, modifica o riproduzione non autorizzata di questo codice e dei file associati, con qualsiasi mezzo, è severamente vietata senza previo consenso scritto del proprietario del copyright.

Vedi il file [LICENSE](file:///Users/alessio/Desktop/Gestionale%20Fatture%20e%20Magazzino/LICENSE) per maggiori informazioni.

