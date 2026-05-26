# Cantina Privilege Selection
## Il Gestionale ERP Moderno ed Intelligente per il Settore Vinicolo

---

### Introduzione al Prodotto

Nel settore vitivinicolo, la gestione quotidiana di una cantina o di una distribuzione comporta una serie di adempimenti burocratici, amministrativi e logistici unici nel loro genere. Molto spesso, le aziende sono costrette a scegliere tra due estremi insoddisfacenti: da un lato, gestionali generici a basso costo che ignorano del tutto le specificità del vino (come formati di bottiglia, annate e accise); dall'altro, software monumentali e obsoleti, complessi da utilizzare e con costi di licenza insostenibili per le piccole e medie realtà.

**Cantina Privilege Selection** nasce per colmare questa lacuna. È un ERP (Enterprise Resource Planning) leggero, moderno e reattivo, progettato specificamente per le cantine e i distributori di vino. Unisce un'interfaccia utente di ultima generazione ad un motore backend potente, integrando nativamente le normative fiscali italiane ed europee ed automatizzando i flussi di lavoro più ripetitivi.

---

### Le Caratteristiche Funzionali Chiave

#### 1. Magazzino Specializzato (Annate e Formati)
A differenza dei magazzini standard, ogni prodotto in Cantina Privilege Selection è strutturato con attributi specifici per il settore vinicolo:
*   **Gestione Annate (Vintages)**: Distinzione immediata tra diverse annate dello stesso vino o indicazione di "NV" (Non Vintage) per spumanti e blend.
*   **Gestione Formati**: Supporto nativo per bottiglie standard da 0.75L, formati minori da 0.375L o Magnum da 1.5L.
*   **Tracciamento dei Lotti**: Associazione automatica dei lotti e delle date di scadenza ad ogni movimento di carico e scarico.

#### 2. Logica di Prezzo Dinamica
Il sistema calcola i prezzi in tempo reale grazie a una doppia logica:
*   **Formula Automatica**: Il prezzo finale (netto e lordo) viene calcolato partendo dal costo base e applicando il ricarico percentuale e l'IVA della categoria.
*   **Listini Custom per Partner**: Consente di legare a ciascun cliente un listino personalizzato (es. Listino HORECA con ricarico al 25%, Listino Privati al 50%). All'inserimento di un ordine, il sistema imposta automaticamente il prezzo corretto.
*   **Prezzo Manuale**: Possibilità di forzare manualmente un prezzo fisso su prodotti specifici, escludendoli dalle formule automatiche.

#### 3. Importazione Automatizzata delle Fatture (SDI XML)
Il modulo **Import Area** permette di trascinare le fatture elettroniche in formato XML (.xml) ricevute dai fornitori. Il sistema:
*   Legge istantaneamente il documento direttamente nel browser.
*   Riconosce il fornitore (creandolo in anagrafica se non esiste).
*   Mappa gli articoli identificando le corrispondenze a magazzino, anche in caso di SKU parzialmente differenti.
*   Genera una fattura di acquisto in stato di bozza. Una volta approvata dal gestore, lo stock di magazzino viene aggiornato automaticamente in tempo reale.

#### 4. Riconciliazione Bancaria Semplificata (CBI)
Il software include un motore di analisi dei tracciati CBI (Corporate Banking Interbancario) forniti dalle banche italiane:
*   Importando l'estratto conto, il sistema estrae ciascun movimento finanziario.
*   Un algoritmo intelligente confronta gli importi, i nomi dei pagatori e i numeri di fattura presenti nelle causali.
*   Associa automaticamente i pagamenti alle fatture emesse, proponendo la riconciliazione automatica o segnalando i casi dubbi per una rapida verifica manuale.

#### 5. Predisposizione Doganale (Accise ed EMCS)
Per le aziende che vendono all'estero o movimentano prodotti in sospensione d'accisa, il software genera i file XML conformi allo standard europeo **EMCS** per l'emissione del documento di accompagnamento elettronico (**e-AD** / tracciato doganale IE815), inclusa la simulazione del rilascio del codice ARC da parte delle Dogane.

#### 6. Integrazione Registro Telematico SIAN
Il sistema è predisposto per generare i flussi di dati XML richiesti dal **SIAN** (Sistema Informativo Agricolo Nazionale) per i registri telematici di cantina (operazioni di fermentazione, arricchimento, imbottigliamento e declassamento), semplificando gli obblighi normativi con il Ministero dell'Agricoltura.

#### 7. Sincronizzazione E-commerce (WooCommerce & Shopify)
Il backend dispone di endpoint pronti a ricevere webhooks da piattaforme e-commerce esterne. Quando viene registrato un ordine online, il sistema:
*   Aggiorna l'anagrafica del cliente web.
*   Genera un documento di scarico stock (DDT).
*   Decrementa le giacenze a magazzino all'istante, prevenendo vendite in sovrannumero (over-selling).

---

### Punti di Forza Tecnologici e Architettura

*   **Tecnologie Enterprise-Grade**: Sviluppato con NestJS (TypeScript) per il backend e React 19 per il frontend, garantendo una struttura modulare, facilmente estendibile e sicura.
*   **PostgreSQL come Garante dei Dati**: La business logic più critica (come i calcoli di prezzo e la movimentazione dello stock) è gestita tramite vincoli e trigger a livello di database. Questo impedisce qualsiasi errore umano o bug applicativo che possa corrompere i dati di magazzino.
*   **Dual-Storage (Subapase / In-Memory)**: Il software può essere collegato al database cloud Supabase per l'uso in produzione, ma integra un database simulato in memoria ad avvio istantaneo. Questo rende le presentazioni commerciali e il testing locale immediati, senza alcuna necessità di installazione preliminare.
*   **Design Premium & Wow-Factor**: L'interfaccia utente è rifinita nei minimi dettagli con uno stile Dark Mode a effetto vetro (Glassmorphism), caratteri moderni ed eleganti e micro-animazioni fluide. Per facilitare la transizione di utenti storici, include anche una modalità di visualizzazione che richiama il layout classico di *InvoiceX*.

---

### Il Valore Commerciale dell'Asset

Acquistare la proprietà intellettuale di questo software rappresenta una scelta strategica di alto valore per diversi motivi:

1.  **Risparmio sui Tempi e sui Costi di Sviluppo**: Ricreare una piattaforma simile richiede oltre **540 ore di lavoro** di ingegneria software senior, pari ad un investimento di mercato compreso tra **35.000 € e 54.000 €**. Acquistando il codice pronto, il time-to-market si riduce a zero.
2.  **Modularità per Modello SaaS**: Il codice è già predisposto per essere trasformato in un servizio ad abbonamento mensile (SaaS) per più cantine contemporaneamente, utilizzando le Row-Level Security (RLS) di Supabase per tenere i dati rigidamente separati e protetti.
3.  **Prodotto Altamente Verticale**: Il mercato dei software generici è saturo e dominato da grandi player. Cantina Privilege Selection si colloca invece in una nicchia specifica e disposta a spendere cifre importanti pur di disporre di uno strumento conforme alla complessa normativa vinicola e doganale italiana.

---
*Proprietà riservata di Alesx99. Tutti i diritti riservati.*
