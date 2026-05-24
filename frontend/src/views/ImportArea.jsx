import React, { useState, useCallback } from 'react';
import { API_BASE_URL, handleFetchError } from '../config';
import { 
  UploadCloud, 
  CheckCircle2, 
  FileCode, 
  ArrowRight, 
  ShieldAlert, 
  Play, 
  Trash2, 
  AlertCircle, 
  Loader2,
  HelpCircle 
} from 'lucide-react';

export default function ImportArea({ onImportSuccess, setActivePage, setSelectedDocId, userRole }) {
  const isMaster = userRole === 'master';
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'bulk'
  const [showHelp, setShowHelp] = useState(false);

  // ==========================================
  // STATO - CARICAMENTO SINGOLO
  // ==========================================
  const [isDragging, setIsDragging] = useState(false);
  const [parsedInvoice, setParsedInvoice] = useState(null);
  const [xmlContent, setXmlContent] = useState('');
  const [loading, setLoading] = useState(false);

  // ==========================================
  // STATO - CARICAMENTO DI GRUPPO (BULK)
  // ==========================================
  const [isDraggingBulk, setIsDraggingBulk] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]); // Array di { id, name, size, status, file, invoiceDetails, errorMsg }
  const [bulkStatus, setBulkStatus] = useState('idle'); // 'idle' | 'running' | 'completed'
  const [currentBulkIndex, setCurrentBulkIndex] = useState(0);
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);
  const [bulkErrorCount, setBulkErrorCount] = useState(0);

  // ==========================================
  // PARSER XML COMUNE (BROWSER-BASED)
  // ==========================================
  const parseXmlInvoice = (xmlText) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Check parse errors
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        throw new Error('Il file non è un XML valido.');
      }

      // Helper to find first element by local name and get text content
      const getTagValue = (parent, tag) => {
        if (!parent) return '';
        const els = parent.getElementsByTagNameNS('*', tag);
        return els.length > 0 ? els[0].textContent.trim() : '';
      };

      // Helper to find first element by local name
      const getElement = (parent, tag) => {
        if (!parent) return null;
        const els = parent.getElementsByTagNameNS('*', tag);
        return els.length > 0 ? els[0] : null;
      };

      // 1. Extract Supplier (CedentePrestatore)
      const cedente = getElement(xmlDoc, 'CedentePrestatore');
      if (!cedente) throw new Error('Sezione CedentePrestatore mancante.');

      const anagrafica = getElement(cedente, 'Anagrafica');
      const denominazione = anagrafica ? (getTagValue(anagrafica, 'Denominazione') || 
                            (getTagValue(anagrafica, 'Nome') + ' ' + getTagValue(anagrafica, 'Cognome')).trim()) : 'FORNITORE SCONOSCIUTO';
      
      const vatCode = getTagValue(cedente, 'IdCodice');
      const sede = getElement(cedente, 'Sede');
      const indirizzo = sede ? getTagValue(sede, 'Indirizzo') : '';
      const comune = sede ? getTagValue(sede, 'Comune') : '';
      const cap = sede ? getTagValue(sede, 'CAP') : '';
      const provincia = sede ? getTagValue(sede, 'Provincia') : '';
      const address = `${indirizzo}, ${cap} ${comune} (${provincia})`;

      // 2. Extract Document Headers
      const datiGenerali = getElement(xmlDoc, 'DatiGeneraliDocumento');
      const number = datiGenerali ? getTagValue(datiGenerali, 'Numero') : '';
      const date = datiGenerali ? getTagValue(datiGenerali, 'Data') : '';
      const totalAmount = datiGenerali ? Number(getTagValue(datiGenerali, 'ImportoTotaleDocumento')) || 0 : 0;

      // 3. Extract Items
      const detailLines = xmlDoc.getElementsByTagNameNS('*', 'DettaglioLinee');
      const items = [];

      for (let i = 0; i < detailLines.length; i++) {
        const line = detailLines[i];
        const desc = getTagValue(line, 'Descrizione');
        const qty = Number(getTagValue(line, 'Quantita')) || 0;
        const price = Number(getTagValue(line, 'PrezzoUnitario')) || 0;
        const lineTotal = Number(getTagValue(line, 'PrezzoTotale')) || 0;
        const vat = Number(getTagValue(line, 'AliquotaIVA')) || 22;

        // Skip descriptive/info lines with no quantity
        if (qty === 0 || (price === 0 && !desc.toLowerCase().includes('sconto') && !desc.toLowerCase().includes('omaggio'))) {
          continue;
        }

        // Discount
        let discount = 0;
        const discountMag = getElement(line, 'ScontoMaggiorazione');
        if (discountMag) {
          const type = getTagValue(discountMag, 'Tipo');
          if (type === 'SC') {
            discount = Number(getTagValue(discountMag, 'Percentuale')) || 0;
          }
        }

        // SKU
        let sku = '';
        const articleCodes = line.getElementsByTagNameNS('*', 'CodiceArticolo');
        for (let j = 0; j < articleCodes.length; j++) {
          const code = articleCodes[j];
          const type = getTagValue(code, 'CodiceTipo');
          const val = getTagValue(code, 'CodiceValore');
          if (type.toLowerCase().includes('fornitore')) {
            sku = val;
            break;
          } else if (!sku && type === 'INTRA') {
            sku = val;
          }
        }
        if (!sku && articleCodes.length > 0) {
          sku = getTagValue(articleCodes[0], 'CodiceValore');
        }
        if (!sku) {
          sku = 'IMP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        // Size Format & Vintage Parsing
        let format = '0.75L';
        if (desc.toLowerCase().includes('magnum') || desc.toLowerCase().includes('1,5') || desc.toLowerCase().includes('1.5')) {
          format = '1.5L';
        } else if (desc.toLowerCase().includes('0,375') || desc.toLowerCase().includes('0.375')) {
          format = '0.375L';
        }

        let vintage = 'NV';
        const yearMatch = desc.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          vintage = yearMatch[0];
        }

        const itemDiscountedCost = discount > 0 && discount < 100 ? Number((price * (1 - discount / 100)).toFixed(2)) : null;

        items.push({
          sku,
          description: desc,
          quantity: qty,
          unit_price: price,
          discount_percent: discount,
          vat_percent: vat,
          total_net: lineTotal,
          format,
          vintage,
          discounted_cost: itemDiscountedCost
        });
      }

      return {
        supplier: { name: denominazione, vat_number: vatCode, address },
        header: { number, date, total_amount: totalAmount },
        items
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // ==========================================
  // FUNZIONI - CARICAMENTO SINGOLO
  // ==========================================
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const processFile = (file) => {
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      alert('Carica solo file XML di fatturazione elettronica (SDI).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setXmlContent(text);
      
      const parsed = parseXmlInvoice(text);
      if (parsed) {
        setParsedInvoice(parsed);
      } else {
        alert('Impossibile interpretare il file XML. Assicurati che sia una Fattura Elettronica italiana valida.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const saveToDatabase = async () => {
    if (!xmlContent) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/import/xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xmlContent })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante l\'importazione.');
      }

      const savedDoc = await res.json();
      alert(`Importazione riuscita! Creato documento ${savedDoc.number} in BOZZE.`);
      
      onImportSuccess();
      setSelectedDocId(savedDoc.id);
      setActivePage('documents');
    } catch (err) {
      alert(handleFetchError(err, 'Importazione documento'));
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FUNZIONI - CARICAMENTO DI GRUPPO (BULK)
  // ==========================================
  const handleDragOverBulk = useCallback((e) => {
    e.preventDefault();
    setIsDraggingBulk(true);
  }, []);

  const handleDragLeaveBulk = useCallback(() => {
    setIsDraggingBulk(false);
  }, []);

  const processBulkFiles = (filesList) => {
    if (!filesList || filesList.length === 0) return;

    const newQueueItems = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (file.name.endsWith('.xml')) {
        newQueueItems.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          status: 'pending',
          file: file,
          invoiceDetails: null,
          errorMsg: null
        });
      }
    }

    if (newQueueItems.length === 0) {
      alert('Nessun file XML valido trovato.');
      return;
    }

    setBulkFiles(prev => [...prev, ...newQueueItems]);
    setBulkStatus('idle');
  };

  const handleDropBulk = useCallback((e) => {
    e.preventDefault();
    setIsDraggingBulk(false);
    processBulkFiles(e.dataTransfer.files);
  }, []);

  const handleFileSelectBulk = (e) => {
    processBulkFiles(e.target.files);
  };

  const handleClearBulkQueue = () => {
    if (bulkStatus === 'running') return;
    setBulkFiles([]);
    setBulkStatus('idle');
    setCurrentBulkIndex(0);
    setBulkSuccessCount(0);
    setBulkErrorCount(0);
  };

  const handleStartBulkUpload = async () => {
    if (bulkStatus === 'running' || bulkFiles.length === 0) return;
    setBulkStatus('running');

    let successCount = bulkSuccessCount;
    let errorCount = bulkErrorCount;

    for (let i = 0; i < bulkFiles.length; i++) {
      const item = bulkFiles[i];
      
      // Skip files already processed in previous runs
      if (item.status === 'success') {
        continue;
      }

      setCurrentBulkIndex(i);

      // Imposta lo stato a "uploading"
      setBulkFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));

      try {
        // Leggi il file XML come testo
        const xmlText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (err) => reject(err);
          reader.readAsText(item.file);
        });

        // Parse preliminare nel browser per raccogliere informazioni da mostrare a schermo
        let invoiceDetails = null;
        const parsed = parseXmlInvoice(xmlText);
        if (parsed) {
          invoiceDetails = {
            number: parsed.header.number,
            supplier: parsed.supplier.name,
            amount: parsed.header.total_amount
          };
        }

        // Chiamata all'endpoint NestJS
        const res = await fetch(`${API_BASE_URL}/api/import/xml`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml: xmlText })
        });

        if (!res.ok) {
          const serverError = await res.json();
          throw new Error(serverError.message || 'Errore del server durante l\'importazione.');
        }

        successCount++;
        setBulkSuccessCount(successCount);
        setBulkFiles(prev => prev.map(f => f.id === item.id ? { 
          ...f, 
          status: 'success', 
          invoiceDetails: invoiceDetails || { number: 'Rilevato', supplier: 'Fornitore', amount: 0 }
        } : f));
      } catch (err) {
        errorCount++;
        setBulkErrorCount(errorCount);
        setBulkFiles(prev => prev.map(f => f.id === item.id ? { 
          ...f, 
          status: 'error', 
          errorMsg: handleFetchError(err, 'Importazione file')
        } : f));
      }
    }

    setBulkStatus('completed');
    onImportSuccess();
  };

  // Calcolo della percentuale di avanzamento
  const progressPercent = bulkFiles.length > 0 
    ? Math.round(((bulkSuccessCount + bulkErrorCount) / bulkFiles.length) * 100) 
    : 0;

  return (
    <div className="import-area-view">
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Import Area SDI (XML)</span>
            <button 
              type="button" 
              className="help-toggle-btn"
              onClick={() => setShowHelp(!showHelp)}
              title="Mostra guida"
            >
              <HelpCircle size={20} />
            </button>
          </h1>
          <p>Importa le fatture elettroniche in formato XML per caricare il magazzino e aggiornare i listini</p>
        </div>
      </div>

      {showHelp && (
        <div className="help-callout">
          <h4><HelpCircle size={16} /> Guida Rapida - Importazione Fatture XML</h4>
          <p>
            Questo modulo ti consente di caricare le scorte in magazzino partendo dal file XML di una fattura elettronica di acquisto:
          </p>
          <ul>
            <li><strong>Riconoscimento automatico:</strong> Il sistema rileva la partita IVA del fornitore (creando l'anagrafica se mancante) e gli articoli.</li>
            <li><strong>Filtro SKU intelligenti:</strong> Se lo SKU rilevato ha una parte finale variabile (lotto, annata, etc.), il sistema associa la riga al prodotto principale corretto evitando duplicazioni.</li>
            <li><strong>Aggregazione automatica:</strong> Più righe collegate allo stesso prodotto vengono fuse in un'unica riga con prezzo medio e sconto ponderato.</li>
            <li><strong>Bozza:</strong> I documenti vengono importati come "Bozze" in modo da poter essere controllati prima di aggiornare effettivamente lo stock.</li>
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <button 
          className={`btn btn-sm ${activeTab === 'single' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            if (bulkStatus !== 'running') setActiveTab('single');
          }}
          disabled={bulkStatus === 'running'}
        >
          Importazione Singola
        </button>
        <button 
          className={`btn btn-sm ${activeTab === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('bulk')}
        >
          Caricamento di Gruppo (Bulk)
        </button>
      </div>

      {activeTab === 'single' ? (
        // =====================================================================
        // TAB: IMPORTAZIONE SINGOLA
        // =====================================================================
        <>
          {!parsedInvoice ? (
            !isMaster ? (
              <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ShieldAlert size={48} style={{ color: 'var(--status-warning)' }} />
                <h3>Modalità Sola Lettura</h3>
                <p className="muted-text">
                  Non disponi delle autorizzazioni necessarie per importare nuovi file XML e caricare lo stock.
                </p>
              </div>
            ) : (
              /* Drag and Drop Zone */
              <div 
                className={`glass-card import-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('xml-input-file').click()}
              >
                <input 
                  type="file" 
                  id="xml-input-file" 
                  style={{ display: 'none' }} 
                  accept=".xml" 
                  onChange={handleFileSelect}
                />
                <div className="import-icon">
                  <UploadCloud size={32} />
                </div>
                <div>
                  <h3>Trascina qui il file XML (.xml)</h3>
                  <p className="muted-text" style={{ marginTop: '6px' }}>
                    Oppure clicca per sfogliare i tuoi file. Supporta il formato Fattura Elettronica FPR12.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '4px' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--accent-light)' }} />
                  <span className="muted-text" style={{ fontSize: '0.8rem' }}>
                    I dati fiscali del fornitore e le etichette dei vini verranno compilati automaticamente.
                  </span>
                </div>
              </div>
            )
          ) : (
            /* Preview Zone */
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="flex-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={20} style={{ color: 'var(--accent-light)' }} />
                  <h3>Anteprima del File Caricato</h3>
                </div>
                <div className="flex-row">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setParsedInvoice(null);
                      setXmlContent('');
                    }}
                  >
                    Carica un altro file
                  </button>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={saveToDatabase}
                    disabled={loading}
                  >
                    {loading ? 'Salvataggio...' : 'Salva come Bozza'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {/* Supplier and Document Headers */}
              <div className="grid-2" style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <p className="muted-text">CEDENTE / FORNITORE RILEVATO</p>
                  <h2 style={{ margin: '4px 0', color: 'var(--text-primary)' }}>{parsedInvoice.supplier.name}</h2>
                  <p>P.IVA: {parsedInvoice.supplier.vat_number}</p>
                  <p>{parsedInvoice.supplier.address}</p>
                </div>
                <div>
                  <p className="muted-text">DATI FATTURA</p>
                  <p style={{ marginTop: '8px' }}>Numero: <strong>{parsedInvoice.header.number}</strong></p>
                  <p>Data: <strong>{parsedInvoice.header.date}</strong></p>
                  <p>Totale Documento: <strong>€ {parsedInvoice.header.total_amount.toFixed(2)}</strong></p>
                </div>
              </div>

              {/* Parsed Items */}
              <div>
                <h3>Prodotti Estratti ed Abbinamenti Scorte</h3>
                <p className="muted-text" style={{ marginBottom: '12px' }}>
                  Il sistema verificherà la presenza del prodotto per codice SKU. Se non esiste, verrà registrato automaticamente una volta salvato il documento.
                </p>
                
                <div className="table-container">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>SKU (Fornitore)</th>
                        <th>Etichetta Rilevata</th>
                        <th>Annata</th>
                        <th>Formato</th>
                        <th>Q.tà Carico</th>
                        <th>Prezzo Cad.</th>
                        <th>Sconto</th>
                        <th>Costo Post-Sconto</th>
                        <th style={{ textAlign: 'right' }}>Imponibile Linea</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedInvoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td><code>{item.sku}</code></td>
                          <td><strong>{item.description}</strong></td>
                          <td><span className="badge badge-success">{item.vintage}</span></td>
                          <td><span className="muted-text">{item.format}</span></td>
                          <td><strong>{item.quantity} Btg</strong></td>
                          <td>€ {item.unit_price.toFixed(2)}</td>
                          <td>{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                          <td>
                            {item.discounted_cost ? (
                              <strong style={{ color: 'var(--status-success)' }}>
                                € {item.discounted_cost.toFixed(2)}
                              </strong>
                            ) : (
                              <span className="muted-text">-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}><strong>€ {item.total_net.toFixed(2)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // =====================================================================
        // TAB: CARICAMENTO DI GRUPPO (BULK)
        // =====================================================================
        <>
          {bulkFiles.length === 0 ? (
            !isMaster ? (
              <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ShieldAlert size={48} style={{ color: 'var(--status-warning)' }} />
                <h3>Modalità Sola Lettura</h3>
                <p className="muted-text">
                  Non disponi delle autorizzazioni necessarie per importare nuovi file XML e caricare lo stock.
                </p>
              </div>
            ) : (
              /* Drag and Drop Zone Bulk */
              <div 
                className={`glass-card import-zone ${isDraggingBulk ? 'dragging' : ''}`}
                onDragOver={handleDragOverBulk}
                onDragLeave={handleDragLeaveBulk}
                onDrop={handleDropBulk}
                onClick={() => document.getElementById('xml-input-bulk').click()}
              >
                <input 
                  type="file" 
                  id="xml-input-bulk" 
                  style={{ display: 'none' }} 
                  accept=".xml" 
                  multiple
                  onChange={handleFileSelectBulk}
                />
                <div className="import-icon">
                  <UploadCloud size={32} style={{ color: 'var(--accent-light)' }} />
                </div>
                <div>
                  <h3>Seleziona o trascina più file XML (.xml)</h3>
                  <p className="muted-text" style={{ marginTop: '6px' }}>
                    Supporta il caricamento simultaneo di decine o centinaia di fatture elettroniche di acquisto.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '4px' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--accent-light)' }} />
                  <span className="muted-text" style={{ fontSize: '0.8rem' }}>
                    I file verranno processati in sequenza per garantire l'integrità del database.
                  </span>
                </div>
              </div>
            )
          ) : (
            /* Coda dei File Caricati */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Pannello Stato e Statistiche */}
              <div className="glass-card">
                <div className="flex-between" style={{ marginBottom: '20px' }}>
                  <div>
                    <h3>Stato Caricamento Massivo</h3>
                    <p className="muted-text">Avanzamento ed elaborazione sequenziale della coda</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearBulkQueue}
                      disabled={bulkStatus === 'running'}
                    >
                      <Trash2 size={16} />
                      <span>Azzera Coda</span>
                    </button>
                    
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={handleStartBulkUpload}
                      disabled={bulkStatus === 'running' || (bulkSuccessCount + bulkErrorCount === bulkFiles.length)}
                    >
                      {bulkStatus === 'running' ? (
                        <>
                          <Loader2 size={16} className="rotating-icon" />
                          <span>Elaborazione...</span>
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          <span>Avvia Caricamento ({bulkFiles.length} file)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grid delle Statistiche */}
                <div className="bulk-stats-grid">
                  <div className="bulk-stat-card">
                    <p className="muted-text" style={{ fontSize: '0.75rem' }}>TOTALI</p>
                    <div className="bulk-stat-value">{bulkFiles.length}</div>
                  </div>
                  <div className="bulk-stat-card" style={{ borderLeftColor: 'rgba(255,255,255,0.05)' }}>
                    <p className="muted-text" style={{ fontSize: '0.75rem' }}>ELABORATI</p>
                    <div className="bulk-stat-value">{bulkSuccessCount + bulkErrorCount}</div>
                  </div>
                  <div className="bulk-stat-card" style={{ borderLeftColor: 'rgba(74,222,128,0.2)' }}>
                    <p className="muted-text" style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>RICHIUSI ✅</p>
                    <div className="bulk-stat-value" style={{ color: 'var(--status-success)' }}>{bulkSuccessCount}</div>
                  </div>
                  <div className="bulk-stat-card" style={{ borderLeftColor: 'rgba(248,113,113,0.2)' }}>
                    <p className="muted-text" style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>ERRORI ❌</p>
                    <div className="bulk-stat-value" style={{ color: 'var(--status-danger)' }}>{bulkErrorCount}</div>
                  </div>
                </div>

                {/* Barra di Progresso */}
                <div className="bulk-progress-wrapper">
                  <div className="flex-between">
                    <span className="muted-text" style={{ fontSize: '0.85rem' }}>
                      {bulkStatus === 'running' && `Elaborazione file: ${bulkFiles[currentBulkIndex]?.name}`}
                      {bulkStatus === 'completed' && 'Caricamento di gruppo completato!'}
                      {bulkStatus === 'idle' && 'Pronto ad avviare l\'importazione.'}
                    </span>
                    <strong style={{ color: 'var(--accent-light)' }}>{progressPercent}%</strong>
                  </div>
                  <div className="bulk-progress-bar">
                    <div className="bulk-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Elenco Tabellare della Coda */}
              <div className="glass-card">
                <h3>Dettaglio File in Coda</h3>
                <p className="muted-text" style={{ marginBottom: '16px' }}>Elenco dei file XML pronti o elaborati</p>
                
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30%' }}>Nome File</th>
                        <th style={{ width: '12%' }}>Dimensione</th>
                        <th style={{ width: '40%' }}>Dettagli Rilevati / Note</th>
                        <th style={{ width: '18%', textAlign: 'right' }}>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkFiles.map((item, idx) => {
                        return (
                          <tr key={item.id} className="bulk-file-row" style={{
                            opacity: bulkStatus === 'running' && currentBulkIndex !== idx && item.status === 'pending' ? 0.5 : 1,
                            backgroundColor: currentBulkIndex === idx && item.status === 'uploading' ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent'
                          }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileCode size={16} className="muted-text" />
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td>
                              <span className="muted-text">{(item.size / 1024).toFixed(1)} KB</span>
                            </td>
                            <td>
                              {item.status === 'success' && item.invoiceDetails && (
                                <span style={{ color: 'var(--status-success)', fontSize: '0.85rem' }}>
                                  Fattura n. <strong>{item.invoiceDetails.number}</strong> di <strong>{item.invoiceDetails.supplier}</strong> (Totale: € {item.invoiceDetails.amount.toFixed(2)})
                                </span>
                              )}
                              {item.status === 'error' && (
                                <span style={{ color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                  <AlertCircle size={14} />
                                  <span>{item.errorMsg}</span>
                                </span>
                              )}
                              {item.status === 'pending' && (
                                <span className="muted-text" style={{ fontSize: '0.85rem' }}>In attesa di caricamento...</span>
                              )}
                              {item.status === 'uploading' && (
                                <span className="pulsing-text" style={{ color: 'var(--accent-light)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                  Lettura e importazione nel database...
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {item.status === 'pending' && (
                                <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>In coda</span>
                              )}
                              {item.status === 'uploading' && (
                                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Loader2 size={12} className="rotating-icon" />
                                  <span>Caricamento</span>
                                </span>
                              )}
                              {item.status === 'success' && (
                                <span className="badge badge-success">Completato</span>
                              )}
                              {item.status === 'error' && (
                                <span className="badge badge-danger">Fallito</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}
