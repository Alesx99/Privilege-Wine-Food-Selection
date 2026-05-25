import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function TesoreriaTab({
  documents = [],
  showNotice
}) {
  const [sepaCreditorName, setSepaCreditorName] = useState('Privilege Wine Selection S.r.l.');
  const [sepaCreditorIban, setSepaCreditorIban] = useState('IT99Z0123456789012345678901');
  const [sepaCreditorId, setSepaCreditorId] = useState('IT12ZZZ09876543210');
  const [selectedSepaInvoiceIds, setSelectedSepaInvoiceIds] = useState([]);
  const [paymentStatusState, setPaymentStatusState] = useState(() => {
    const saved = localStorage.getItem('privilege_paid_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  const unpaidCompletedInvoices = useMemo(() => {
    return documents.filter(doc => 
      doc.type === 'invoice_sale' && 
      doc.status === 'completed' && 
      !paymentStatusState.includes(doc.id)
    );
  }, [documents, paymentStatusState]);

  const handleToggleSepaInvoice = (id) => {
    setSelectedSepaInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerateSepaSddXml = async () => {
    if (selectedSepaInvoiceIds.length === 0) {
      alert('Seleziona almeno una fattura da inserire nel flusso SEPA.');
      return;
    }
    try {
      const promises = selectedSepaInvoiceIds.map(id => 
        fetch(`${API_BASE_URL}/api/documents/${id}`).then(res => res.json())
      );
      const fullInvoices = await Promise.all(promises);

      const xml = generateSepaSddXmlFile(fullInvoices, sepaCreditorName, sepaCreditorIban, sepaCreditorId);
      
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FLUSSO_CBI_SEPA_SDD_${new Date().toISOString().slice(0, 10)}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotice(`Flusso SEPA SDD generato per ${selectedSepaInvoiceIds.length} fatture!`);
    } catch (err) {
      alert('Errore generazione SEPA: ' + err.message);
    }
  };

  const handleMarkAsPaid = (id) => {
    const nextPaid = [...paymentStatusState, id];
    setPaymentStatusState(nextPaid);
    localStorage.setItem('privilege_paid_invoices', JSON.stringify(nextPaid));
    showNotice('Fattura segnata come saldata.');
  };

  const handleResetPaidState = () => {
    if (confirm('Vuoi azzerare lo stato di saldato delle fatture?')) {
      setPaymentStatusState([]);
      localStorage.removeItem('privilege_paid_invoices');
      showNotice('Stato pagamenti resettato.');
    }
  };

  const [sollecitoInvoiceId, setSollecitoInvoiceId] = useState('');
  const [sollecitoLevel, setSollecitoLevel] = useState('soft');
  const [sollecitoPreview, setSollecitoPreview] = useState('');

  const handleGenerateSollecitoText = () => {
    const inv = documents.find(d => d.id === sollecitoInvoiceId);
    if (!inv) {
      alert('Seleziona una fattura valida.');
      return;
    }

    const clientName = inv.partner?.name || 'Spett.le Cliente';
    const num = inv.number;
    const date = inv.date;
    const amt = inv.total_amount.toFixed(2);
    
    let text = '';
    if (sollecitoLevel === 'soft') {
      text = `Oggetto: Promemoria Scadenza Pagamento - Fattura N. ${num} del ${date}\n\nGentile ${clientName},\ncon la presente desideriamo ricordarLe che la fattura n. ${num} del ${date} di importo pari a € ${amt} risulta scaduta e non ancora saldata.\n\nLe chiediamo cortesemente di verificare ed eventualmente procedere al bonifico sulle nostre coordinate bancarie:\nIBAN: ${sepaCreditorIban}\n\nQualora avesse già provveduto al saldo, La preghiamo di ignorare questa comunicazione.\n\nCordiali saluti,\nAmministrazione ${sepaCreditorName}`;
    } else if (sollecitoLevel === 'medium') {
      text = `Oggetto: Sollecito di Pagamento - Fattura N. ${num} del ${date}\n\nGentile ${clientName},\nfacciamo seguito al nostro precedente promemoria per segnalarLe che ad oggi non abbiamo ancora ricevuto il pagamento relativo alla fattura n. ${num} del ${date} dell'importo di € ${amt}.\n\nVi invitiamo ad effettuare il saldo entro 5 giorni lavorativi all'IBAN:\nIBAN: ${sepaCreditorIban}\n\nRestiamo in attesa di una copia della contabile del bonifico.\n\nCordiali saluti,\nAmministrazione ${sepaCreditorName}`;
    } else {
      text = `Oggetto: Messa in mora e Ultimo Sollecito - Fattura N. ${num} del ${date}\n\nSpett.le ${clientName},\nnon avendo ricevuto alcun riscontro o pagamento in merito alla fattura n. ${num} del ${date} (importo € ${amt}), con la presente formalizziamo ultimo sollecito di pagamento.\n\nSe il pagamento non verrà eseguito entro e non oltre 3 giorni dal ricevimento della presente, saremo costretti a tutelare i nostri diritti nelle sedi legali opportune, con aggravio di spese e interessi a Suo carico.\n\nCoordinate di pagamento:\nIBAN: ${sepaCreditorIban}\n\nDistinti saluti,\nDirezione Generale ${sepaCreditorName}`;
    }
    setSollecitoPreview(text);
  };

  function generateSepaSddXmlFile(invoicesList, credName, credIban, credId) {
    const msgId = 'MID' + Date.now();
    const pmtInfId = 'PIID' + Date.now();
    const reqdColltnDt = new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0];
    
    let totalSum = 0;
    let txsXml = '';
    
    invoicesList.forEach((inv, index) => {
      const amount = Number(inv.total_amount || 0).toFixed(2);
      totalSum += Number(amount);
      const endToEndId = 'E2E' + inv.number.replace(/\//g, '_') + '_' + index;
      const mandateId = 'MANDATE_' + (inv.partner?.vat_number || '00000000000');
      const mandateDate = '2026-01-01';
      
      txsXml += `
        <DrctDbtTxInf>
          <PmtId>
            <EndToEndId>${endToEndId}</EndToEndId>
          </PmtId>
          <InstdAmt Ccy="EUR">${amount}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${mandateId}</MndtId>
              <DtOfSgntr>${mandateDate}</DtOfSgntr>
              <AmndmntInd>false</AmndmntInd>
            </MndtRltdInf>
          </DrctDbtTx>
          <DbtrAgt>
            <FinInstnId>
              <BIC>XXXXXXXXXXX</BIC>
            </FinInstnId>
          </DbtrAgt>
          <Dbtr>
            <Nm>${inv.partner?.name || 'Cliente Generico'}</Nm>
          </Dbtr>
          <DbtrAcct>
            <Id>
              <IBAN>IT00Y0000000000000000000000</IBAN>
            </Id>
          </DbtrAcct>
          <RmtInf>
            <Ustrd>Saldo fattura n. ${inv.number} del ${inv.date}</Ustrd>
          </RmtInf>
        </DrctDbtTxInf>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${invoicesList.length}</NbOfTxs>
      <CtrlSum>${totalSum.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${credName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${invoicesList.length}</NbOfTxs>
      <CtrlSum>${totalSum.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${reqdColltnDt}</ReqdColltnDt>
      <Cdtr>
        <Nm>${credName}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${credIban}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BIC>XXXXXXXXXXX</BIC>
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${credId}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
      ${txsXml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* SEPA Generator */}
      <div>
        <h3>Tesoreria - Generatore Flussi SEPA SDD CBI ( pain.008 )</h3>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>
          Seleziona le fatture attive saldate con addebito diretto (SDD). Il sistema genererà il file XML CBI standard da caricare sull'home banking aziendale.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          {/* Bank Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <h4>Configurazione Creditore</h4>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Nome Azienda Creditore</label>
              <input type="text" className="classic-input" value={sepaCreditorName} onChange={(e) => setSepaCreditorName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>IBAN Azienda Creditore</label>
              <input type="text" className="classic-input" value={sepaCreditorIban} onChange={(e) => setSepaCreditorIban(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Codice Identificativo Creditore (SIA/CredId)</label>
              <input type="text" className="classic-input" value={sepaCreditorId} onChange={(e) => setSepaCreditorId(e.target.value)} />
            </div>

            <div style={{ marginTop: '8px' }}>
              <button className="classic-btn classic-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerateSepaSddXml} disabled={selectedSepaInvoiceIds.length === 0}>
                <Download size={14} />
                <span>Scarica Flusso XML SDD</span>
              </button>
              {paymentStatusState.length > 0 && (
                <button className="classic-btn classic-btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} onClick={handleResetPaidState}>
                  Reset Pagamenti
                </button>
              )}
            </div>
          </div>

          {/* Unpaid Completed Invoices */}
          <div>
            <h4>Fatture Attive Non Saldate (Completed)</h4>
            {unpaidCompletedInvoices.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                Ottimo! Nessuna fattura attiva non saldata trovata a sistema.
              </div>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                <table className="classic-table">
                  <thead>
                    <tr>
                      <th width="40">Seleziona</th>
                      <th>Fattura</th>
                      <th>Cliente</th>
                      <th>Data</th>
                      <th style={{ textAlign: 'right' }}>Importo</th>
                      <th>Azione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidCompletedInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedSepaInvoiceIds.includes(inv.id)} 
                            onChange={() => handleToggleSepaInvoice(inv.id)}
                          />
                        </td>
                        <td><strong>{inv.number}</strong></td>
                        <td>{inv.partner?.name}</td>
                        <td>{inv.date}</td>
                        <td style={{ textAlign: 'right' }}>€ {inv.total_amount?.toFixed(2)}</td>
                        <td>
                          <button className="classic-btn classic-btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => handleMarkAsPaid(inv.id)}>
                            Segna Saldata
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dunning Letter Templates */}
      <div style={{ borderTop: '1px solid var(--classic-border)', paddingTop: '20px' }}>
        <h3>Modello E-mail Solleciti Scadenze Inolute</h3>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Genera testo pronto per email o PEC di sollecito basandoti sullo scadenzario delle fatture attive insolute.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <select 
              className="classic-select" 
              value={sollecitoInvoiceId} 
              onChange={(e) => setSollecitoInvoiceId(e.target.value)}
            >
              <option value="">-- Seleziona Fattura Insoluta --</option>
              {documents.filter(d => d.type === 'invoice_sale' && d.status === 'completed').map(d => (
                <option key={d.id} value={d.id}>{d.number} - {d.partner?.name} (€ {d.total_amount?.toFixed(2)})</option>
              ))}
            </select>

            <select className="classic-select" value={sollecitoLevel} onChange={(e) => setSollecitoLevel(e.target.value)}>
              <option value="soft">1° Sollecito (Cortese / Promemoria)</option>
              <option value="medium">2° Sollecito (Sollecito Ufficiale)</option>
              <option value="hard">3° Sollecito (Messa in Mora / Legale)</option>
            </select>

            <button className="classic-btn classic-btn-primary" onClick={handleGenerateSollecitoText} disabled={!sollecitoInvoiceId}>
              Genera Testo Email
            </button>
          </div>

          <div>
            <textarea 
              className="classic-textarea" 
              rows={8} 
              readOnly 
              value={sollecitoPreview}
              placeholder="Il testo dell'email precompilato apparirà qui..."
              style={{ fontSize: '0.8rem' }}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}
