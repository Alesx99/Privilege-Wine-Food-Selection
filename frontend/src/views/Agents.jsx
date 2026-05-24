import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL, handleFetchError } from '../config';
import { Users, DollarSign, Plus, Check, Loader2, Sparkles } from 'lucide-react';

export default function Agents({ userRole }) {
  const isMaster = userRole === 'master';
  const [agents, setAgents] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit / Form state
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('10.00');

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentsRes, commRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/agents`),
        fetch(`${API_BASE_URL}/api/agents/commissions`),
      ]);

      if (!agentsRes.ok || !commRes.ok) {
        throw new Error('Errore nel caricamento dei dati degli agenti dal server.');
      }

      const agentsData = await agentsRes.json();
      const commData = await commRes.json();

      setAgents(agentsData);
      setCommissions(commData);
    } catch (err) {
      alert(handleFetchError(err, 'Caricamento modulo agenti'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setEmail(agent.email);
    setPhone(agent.phone || '');
    setVatNumber(agent.vat_number || '');
    setCommissionPercent(String(agent.default_commission_percent));
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingAgent(null);
    setName('');
    setEmail('');
    setPhone('');
    setVatNumber('');
    setCommissionPercent('10.00');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: editingAgent ? editingAgent.id : undefined,
      name,
      email,
      phone,
      vat_number: vatNumber,
      default_commission_percent: Number(commissionPercent) || 10.00,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante il salvataggio.');
      }

      setShowForm(false);
      await loadData();
    } catch (err) {
      alert(handleFetchError(err, 'Salvataggio agente'));
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalCommissions = commissions
      .filter(c => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const unpaidCommissions = commissions
      .filter(c => c.status === 'unpaid')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const paidCommissions = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    return {
      total: totalCommissions,
      unpaid: unpaidCommissions,
      paid: paidCommissions,
      count: agents.length
    };
  }, [agents, commissions]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted-text">Caricamento modulo agenti ed esazione provvigionale...</p>
      </div>
    );
  }

  return (
    <div className="agents-view">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Gestione Agenti & Provvigioni</h1>
          <p>Supervisiona la rete commerciale, configura i ricarichi e monitora lo scadenziario delle provvigioni cantina</p>
        </div>
        {isMaster && (
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={16} />
            <span>Nuovo Agente</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
        <div className="glass-card stat-card">
          <div className="flex-between">
            <span className="muted-text">Agenti in Rete</span>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent-light)' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.count}</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--accent-light)' }}>
          <div className="flex-between">
            <span className="muted-text">Totale Provvigioni</span>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-value">€ {stats.total.toFixed(2)}</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--status-warning)' }}>
          <div className="flex-between">
            <span className="muted-text">Provvigioni da Liquidare</span>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--status-warning)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-warning)' }}>€ {stats.unpaid.toFixed(2)}</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--status-success)' }}>
          <div className="flex-between">
            <span className="muted-text">Provvigioni Liquidate</span>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--status-success)' }}>
              <Check size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--status-success)' }}>€ {stats.paid.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: '24px' }}>
        {/* Left Column: Agents List */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '16px' }}>Elenco Agenti Commerciali</h3>
          <div className="table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Nome Agente</th>
                  <th>E-mail</th>
                  <th>Provvigione Base</th>
                  {isMaster && <th style={{ textAlign: 'right' }}>Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted-text" style={{ textAlign: 'center', padding: '20px' }}>
                      Nessun agente registrato.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id}>
                      <td><strong>{agent.name}</strong></td>
                      <td>{agent.email}</td>
                      <td>
                        <span className="badge badge-success">
                          {agent.default_commission_percent}%
                        </span>
                      </td>
                      {isMaster && (
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(agent)}>
                            Modifica
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Dynamic Form or Commissions Log */}
        <div>
          {showForm ? (
            <div className="glass-card">
              <h3>{editingAgent ? 'Modifica Anagrafica Agente' : 'Nuovo Agente Commerciale'}</h3>
              <p className="muted-text" style={{ marginBottom: '20px' }}>Inserisci i dettagli di fatturazione ed email per il report mensile</p>
              
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input 
                    type="text" 
                    className="erp-input"
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Es. Mario Rossi"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>E-mail Ufficiale</label>
                  <input 
                    type="email" 
                    className="erp-input"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="Es. mario@cantina.it"
                    required 
                  />
                </div>

                <div className="grid-2" style={{ gap: '16px' }}>
                  <div className="form-group">
                    <label>Telefono</label>
                    <input 
                      type="text" 
                      className="erp-input"
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      placeholder="Es. 333-1234567"
                    />
                  </div>
                  <div className="form-group">
                    <label>Partita IVA</label>
                    <input 
                      type="text" 
                      className="erp-input"
                      value={vatNumber} 
                      onChange={e => setVatNumber(e.target.value)} 
                      placeholder="P.IVA 11 cifre"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Provvigione Predefinita (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="erp-input"
                    value={commissionPercent} 
                    onChange={e => setCommissionPercent(e.target.value)} 
                    required 
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
                    Annulla
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 size={14} className="rotating-icon" />
                        <span>Salvataggio...</span>
                      </>
                    ) : (
                      <span>Salva Agente</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="glass-card">
              <div className="flex-between" style={{ marginBottom: '16px' }}>
                <h3>Registro Provvigioni Maturate</h3>
                <span className="badge" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent-light)' }}>
                  <Sparkles size={12} style={{ marginRight: '4px' }} />
                  <span>Automatizzato</span>
                </span>
              </div>
              
              <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Importo</th>
                      <th>Aliquota %</th>
                      <th style={{ textAlign: 'right' }}>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="muted-text" style={{ textAlign: 'center', padding: '20px' }}>
                          Nessuna provvigione calcolata sui documenti recenti.
                        </td>
                      </tr>
                    ) : (
                      commissions.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.agent?.name || 'Agente Sconosciuto'}</strong></td>
                          <td><strong>€ {Number(c.amount).toFixed(2)}</strong></td>
                          <td>{c.commission_percent}%</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`badge ${c.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                              {c.status === 'paid' ? 'Liquidato' : 'Da Liquidare'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
