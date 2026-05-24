import React, { useState, useEffect } from 'react';
import { API_BASE_URL, handleFetchError } from '../config';
import { Landmark, ArrowLeftRight, Plus, RefreshCw } from 'lucide-react';

export default function Warehouses({ userRole }) {
  const isMaster = userRole === 'master';
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Transfer state
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [transferQty, setTransferQty] = useState('6');
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [whRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/warehouses`),
        fetch(`${API_BASE_URL}/api/products`),
      ]);

      if (!whRes.ok || !prodRes.ok) {
        throw new Error('Errore nel caricamento delle giacenze depositi.');
      }

      const whData = await whRes.json();
      const prodData = await prodRes.json();

      setWarehouses(whData);
      setProducts(prodData);
    } catch (err) {
      alert(handleFetchError(err, 'Caricamento depositi'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!fromWarehouse || !toWarehouse || !selectedProduct || !transferQty) {
      alert('Tutti i campi sono obbligatori per il trasferimento.');
      return;
    }

    if (fromWarehouse === toWarehouse) {
      alert('Il magazzino di origine e destinazione devono essere diversi.');
      return;
    }

    setProcessing(true);
    // Simulate stock transfer
    await new Promise(resolve => setTimeout(resolve, 800));

    alert('Trasferimento di stock registrato con successo! Emesso DDT di trasferimento interno.');
    setTransferQty('6');
    setProcessing(false);
    loadData();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted-text">Caricamento logistica multi-deposito...</p>
      </div>
    );
  }

  return (
    <div className="warehouses-view">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Multi-Deposito & Trasferimenti</h1>
          <p>Supervisiona lo stoccaggio nei vari punti di stoccaggio fisici e logistici esterni della cantina</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: '24px' }}>
        {/* Left: Warehouses List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {warehouses.map((wh) => (
            <div key={wh.id} className="glass-card" style={{ borderLeft: '4px solid var(--accent-light)' }}>
              <div className="flex-between" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={20} style={{ color: 'var(--accent-light)' }} />
                  <h3 style={{ margin: 0 }}>{wh.name}</h3>
                </div>
                <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <code>{wh.code}</code>
                </span>
              </div>
              <p className="muted-text" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>Ubicazione: {wh.location}</p>

              {/* Simulated details of quantities */}
              <div className="table-container">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Vino Label</th>
                      <th>Annata</th>
                      <th style={{ textAlign: 'right' }}>Giacenza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      // Deposito principale sees the full mock quantity, Deposito esterno is empty or seeded
                      const qty = wh.code === 'DEP-PRINCIPALE' ? p.stock_quantity : Math.max(0, Math.floor(p.stock_quantity / 3) - 2);
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.vintage}</td>
                          <td style={{ textAlign: 'right' }}><strong>{qty} Btg</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Transfer Stock Form */}
        <div className="glass-card">
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3>Trasferimento Interno Merci</h3>
            <ArrowLeftRight size={20} style={{ color: 'var(--accent-light)' }} />
          </div>
          {!isMaster ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <Landmark size={32} style={{ color: 'var(--status-warning)', marginBottom: '12px' }} />
              <p className="muted-text" style={{ fontSize: '0.85rem' }}>
                La visualizzazione autorizzata in sola lettura non consente la movimentazione interna delle scorte tra i depositi.
              </p>
            </div>
          ) : (
            <>
              <p className="muted-text" style={{ marginBottom: '20px' }}>Emetti un DDT di storno logistico per movimentare scorte tra depositi differenti.</p>

              <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>Deposito Origine</label>
                  <select className="erp-select" value={fromWarehouse} onChange={e => setFromWarehouse(e.target.value)} required>
                    <option value="">Seleziona origine...</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Deposito Destinazione</label>
                  <select className="erp-select" value={toWarehouse} onChange={e => setToWarehouse(e.target.value)} required>
                    <option value="">Seleziona destinazione...</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Vino da Trasferire</label>
                  <select className="erp-select" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} required>
                    <option value="">Seleziona vino...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.vintage} - {p.format})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantità (Bottiglie)</label>
                  <input 
                    type="number" 
                    className="erp-input"
                    value={transferQty}
                    onChange={e => setTransferQty(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={processing}>
                  {processing ? (
                    <>
                      <RefreshCw size={16} className="rotating-icon" />
                      <span>Elaborazione storno logistico...</span>
                    </>
                  ) : (
                    <span>Registra Trasferimento</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
