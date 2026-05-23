import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, FileText, Download, Trash2, CheckCircle2, RotateCcw, XCircle, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Documents({ 
  documents, 
  partners, 
  products, 
  selectedDocId, 
  setSelectedDocId,
  onSave, 
  onDelete, 
  onUpdateStatus,
  onApproveAllDrafts
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const draftCount = useMemo(() => {
    return documents.filter(doc => doc.status === 'draft').length;
  }, [documents]);
  
  // View states
  const [isCreating, setIsCreating] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);

  // Form states
  const [type, setType] = useState('invoice_sale');
  const [partnerId, setPartnerId] = useState('');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]); // Array of { product_id, quantity, unit_price, discount_percent, vat_percent, lot_number }

  // Load document details if selectedDocId changes
  useEffect(() => {
    if (selectedDocId) {
      fetchDocDetail(selectedDocId);
    } else {
      setViewingDoc(null);
    }
  }, [selectedDocId, documents]);

  const fetchDocDetail = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}`);
      if (!res.ok) throw new Error('Impossibile caricare il documento.');
      const data = await res.json();
      setViewingDoc(data);
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const partnerName = doc.partner?.name || '';
      const matchSearch = doc.number.toLowerCase().includes(search.toLowerCase()) || 
                          partnerName.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === '' || doc.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [documents, search, typeFilter]);

  const startCreate = () => {
    setType('invoice_sale');
    setPartnerId(partners[0]?.id || '');
    setNumber(`FE-${Date.now().toString().slice(-5)}`);
    setDate(new Date().toISOString().split('T')[0]);
    setItems([{ product_id: products[0]?.id || '', quantity: 1, unit_price: 0, discount_percent: 0, vat_percent: 22, lot_number: '' }]);
    setIsCreating(true);
    setViewingDoc(null);
  };

  // Handle product selection to retrieve listino prices
  const handleProductChange = async (index, prodId) => {
    if (!partnerId) {
      alert('Seleziona prima un Partner per applicare il listino corretto.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/calculate-price?partnerId=${partnerId}&productId=${prodId}`);
      if (!res.ok) throw new Error('Errore nel calcolo del prezzo.');
      const priceData = await res.json();

      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: prodId,
        unit_price: priceData.price_net,
        vat_percent: priceData.vat_percent
      };
      setItems(newItems);
    } catch (err) {
      const newItems = [...items];
      // fallback to product base cost
      const prod = products.find(p => p.id === prodId);
      newItems[index] = {
        ...newItems[index],
        product_id: prodId,
        unit_price: prod ? prod.selling_price_net : 0,
        vat_percent: prod ? prod.vat_percent : 22
      };
      setItems(newItems);
    }
  };

  // Update item field
  const updateItemField = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { product_id: products[0]?.id || '', quantity: 1, unit_price: 0, discount_percent: 0, vat_percent: 22, lot_number: '' }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate document totals
  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    items.forEach(item => {
      const lineNet = Number((Number(item.quantity || 0) * Number(item.unit_price || 0) * (1 - Number(item.discount_percent || 0) / 100)).toFixed(2));
      const lineTax = Number((lineNet * (Number(item.vat_percent || 22) / 100)).toFixed(2));
      net += lineNet;
      tax += lineTax;
    });
    return {
      net,
      tax,
      gross: net + tax
    };
  }, [items]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!partnerId || items.length === 0) {
      alert('Tutti i campi ed almeno una riga sono obbligatori.');
      return;
    }

    const payload = {
      type,
      partner_id: partnerId,
      number,
      date,
      status: 'draft', // defaults to draft
      items
    };

    onSave(payload);
    setIsCreating(false);
  };

  const handleDownloadPdf = (docId, docNum) => {
    window.open(`${API_BASE_URL}/api/documents/${docId}/pdf`, '_blank');
  };

  const changeStatus = (id, newStatus) => {
    onUpdateStatus(id, newStatus);
  };

  const formatDocType = (type) => {
    switch (type) {
      case 'invoice_sale': return 'Fattura Vendita';
      case 'invoice_purchase': return 'Fattura Acquisto';
      case 'ddt_out': return 'DDT Vendita';
      case 'ddt_in': return 'DDT Acquisto';
      case 'order_supplier': return 'Ordine Fornitore';
      default: return type;
    }
  };

  return (
    <div className="documents-view">
      
      {/* 1. VIEW DETTAGLIO DOCUMENTO */}
      {viewingDoc && !isCreating && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="flex-between">
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setViewingDoc(null);
                setSelectedDocId(null);
              }}
            >
              <ArrowLeft size={16} />
              <span>Indietro</span>
            </button>
            <div className="flex-row">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handleDownloadPdf(viewingDoc.id, viewingDoc.number)}
              >
                <Download size={16} />
                <span>Scarica PDF</span>
              </button>
              
              {viewingDoc.status === 'draft' ? (
                <button 
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--status-success)', borderColor: 'transparent' }}
                  onClick={() => changeStatus(viewingDoc.id, 'completed')}
                >
                  <CheckCircle2 size={16} />
                  <span>Approva & Carica Stock</span>
                </button>
              ) : (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => changeStatus(viewingDoc.id, 'draft')}
                >
                  <RotateCcw size={16} />
                  <span>Riporta a Bozze</span>
                </button>
              )}

              {viewingDoc.status !== 'cancelled' && (
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => changeStatus(viewingDoc.id, 'cancelled')}
                >
                  <XCircle size={16} />
                  <span>Annulla Doc.</span>
                </button>
              )}

              <button 
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  if (confirm('Sei sicuro di voler cancellare definitivamente questo documento? Lo stock verrà ricalcolato.')) {
                    await onDelete(viewingDoc.id);
                    setViewingDoc(null);
                    setSelectedDocId(null);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid-2" style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: 'var(--radius-md)' }}>
            <div>
              <p className="muted-text">DOCUMENTO</p>
              <h2 style={{ margin: '4px 0' }}>{formatDocType(viewingDoc.type)}</h2>
              <p>N. <strong>{viewingDoc.number}</strong> del {viewingDoc.date}</p>
              <p style={{ marginTop: '8px' }}>
                Stato: <span className={`badge badge-${viewingDoc.status === 'completed' ? 'success' : viewingDoc.status === 'cancelled' ? 'danger' : 'warning'}`}>
                  {viewingDoc.status}
                </span>
              </p>
            </div>
            <div>
              <p className="muted-text">ANAGRAFICA COINVOLTA</p>
              <h2 style={{ margin: '4px 0' }}>{viewingDoc.partner?.name}</h2>
              <p>P.IVA: {viewingDoc.partner?.vat_number}</p>
              <p>{viewingDoc.partner?.address}</p>
            </div>
          </div>

          <div>
            <h3>Righe Documento</h3>
            <div className="table-container" style={{ marginTop: '8px' }}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Articolo</th>
                    <th>Codice SKU</th>
                    <th>Quantità</th>
                    <th>Prezzo Unitario</th>
                    <th>Sconto %</th>
                    <th>Lotto</th>
                    <th>Aliquota</th>
                    <th style={{ textAlign: 'right' }}>Totale Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingDoc.items?.map((item) => {
                    const net = Number((item.quantity * item.unit_price * (1 - item.discount_percent / 100)).toFixed(2));
                    return (
                      <tr key={item.id}>
                        <td><strong>{item.product_name}</strong></td>
                        <td><code>{item.product_sku}</code></td>
                        <td>{item.quantity} Btg</td>
                        <td>€ {Number(item.unit_price).toFixed(2)}</td>
                        <td>{item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}</td>
                        <td><span className="muted-text">{item.lot_number || '-'}</span></td>
                        <td>{item.vat_percent}%</td>
                        <td style={{ textAlign: 'right' }}><strong>€ {net.toFixed(2)}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <div className="glass-card" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
              <div className="flex-between">
                <span className="muted-text">Imponibile:</span>
                <span>€ {Number(viewingDoc.total_amount * 0.82).toFixed(2)}</span>
              </div>
              <div className="flex-between">
                <span className="muted-text">IVA (22%):</span>
                <span>€ {Number(viewingDoc.total_amount * 0.18).toFixed(2)}</span>
              </div>
              <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold' }}>
                <span>Totale Documento:</span>
                <span style={{ color: 'var(--accent-light)' }}>€ {Number(viewingDoc.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CREAZIONE NUOVO DOCUMENTO */}
      {isCreating && (
        <div className="glass-card">
          <div className="flex-between" style={{ marginBottom: '24px' }}>
            <h3>Nuovo Documento Commerciale</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsCreating(false)}>Annulla</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Tipo Documento *</label>
                <select className="erp-select" value={type} onChange={e => setType(e.target.value)}>
                  <option value="invoice_sale">Fattura di Vendita (Scarico Magazzino)</option>
                  <option value="ddt_out">DDT di Vendita (Scarico Magazzino)</option>
                  <option value="invoice_purchase">Fattura d'Acquisto (Carico Magazzino)</option>
                  <option value="ddt_in">DDT di Carico (Carico Magazzino)</option>
                  <option value="order_supplier">Ordine Fornitore (Nessun movimento stock)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Anagrafica Partner *</label>
                <select 
                  className="erp-select" 
                  value={partnerId} 
                  onChange={e => setPartnerId(e.target.value)}
                  required
                >
                  <option value="">-- Seleziona Partner --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type.toUpperCase()})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Numero Documento *</label>
                <input 
                  type="text" 
                  className="erp-input" 
                  value={number} 
                  onChange={e => setNumber(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Data Documento *</label>
                <input 
                  type="date" 
                  className="erp-input" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {/* Document Items Builder */}
            <div className="doc-items-builder">
              <h4>Righe Articoli</h4>
              
              {items.map((item, index) => (
                <div key={index} className="doc-item-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Prodotto / Vino</label>
                    <select 
                      className="erp-select" 
                      value={item.product_id}
                      onChange={e => handleProductChange(index, e.target.value)}
                    >
                      <option value="">-- Seleziona Vino --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.vintage} ({p.format}) - Giac: {p.stock_quantity} Btg
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Q.tà</label>
                    <input 
                      type="number" 
                      className="erp-input" 
                      value={item.quantity}
                      min="1"
                      onChange={e => updateItemField(index, 'quantity', Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Prezzo Unit. (€)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="erp-input" 
                      value={item.unit_price}
                      onChange={e => updateItemField(index, 'unit_price', Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Sconto %</label>
                    <input 
                      type="number" 
                      className="erp-input" 
                      value={item.discount_percent}
                      onChange={e => updateItemField(index, 'discount_percent', Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Lotto</label>
                    <input 
                      type="text" 
                      className="erp-input" 
                      value={item.lot_number}
                      placeholder="es. L0526"
                      onChange={e => updateItemField(index, 'lot_number', e.target.value)}
                    />
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-ghost btn-danger btn-sm"
                    onClick={() => removeItemRow(index)}
                    style={{ marginBottom: '6px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <div style={{ marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                  + Aggiungi Riga Articolo
                </button>
              </div>
            </div>

            {/* Summary Box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <div className="glass-card" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
                <div className="flex-between">
                  <span className="muted-text">Imponibile:</span>
                  <span>€ {totals.net.toFixed(2)}</span>
                </div>
                <div className="flex-between">
                  <span className="muted-text">Imposta (IVA):</span>
                  <span>€ {totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold' }}>
                  <span>Totale Stimato:</span>
                  <span style={{ color: 'var(--accent-light)' }}>€ {totals.gross.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Annulla</button>
              <button type="submit" className="btn btn-primary">Salva Documento in Bozze</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. LISTA DOCUMENTI */}
      {!viewingDoc && !isCreating && (
        <>
          <div className="page-header">
            <div>
              <h1>Fatturazione & Documenti</h1>
              <p>Emissione e storico di Fatture Vendita/Acquisto, DDT e Ordini Fornitore</p>
            </div>
            <div className="flex-row" style={{ gap: '10px' }}>
              {draftCount > 0 && (
                <button 
                  className="btn btn-secondary" 
                  style={{ borderColor: 'rgba(74,222,128,0.4)', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={() => {
                    if (window.confirm(`Sei sicuro di voler approvare ed eseguire il carico/scarico stock per tutte le ${draftCount} bozze di documenti presenti?`)) {
                      onApproveAllDrafts();
                    }
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>Approva Bulk Bozze ({draftCount})</span>
                </button>
              )}
              <button className="btn btn-primary" onClick={startCreate}>
                <Plus size={18} />
                <span>Nuovo Documento</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card search-filter-row">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input 
                type="text" 
                placeholder="Cerca per numero documento o nome partner..." 
                className="erp-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select 
              className="erp-select" 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: '220px' }}
            >
              <option value="">Tutti i Tipi Documento</option>
              <option value="invoice_sale">Fatture di Vendita</option>
              <option value="invoice_purchase">Fatture d'Acquisto</option>
              <option value="ddt_out">DDT Vendita</option>
              <option value="ddt_in">DDT Acquisto</option>
              <option value="order_supplier">Ordini Fornitore</option>
            </select>
          </div>

          {/* Document list table */}
          <div className="glass-card table-container" style={{ marginTop: '16px' }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Numero</th>
                  <th>Data</th>
                  <th>Partner</th>
                  <th>Importo Lordo</th>
                  <th>Stato</th>
                  <th style={{ textAlign: 'right' }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Nessun documento trovato.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr 
                      key={doc.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => fetchDocDetail(doc.id)}
                    >
                      <td>
                        <span className="flex-row">
                          <FileText size={16} className="muted-text" />
                          <span>{formatDocType(doc.type)}</span>
                        </span>
                      </td>
                      <td><strong>{doc.number}</strong></td>
                      <td>{doc.date}</td>
                      <td>{doc.partner?.name || 'N/D'}</td>
                      <td><strong>€ {Number(doc.total_amount).toFixed(2)}</strong></td>
                      <td>
                        <span className={`badge badge-${doc.status === 'completed' ? 'success' : doc.status === 'cancelled' ? 'danger' : 'warning'}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDownloadPdf(doc.id, doc.number)} style={{ padding: '6px' }}>
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
