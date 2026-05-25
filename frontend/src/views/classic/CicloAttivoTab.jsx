import React, { useState, useMemo } from 'react';
import { CheckCircle, Building } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function CicloAttivoTab({
  products = [],
  partners = [],
  documents = [],
  userRole,
  isMaster,
  loadAllData,
  showNotice,
  groupedDdtsState,
  setGroupedDdtsState
}) {
  const [selectedClientForDdt, setSelectedClientForDdt] = useState('');
  const [selectedDdtIds, setSelectedDdtIds] = useState([]);

  const clients = useMemo(() => {
    return partners.filter(p => p.type === 'client' || p.type === 'both');
  }, [partners]);

  const clientDdts = useMemo(() => {
    if (!selectedClientForDdt) return [];
    return documents.filter(doc => 
      doc.partner_id === selectedClientForDdt && 
      doc.type === 'ddt_out' && 
      !groupedDdtsState.includes(doc.id)
    );
  }, [selectedClientForDdt, documents, groupedDdtsState]);

  const handleToggleDdt = (id) => {
    setSelectedDdtIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGroupDdts = async () => {
    if (selectedDdtIds.length === 0) {
      alert('Seleziona almeno un DDT da raggruppare.');
      return;
    }
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }

    try {
      const fetchPromises = selectedDdtIds.map(id => 
        fetch(`${API_BASE_URL}/api/documents/${id}`).then(res => {
          if (!res.ok) throw new Error(`Errore caricamento DDT ${id}`);
          return res.json();
        })
      );
      const fullDdts = await Promise.all(fetchPromises);

      const aggregatedItems = {};
      fullDdts.forEach(ddt => {
        const ddtItems = ddt.items || [];
        ddtItems.forEach(item => {
          const key = item.product_id;
          if (!aggregatedItems[key]) {
            aggregatedItems[key] = {
              product_id: item.product_id,
              quantity: 0,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent || 0,
              vat_percent: item.vat_percent || 22,
              lot_number: item.lot_number || '',
            };
          }
          aggregatedItems[key].quantity += Number(item.quantity);
        });
      });

      const finalItems = Object.values(aggregatedItems);

      if (finalItems.length === 0) {
        alert('Nessun articolo trovato nei DDT selezionati.');
        return;
      }

      const invoiceNumber = `FD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const payload = {
        type: 'invoice_sale',
        partner_id: selectedClientForDdt,
        number: invoiceNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        items: finalItems
      };

      const res = await fetch(`${API_BASE_URL}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore nel salvataggio della fattura differita.');
      }

      await res.json();

      const updatedGrouped = [...groupedDdtsState, ...selectedDdtIds];
      setGroupedDdtsState(updatedGrouped);
      localStorage.setItem('privilege_grouped_ddts', JSON.stringify(updatedGrouped));

      setSelectedDdtIds([]);
      showNotice(`Fattura differita bozza ${invoiceNumber} generata con successo!`);
      await loadAllData();
    } catch (err) {
      alert('Errore raggruppamento DDT: ' + err.message);
    }
  };

  const handleResetGroupedDdts = () => {
    if (confirm('Vuoi resettare lo stato di fatturazione dei DDT? Sarà possibile ri-selezionarli.')) {
      setGroupedDdtsState([]);
      localStorage.removeItem('privilege_grouped_ddts');
      showNotice('Filtro DDT resettato.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="flex-between" style={{ borderBottom: '1px solid var(--classic-border)', paddingBottom: '12px' }}>
        <div>
          <h3>Ciclo Attivo - Workflow di Conversione DDT e Documenti</h3>
          <p className="muted-text" style={{ fontSize: '0.78rem' }}>Raggruppamento differito di fine mese per cliente con aggregazione automatica degli SKU ripetuti.</p>
        </div>
        {groupedDdtsState.length > 0 && (
          <button className="classic-btn classic-btn-secondary" onClick={handleResetGroupedDdts}>
            Ripristina DDT Raggruppati
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        {/* Selection Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <h4>1. Seleziona Cliente</h4>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Anagrafica Cliente</label>
            <select 
              className="classic-select" 
              value={selectedClientForDdt} 
              onChange={(e) => {
                setSelectedClientForDdt(e.target.value);
                setSelectedDdtIds([]);
              }}
            >
              <option value="">-- Seleziona Cliente --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.vat_number})</option>
              ))}
            </select>
          </div>

          {selectedClientForDdt && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '0.8rem' }}>DDT pronti per fattura differita: <strong>{clientDdts.length}</strong></p>
              <button 
                className="classic-btn classic-btn-primary" 
                onClick={handleGroupDdts}
                disabled={selectedDdtIds.length === 0 || !isMaster}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <CheckCircle size={16} />
                <span>Raggruppa in Fattura Differita</span>
              </button>
            </div>
          )}
        </div>

        {/* DDT List */}
        <div>
          <h4>2. DDT Pendenti</h4>
          {!selectedClientForDdt ? (
            <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
              Seleziona un cliente a sinistra per visualizzare i DDT pendenti da fatturare.
            </div>
          ) : clientDdts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
              Nessun DDT pendente non fatturato per questo cliente.
            </div>
          ) : (
            <table className="classic-table">
              <thead>
                <tr>
                  <th width="40">Seleziona</th>
                  <th>Numero DDT</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Importo Totale</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {clientDdts.map(ddt => (
                  <tr key={ddt.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedDdtIds.includes(ddt.id)} 
                        onChange={() => handleToggleDdt(ddt.id)}
                      />
                    </td>
                    <td><strong>{ddt.number}</strong></td>
                    <td>{ddt.date}</td>
                    <td style={{ textAlign: 'right' }}>€ {ddt.total_amount?.toFixed(2)}</td>
                    <td><span className={`status-badge ${ddt.status}`}>{ddt.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Price list display */}
      <div style={{ marginTop: '20px', borderTop: '1px solid var(--classic-border)', paddingTop: '20px' }}>
        <h3>Consulta Listini Prezzi Configurati</h3>
        <table className="classic-table" style={{ marginTop: '12px' }}>
          <thead>
            <tr>
              <th>Nome Prodotto (Vino)</th>
              <th>Codice SKU</th>
              <th>Prezzo Base Netto</th>
              <th>IVA %</th>
              <th>Listino Ristorazione (+ markup)</th>
              <th>Listino Privati (+ markup)</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong> ({p.vintage} &bull; {p.format})</td>
                <td><code>{p.sku}</code></td>
                <td>€ {p.base_cost?.toFixed(2)}</td>
                <td>{p.vat_percent}%</td>
                <td>€ {((p.base_cost || 0) * 1.3).toFixed(2)} (+30%)</td>
                <td>€ {((p.base_cost || 0) * 1.5).toFixed(2)} (+50%)</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
