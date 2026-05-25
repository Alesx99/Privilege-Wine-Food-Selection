import React, { useState } from 'react';
import { API_BASE_URL } from '../../config';

export default function CicloPassivoTab({
  documents = [],
  isMaster,
  loadAllData,
  showNotice
}) {
  const [xmlContentInput, setXmlContentInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportXml = async () => {
    if (!xmlContentInput.trim()) {
      alert('Inserisci o incolla il contenuto XML di una fattura elettronica passiva.');
      return;
    }
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/import/xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xmlContentInput }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante l\'importazione XML.');
      }

      const importedDoc = await res.json();
      showNotice(`Fattura Passiva n. ${importedDoc.number} importata con successo e giacenze aggiornate!`);
      setXmlContentInput('');
      await loadAllData();
    } catch (err) {
      alert('Errore importazione: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleXmlFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setXmlContentInput(evt.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3>Ciclo Passivo & Importatore XML Fattura Fornitore</h3>
      <p className="muted-text" style={{ fontSize: '0.82rem' }}>
        Importa fatture passive in formato XML dell'Agenzia delle Entrate per registrare l'acquisto, caricare le giacenze nel magazzino e salvare l'anagrafica fornitore se non esistente.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4>1. Incolla XML o Carica File</h4>
          
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Scegli file .xml
            </label>
            <input type="file" accept=".xml" onChange={handleXmlFileChange} className="classic-input" />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Contenuto XML della Fattura
            </label>
            <textarea 
              className="classic-textarea" 
              rows={12} 
              value={xmlContentInput} 
              onChange={(e) => setXmlContentInput(e.target.value)}
              placeholder='<?xml version="1.0" ... <FatturaElettronica> ...'
              style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
            ></textarea>
          </div>

          <button 
            className="classic-btn classic-btn-primary" 
            onClick={handleImportXml}
            disabled={isImporting || !isMaster}
            style={{ justifyContent: 'center' }}
          >
            {isImporting ? 'Elaborazione...' : 'Elabora e Registra Fattura d\'Acquisto'}
          </button>
        </div>

        {/* Purchase invoices history */}
        <div>
          <h4>Ultime Fatture Acquisto Registrate</h4>
          <table className="classic-table" style={{ marginTop: '12px' }}>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Fornitore</th>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Importo</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {documents.filter(d => d.type === 'invoice_purchase').map(doc => (
                <tr key={doc.id}>
                  <td><strong>{doc.number}</strong></td>
                  <td>{doc.partner?.name}</td>
                  <td>{doc.date}</td>
                  <td style={{ textAlign: 'right' }}>€ {doc.total_amount?.toFixed(2)}</td>
                  <td><span className={`status-badge ${doc.status}`}>{doc.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
