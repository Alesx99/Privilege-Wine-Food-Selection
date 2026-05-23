import React, { useState, useMemo } from 'react';
import { Search, Lock, Home } from 'lucide-react';

export default function ClientCatalog({ products, onLoginClick }) {
  const [search, setSearch] = useState('');
  const [vintageFilter, setVintageFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  const handleHomeClick = () => {
    setSearch('');
    setVintageFilter('');
    setFormatFilter('');
  };

  // Extract unique formats/vintages for filter dropdowns
  const vintages = useMemo(() => {
    return ['NV', ...new Set(products.map(p => p.vintage).filter(v => v !== 'NV'))].sort();
  }, [products]);

  const formats = useMemo(() => {
    return [...new Set(products.map(p => p.format))].sort();
  }, [products]);

  // Filter products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.sku.toLowerCase().includes(search.toLowerCase());
      const matchVintage = vintageFilter === '' || p.vintage === vintageFilter;
      const matchFormat = formatFilter === '' || p.format === formatFilter;
      return matchSearch && matchVintage && matchFormat;
    });
  }, [products, search, vintageFilter, formatFilter]);

  return (
    <div className="client-catalog-container">
      {/* Navbar */}
      <header className="client-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div className="client-brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }} onClick={handleHomeClick}>
            <img 
              src="/logo.jpeg" 
              alt="Privilege Selection Logo" 
              style={{ height: '40px', width: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }} 
            />
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '700' }}>Privilege Selection</h2>
          </div>
          
          <button className="btn btn-secondary btn-sm" onClick={handleHomeClick} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Home size={16} />
            <span>Home</span>
          </button>
        </div>
        
        <button className="btn btn-primary btn-sm" onClick={onLoginClick} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={16} />
          <span>Accedi</span>
        </button>
      </header>

      {/* Catalog Main Content */}
      <div className="client-catalog-content">
        <div>
          <h1>Listino Prezzi & Scorte</h1>
          <p>Consulta il catalogo aggiornato in tempo reale dei nostri vini ed eccellenze vinicole</p>
        </div>

        {/* Search & Filters */}
        <div className="glass-card search-filter-row">
          <div className="search-input-wrapper">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Cerca un vino nel listino..." 
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

        {/* Catalog Grid */}
        <div className="client-product-grid">
          {filteredProducts.length === 0 ? (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
              <p className="muted-text">Nessun prodotto disponibile soddisfa i criteri di ricerca.</p>
            </div>
          ) : (
            filteredProducts.map(prod => {
              const isAvailable = Number(prod.stock_quantity || 0) > 0;

              return (
                <div key={prod.id} className="glass-card client-product-card">
                  <div>
                    <span className="muted-text" style={{ fontSize: '0.8rem', textTransform: 'uppercase', trackingLetter: '0.05em' }}>
                      {prod.format} | Annata: {prod.vintage}
                    </span>
                    <h3>{prod.name}</h3>
                  </div>

                  <div className="client-product-price-box">
                    <span className="muted-text" style={{ fontSize: '0.85rem' }}>Disponibilità:</span>
                    {isAvailable ? (
                      <div>
                        <span className="client-price-value">
                          € {Number(prod.selling_price_gross).toFixed(2)}
                        </span>
                        <span className="client-price-label">Lordo IVA</span>
                      </div>
                    ) : (
                      <span className="badge badge-danger" style={{ border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px' }}>
                        Non disponibile
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
