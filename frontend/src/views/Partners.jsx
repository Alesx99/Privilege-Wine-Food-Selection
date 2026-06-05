import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Download } from 'lucide-react';
import { z } from 'zod';
import { API_BASE_URL } from '../config';

// Zod Schema for Partner validation
const partnerSchema = z.object({
  name: z.string().min(2, 'La denominazione deve contenere almeno 2 caratteri'),
  type: z.enum(['client', 'supplier', 'both']),
  vat_number: z.string().regex(/^\d{11}$/, 'La Partita IVA italiana deve essere composta da esattamente 11 cifre'),
  tax_code: z.string().optional().or(z.literal('')),
  sdi_code: z.string().regex(/^[A-Z0-9]{7}$/i, 'Il Codice SDI deve essere di esattamente 7 caratteri alfanumerici'),
  email: z.string().email('Indirizzo e-mail non valido').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  price_list_id: z.string().optional().or(z.literal('')),
  password: z.string().optional().or(z.literal(''))
});

export default function Partners({ partners, priceLists, onSave, onDelete, userRole }) {
  const isMaster = userRole === 'master';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('client');
  const [vatNumber, setVatNumber] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [sdiCode, setSdiCode] = useState('0000000');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [password, setPassword] = useState('');
  
  const [errors, setErrors] = useState({});

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.vat_number.includes(search);
      const matchType = typeFilter === '' || p.type === typeFilter || p.type === 'both';
      return matchSearch && matchType;
    });
  }, [partners, search, typeFilter]);

  const openAddModal = () => {
    setEditingPartner(null);
    setName('');
    setType('client');
    setVatNumber('');
    setTaxCode('');
    setSdiCode('0000000');
    setEmail('');
    setAddress('');
    setPhone('');
    setPriceListId('');
    setPassword('');
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingPartner(p);
    setName(p.name);
    setType(p.type);
    setVatNumber(p.vat_number);
    setTaxCode(p.tax_code || '');
    setSdiCode(p.sdi_code || '0000000');
    setEmail(p.email || '');
    setAddress(p.address || '');
    setPhone(p.phone || '');
    setPriceListId(p.price_list_id || '');
    setPassword(p.password || '');
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate inputs with Zod
    const dataToValidate = {
      name,
      type,
      vat_number: vatNumber,
      tax_code: taxCode,
      sdi_code: sdiCode.toUpperCase(),
      email,
      address,
      phone,
      price_list_id: priceListId,
      password
    };

    const result = partnerSchema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const payload = {
      id: editingPartner?.id,
      ...dataToValidate,
      sdi_code: sdiCode.toUpperCase()
    };

    onSave(payload);
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (confirm('Sei sicuro di voler eliminare questa anagrafica? Tutti i documenti relativi rimarranno bloccati.')) {
      onDelete(id);
    }
  };

  const handleExportCsv = () => {
    window.open(`${API_BASE_URL}/api/export/partners`, '_blank');
  };

  const getPriceListName = (listId) => {
    const list = priceLists.find(pl => pl.id === listId);
    return list ? list.name : 'Nessuno (Default)';
  };

  return (
    <div className="partners-view">
      <div className="page-header">
        <div>
          <h1>Anagrafiche Commerciali</h1>
          <p>Gestione di Clienti, Fornitori e Listini di ricarico associati</p>
        </div>
        <div className="flex-row">
          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={18} />
            <span>Esporta CSV</span>
          </button>
          {isMaster && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              <span>Nuova Anagrafica</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="glass-card search-filter-row">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Cerca per Ragione Sociale o Partita IVA..." 
            className="erp-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select 
          className="erp-select" 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="">Tutti i Ruoli</option>
          <option value="client">Clienti</option>
          <option value="supplier">Fornitori</option>
        </select>
      </div>

      {/* Partners Table */}
      <div className="glass-card table-container" style={{ marginTop: '16px' }}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Ragione Sociale</th>
              <th>Ruolo</th>
              <th>Partita IVA</th>
              <th>Codice SDI</th>
              <th>Email</th>
              <th>Listino Ricarico</th>
              {isMaster && <th style={{ textAlign: 'right' }}>Azioni</th>}
            </tr>
          </thead>
          <tbody>
            {filteredPartners.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Nessun cliente o fornitore in archivio.
                </td>
              </tr>
            ) : (
              filteredPartners.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted-text" style={{ fontSize: '0.8rem', marginTop: '2px' }}>{p.address || '-'}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${p.type === 'client' ? 'info' : p.type === 'supplier' ? 'warning' : 'success'}`}>
                      {p.type === 'client' ? 'CLIENTE' : p.type === 'supplier' ? 'FORNITORE' : 'ENTRAMBI'}
                    </span>
                  </td>
                  <td><code>{p.vat_number}</code></td>
                  <td><code>{p.sdi_code}</code></td>
                  <td>{p.email || '-'}</td>
                  <td>
                    {p.type === 'supplier' ? '-' : (
                      <span className="badge badge-success">
                        {getPriceListName(p.price_list_id)}
                      </span>
                    )}
                  </td>
                  {isMaster && (
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(p)} style={{ padding: '6px' }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDelete(p.id)} style={{ padding: '6px' }}>
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
              <h3>{editingPartner ? 'Modifica Anagrafica' : 'Nuova Anagrafica Commerciale'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Ruolo Soggetto *</label>
                  <select 
                    className="erp-select" 
                    value={type} 
                    onChange={e => setType(e.target.value)}
                  >
                    <option value="client">Cliente</option>
                    <option value="supplier">Fornitore</option>
                    <option value="both">Entrambi (Fornitore & Cliente)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Listino Ricarico (Solo per Clienti)</label>
                  <select 
                    className="erp-select" 
                    value={priceListId} 
                    onChange={e => setPriceListId(e.target.value)}
                    disabled={type === 'supplier'}
                  >
                    <option value="">Nessuno (Default Margine Prodotto)</option>
                    {priceLists.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name} (+{pl.markup_percent}%)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Ragione Sociale / Nome e Cognome *</label>
                <input 
                  type="text" 
                  className="erp-input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Es. MEREGALLI GIUSEPPE SPA o ROSSI MARIO"
                />
                {errors.name && <span className="muted-text" style={{ color: 'red', fontSize: '0.8rem' }}>{errors.name}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Partita IVA *</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={vatNumber} 
                    onChange={e => setVatNumber(e.target.value)} 
                    required 
                    placeholder="11 cifre numeriche"
                  />
                  {errors.vat_number && <span className="muted-text" style={{ color: 'red', fontSize: '0.8rem' }}>{errors.vat_number}</span>}
                </div>
                <div className="form-group">
                  <label>Codice SDI *</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={sdiCode} 
                    onChange={e => setSdiCode(e.target.value)} 
                    required 
                    placeholder="7 caratteri alfanumerici"
                  />
                  {errors.sdi_code && <span className="muted-text" style={{ color: 'red', fontSize: '0.8rem' }}>{errors.sdi_code}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Codice Fiscale (Opzionale)</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={taxCode} 
                    onChange={e => setTaxCode(e.target.value)} 
                    placeholder="16 caratteri alfanumerici"
                  />
                </div>
                <div className="form-group">
                  <label>Telefono (Opzionale)</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Indirizzo E-mail (Opzionale)</label>
                <input 
                  type="email" 
                  className="erp-input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="amministrazione@azienda.it"
                />
                {errors.email && <span className="muted-text" style={{ color: 'red', fontSize: '0.8rem' }}>{errors.email}</span>}
              </div>

              {(type === 'client' || type === 'both') && (
                <div className="form-group">
                  <label>Chiave di Accesso / Password Ristoratore (Opzionale, visibile all'amministratore)</label>
                  <input 
                    type="text" 
                    className="erp-input" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Imposta una password per consentire il login come Ristoratore..."
                  />
                  {errors.password && <span className="muted-text" style={{ color: 'red', fontSize: '0.8rem' }}>{errors.password}</span>}
                </div>
              )}

              <div className="form-group">
                <label>Sede Legale / Indirizzo (Opzionale)</label>
                <input 
                  type="text" 
                  className="erp-input" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)} 
                  placeholder="Via, CAP, Comune (Provincia)"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva Anagrafica</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
