import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Download } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Products({ products, onSave, onDelete }) {
  const [search, setSearch] = useState('');
  const [vintageFilter, setVintageFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  
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
          <h1>Magazzino Vini</h1>
          <p>Gestione del catalogo prodotti, prezzi e scorte di magazzino</p>
        </div>
        <div className="flex-row">
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={18} />
            <span>Esporta CSV</span>
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            <span>Aggiungi Vino</span>
          </button>
        </div>
      </div>

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
              <th>Costo Base</th>
              <th>Costo Scontato</th>
              <th>Ricarico</th>
              <th>Prezzo Vend. Netto</th>
              <th>Prezzo Vend. Lordo</th>
              <th>Tipo Prezzo</th>
              <th>Giacenza</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
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
                  <td>€ {Number(prod.selling_price_gross).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${prod.is_manual_price ? 'badge-warning' : 'badge-success'}`}>
                      {prod.is_manual_price ? 'MANUALE' : 'FORMULA'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${Number(prod.stock_quantity) === 0 ? 'badge-danger' : Number(prod.stock_quantity) < 12 ? 'badge-warning' : 'badge-success'}`}>
                      {prod.stock_quantity} Btg
                    </span>
                  </td>
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
