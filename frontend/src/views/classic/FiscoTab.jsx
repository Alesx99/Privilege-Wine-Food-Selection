import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export default function FiscoTab({
  documents = [],
  showNotice
}) {
  const [ritBase, setRitBase] = useState(1000);
  const [ritInpsCheck, setRitInpsCheck] = useState(true);
  const [ritInpsRate, setRitInpsRate] = useState(4);
  const [ritCassaCheck, setRitCassaCheck] = useState(true);
  const [ritCassaRate, setRitCassaRate] = useState(4);
  const [ritAccontoCheck, setRitAccontoCheck] = useState(true);
  const [ritAccontoRate, setRitAccontoRate] = useState(20);
  const [ritVatRate, setRitVatRate] = useState(22);

  const ritCalcs = useMemo(() => {
    const base = Number(ritBase) || 0;
    const inps = ritInpsCheck ? Number((base * (ritInpsRate / 100)).toFixed(2)) : 0;
    const cassa = ritCassaCheck ? Number(((base + inps) * (ritCassaRate / 100)).toFixed(2)) : 0;
    const imponibile = base + inps + cassa;
    const iva = Number((imponibile * (ritVatRate / 100)).toFixed(2));
    const lordo = imponibile + iva;
    const ritenuta = ritAccontoCheck ? Number(((base + inps) * (ritAccontoRate / 100)).toFixed(2)) : 0;
    const bollo = lordo > 77.47 ? 2.00 : 0;
    const nettoAPagare = lordo - ritenuta + bollo;

    return { inps, cassa, imponibile, iva, lordo, ritenuta, bollo, nettoAPagare };
  }, [ritBase, ritInpsCheck, ritInpsRate, ritCassaCheck, ritCassaRate, ritAccontoCheck, ritAccontoRate, ritVatRate]);

  // XML Active Invoice Generation
  const [xmlActiveInvoiceId, setXmlActiveInvoiceId] = useState('');
  const [generatedActiveXml, setGeneratedActiveXml] = useState('');

  const handleGenerateActiveXml = async () => {
    if (!xmlActiveInvoiceId) {
      alert('Seleziona una fattura attiva.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/documents/${xmlActiveInvoiceId}`);
      if (!res.ok) throw new Error('Impossibile caricare il dettaglio della fattura.');
      const doc = await res.json();
      
      const xml = generateFatturaElettronicaXml(doc);
      setGeneratedActiveXml(xml);
      showNotice('XML Fattura Elettronica generato correttamente.');
    } catch (err) {
      alert('Errore generazione XML: ' + err.message);
    }
  };

  const handleDownloadActiveXml = () => {
    if (!generatedActiveXml) return;
    const blob = new Blob([generatedActiveXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `IT09876543210_${Date.now().toString().slice(-5)}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  function generateFatturaElettronicaXml(doc) {
    const vatNumber = doc.partner?.vat_number || '00000000000';
    const name = doc.partner?.name || 'Cliente Generico';
    const address = doc.partner?.address || 'Indirizzo non specificato';
    const number = doc.number || '1';
    const date = doc.date || '2026-01-01';
    const sdiCode = doc.partner?.sdi_code || '0000000';
    
    let linesXml = '';
    const items = doc.items || [];

    const processedItems = items.length > 0 ? items : [{
      product: { name: 'Fornitura Beni / Servizi' },
      quantity: 1,
      unit_price: doc.total_amount / 1.22,
      discount_percent: 0,
      vat_percent: 22
    }];

    processedItems.forEach((item, index) => {
      const lineNum = index + 1;
      const desc = item.product?.name || 'Prodotto';
      const qty = Number(item.quantity).toFixed(2);
      const price = Number(item.unit_price).toFixed(2);
      const disc = Number(item.discount_percent || 0).toFixed(2);
      const net = (Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_percent || 0)/100)).toFixed(2);
      const vat = Number(item.vat_percent).toFixed(2);
      
      linesXml += `
        <DettaglioLinee>
          <NumeroLinea>${lineNum}</NumeroLinea>
          <Descrizione>${desc}</Descrizione>
          <Quantita>${qty}</Quantita>
          <PrezzoUnitario>${price}</PrezzoUnitario>${Number(disc) > 0 ? `
          <ScontoMaggiorazione>
            <Tipo>SC</Tipo>
            <Percentuale>${disc}</Percentuale>
          </ScontoMaggiorazione>` : ''}
          <PrezzoTotale>${net}</PrezzoTotale>
          <AliquotaIVA>${vat}</AliquotaIVA>
        </DettaglioLinee>`;
    });

    const totalNet = processedItems.reduce((acc, item) => 
      acc + (Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_percent || 0)/100))
    , 0).toFixed(2);
    
    const totalTax = processedItems.reduce((acc, item) => 
      acc + (Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_percent || 0)/100) * (Number(item.vat_percent)/100))
    , 0).toFixed(2);
    
    const totalGross = (Number(totalNet) + Number(totalTax)).toFixed(2);

    return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>09876543210</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${doc.id ? doc.id.slice(0, 8) : '00001'}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${sdiCode}</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>09876543210</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Privilege Selection S.r.l.</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via della Cantina 12</Indirizzo>
        <CAP>37100</CAP>
        <Comune>Verona</Comune>
        <Provincia>VR</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${vatNumber}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>${name}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${address}</Indirizzo>
        <CAP>00100</CAP>
        <Comune>Roma</Comune>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${date}</Data>
        <Numero>${number}</Numero>
        <ImportoTotaleDocumento>${totalGross}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${linesXml}
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>${totalNet}</ImponibileImporto>
        <Imposta>${totalTax}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Ritenute Calculator */}
      <div>
        <h3>Calcolatore Fiscale Ritenuta d'Acconto & Rivalsa INPS</h3>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Strumento di calcolo conforme alle direttive fiscali italiane per professionisti e agenti.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>Imponibile di Partenza (€)</label>
              <input type="number" className="classic-input" value={ritBase} onChange={(e) => setRitBase(e.target.value)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={ritInpsCheck} onChange={(e) => setRitInpsCheck(e.target.checked)} />
              <label style={{ fontSize: '0.82rem' }}>Applica Rivalsa INPS (4%)</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={ritCassaCheck} onChange={(e) => setRitCassaCheck(e.target.checked)} />
              <label style={{ fontSize: '0.82rem' }}>Applica Cassa Previdenziale (%)</label>
              {ritCassaCheck && (
                <input type="number" style={{ width: '60px', padding: '4px' }} value={ritCassaRate} onChange={(e) => setRitCassaRate(e.target.value)} />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={ritAccontoCheck} onChange={(e) => setRitAccontoCheck(e.target.checked)} />
              <label style={{ fontSize: '0.82rem' }}>Applica Ritenuta d'Acconto (%)</label>
              {ritAccontoCheck && (
                <input type="number" style={{ width: '60px', padding: '4px' }} value={ritAccontoRate} onChange={(e) => setRitAccontoRate(e.target.value)} />
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>Aliquota IVA (%)</label>
              <input type="number" className="classic-input" value={ritVatRate} onChange={(e) => setRitVatRate(e.target.value)} />
            </div>
          </div>

          {/* Prospetto Calcolo */}
          <div style={{ background: 'white', padding: '16px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px' }}>Prospetto di Calcolo</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
              <div className="flex-between"><span>Imponibile Base:</span><strong>€ {Number(ritBase).toFixed(2)}</strong></div>
              {ritInpsCheck && <div className="flex-between"><span>Rivalsa INPS ({ritInpsRate}%):</span><strong>€ {ritCalcs.inps.toFixed(2)}</strong></div>}
              {ritCassaCheck && <div className="flex-between"><span>Cassa Previdenziale ({ritCassaRate}% su Base + INPS):</span><strong>€ {ritCalcs.cassa.toFixed(2)}</strong></div>}
              <div className="flex-between" style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}><span>Base Imponibile IVA:</span><strong>€ {ritCalcs.imponibile.toFixed(2)}</strong></div>
              <div className="flex-between"><span>IVA ({ritVatRate}%):</span><strong>€ {ritCalcs.iva.toFixed(2)}</strong></div>
              <div className="flex-between"><span>Totale Lordo Documento:</span><strong>€ {ritCalcs.lordo.toFixed(2)}</strong></div>
              {ritAccontoCheck && <div className="flex-between" style={{ color: '#b91c1c' }}><span>Ritenuta d'Acconto ({ritAccontoRate}% su Base):</span><strong>- € {ritCalcs.ritenuta.toFixed(2)}</strong></div>}
              {ritCalcs.bollo > 0 && <div className="flex-between"><span>Imposta di Bollo (Legge):</span><strong>€ {ritCalcs.bollo.toFixed(2)}</strong></div>}
              <div className="flex-between" style={{ borderTop: '2px solid #cbd5e1', paddingTop: '6px', fontSize: '1.05rem', color: 'var(--classic-accent)' }}>
                <span>Netto a Pagare (Esigibile):</span>
                <strong>€ {ritCalcs.nettoAPagare.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Codici Natura IVA Table */}
      <div>
        <h3>Mappatura Codici Natura IVA & Regimi Fiscali (Fattura Elettronica)</h3>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Tabella di riferimento dei codici richiesti da SdI per le operazioni non imponibili, esenti o regimi speciali.</p>
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
          <table className="classic-table">
            <thead>
              <tr>
                <th width="80">Codice</th>
                <th>Significato e Descrizione</th>
                <th>Regime fiscale consigliato</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>N1</strong></td><td>Escluse ex art. 15 DPR 633/72 (es. bolli, spese anticipate)</td><td>Qualsiasi regime</td></tr>
              <tr><td><strong>N2.1</strong></td><td>Non soggette ad IVA - art. da 7 a 7-septies (Prestazioni extra-UE)</td><td>Qualsiasi</td></tr>
              <tr><td><strong>N2.2</strong></td><td>Non soggette ad IVA - Regime Forfettario (art. 1 c. 54-89 L. 190/2014)</td><td>RF19 (Forfettario)</td></tr>
              <tr><td><strong>N3.1</strong></td><td>Non imponibili - esportazioni (art. 8)</td><td>Qualsiasi ordinario</td></tr>
              <tr><td><strong>N3.2</strong></td><td>Non imponibili - cessioni intracomunitarie (art. 41)</td><td>Qualsiasi</td></tr>
              <tr><td><strong>N4</strong></td><td>Operazioni Esenti (art. 10 DPR 633/72)</td><td>Qualsiasi</td></tr>
              <tr><td><strong>N6.1</strong></td><td>Reverse Charge (inversione contabile) - subappalto edilizia</td><td>RF01 (Ordinario)</td></tr>
              <tr><td><strong>N6.9</strong></td><td>Reverse Charge - Altri settori ed ecommerce elettronici</td><td>RF01</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate XML active invoice */}
      <div style={{ borderTop: '1px solid var(--classic-border)', paddingTop: '20px' }}>
        <h3>Generatore XML SDI Fattura Elettronica Attiva</h3>
        <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Seleziona una fattura di vendita completata per visualizzare ed esportare il file XML conforme per la trasmissione a SdI.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <select 
              className="classic-select" 
              value={xmlActiveInvoiceId} 
              onChange={(e) => {
                setXmlActiveInvoiceId(e.target.value);
                setGeneratedActiveXml('');
              }}
            >
              <option value="">-- Seleziona Fattura --</option>
              {documents.filter(d => d.type === 'invoice_sale' && d.status === 'completed').map(d => (
                <option key={d.id} value={d.id}>{d.number} del {d.date} - {d.partner?.name} (€ {d.total_amount?.toFixed(2)})</option>
              ))}
            </select>
            <button className="classic-btn classic-btn-primary" onClick={handleGenerateActiveXml} disabled={!xmlActiveInvoiceId}>
              Genera XML Fattura
            </button>
            {generatedActiveXml && (
              <button className="classic-btn classic-btn-secondary" onClick={handleDownloadActiveXml}>
                <Download size={14} />
                <span>Scarica XML</span>
              </button>
            )}
          </div>

          <div>
            <textarea 
              className="classic-textarea" 
              rows={10} 
              readOnly 
              value={generatedActiveXml}
              placeholder="Il tracciato XML generato apparirà qui..."
              style={{ fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: '#f8fafc' }}
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}
