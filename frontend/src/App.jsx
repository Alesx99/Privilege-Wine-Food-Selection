import React, { useState, useEffect } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { API_BASE_URL, handleFetchError } from './config';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Products from './views/Products';
import Partners from './views/Partners';
import Documents from './views/Documents';
import ImportArea from './views/ImportArea';
import Login from './components/Login';
import ClientCatalog from './views/ClientCatalog';
import Warehouses from './views/Warehouses';
import Agents from './views/Agents';
import Reconciliation from './views/Reconciliation';
import ClassicInvoicex from './views/ClassicInvoicex';
import ProductSuggestions from './views/ProductSuggestions';

export default function App() {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('privilege_user_role') || null);
  const [agentId, setAgentId] = useState(() => localStorage.getItem('privilege_agent_id') || null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('privilege_theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('privilege_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Data states
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter out "Sconto", "Omaggio", "Secchiello" and 0€ products for non-master roles
  const visibleProducts = React.useMemo(() => {
    if (userRole === 'master') return products;
    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const priceGross = Number(p.selling_price_gross) || 0;
      const priceNet = Number(p.selling_price_net) || 0;
      
      const excludeKeywords = ['sconto', 'omaggio', 'omaggi', 'secchiello', 'secchielli'];
      const matchesKeyword = excludeKeywords.some(keyword => name.includes(keyword) || sku.includes(keyword));
      const isZeroPrice = priceGross <= 0 || priceNet <= 0;
      
      return !matchesKeyword && !isZeroPrice;
    });
  }, [products, userRole]);

  // Load database tables from backend
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [prodRes, partRes, docRes, listRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/products`),
        fetch(`${API_BASE_URL}/api/partners`),
        fetch(`${API_BASE_URL}/api/documents`),
        fetch(`${API_BASE_URL}/api/price-lists`),
      ]);

      if (!prodRes.ok || !partRes.ok || !docRes.ok || !listRes.ok) {
        const errors = [];
        if (!prodRes.ok) {
          const body = await prodRes.json().catch(() => ({}));
          errors.push(`Prodotti: ${body.message || prodRes.statusText}`);
        }
        if (!partRes.ok) {
          const body = await partRes.json().catch(() => ({}));
          errors.push(`Partner: ${body.message || partRes.statusText}`);
        }
        if (!docRes.ok) {
          const body = await docRes.json().catch(() => ({}));
          errors.push(`Documenti: ${body.message || docRes.statusText}`);
        }
        if (!listRes.ok) {
          const body = await listRes.json().catch(() => ({}));
          errors.push(`Listini: ${body.message || listRes.statusText}`);
        }
        throw new Error(`Errore nel caricamento dei dati dal server NestJS:\n${errors.join('\n')}`);
      }

      const prods = await prodRes.json();
      const parts = await partRes.json();
      const docs = await docRes.json();
      const lists = await listRes.json();

      setProducts(prods);
      setPartners(parts);
      setDocuments(docs);
      setPriceLists(lists);
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- PRODUCT CRUD ACTION ---
  const handleSaveProduct = async (productData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!res.ok) throw new Error("Errore nel salvataggio del prodotto.");
      await loadAllData();
    } catch (err) {
      alert(handleFetchError(err, 'Salvataggio prodotto'));
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error("Errore nell'eliminazione del prodotto.");
      await loadAllData();
    } catch (err) {
      alert(handleFetchError(err, 'Eliminazione prodotto'));
    }
  };

  // --- PARTNER CRUD ACTION ---
  const handleSavePartner = async (partnerData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partnerData),
      });

      if (!res.ok) throw new Error("Errore nel salvataggio del partner.");
      await loadAllData();
    } catch (err) {
      alert(handleFetchError(err, 'Salvataggio partner'));
    }
  };

  const handleDeletePartner = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/partners/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error("Errore nell'eliminazione del partner.");
      await loadAllData();
    } catch (err) {
      alert(handleFetchError(err, 'Eliminazione partner'));
    }
  };

  // --- DOCUMENT CRUD ACTION ---
  const handleSaveDocument = async (docData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData),
      });

      if (!res.ok) throw new Error("Errore nel salvataggio del documento.");
      const saved = await res.json();
      await loadAllData();
      setSelectedDocId(saved.id);
      setActivePage('documents');
    } catch (err) {
      alert(handleFetchError(err, 'Salvataggio documento'));
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error("Errore nell'eliminazione del documento.");
      await loadAllData();
      return true;
    } catch (err) {
      alert(handleFetchError(err, 'Eliminazione documento'));
      return false;
    }
  };

  const handleUpdateDocStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Errore nell'aggiornamento dello stato.");
      }
      await loadAllData();
    } catch (err) {
      alert(handleFetchError(err, 'Aggiornamento stato documento'));
    }
  };

  const handleApproveAllDrafts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/documents/approve-all-drafts`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante l\'approvazione massiva.');
      }

      const result = await res.json();
      alert(`Approvazione completata con successo! Approvate ${result.count} bozze di documenti.`);
      await loadAllData();
    } catch (err) {
      alert(handleFetchError(err, 'Approvazione massiva dei documenti'));
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER CONTROLLER ---
  const renderPage = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <p className="muted-text">Caricamento moduli gestionale...</p>
        </div>
      );
    }

    const resolvedPage = userRole === 'ristoratore' ? 'products' : activePage;

    switch (resolvedPage) {
      case 'dashboard':
        return (
          <Dashboard 
            products={visibleProducts}
            partners={partners}
            documents={documents}
            setActivePage={setActivePage}
            setSelectedDocId={setSelectedDocId}
          />
        );
      case 'products':
        return (
          <Products 
            products={visibleProducts}
            onSave={handleSaveProduct}
            onDelete={handleDeleteProduct}
            userRole={userRole}
            loadAllData={loadAllData}
          />
        );
      case 'partners':
        return (
          <Partners 
            partners={partners}
            priceLists={priceLists}
            onSave={handleSavePartner}
            onDelete={handleDeletePartner}
            userRole={userRole}
          />
        );
      case 'documents':
        return (
          <Documents 
            documents={documents}
            partners={partners}
            products={visibleProducts}
            selectedDocId={selectedDocId}
            setSelectedDocId={setSelectedDocId}
            onSave={handleSaveDocument}
            onDelete={handleDeleteDocument}
            onUpdateStatus={handleUpdateDocStatus}
            onApproveAllDrafts={handleApproveAllDrafts}
            userRole={userRole}
          />
        );
      case 'import':
        return (
          <ImportArea 
            onImportSuccess={loadAllData}
            setActivePage={setActivePage}
            setSelectedDocId={setSelectedDocId}
            userRole={userRole}
          />
        );
      case 'warehouses':
        return <Warehouses userRole={userRole} />;
      case 'agents':
        return <Agents userRole={userRole} />;
      case 'suggestions':
        return <ProductSuggestions userRole={userRole} agentId={agentId} loadAllData={loadAllData} />;
      case 'reconciliation':
        return <Reconciliation userRole={userRole} />;
      case 'classic':
        return (
          <ClassicInvoicex 
            products={visibleProducts}
            partners={partners}
            documents={documents}
            priceLists={priceLists}
            userRole={userRole}
            loadAllData={loadAllData}
            onSaveDocument={handleSaveDocument}
            onDeleteDocument={handleDeleteDocument}
            onUpdateDocStatus={handleUpdateDocStatus}
          />
        );
      default:
        return <div>Pagina non trovata</div>;
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setAgentId(null);
    localStorage.removeItem('privilege_user_role');
    localStorage.removeItem('privilege_agent_id');
    setIsLoggingIn(false);
  };

  // Se l'utente non è loggato come master, viewer, agent o ristoratore, mostra il listino pubblico o la schermata di login
  if (userRole !== 'master' && userRole !== 'viewer' && userRole !== 'agent' && userRole !== 'ristoratore') {
    if (isLoggingIn) {
      return (
        <Login 
          onLogin={(role, id, name) => {
            setUserRole(role);
            localStorage.setItem('privilege_user_role', role);
            if (role === 'ristoratore') {
              setActivePage('products');
            } else {
              setActivePage('dashboard');
            }
            if (id) {
              setAgentId(id);
              localStorage.setItem('privilege_agent_id', id);
            } else {
              setAgentId(null);
              localStorage.removeItem('privilege_agent_id');
            }
            setIsLoggingIn(false);
          }} 
          onCancel={() => setIsLoggingIn(false)} 
        />
      );
    }
    return (
      <ClientCatalog 
        products={visibleProducts} 
        onLoginClick={() => setIsLoggingIn(true)} 
      />
    );
  }

  // Altrimenti mostra il pannello ERP completo (Master)
  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Menu">
          <Menu size={24} />
        </button>
        <span className="mobile-logo-text">Privilege ERP</span>
        <button className="mobile-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={userRole}
      />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
