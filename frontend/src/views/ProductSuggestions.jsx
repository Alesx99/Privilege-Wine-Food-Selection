import React, { useState, useEffect } from 'react';
import { API_BASE_URL, handleFetchError } from '../config';
import { Lightbulb, Check, X, Plus, Loader2, Sparkles, AlertCircle, FileText, User } from 'lucide-react';

export default function ProductSuggestions({ userRole, agentId, loadAllData }) {
  const isMaster = userRole === 'master';
  const isAgent = userRole === 'agent';
  const isViewer = userRole === 'viewer';

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  // Form states
  const [productName, setProductName] = useState('');
  const [winery, setWinery] = useState('');
  const [priceList, setPriceList] = useState('Listino HORECA');
  const [recommendedPrice, setRecommendedPrice] = useState('');
  const [notes, setNotes] = useState('');

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      // If agent, only fetch their own suggestions
      const url = isAgent
        ? `${API_BASE_URL}/api/product-suggestions?agentId=${agentId}`
        : `${API_BASE_URL}/api/product-suggestions`;

      const res = await fetch(url);
      if (!res.ok) {
        let errMessage = 'Errore nel caricamento delle segnalazioni.';
        try {
          const errData = await res.json();
          if (errData && errData.message) {
            errMessage = errData.message;
          }
        } catch (_) {}
        throw new Error(errMessage);
      }
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      alert(handleFetchError(err, 'Caricamento segnalazioni'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [userRole, agentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productName || !winery || !priceList || !recommendedPrice) {
      alert('Tutti i campi obbligatori devono essere compilati.');
      return;
    }

    setSubmitting(true);
    const payload = {
      agent_id: isAgent ? agentId : null,
      product_name: productName,
      winery,
      price_list: priceList,
      recommended_price: Number(recommendedPrice),
      notes,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/product-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore nel salvataggio della segnalazione.');
      }

      setProductName('');
      setWinery('');
      setRecommendedPrice('');
      setNotes('');
      alert('Segnalazione inviata con successo al Master!');
      await loadSuggestions();
    } catch (err) {
      alert(handleFetchError(err, 'Invio segnalazione'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    if (!window.confirm(`Sei sicuro di voler ${status === 'accepted' ? 'accettare e creare' : 'rifiutare'} questa segnalazione?`)) {
      return;
    }

    setActioningId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/product-suggestions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore nell\'aggiornamento dello stato.');
      }

      alert(
        status === 'accepted'
          ? 'Segnalazione accettata! Il prodotto è stato aggiunto al catalogo vini in bozza.'
          : 'Segnalazione rifiutata.'
      );
      
      // Reload main catalog data (so products lists are updated in App.jsx state)
      await loadAllData();
      // Reload suggestions list
      await loadSuggestions();
    } catch (err) {
      alert(handleFetchError(err, 'Aggiornamento stato segnalazione'));
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'accepted':
        return 'badge-success';
      case 'refused':
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'accepted':
        return 'Accettata';
      case 'refused':
        return 'Rifiutata';
      default:
        return 'In attesa';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted-text">Caricamento modulo segnalazioni prodotti...</p>
      </div>
    );
  }

  return (
    <div className="product-suggestions-view">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lightbulb size={24} style={{ color: 'var(--accent-light)' }} />
            <span>Segnalazione Nuovi Prodotti</span>
          </h1>
          <p>
            {isMaster
              ? 'Esamina e approva i nuovi prodotti proposti dagli agenti per inserirli direttamente in magazzino'
              : 'Inserisci le proposte di nuovi vini e cantine da inserire a listino per la commercializzazione'}
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: '24px' }}>
        {/* Left Column: Form (only visible for agents or master if he wants to insert directly) */}
        {!isViewer && (isAgent || isMaster) && (
          <div className="glass-card">
            <h3>Nuova Segnalazione</h3>
            <p className="muted-text" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
              Compila la scheda del prodotto consigliato. Verrà inoltrata all'amministratore per la revisione.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Nome Prodotto / Etichetta *</label>
                <input
                  type="text"
                  className="erp-input"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Es. Amarone Classico DOCG Riserva"
                  required
                />
              </div>

              <div className="form-group">
                <label>Cantina / Produttore *</label>
                <input
                  type="text"
                  className="erp-input"
                  value={winery}
                  onChange={(e) => setWinery(e.target.value)}
                  placeholder="Es. Masi Agricola"
                  required
                />
              </div>

              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label>Listino di Riferimento *</label>
                  <select
                    className="erp-input"
                    value={priceList}
                    onChange={(e) => setPriceList(e.target.value)}
                    required
                  >
                    <option value="Listino HORECA">Listino HORECA</option>
                    <option value="Listino Privati">Listino Privati</option>
                    <option value="Listino Estero">Listino Estero</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Prezzo Consigliato (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="erp-input"
                    value={recommendedPrice}
                    onChange={(e) => setRecommendedPrice(e.target.value)}
                    placeholder="Es. 45.00"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Note e Dettagli Aggiuntivi</label>
                <textarea
                  className="erp-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Inserisci annate disponibili, formati, lotto minimo o altre info utili..."
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="rotating-icon" />
                    <span>Invio in corso...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Invia Segnalazione</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Right Column / Full screen: List of suggestions */}
        <div className={(isViewer || (!isAgent && !isMaster)) ? 'glass-card' : ''} style={{ flexGrow: 1 }}>
          <div className="glass-card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3>{isMaster ? 'Casella Segnalazioni Agenti' : 'Le Mie Segnalazioni'}</h3>
              <span className="badge" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent-light)' }}>
                <Sparkles size={12} style={{ marginRight: '4px' }} />
                <span>{suggestions.length} Totali</span>
              </span>
            </div>

            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Prodotto & Cantina</th>
                    {isMaster && <th>Agente</th>
                    }<th>Listino</th>
                    <th>Prezzo Cons.</th>
                    <th>Stato</th>
                    {isMaster && <th style={{ textAlign: 'right' }}>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {suggestions.length === 0 ? (
                    <tr>
                      <td colSpan={isMaster ? 6 : 5} className="muted-text" style={{ textAlign: 'center', padding: '30px' }}>
                        <AlertCircle size={24} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.5 }} />
                        Nessuna segnalazione inserita al momento.
                      </td>
                    </tr>
                  ) : (
                    suggestions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div>
                            <strong>{s.product_name}</strong>
                          </div>
                          <div className="muted-text" style={{ fontSize: '0.75rem' }}>
                            Cantina: {s.winery}
                          </div>
                          {s.notes && (
                            <div className="suggestion-notes-preview" style={{ fontSize: '0.7rem', fontStyle: 'italic', opacity: 0.8, marginTop: '4px' }}>
                              📝 Note: {s.notes}
                            </div>
                          )}
                        </td>
                        {isMaster && (
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <User size={12} className="muted-text" />
                              <span>{s.agent?.name || 'Diretto / Master'}</span>
                            </div>
                          </td>
                        )}
                        <td>{s.price_list}</td>
                        <td><strong>€ {Number(s.recommended_price).toFixed(2)}</strong></td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(s.status)}`}>
                            {getStatusLabel(s.status)}
                          </span>
                        </td>
                        {isMaster && (
                          <td style={{ textAlign: 'right' }}>
                            {s.status === 'pending' ? (
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  className="btn btn-success btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleUpdateStatus(s.id, 'accepted')}
                                  disabled={actioningId !== null}
                                >
                                  {actioningId === s.id ? (
                                    <Loader2 size={12} className="rotating-icon" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  <span style={{ marginLeft: '2px' }}>Accetta</span>
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => handleUpdateStatus(s.id, 'refused')}
                                  disabled={actioningId !== null}
                                >
                                  <X size={12} />
                                  <span style={{ marginLeft: '2px' }}>Rifiuta</span>
                                </button>
                              </div>
                            ) : (
                              <span className="muted-text" style={{ fontSize: '0.75rem' }}>
                                Elaborata
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'center' }}>
        <p className="muted-text" style={{ fontSize: '0.75rem' }}>
          © Alesx99. Piattaforma ERP cantina - Area Riservata
        </p>
      </div>
    </div>
  );
}
