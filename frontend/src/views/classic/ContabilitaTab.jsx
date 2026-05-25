import React, { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';

export default function ContabilitaTab({
  documents = [],
  isMaster,
  showNotice
}) {
  const [primaNota, setPrimaNota] = useState(() => {
    const saved = localStorage.getItem('privilege_prima_nota');
    return saved ? JSON.parse(saved) : [];
  });

  const [pnDate, setPnDate] = useState(new Date().toISOString().split('T')[0]);
  const [pnDesc, setPnDesc] = useState('');
  const [pnType, setPnType] = useState('entrata');
  const [pnAmount, setPnAmount] = useState('');
  const [pnGruppo, setPnGruppo] = useState('Attività');
  const [pnConto, setPnConto] = useState('Cassa e Banche');
  const [pnSottoconto, setPnSottoconto] = useState('Cassa Contanti');

  const handleAddPrimaNota = () => {
    if (!pnDesc || !pnAmount) {
      alert('Descrizione ed Importo sono obbligatori.');
      return;
    }
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }

    const entry = {
      id: 'pn-' + Date.now(),
      date: pnDate,
      description: pnDesc,
      type: pnType,
      amount: Number(pnAmount),
      gruppo: pnGruppo,
      conto: pnConto,
      sottoconto: pnSottoconto
    };

    const nextPn = [...primaNota, entry];
    setPrimaNota(nextPn);
    localStorage.setItem('privilege_prima_nota', JSON.stringify(nextPn));

    setPnDesc('');
    setPnAmount('');
    showNotice('Movimento di Prima Nota registrato con successo!');
  };

  const handleDeletePn = (id) => {
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }
    if (confirm('Eliminare questo movimento?')) {
      const nextPn = primaNota.filter(p => p.id !== id);
      setPrimaNota(nextPn);
      localStorage.setItem('privilege_prima_nota', JSON.stringify(nextPn));
      showNotice('Movimento eliminato.');
    }
  };

  const pnBalance = useMemo(() => {
    let entrate = 0;
    let uscite = 0;
    primaNota.forEach(p => {
      if (p.type === 'entrata') entrate += p.amount;
      else uscite += p.amount;
    });
    return { entrate, uscite, total: entrate - uscite };
  }, [primaNota]);

  // VAT settlement simulator (Liquidazione IVA)
  const [vatYear, setVatYear] = useState('2026');
  const [vatPeriod, setVatPeriod] = useState('1');
  const [vatResultSummary, setVatResultSummary] = useState(null);

  const handleCalculateVatSettlement = () => {
    let salesVat = 0;
    let salesTaxable = 0;
    let purchasesVat = 0;
    let purchasesTaxable = 0;

    documents.forEach(doc => {
      if (doc.status !== 'completed') return;
      
      const docDate = new Date(doc.date);
      const y = docDate.getFullYear().toString();
      if (y !== vatYear) return;

      const m = docDate.getMonth() + 1;
      let isInPeriod = false;

      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].includes(vatPeriod)) {
        isInPeriod = m.toString() === vatPeriod;
      } else if (vatPeriod === 'Q1') {
        isInPeriod = m >= 1 && m <= 3;
      } else if (vatPeriod === 'Q2') {
        isInPeriod = m >= 4 && m <= 6;
      } else if (vatPeriod === 'Q3') {
        isInPeriod = m >= 7 && m <= 9;
      } else if (vatPeriod === 'Q4') {
        isInPeriod = m >= 10 && m <= 12;
      }

      if (isInPeriod) {
        const total = Number(doc.total_amount) || 0;
        const taxable = Number((total / 1.22).toFixed(2));
        const vat = Number((total - taxable).toFixed(2));

        if (doc.type === 'invoice_sale') {
          salesTaxable += taxable;
          salesVat += vat;
        } else if (doc.type === 'invoice_purchase') {
          purchasesTaxable += taxable;
          purchasesVat += vat;
        }
      }
    });

    const diff = salesVat - purchasesVat;
    setVatResultSummary({
      year: vatYear,
      period: vatPeriod,
      salesTaxable,
      salesVat,
      purchasesTaxable,
      purchasesVat,
      diff
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Prima Nota */}
      <div>
        <div className="flex-between">
          <h3>Prima Nota Cassa & Banche a 3 Livelli</h3>
          <div>
            Saldo Attuale Cassa/Banca: <strong style={{ color: pnBalance.total >= 0 ? '#059669' : '#dc2626', fontSize: '1.1rem' }}>€ {pnBalance.total.toFixed(2)}</strong>
          </div>
        </div>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Inserisci movimenti e traccia le entrate/uscite di cassa con il Piano dei Conti a 3 livelli (Gruppo &rarr; Conto &rarr; Sottoconto).</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          {/* Form Add */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Data Registrazione</label>
              <input type="date" className="classic-input" value={pnDate} onChange={(e) => setPnDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Descrizione Movimento</label>
              <input type="text" className="classic-input" value={pnDesc} onChange={(e) => setPnDesc(e.target.value)} placeholder="es. Ritiro contanti / Spese cancelleria" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Direzione Cassa</label>
              <select className="classic-select" value={pnType} onChange={(e) => setPnType(e.target.value)}>
                <option value="entrata">Entrata (+) </option>
                <option value="uscita">Uscita (-)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Importo (€)</label>
              <input type="number" className="classic-input" value={pnAmount} onChange={(e) => setPnAmount(e.target.value)} />
            </div>

            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Piano dei Conti (3 Livelli)</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <select className="classic-select" value={pnGruppo} onChange={(e) => setPnGruppo(e.target.value)}>
                  <option value="Attività">1. Attività</option>
                  <option value="Passività">1. Passività</option>
                  <option value="Costi">2. Costi</option>
                  <option value="Ricavi">2. Ricavi</option>
                </select>
                <select className="classic-select" value={pnConto} onChange={(e) => setPnConto(e.target.value)}>
                  <option value="Cassa e Banche">2. Cassa e Banche</option>
                  <option value="Clienti/Fornitori">2. Debiti / Crediti</option>
                  <option value="Oneri di Gestione">2. Oneri di Gestione</option>
                </select>
                <select className="classic-select" value={pnSottoconto} onChange={(e) => setPnSottoconto(e.target.value)}>
                  <option value="Cassa Contanti">3. Cassa Contanti</option>
                  <option value="Conto Corrente Bancario">3. Conto Corrente Bancario</option>
                  <option value="Acquisti Cancelleria">3. Acquisti Cancelleria</option>
                  <option value="Ricavi da Vendite Vini">3. Ricavi da Vendite Vini</option>
                </select>
              </div>
            </div>

            <button className="classic-btn classic-btn-primary" onClick={handleAddPrimaNota} style={{ justifyContent: 'center' }} disabled={!isMaster}>
              Registra Movimento
            </button>
          </div>

          {/* Table List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4>Movimenti Registrati</h4>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="classic-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrizione / Piano Conti</th>
                    <th style={{ textAlign: 'right' }}>Importo</th>
                    <th>Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {primaNota.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Nessun movimento registrato in Prima Nota.</td></tr>
                  ) : (
                    primaNota.map(p => (
                      <tr key={p.id}>
                        <td>{p.date}</td>
                        <td>
                          <div><strong>{p.description}</strong></div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.gruppo} &gt; {p.conto} &gt; {p.sottoconto}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: p.type === 'entrata' ? '#059669' : '#dc2626' }}>
                          {p.type === 'entrata' ? '+' : '-'} € {p.amount?.toFixed(2)}
                        </td>
                        <td>
                          <button className="classic-btn classic-btn-danger" style={{ padding: '2px 4px' }} onClick={() => handleDeletePn(p.id)} disabled={!isMaster}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Liquidazione IVA */}
      <div style={{ borderTop: '1px solid var(--classic-border)', paddingTop: '20px' }}>
        <h3>Liquidazione IVA Periodica Simulata</h3>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Simulatore per il calcolo dell'IVA a debito (da vendite) ed IVA a credito (da acquisti) per il periodo specificato.</p>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <select className="classic-select" style={{ width: '120px' }} value={vatYear} onChange={(e) => setVatYear(e.target.value)}>
            <option value="2026">Anno 2026</option>
            <option value="2025">Anno 2025</option>
          </select>

          <select className="classic-select" style={{ width: '150px' }} value={vatPeriod} onChange={(e) => setVatPeriod(e.target.value)}>
            <option value="1">Gennaio</option>
            <option value="2">Febbraio</option>
            <option value="3">Marzo</option>
            <option value="4">Aprile</option>
            <option value="5">Maggio</option>
            <option value="6">Giugno</option>
            <option value="7">Luglio</option>
            <option value="8">Agosto</option>
            <option value="9">Settembre</option>
            <option value="10">Ottobre</option>
            <option value="11">Novembre</option>
            <option value="12">Dicembre</option>
            <option value="Q1">1° Trimestre (Q1)</option>
            <option value="Q2">2° Trimestre (Q2)</option>
            <option value="Q3">3° Trimestre (Q3)</option>
            <option value="Q4">4° Trimestre (Q4)</option>
          </select>

          <button className="classic-btn classic-btn-primary" onClick={handleCalculateVatSettlement}>
            Calcola Liquidazione IVA
          </button>
        </div>

        {vatResultSummary && (
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h4>Riepilogo IVA Periodica</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginTop: '10px' }}>
                <div className="flex-between"><span>Imponibile vendite:</span><span>€ {vatResultSummary.salesTaxable.toFixed(2)}</span></div>
                <div className="flex-between"><span>IVA vendite (Esigibile a Debito):</span><strong>€ {vatResultSummary.salesVat.toFixed(2)}</strong></div>
                <div className="flex-between" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}><span>Imponibile acquisti:</span><span>€ {vatResultSummary.purchasesTaxable.toFixed(2)}</span></div>
                <div className="flex-between"><span>IVA acquisti (Detraibile a Credito):</span><strong>€ {vatResultSummary.purchasesVat.toFixed(2)}</strong></div>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Risultato della Liquidazione:</p>
              <h2 style={{ 
                color: vatResultSummary.diff >= 0 ? '#dc2626 !important' : '#059669 !important',
                margin: '6px 0',
                fontSize: '1.6rem'
              }}>
                € {Math.abs(vatResultSummary.diff).toFixed(2)}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {vatResultSummary.diff >= 0 ? (
                  <span style={{ color: '#b91c1c', fontWeight: 600 }}>Debito d'Imposta (da versare con F24)</span>
                ) : (
                  <span style={{ color: '#047857', fontWeight: 600 }}>Credito d'Imposta (compensabile o a rimborso)</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
