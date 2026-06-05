import React, { useState } from 'react';
import { Lock, Home } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Login({ onLogin, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        onLogin(data.role, data.agentId, data.name);
        return;
      }

      const errData = await res.json();
      setError(errData.message || 'Credenziali non valide. Riprova.');
    } catch (err) {
      console.warn('Autenticazione API fallita, provo offline fallback...', err);
      if (trimmedUser === 'master' && trimmedPass === 'master') {
        onLogin('master');
      } else if (trimmedUser === 'autorizzato' && trimmedPass === 'autorizzato') {
        onLogin('viewer');
      } else if (trimmedUser === 'ristoratore' && trimmedPass === 'ristoratore') {
        onLogin('ristoratore');
      } else {
        setError('Impossibile connettersi al server per validare le credenziali dell\'agente.');
      }
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <img 
            src={`${import.meta.env.BASE_URL}logo.jpeg`} 
            alt="Privilege Selection Logo" 
            style={{ width: '100%', maxWidth: '180px', height: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }} 
          />
          <p className="muted-text" style={{ fontSize: '0.85rem' }}>Area Riservata ERP</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Identificativo Utente</label>
            <input 
              type="text" 
              className="erp-input"
              value={username}
              placeholder="Es. master"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Chiave di Accesso / Password</label>
            <input 
              type="password" 
              className="erp-input"
              value={password}
              placeholder="Inserisci password..."
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
            <Lock size={16} />
            <span>Accedi al Pannello</span>
          </button>
          
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={onCancel}>
            <Home size={16} />
            <span>Home (Torna al Listino)</span>
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p className="muted-text" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
            💡 Accedi come <strong>master</strong> (pass: <code>master</code>), come <strong>autorizzato</strong> (pass: <code>autorizzato</code>) per sola lettura, o come <strong>ristoratore</strong> (pass: <code>ristoratore</code>).
          </p>
          <p className="muted-text" style={{ fontSize: '0.65rem', textAlign: 'center', opacity: 0.6, marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '8px' }}>
            © Alesx99. Tutti i diritti riservati. Proprietà esclusiva.
          </p>
        </div>
      </div>
    </div>
  );
}
