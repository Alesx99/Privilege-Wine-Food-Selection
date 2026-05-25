import React, { useState } from 'react';
import { 
  Building, 
  Upload, 
  Percent, 
  Package, 
  Calculator, 
  Database,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  Info
} from 'lucide-react';

// Import modular sub-components
import CicloAttivoTab from './classic/CicloAttivoTab';
import CicloPassivoTab from './classic/CicloPassivoTab';
import FiscoTab from './classic/FiscoTab';
import MagazzinoTab from './classic/MagazzinoTab';
import TesoreriaTab from './classic/TesoreriaTab';
import ContabilitaTab from './classic/ContabilitaTab';
import CommercialistaTab from './classic/CommercialistaTab';

export default function ClassicInvoicex({ 
  products = [], 
  partners = [], 
  documents = [], 
  priceLists = [], 
  userRole, 
  loadAllData,
  onSaveDocument,
  onDeleteDocument,
  onUpdateDocStatus
}) {
  const isMaster = userRole === 'master';

  // Active Tab state
  const [activeTab, setActiveTab] = useState('attivo');

  // Success/Error notifications state
  const [notice, setNotice] = useState(null);
  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 5000);
  };

  // Grouped DDTs persistent state
  const [groupedDdtsState, setGroupedDdtsState] = useState(() => {
    const saved = localStorage.getItem('privilege_grouped_ddts');
    return saved ? JSON.parse(saved) : [];
  });

  // Help contents mapping
  const helpContents = {
    attivo: 'Ciclo Attivo (Vendite): in questo modulo puoi visionare i listini e raggruppare DDT multipli di uno stesso cliente in un\'unica Fattura Differita di fine mese. Gli articoli uguali vengono aggregati automaticamente per accorciare il documento.',
    passivo: 'Ciclo Passivo (Acquisti): qui puoi caricare i documenti di acquisto da fornitori. Inoltre, il modulo consente di caricare direttamente file XML di fatture passive. L\'importatore integrato estrarrà le righe, creerà le anagrafiche mancanti ed effettuerà il carico automatico in magazzino.',
    fisco: 'Fatturazione Elettronica & Fisco: questa scheda ti permette di simulare ed applicare ritenute d\'acconto e rivalse INPS (4%), di consultare i codici natura esenzione IVA aggiornati (es. N2.2 per forfettari, N6.1 per reverse charge) e di generare il tracciato XML standard conforme per l\'invio a SdI.',
    magazzino: 'Magazzino & Distinta Base (Kit): consenti di creare ricette di "Kit" (assemblati di più prodotti). Per ogni Kit viene calcolata in tempo reale la fattibilità di produzione basandosi sulle giacenze reali a magazzino delle singole bottiglie ed il costo totale di carico.',
    tesoreria: 'Tesoreria: seleziona le fatture attive completate ma non ancora saldate per generare un flusso SEPA Direct Debit (pain.008 CBI) in formato XML da caricare in banca. Da questa sezione puoi anche compilare email di sollecito personalizzate basandoti sui giorni di ritardo.',
    contabilita: 'Contabilità & Prima Nota: gestisci la Prima Nota cassa/banca con un piano dei conti simulato e calcola in tempo reale la liquidazione IVA periodica (mensile o trimestrale) calcolando l\'Iva esigibile a debito e l\'Iva detraibile a credito.',
    commercialista: 'Area Commercialista: esporta i dati delle fatture vendite e acquisti per i gestionali contabili più diffusi (TeamSystem .fatseq, Profis / Sistemi CSV, Datev CSV). È anche possibile scaricare uno ZIP massivo contenente tutti gli XML delle fatture elettroniche di vendita.'
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'attivo':
        return (
          <CicloAttivoTab 
            products={products}
            partners={partners}
            documents={documents}
            userRole={userRole}
            isMaster={isMaster}
            loadAllData={loadAllData}
            showNotice={showNotice}
            groupedDdtsState={groupedDdtsState}
            setGroupedDdtsState={setGroupedDdtsState}
          />
        );
      case 'passivo':
        return (
          <CicloPassivoTab 
            documents={documents}
            isMaster={isMaster}
            loadAllData={loadAllData}
            showNotice={showNotice}
          />
        );
      case 'fisco':
        return (
          <FiscoTab 
            documents={documents}
            showNotice={showNotice}
          />
        );
      case 'magazzino':
        return (
          <MagazzinoTab 
            products={products}
            showNotice={showNotice}
          />
        );
      case 'tesoreria':
        return (
          <TesoreriaTab 
            documents={documents}
            showNotice={showNotice}
          />
        );
      case 'contabilita':
        return (
          <ContabilitaTab 
            documents={documents}
            isMaster={isMaster}
            showNotice={showNotice}
          />
        );
      case 'commercialista':
        return (
          <CommercialistaTab 
            documents={documents}
            showNotice={showNotice}
          />
        );
      default:
        return <div>Tab non trovato</div>;
    }
  };

  return (
    <div className="classic-invoicex-view" style={{ padding: '24px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* GLOBAL SCOPED CUSTOM STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        .classic-invoicex-view {
          --classic-bg: #eceff1;
          --classic-header: #263238;
          --classic-primary: #1e88e5;
          --classic-accent: #0d47a1;
          --classic-border: #cfd8dc;
          --classic-card-bg: #ffffff;
          --classic-text: #37474f;
          --classic-text-muted: #78909c;
          background-color: var(--classic-bg);
          color: var(--classic-text);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }

        .classic-invoicex-view h1, .classic-invoicex-view h2, .classic-invoicex-view h3, .classic-invoicex-view h4 {
          color: var(--classic-header) !important;
          font-weight: 600;
          margin: 0;
        }

        .classic-header-bar {
          background-color: var(--classic-header);
          color: white;
          padding: 16px 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .classic-tabs {
          display: flex;
          background-color: #cfd8dc;
          padding: 4px;
          border-radius: 4px;
          gap: 4px;
          border: 1px solid #b0bec5;
        }

        .classic-tab-btn {
          flex: 1;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-radius: 4px;
          font-size: 0.88rem;
          font-weight: 500;
          color: #546e7a;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .classic-tab-btn:hover {
          background-color: rgba(255,255,255,0.4);
          color: var(--classic-header);
        }

        .classic-tab-btn.active {
          background-color: white;
          color: var(--classic-accent);
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          border: 1px solid #b0bec5;
        }

        .classic-card {
          background-color: var(--classic-card-bg);
          border: 1px solid var(--classic-border);
          border-radius: 6px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .classic-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .classic-table th {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: 600;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 2px solid #cbd5e1;
        }

        .classic-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }

        .classic-table tr:hover td {
          background-color: #f8fafc;
        }

        .classic-btn {
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid transparent;
          transition: all 0.2s;
        }

        .classic-btn-primary {
          background-color: var(--classic-primary);
          color: white;
        }

        .classic-btn-primary:hover {
          background-color: var(--classic-accent);
        }

        .classic-btn-secondary {
          background-color: white;
          border-color: #cbd5e1;
          color: #475569;
        }

        .classic-btn-secondary:hover {
          background-color: #f1f5f9;
        }

        .classic-btn-danger {
          background-color: #ef4444;
          color: white;
        }

        .classic-btn-danger:hover {
          background-color: #dc2626;
        }

        .classic-input, .classic-select, .classic-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 0.88rem;
          color: #334155;
          background-color: white;
        }

        .classic-input:focus, .classic-select:focus, .classic-textarea:focus {
          outline: none;
          border-color: var(--classic-primary);
          box-shadow: 0 0 0 3px rgba(30,136,229,0.15);
        }

        .info-bubble {
          background-color: #e3f2fd;
          border-left: 4px solid var(--classic-primary);
          padding: 12px;
          border-radius: 0 4px 4px 0;
          font-size: 0.82rem;
          color: #1565c0;
          line-height: 1.4;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          font-size: 0.72rem;
          font-weight: 600;
          border-radius: 12px;
          text-transform: uppercase;
        }

        .status-badge.draft { background-color: #fef3c7; color: #d97706; }
        .status-badge.completed { background-color: #d1fae5; color: #059669; }
        .status-badge.cancelled { background-color: #fee2e2; color: #dc2626; }

        @media (max-width: 768px) {
          .classic-header-bar {
            flex-direction: column;
            gap: 12px;
            text-align: center;
            align-items: center;
            padding: 16px;
          }
          .classic-header-bar > div {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .classic-tabs {
            flex-wrap: wrap;
            justify-content: center;
            gap: 6px;
          }
          .classic-tab-btn {
            flex: 0 0 calc(50% - 6px); /* 2 columns of tabs */
            font-size: 0.78rem;
            padding: 8px;
          }
        }
      `}} />

      {/* TOP HEADER BAR */}
      <div className="classic-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Layers size={24} />
          <div>
            <h2 style={{ color: 'white !important', margin: 0, fontSize: '1.25rem' }}>Gestione Classica (Stile Invoicex)</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#b0bec5' }}>
              Moduli ERP per PMI &bull; Connesso ai dati reali del database &bull; Proprietario Alesx99
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="classic-btn classic-btn-secondary" style={{ padding: '6px 12px' }} onClick={loadAllData}>
            <RefreshCw size={14} />
            <span>Sincronizza</span>
          </button>
          <div style={{ fontSize: '0.75rem', background: '#37474f', padding: '6px 12px', borderRadius: '4px' }}>
            Modalità: <strong style={{ color: isMaster ? '#4caf50' : '#ffa726' }}>{userRole.toUpperCase()}</strong>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="classic-tabs">
        <button className={`classic-tab-btn ${activeTab === 'attivo' ? 'active' : ''}`} onClick={() => setActiveTab('attivo')}>
          <Building size={16} />
          <span>Ciclo Attivo</span>
        </button>
        <button className={`classic-tab-btn ${activeTab === 'passivo' ? 'active' : ''}`} onClick={() => setActiveTab('passivo')}>
          <Upload size={16} />
          <span>Ciclo Passivo</span>
        </button>
        <button className={`classic-tab-btn ${activeTab === 'fisco' ? 'active' : ''}`} onClick={() => setActiveTab('fisco')}>
          <Percent size={16} />
          <span>Fisco & E-Fattura</span>
        </button>
        <button className={`classic-tab-btn ${activeTab === 'magazzino' ? 'active' : ''}`} onClick={() => setActiveTab('magazzino')}>
          <Package size={16} />
          <span>Magazzino & Kit</span>
        </button>
        <button className={`classic-tab-btn ${activeTab === 'tesoreria' ? 'active' : ''}`} onClick={() => setActiveTab('tesoreria')}>
          <Calculator size={16} />
          <span>Tesoreria</span>
        </button>
        <button className={`classic-tab-btn ${activeTab === 'contabilita' ? 'active' : ''}`} onClick={() => setActiveTab('contabilita')}>
          <Database size={16} />
          <span>Prima Nota & IVA</span>
        </button>
        <button className={`classic-tab-btn ${activeTab === 'commercialista' ? 'active' : ''}`} onClick={() => setActiveTab('commercialista')}>
          <FileSpreadsheet size={16} />
          <span>Commercialista</span>
        </button>
      </div>

      {/* NOTIFICATION TOAST */}
      {notice && (
        <div style={{
          backgroundColor: notice.type === 'success' ? '#d1fae5' : '#fee2e2',
          borderLeft: `4px solid ${notice.type === 'success' ? '#10b981' : '#ef4444'}`,
          padding: '12px 16px',
          borderRadius: '4px',
          color: notice.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          {notice.msg}
        </div>
      )}

      {/* INLINE GUIDE PANEL */}
      <div className="info-bubble">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Guida Modulo:</strong> {helpContents[activeTab]}
        </div>
      </div>

      {/* RENDER CURRENT TAB COMPONENT */}
      <div className="classic-card">
        {renderActiveTab()}
      </div>

      {/* DEVELOPER CREDIT & OWNERSHIP */}
      <div style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px dashed #cfd8dc', paddingTop: '20px', paddingBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--classic-text-muted)' }}>
          © Alesx99 &bull; Esclusiva Proprietà del Sistema di Gestione Integrata Privilege Wine &amp; Food Selection
        </p>
      </div>

    </div>
  );
}
