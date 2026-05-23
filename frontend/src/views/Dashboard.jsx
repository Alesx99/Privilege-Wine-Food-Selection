import React, { useMemo } from 'react';
import { 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Users, 
  FileText 
} from 'lucide-react';

export default function Dashboard({ products, partners, documents, setActivePage, setSelectedDocId }) {
  
  // Calculate KPIs
  const kpis = useMemo(() => {
    // Sales: Sum of completed invoice_sale
    const salesTotal = documents
      .filter(doc => doc.type === 'invoice_sale' && doc.status === 'completed')
      .reduce((sum, doc) => sum + Number(doc.total_amount || 0), 0);

    // Stock value: Sum of product stock * base_cost
    const stockValuation = products.reduce(
      (sum, p) => sum + (Number(p.stock_quantity || 0) * Number(p.base_cost || 0)), 
      0
    );

    // Low stock count: products with stock < 12
    const lowStockCount = products.filter(p => Number(p.stock_quantity || 0) < 12).length;

    return {
      salesTotal,
      stockValuation,
      lowStockCount,
      partnersCount: partners.length,
    };
  }, [products, partners, documents]);

  // Recent Documents (max 5)
  const recentDocs = useMemo(() => {
    return [...documents]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [documents]);

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products
      .filter(p => Number(p.stock_quantity || 0) < 12)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity))
      .slice(0, 5);
  }, [products]);

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
    <div className="dashboard-view">
      <div className="page-header">
        <div>
          <h1>Dashboard Cantina</h1>
          <p>Panoramica delle scorte e della gestione commerciale Privilege</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-grid">
        <div className="glass-card kpi-card">
          <div>
            <p className="muted-text">Fatturato Vendite</p>
            <div className="kpi-value">€ {kpis.salesTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="kpi-icon-container">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div>
            <p className="muted-text">Valore Magazzino (Costo)</p>
            <div className="kpi-value">€ {kpis.stockValuation.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="kpi-icon-container">
            <Package size={24} />
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div>
            <p className="muted-text">Allerta Sotto-scorta</p>
            <div className="kpi-value" style={{ color: kpis.lowStockCount > 0 ? '#ef4444' : 'inherit' }}>
              {kpis.lowStockCount}
            </div>
          </div>
          <div className="kpi-icon-container">
            <AlertTriangle size={24} style={{ color: kpis.lowStockCount > 0 ? '#ef4444' : 'inherit' }} />
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div>
            <p className="muted-text">Anagrafiche Attive</p>
            <div className="kpi-value">{kpis.partnersCount}</div>
          </div>
          <div className="kpi-icon-container">
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* Double Column Layout */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        
        {/* Recent Documents */}
        <div className="glass-card">
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3>Documenti Recenti</h3>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setActivePage('documents')}
            >
              Vedi Tutti
            </button>
          </div>
          
          <div className="table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Numero</th>
                  <th>Data</th>
                  <th>Totale</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Nessun documento trovato
                    </td>
                  </tr>
                ) : (
                  recentDocs.map(doc => (
                    <tr 
                      key={doc.id} 
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setActivePage('documents');
                      }}
                    >
                      <td><span className="muted-text">{formatDocType(doc.type)}</span></td>
                      <td><strong>{doc.number}</strong></td>
                      <td>{doc.date}</td>
                      <td>€ {Number(doc.total_amount).toFixed(2)}</td>
                      <td>
                        <span className={`badge badge-${doc.status === 'completed' ? 'success' : doc.status === 'cancelled' ? 'danger' : 'warning'}`}>
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-card">
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3>Allerta Scorte Cantina</h3>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setActivePage('products')}
            >
              Vedi Tutti
            </button>
          </div>

          <div className="table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Codice SKU</th>
                  <th>Denominazione Vino</th>
                  <th>Formato</th>
                  <th>Giacenza</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--status-success)' }}>
                      Tutti i vini sono a scorta ottimale (&gt;12 bottiglie)
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.map(prod => (
                    <tr key={prod.id}>
                      <td><code style={{ fontSize: '0.8rem' }}>{prod.sku}</code></td>
                      <td>
                        <strong>{prod.name}</strong> 
                        <span style={{ color: 'var(--accent-light)', marginLeft: '8px' }}>{prod.vintage}</span>
                      </td>
                      <td><span className="muted-text">{prod.format}</span></td>
                      <td>
                        <span className={`badge badge-${prod.stock_quantity === 0 ? 'danger' : 'warning'}`}>
                          {prod.stock_quantity} Btg
                        </span>
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
  );
}
