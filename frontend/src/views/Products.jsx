import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Download, HelpCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Products({ products, onSave, onDelete, userRole, loadAllData }) {
  const isMaster = userRole === 'master';
  const [search, setSearch] = useState('');
  const [vintageFilter, setVintageFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  
  // Duplicates panel states
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [merging, setMerging] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Form fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [vintage, setVintage] = useState('NV');
  const [format, setFormat] = useState('0.75L');
  const [baseCost, setBaseCost] = useState('0.00');
  const [discountedCost, setDiscountedCost] = useState('');
  const [markupPercent, setMarkupPercent] = useState('30.00');
  const [vatPercent, setVatPercent] = useState('22.00');
  const [isManualPrice, setIsManualPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');

  // Helper to extract base SKU
  const getBaseSku = (s) => {
    if (!s) return '';
    const clean = s.trim().toUpperCase();
    let base = clean.replace(/[-/_.]+[A-Z0-9]{1,2}$/, '');
    base = base.replace(/([0-9]+)[A-Z]{1,2}$/, '$1');
    return base;
  };

  // Group potential duplicates (products sharing the same base SKU, vintage, and format)
  const duplicateGroups = useMemo(() => {
    const groups = {};
    products.forEach(p => {
      const base = getBaseSku(p.sku);
      if (!base || base.length < 3) return;
      
      // key includes base SKU, vintage, and format to prevent mixing vintages/formats!
      const key = `${base}|${p.vintage || 'NV'}|${p.format || '0.75L'}`;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    // Filter groups that have more than one product
    return Object.entries(groups)
      .filter(([_, group]) => group.length > 1)
      .map(([key, group]) => {
        const [base] = key.split('|');
        return { base, group };
      });
  }, [products]);

  const handleMerge = async (targetId, sourceId) => {
    if (!targetId || !sourceId) {
      alert('Seleziona entrambi i prodotti per eseguire l\'unione.');
      return;
    }
    if (targetId === sourceId) {
      alert('Impossibile unire un prodotto con se stesso.');
      return;
    }

    const source = products.find(p => p.id === sourceId);
    const target = products.find(p => p.id === targetId);
    
    if (!confirm(`Sei sicuro di voler unire il prodotto "${source?.name}" (${source?.sku}) nel prodotto "${target?.name}" (${target?.sku})?\n\nTutte le righe di documenti storici verranno riassociate e le giacenze sommate. Il prodotto sorgente verrà cancellato.`)) {
      return;
    }

    setMerging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetProductId: targetId, sourceProductId: sourceId })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante l\'unione.');
      }

      // Aggiorna riferimenti nei Kit locali in localStorage (Criticità #3)
      const savedKits = localStorage.getItem('privilege_kits');
      if (savedKits) {
        try {
          const kits = JSON.parse(savedKits);
          let modified = false;
          const updatedKits = kits.map(kit => {
            const updatedComponents = kit.components.map(comp => {
              if (comp.product_id === sourceId) {
                modified = true;
                return { ...comp, product_id: targetId };
              }
              return comp;
            });
            return { ...kit, components: updatedComponents };
          });
          if (modified) {
            localStorage.setItem('privilege_kits', JSON.stringify(updatedKits));
          }
        } catch (e) {
          console.error('Errore aggiornamento kit locali:', e);
        }
      }

      alert('Prodotti uniti con successo!');
      if (loadAllData) {
        await loadAllData();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setMerging(false);
    }
  };

  // Filter lists
  const vintages = useMemo(() => {
    return ['NV', ...new Set(products.map(p => p.vintage).filter(v => v !== 'NV'))].sort();
  }, [products]);

  const formats = useMemo(() => {
    return [...new Set(products.map(p => p.format))].sort();
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.sku.toLowerCase().includes(search.toLowerCase());
      const matchVintage = vintageFilter === '' || p.vintage === vintageFilter;
      const matchFormat = formatFilter === '' || p.format === formatFilter;
      return matchSearch && matchVintage && matchFormat;
    });
  }, [products, search, vintageFilter, formatFilter]);

  const openAddModal = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setVintage('NV');
    setFormat('0.75L');
    setBaseCost('0.00');
    setDiscountedCost('');
    setMarkupPercent('30.00');
    setVatPercent('22.00');
    setIsManualPrice(false);
    setManualPrice('');
    setStockQuantity('0');
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setSku(p.sku);
    setName(p.name);
    setVintage(p.vintage);
    setFormat(p.format);
    setBaseCost(String(p.base_cost));
    setDiscountedCost(p.discounted_cost !== null && p.discounted_cost !== undefined ? String(p.discounted_cost) : '');
    setMarkupPercent(String(p.markup_percent));
    setVatPercent(String(p.vat_percent));
    setIsManualPrice(p.is_manual_price);
    setManualPrice(p.manual_price !== null ? String(p.manual_price) : '');
    setStockQuantity(String(p.stock_quantity));
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sku || !name) {
      alert('SKU e Nome Prodotto sono obbligatori.');
      return;
    }

    const payload = {
      id: editingProduct?.id,
      sku,
      name,
      vintage,
      format,
      base_cost: Number(baseCost) || 0,
      discounted_cost: discountedCost !== '' ? Number(discountedCost) : null,
      markup_percent: Number(markupPercent) || 0,
      vat_percent: Number(vatPercent) || 0,
      is_manual_price: isManualPrice,
      manual_price: isManualPrice && manualPrice ? Number(manualPrice) : null,
      stock_quantity: Number(stockQuantity) || 0
    };

    onSave(payload);
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (confirm('Sei sicuro di voler eliminare questo prodotto?')) {
      onDelete(id);
    }
  };

  const handleExportCsv = () => {
    window.open(`${API_BASE_URL}/api/export/products`, '_blank');
  };

  // Preview calculated prices in modal
  const computedNet = useMemo(() => {
    const cost = discountedCost !== '' ? Number(discountedCost) : (Number(baseCost) || 0);
    const markup = Number(markupPercent) || 0;
    return (cost * (1 + markup / 100)).toFixed(2);
  }, [baseCost, discountedCost, markupPercent]);

  const computedGross = useMemo(() => {
    const net = isManualPrice ? (Number(manualPrice) || 0) : Number(computedNet);
    const vat = Number(vatPercent) || 0;
    return (net * (1 + vat / 100)).toFixed(2);
  }, [computedNet, vatPercent, isManualPrice, manualPrice]);

  return (
    <div className="products-view">
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Magazzino Vini</span>
            <button 
              type="button" 
              className="help-toggle-btn"
              onClick={() => setShowHelp(!showHelp)}
              title="Mostra guida"
            >
              <HelpCircle size={20} />
            </button>
          </h1>
          <p>Gestione del catalogo prodotti, prezzi e scorte di magazzino</p>
        </div>
        
        <div className="flex-row">
          {userRole !== 'ristoratore' && (
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              <Download size={18} />
              <span>Esporta CSV</span>
            </button>
          )}
          {isMaster && (
            <>
              <button 
                className={`btn ${showMergePanel ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setShowMergePanel(!showMergePanel)}
              >
                <span>Gestione Duplicati</span>
              </button>
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={18} />
                <span>Aggiungi Vino</span>
              </button>
            </>
          )}
        </div>
      </div>

      {showHelp && (
        <div className="help-callout">
          <h4><HelpCircle size={16} /> Guida Rapida - Magazzino Vini</h4>
          <p>
            Benvenuto nel modulo di gestione catalogo e scorte. Qui puoi:
          </p>
          <ul>
            <li><strong>Prezzo Formula:</strong> Calcolato partendo dal costo unitario fornitore (base o scontato) applicando la percentuale di ricarico impostata.</li>
            <li><strong>Prezzo Manuale:</strong> Consente di bloccare ed inserire liberamente il prezzo di vendita netto scavalcando le formule automatiche.</li>
            <li><strong>Soglia di Sottoscorta:</strong> I prodotti con giacenza 0 compaiono in rosso, quelli sotto le 12 bottiglie in giallo per facilitare i riassortimenti.</li>
            <li><strong>Gestione Duplicati:</strong> Unisci due schede vino con codici simili o errati. L'operazione ricalcolerà lo stock e aggiornerà lo storico dei DDT e delle fatture in automatico.</li>
          </ul>
        </div>
      )}

      {isMaster && showMergePanel && (
        <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div className="flex-between">
            <h3 style={{ color: 'var(--accent-light)' }}>Risoluzione Prodotti Duplicati (SKU Simili)</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowMergePanel(false)}>Chiudi</button>
          </div>
          
          <div className="grid-2" style={{ gap: '24px' }}>
            {/* Automatic detection list */}
            <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
              <h4>Duplicati Rilevati Automaticamente</h4>
              <p className="muted-text" style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
                Il sistema analizza gli SKU che differiscono solo nella parte finale (es. varianti o lotti).
              </p>
              
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {duplicateGroups.length === 0 ? (
                  <div className="muted-text" style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                    Nessun potenziale duplicato rilevato al momento.
                  </div>
                ) : (
                  duplicateGroups.map(({ base, group }) => (
                    <div key={base} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex-between" style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Gruppo SKU Base: <code>{base}</code></span>
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{group.length} duplicati</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {group.map(prod => (
                          <div key={prod.id} className="flex-between" style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <div>
                              <span>{prod.name} ({prod.vintage})</span>
                              <br />
                              <span className="muted-text">SKU: <code>{prod.sku}</code> | Giac: {prod.stock_quantity} Btg</span>
                            </div>
                            <button 
                              className="btn btn-xs btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              disabled={merging}
                              onClick={async () => {
                                const targetId = prod.id;
                                const sources = group.filter(p => p.id !== targetId);
                                if (sources.length > 0) {
                                  for (const src of sources) {
                                    await handleMerge(targetId, src.id);
                                  }
                                }
                              }}
                            >
                              Mantieni questo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Manual merging */}
            <div>
              <h4>Unione Manuale Prodotti</h4>
              <p className="muted-text" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Seleziona manualmente un prodotto principale da conservare e un prodotto duplicato da fondere.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Prodotto Principale (da mantenere) *</label>
                  <select 
                    className="erp-select"
                    id="merge-target-select"
                    defaultValue=""
                  >
                    <option value="">-- Seleziona Prodotto Principale --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.vintage} ({p.sku}) - Giac: {p.stock_quantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Prodotto Duplicato (da eliminare ed unire) *</label>
                  <select 
                    className="erp-select"
                    id="merge-source-select"
                    defaultValue=""
                  >
                    <option value="">-- Seleziona Prodotto Duplicato --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.vintage} ({p.sku}) - Giac: {p.stock_quantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(244,63,94,0.05)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(244,63,94,0.15)', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>
                    <strong>Attenzione:</strong> Le righe dei documenti storici saranno spostate sul prodotto principale. La giacenza sarà sommata e il prodotto duplicato verrà rimosso permanentemente dal catalogo.
                  </span>
                </div>

                <button 
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                  disabled={merging}
                  onClick={() => {
                    const targetVal = document.getElementById('merge-target-select').value;
                    const sourceVal = document.getElementById('merge-source-select').value;
                    handleMerge(targetVal, sourceVal);
                  }}
                >
                  {merging ? 'Elaborazione...' : 'Unisci Prodotti'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Row */}
      <div className="glass-card search-filter-row">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Cerca per denominazione o codice SKU..." 
            className="erp-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select 
          className="erp-select" 
          value={vintageFilter} 
          onChange={(e) => setVintageFilter(e.target.value)}
          style={{ width: '150px' }}
        >
          <option value="">Tutte le Annate</option>
          {vintages.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select 
          className="erp-select" 
          value={formatFilter} 
          onChange={(e) => setFormatFilter(e.target.value)}
          style={{ width: '150px' }}
        >
          <option value="">Tutti i Formati</option>
          {formats.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="glass-card table-container" style={{ marginTop: '16px' }}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Prodotto</th>
              <th>Formato</th>
              {userRole !== 'ristoratore' && (
                <>
                  <th>Costo Base</th>
                  <th>Costo Scontato</th>
                  <th>Ricarico</th>
                  <th>Prezzo Vend. Netto</th>
                </>
              )}
              <th>Prezzo Vend. Lordo</th>
              {userRole !== 'ristoratore' && <th>Tipo Prezzo</th>}
              <th>Giacenza</th>
              {isMaster && <th style={{ textAlign: 'right' }}>Azioni</th>}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={userRole === 'ristoratore' ? 5 : 11} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Nessun vino trovato in catalogo.
                </td>
              </tr>
            ) : (
              filteredProducts.map(prod => (
                <tr key={prod.id}>
                  <td><code style={{ fontSize: '0.85rem' }}>{prod.sku}</code></td>
                  <td>
                    <strong>{prod.name}</strong>
                    <span style={{ color: 'var(--accent-light)', marginLeft: '8px', fontWeight: 'bold' }}>
                      {prod.vintage}
                    </span>
                  </td>
                  <td><span className="muted-text">{prod.format}</span></td>
                  
                  {userRole !== 'ristoratore' && (
                    <>
                      <td>€ {Number(prod.base_cost).toFixed(2)}</td>
                      <td>
                        {prod.discounted_cost !== null && prod.discounted_cost !== undefined ? (
                          <strong style={{ color: 'var(--status-success)' }}>
                            € {Number(prod.discounted_cost).toFixed(2)}
                          </strong>
                        ) : (
                          <span className="muted-text">-</span>
                        )}
                      </td>
                      <td>{prod.is_manual_price ? '-' : `${prod.markup_percent}%`}</td>
                      <td><strong>€ {Number(prod.selling_price_net).toFixed(2)}</strong></td>
                    </>
                  )}
                  
                  <td>€ {Number(prod.selling_price_gross).toFixed(2)}</td>
                  
                  {userRole !== 'ristoratore' && (
                    <td>
                      <span className={`badge ${prod.is_manual_price ? 'badge-warning' : 'badge-success'}`}>
                        {prod.is_manual_price ? 'MANUALE' : 'FORMULA'}
                      </span>
                    </td>
                  )}
                  
                  <td>
                    <span className={`badge ${Number(prod.stock_quantity) === 0 ? 'badge-danger' : Number(prod.stock_quantity) < 12 ? 'badge-warning' : 'badge-success'}`}>
                      {prod.stock_quantity} Btg
                    </span>
                  </td>
                  {isMaster && (
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(prod)} style={{ padding: '6px' }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(prod.id)} style={{ padding: '6px' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h3>{editingProduct ? 'Modifica Scheda Prodotto' : 'Aggiungi Nuovo Prodotto'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Codice SKU / Cod. Art. Fornitore *</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={sku} 
                    onChange={e => setSku(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Giacenza Iniziale (Bottiglie) *</label>
                  <input 
                    type="number" 
                    className="erp-input" 
                    value={stockQuantity} 
                    onChange={e => setStockQuantity(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Denominazione Vino *</label>
                <input 
                  type="text" 
                  className="erp-input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Es. BAROLO DOCG CANNUBI"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Annata (Vintage) *</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={vintage} 
                    onChange={e => setVintage(e.target.value)} 
                    required 
                    placeholder="NV o Anno"
                  />
                </div>
                <div className="form-group">
                  <label>Formato Bottiglia *</label>
                  <select 
                    className="erp-select" 
                    value={format} 
                    onChange={e => setFormat(e.target.value)}
                  >
                    <option value="0.375L">Mezza Bottiglia (0.375L)</option>
                    <option value="0.75L">Standard (0.75L)</option>
                    <option value="1.5L">Magnum (1.5L)</option>
                    <option value="3.0L">Doppio Magnum (3.0L)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Costo Base Fornitore (€) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="erp-input" 
                    value={baseCost} 
                    onChange={e => setBaseCost(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Costo Scontato Unitario (€)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="erp-input" 
                    value={discountedCost} 
                    placeholder="Facoltativo..."
                    onChange={e => setDiscountedCost(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Aliquota IVA (%) *</label>
                  <input 
                    type="number" 
                    step="1" 
                    className="erp-input" 
                    value={vatPercent} 
                    onChange={e => setVatPercent(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px', margin: '16px 0 20px 0', border: '1px dashed var(--border-color)' }}>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={isManualPrice} 
                      onChange={e => setIsManualPrice(e.target.checked)} 
                    />
                    Imposta Prezzo Manuale (Sblocca Ricarico Calcolato)
                  </label>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Ricarico automatico (%)</label>
                    <input 
                      type="number" 
                      className="erp-input" 
                      value={markupPercent} 
                      onChange={e => setMarkupPercent(e.target.value)} 
                      disabled={isManualPrice}
                    />
                  </div>
                  <div className="form-group">
                    <label>Prezzo Netto Manuale (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="erp-input" 
                      value={manualPrice} 
                      onChange={e => setManualPrice(e.target.value)} 
                      disabled={!isManualPrice}
                      placeholder={isManualPrice ? 'Imposta prezzo manuale...' : computedNet}
                    />
                  </div>
                </div>
              </div>

              {/* Real-time price calculation box */}
              <div className="flex-between" style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' }}>
                <span className="muted-text">Prezzo Finale calcolato:</span>
                <div>
                  <span className="muted-text" style={{ marginRight: '16px' }}>Imponibile: € {isManualPrice ? Number(manualPrice || 0).toFixed(2) : computedNet}</span>
                  <strong>Lordo (IVA Inclusa): € {computedGross}</strong>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva Scheda</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
