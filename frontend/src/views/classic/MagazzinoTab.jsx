import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function MagazzinoTab({
  products = [],
  showNotice
}) {
  const [kits, setKits] = useState(() => {
    const saved = localStorage.getItem('privilege_kits');
    return saved ? JSON.parse(saved) : [
      {
        id: 'kit-1',
        name: 'Tris Barolo & Amarone Privilege',
        sku: 'KIT-TRIS-01',
        components: [
          { product_id: products[0]?.id || '', quantity: 2 },
          { product_id: products[1]?.id || '', quantity: 1 }
        ]
      }
    ];
  });

  const [newKitName, setNewKitName] = useState('');
  const [newKitSku, setNewKitSku] = useState('');
  const [newKitComponents, setNewKitComponents] = useState([{ product_id: '', quantity: 1 }]);

  const handleAddKitComponentRow = () => {
    setNewKitComponents([...newKitComponents, { product_id: '', quantity: 1 }]);
  };

  const handleUpdateKitComponent = (index, field, value) => {
    const updated = [...newKitComponents];
    updated[index] = { ...updated[index], [field]: value };
    setNewKitComponents(updated);
  };

  const handleSaveKit = () => {
    if (!newKitName || !newKitSku) {
      alert('Nome e SKU sono obbligatori.');
      return;
    }
    const cleanComponents = newKitComponents.filter(c => c.product_id && c.quantity > 0);
    if (cleanComponents.length === 0) {
      alert('Aggiungi almeno un componente valido al Kit.');
      return;
    }

    const nextKits = [
      ...kits,
      {
        id: 'kit-' + Date.now(),
        name: newKitName,
        sku: newKitSku.toUpperCase(),
        components: cleanComponents
      }
    ];
    setKits(nextKits);
    localStorage.setItem('privilege_kits', JSON.stringify(nextKits));

    setNewKitName('');
    setNewKitSku('');
    setNewKitComponents([{ product_id: '', quantity: 1 }]);
    showNotice('Kit / Distinta Base salvato correttamente.');
  };

  const handleDeleteKit = (id) => {
    if (confirm('Sei sicuro di voler eliminare questo Kit?')) {
      const nextKits = kits.filter(k => k.id !== id);
      setKits(nextKits);
      localStorage.setItem('privilege_kits', JSON.stringify(nextKits));
      showNotice('Kit eliminato.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="flex-between">
        <div>
          <h3>Compositore Kit Articoli (Distinta Base Semplice)</h3>
          <p className="muted-text" style={{ fontSize: '0.8rem' }}>Permette di definire Kit di vini ed articoli del magazzino, calcolando la giacenza massima assemblabile e i costi.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        {/* Kit Builder Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <h4>Crea Nuovo Kit</h4>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Nome del Kit</label>
            <input type="text" className="classic-input" value={newKitName} onChange={(e) => setNewKitName(e.target.value)} placeholder="es. Confezione Regalo Barolo" />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Codice SKU del Kit</label>
            <input type="text" className="classic-input" value={newKitSku} onChange={(e) => setNewKitSku(e.target.value)} placeholder="es. KIT-BAROLO-01" />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Componenti & Quantità</label>
            {newKitComponents.map((comp, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <select 
                  className="classic-select"
                  value={comp.product_id}
                  onChange={(e) => handleUpdateKitComponent(idx, 'product_id', e.target.value)}
                >
                  <option value="">-- Seleziona Vino --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.vintage})</option>
                  ))}
                </select>
                <input 
                  type="number" 
                  style={{ width: '70px' }} 
                  className="classic-input"
                  value={comp.quantity}
                  min="1"
                  onChange={(e) => handleUpdateKitComponent(idx, 'quantity', e.target.value)}
                  placeholder="Q.tà"
                />
              </div>
            ))}
            <button className="classic-btn classic-btn-secondary" style={{ width: '100%', padding: '4px' }} onClick={handleAddKitComponentRow}>
              + Aggiungi Componente
            </button>
          </div>

          <button className="classic-btn classic-btn-primary" onClick={handleSaveKit} style={{ justifyContent: 'center' }}>
            Registra Kit
          </button>
        </div>

        {/* Kits List */}
        <div>
          <h4>Kits Registrati nel Sistema</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            {kits.map(kit => {
              let totalCost = 0;
              let maxAssemblable = Infinity;

              const breakdown = kit.components.map(comp => {
                const prod = products.find(p => p.id === comp.product_id);
                const cost = (prod?.base_cost || 0) * comp.quantity;
                totalCost += cost;

                const stock = prod?.stock_quantity || 0;
                const possible = Math.floor(stock / comp.quantity);
                if (possible < maxAssemblable) maxAssemblable = possible;

                return {
                  name: prod?.name || 'Vino sconosciuto',
                  vintage: prod?.vintage || '',
                  qty: comp.quantity,
                  stock: stock
                };
              });

              if (maxAssemblable === Infinity) maxAssemblable = 0;

              return (
                <div key={kit.id} style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', background: 'white' }}>
                  <div className="flex-between" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>{kit.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '10px' }}>SKU: <code>{kit.sku}</code></span>
                    </div>
                    <button className="classic-btn classic-btn-danger" style={{ padding: '4px' }} onClick={() => handleDeleteKit(kit.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.8rem' }}>
                    <p style={{ margin: '0 0 6px 0', color: '#64748b' }}>Componenti:</p>
                    <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                      {breakdown.map((b, i) => (
                        <li key={i}>
                          {b.name} ({b.vintage}) &bull; Q.tà nel Kit: <strong>{b.qty}</strong> &bull; Magazzino reale: <span style={{ color: b.stock >= b.qty ? '#059669' : '#dc2626' }}>{b.stock} bottiglie</span>
                        </li>
                      ))}
                    </ul>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '4px' }}>
                      <div>Costo di Produzione: <strong>€ {totalCost.toFixed(2)}</strong></div>
                      <div>Giacenza Assemblabile Max: <strong style={{ color: maxAssemblable > 0 ? '#059669' : '#d97706' }}>{maxAssemblable} conf.</strong></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
