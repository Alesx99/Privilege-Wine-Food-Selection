import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Products from './views/Products';
import Partners from './views/Partners';
import Documents from './views/Documents';
import ImportArea from './views/ImportArea';
import Login from './components/Login';
import ClientCatalog from './views/ClientCatalog';

export default function App() {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('privilege_user_role') || null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedDocId, setSelectedDocId] = useState(null);

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
        fetch('http://localhost:3001/api/products'),
        fetch('http://localhost:3001/api/partners'),
        fetch('http://localhost:3001/api/documents'),
        fetch('http://localhost:3001/api/price-lists'),
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
      const res = await fetch('http://localhost:3001/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!res.ok) throw new Error("Errore nel salvataggio del prodotto.");
      await loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/products/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error("Errore nell'eliminazione del prodotto.");
      await loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- PARTNER CRUD ACTION ---
  const handleSavePartner = async (partnerData) => {
    try {
      const res = await fetch('http://localhost:3001/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partnerData),
      });

      if (!res.ok) throw new Error("Errore nel salvataggio del partner.");
      await loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePartner = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/partners/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error("Errore nell'eliminazione del partner.");
      await loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- DOCUMENT CRUD ACTION ---
  const handleSaveDocument = async (docData) => {
    try {
      const res = await fetch('http://localhost:3001/api/documents', {
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
      alert(err.message);
    }
  };

  const handleDeleteDocument = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/documents/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error("Errore nell'eliminazione del documento.");
      await loadAllData();
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  };

  const handleUpdateDocStatus = async (id, status) => {
    try {
      const res = await fetch(`http://localhost:3001/api/documents/${id}/status`, {
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
      alert(err.message);
    }
  };

  const handleApproveAllDrafts = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/api/documents/approve-all-drafts', {
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
      alert(err.message);
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
          />
        );
      case 'partners':
        return (
          <Partners 
            partners={partners}
            priceLists={priceLists}
            onSave={handleSavePartner}
            onDelete={handleDeletePartner}
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
          />
        );
      case 'import':
        return (
          <ImportArea 
            onImportSuccess={loadAllData}
            setActivePage={setActivePage}
            setSelectedDocId={setSelectedDocId}
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

  // Se l'utente non è loggato come master, mostra il listino pubblico o la schermata di login
  if (userRole !== 'master') {
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
      />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
