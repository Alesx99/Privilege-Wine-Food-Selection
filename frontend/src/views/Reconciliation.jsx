import React, { useState } from 'react';
import { API_BASE_URL, handleFetchError } from '../config';
import { Landmark, UploadCloud, FileCode, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function Reconciliation() {
  const [fileContent, setFileContent] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const processTextContent = async (text) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reconciliation/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: text })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante l\'elaborazione del file CBI.');
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      alert(handleFetchError(err, 'Riconciliazione bancaria'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setFileContent(text);
      processTextContent(text);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setFileContent(text);
      processTextContent(text);
    };
    reader.readAsText(file);
  };

  const handleLoadMockCbi = () => {
    // Generates a mock CBI string format (120 char per line standard)
    const mockCbi = 
      `1000845920966          BANCA DI VERONA                                                     \n` +
      `3000000000000000000000200526000000000090530CSALDO FATTURA N 10092/FE             ENOTECA DEL CORSO SRL\n` +
      `3000000000000000000000200526000000000011000CPAGAMENTO BOLLA 8114ME             GRAND HOTEL VESUVIO\n` +
      `9900000000000000000000000000000000000000000                                                         `;
    setFileName('MOCK_ESTRATTO_CONTO_CBI.TXT');
    setFileContent(mockCbi);
    processTextContent(mockCbi);
  };

  const handleConfirmReconcile = (invoiceNum) => {
    alert(`Fattura ${invoiceNum} riconciliata con successo. Lo stato del pagamento è stato aggiornato.`);
    // Remove transaction from matching screen
    setResults(prev => prev.filter(r => r.matchedInvoiceNumber !== invoiceNum));
  };

  return (
    <div className="reconciliation-view">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Riconciliazione Bancaria</h1>
          <p>Importa gli estratti conto telematici della banca (tracciato CBI standard) per chiudere automaticamente le fatture aperte</p>
        </div>
      </div>

      {results.length === 0 ? (
        /* Upload Area */
        <div 
          className={`glass-card import-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('cbi-input-file').click()}
          style={{ padding: '60px 40px', textAlign: 'center' }}
        >
          <input 
            type="file" 
            id="cbi-input-file" 
            style={{ display: 'none' }} 
            accept=".txt,.xml" 
            onChange={handleFileSelect}
          />
          <div className="import-icon">
            <Landmark size={32} />
          </div>
          <div>
            <h3>Trascina qui il file CBI della banca (.txt o .xml)</h3>
            <p className="muted-text" style={{ marginTop: '6px' }}>
              Oppure clicca per sfogliare i tuoi file. Supporta estratti conto a tracciato CBI a 120 caratteri.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadMockCbi();
              }}
            >
              Genera Estratto Conto CBI di Esempio
            </button>
          </div>
        </div>
      ) : (
        /* Reconcile Matcher Dashboard */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileCode size={24} style={{ color: 'var(--accent-light)' }} />
              <div>
                <h3>File Rilevato: <code>{fileName}</code></h3>
                <p className="muted-text">Riconciliazione automatica attiva</p>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { setResults([]); setFileName(''); setFileContent(''); }}>
              Carica un altro estratto conto
            </button>
          </div>

          <div className="glass-card">
            <h3>Abbinamenti Fatture Proposti</h3>
            <p className="muted-text" style={{ marginBottom: '16px' }}>Il sistema ha abbinato i movimenti di cassa basandosi su importo esatto e testi causali.</p>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={32} className="rotating-icon" />
              </div>
            ) : (
              <div className="table-container">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Transazione Banca</th>
                      <th>Importo</th>
                      <th>Causale Rilevata</th>
                      <th>Fattura Abbinata</th>
                      <th>Confidenza</th>
                      <th style={{ textAlign: 'right' }}>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((res, idx) => {
                      const score = res.confidenceScore;
                      let scoreColor = 'var(--status-danger)';
                      if (score >= 80) scoreColor = 'var(--status-success)';
                      else if (score >= 50) scoreColor = 'var(--status-warning)';

                      return (
                        <tr key={idx}>
                          <td>
                            <div><strong>{res.transaction.payerName}</strong></div>
                            <span className="muted-text" style={{ fontSize: '0.8rem' }}>{res.transaction.date}</span>
                          </td>
                          <td><strong>€ {Number(res.transaction.amount).toFixed(2)}</strong></td>
                          <td><code style={{ fontSize: '0.85rem' }}>{res.transaction.causale}</code></td>
                          <td>
                            {res.matchedInvoiceNumber ? (
                              <div>
                                <span>Fattura </span>
                                <strong>#{res.matchedInvoiceNumber}</strong>
                              </div>
                            ) : (
                              <span className="muted-text">- Nessuna -</span>
                            )}
                          </td>
                          <td>
                            <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: scoreColor, border: `1px solid ${scoreColor}40` }}>
                              {score}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {res.status === 'reconciled' ? (
                              <button className="btn btn-primary btn-sm" onClick={() => handleConfirmReconcile(res.matchedInvoiceNumber)}>
                                <CheckCircle size={14} style={{ marginRight: '4px' }} />
                                <span>Riconcilia</span>
                              </button>
                            ) : res.status === 'partial' ? (
                              <button className="btn btn-warning btn-sm" onClick={() => handleConfirmReconcile(res.matchedInvoiceNumber)}>
                                <AlertTriangle size={14} style={{ marginRight: '4px' }} />
                                <span>Verifica & Chiudi</span>
                              </button>
                            ) : (
                              <button className="btn btn-secondary btn-sm" disabled>
                                Abbina Manuale
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
