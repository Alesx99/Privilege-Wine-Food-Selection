import React, { useState, useEffect } from 'react';
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

export default function App() {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('privilege_user_role') || null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('privilege_theme') || 'dark');

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
        throw new Error('Errore nel caricamento dei dati dal server NestJS.');
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

    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard 
            products={products}
            partners={partners}
            documents={documents}
            setActivePage={setActivePage}
            setSelectedDocId={setSelectedDocId}
          />
        );
      case 'products':
        return (
          <Products 
            products={products}
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
            products={products}
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
      case 'reconciliation':
        return <Reconciliation userRole={userRole} />;
      case 'classic':
        return (
          <ClassicInvoicex 
            products={products}
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
    localStorage.removeItem('privilege_user_role');
    setIsLoggingIn(false);
  };

  // Se l'utente non è loggato come master o viewer, mostra il listino pubblico o la schermata di login
  if (userRole !== 'master' && userRole !== 'viewer') {
    if (isLoggingIn) {
      return (
        <Login 
          onLogin={(role) => {
            setUserRole(role);
            localStorage.setItem('privilege_user_role', role);
            setIsLoggingIn(false);
          }} 
          onCancel={() => setIsLoggingIn(false)} 
        />
      );
    }
    return (
      <ClientCatalog 
        products={products} 
        onLoginClick={() => setIsLoggingIn(true)} 
      />
    );
  }

  // Altrimenti mostra il pannello ERP completo (Master)
  return (
    <div className="app-container">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
