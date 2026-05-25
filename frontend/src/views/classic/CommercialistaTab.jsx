import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Building, FileArchive } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import JSZip from 'jszip';

export default function CommercialistaTab({
  documents = [],
  showNotice
}) {
  const [commYear, setCommYear] = useState('2026');
  const [commMonth, setCommMonth] = useState('05');

  // TeamSystem `.fatseq` exporter
  const handleExportTeamSystem = async () => {
    const filtered = documents.filter(doc => {
      if (doc.type !== 'invoice_sale') return false;
      const d = new Date(doc.date);
      return d.getFullYear().toString() === commYear && (d.getMonth() + 1).toString().padStart(2, '0') === commMonth;
    });

    if (filtered.length === 0) {
      alert('Nessuna fattura attiva trovata per il periodo selezionato.');
      return;
    }

    let content = 'REGISTRO FATTURE ELETT. - EXPORT TEAMSYSTEM\r\n';
    filtered.forEach(inv => {
      const tot = Number(inv.total_amount) || 0;
      const imp = Number((tot / 1.22).toFixed(2));
      const iva = Number((tot - imp).toFixed(2));
      const clientName = inv.partner?.name || 'Cliente';
      const vatNum = inv.partner?.vat_number || '00000000000';
      
      content += `REG|VENDITA|${inv.number}|${inv.date}|${vatNum}|${clientName}|${imp}|${iva}|${tot}\r\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TS_EXPORT_${commYear}_${commMonth}.fatseq`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Esportazione TeamSystem completata con successo!');
  };

  // Profis CSV Exporter
  const handleExportProfis = () => {
    const filtered = documents.filter(doc => {
      const d = new Date(doc.date);
      return d.getFullYear().toString() === commYear && (d.getMonth() + 1).toString().padStart(2, '0') === commMonth;
    });

    if (filtered.length === 0) {
      alert('Nessun documento trovato per il periodo selezionato.');
      return;
    }

    let content = 'Data;Documento;Numero;Anagrafica;PartitaIVA;Imponibile;Aliquota;Imposta;Totale\r\n';
    filtered.forEach(doc => {
      const typeLabel = doc.type === 'invoice_sale' ? 'FatturaVendita' : doc.type === 'invoice_purchase' ? 'FatturaAcquisto' : doc.type;
      const tot = Number(doc.total_amount) || 0;
      const imp = Number((tot / 1.22).toFixed(2));
      const iva = Number((tot - imp).toFixed(2));
      const partnerName = doc.partner?.name || 'Partner';
      const vatNum = doc.partner?.vat_number || '';

      content += `${doc.date};${typeLabel};${doc.number};${partnerName};${vatNum};${imp};22;${iva};${tot}\r\n`;
    });

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PROFIS_EXPORT_${commYear}_${commMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Esportazione Profis CSV completata!');
  };

  // Datev CSV Exporter
  const handleExportDatev = () => {
    const filtered = documents.filter(doc => {
      const d = new Date(doc.date);
      return d.getFullYear().toString() === commYear && (d.getMonth() + 1).toString().padStart(2, '0') === commMonth;
    });

    if (filtered.length === 0) {
      alert('Nessun documento trovato per il periodo.');
      return;
    }

    let content = 'Umsatz;SollHaben;Konto;Gegenkonto;Belegfeld;Datum;Buchungstext\r\n';
    filtered.forEach(doc => {
      const tot = Number(doc.total_amount).toFixed(2);
      const sh = doc.type === 'invoice_sale' ? 'S' : 'H';
      const dateFormatted = doc.date.replace(/-/g, '').slice(4); // MMDD
      content += `${tot};${sh};10000;8400;${doc.number};${dateFormatted};${doc.partner?.name || ''}\r\n`;
    });

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DATEV_EXPORT_${commYear}_${commMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Esportazione Datev CSV completata!');
  };

  // Mass XML ZIP download (JSZip)
  const handleExportXmlZip = async () => {
    const filtered = documents.filter(doc => {
      if (doc.type !== 'invoice_sale') return false;
      const d = new Date(doc.date);
      return d.getFullYear().toString() === commYear && (d.getMonth() + 1).toString().padStart(2, '0') === commMonth;
    });

    if (filtered.length === 0) {
      alert('Nessuna fattura attiva trovata per questo mese.');
      return;
    }

    showNotice('Generazione archivio ZIP in corso...');

    try {
      const promises = filtered.map(doc => 
        fetch(`${API_BASE_URL}/api/documents/${doc.id}`).then(res => res.json())
      );
      const fullDocs = await Promise.all(promises);

      const zip = new JSZip();
      let reportCsv = 'ID;Numero;Data;Cliente;PartitaIVA;TotaleImponibile;TotaleImposta;TotaleFattura\r\n';

      fullDocs.forEach(doc => {
        const xml = generateFatturaElettronicaXml(doc);
        const fileName = `IT09876543210_${doc.number.replace(/\//g, '_')}.xml`;
        zip.file(fileName, xml);

        const tot = Number(doc.total_amount) || 0;
        const imp = Number((tot / 1.22).toFixed(2));
        const iva = Number((tot - imp).toFixed(2));
        
        reportCsv += `${doc.id};${doc.number};${doc.date};${doc.partner?.name || ''};${doc.partner?.vat_number || ''};${imp};${iva};${tot}\r\n`;
      });

      zip.file('report_riepilogativo.csv', reportCsv);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `XML_FATTURE_${commYear}_${commMonth}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotice(`ZIP scaricato! Contiene ${fullDocs.length} fatture XML.`);
    } catch (err) {
      alert('Errore compilazione ZIP: ' + err.message);
    }
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
      <h3>Area Commercialista - Esportazione Flussi Contabili e XML</h3>
      <p className="muted-text" style={{ fontSize: '0.8rem' }}>
        Genera e scarica i file tracciati per i gestionali di contabilità utilizzati dagli studi commercialisti (TeamSystem, Profis/Sistemi, Datev) ed effettua l'estrazione massiva delle fatture XML.
      </p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Anno Fiscale</label>
          <select className="classic-select" style={{ width: '120px' }} value={commYear} onChange={(e) => setCommYear(e.target.value)}>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Mese Fiscale</label>
          <select className="classic-select" style={{ width: '120px' }} value={commMonth} onChange={(e) => setCommMonth(e.target.value)}>
            <option value="01">Gennaio</option>
            <option value="02">Febbraio</option>
            <option value="03">Marzo</option>
            <option value="04">Aprile</option>
            <option value="05">Maggio</option>
            <option value="06">Giugno</option>
            <option value="07">Luglio</option>
            <option value="08">Agosto</option>
            <option value="09">Settembre</option>
            <option value="10">Ottobre</option>
            <option value="11">Novembre</option>
            <option value="12">Dicembre</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* TeamSystem Card */}
        <div style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', background: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} style={{ color: '#1e88e5' }} />
            <strong>TeamSystem</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, minHeight: '36px' }}>Esporta le fatture del mese in formato testuale sequenziale .fatseq.</p>
          <button className="classic-btn classic-btn-primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={handleExportTeamSystem}>
            Scarica .fatseq
          </button>
        </div>

        {/* Profis / Sistemi Card */}
        <div style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', background: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} style={{ color: '#10b981' }} />
            <strong>Profis / Sistemi</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, minHeight: '36px' }}>Esporta i tracciati record in formato CSV separato da punto e virgola.</p>
          <button className="classic-btn classic-btn-primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={handleExportProfis}>
            Scarica CSV Profis
          </button>
        </div>

        {/* Datev Card */}
        <div style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', background: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={20} style={{ color: '#8b5cf6' }} />
            <strong>Datev CSV</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, minHeight: '36px' }}>Genera tracciati conformi allo standard contabile tedesco Datev.</p>
          <button className="classic-btn classic-btn-primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={handleExportDatev}>
            Scarica CSV Datev
          </button>
        </div>

        {/* ZIP Mass XML Export */}
        <div style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', background: 'white', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileArchive size={20} style={{ color: '#f59e0b' }} />
            <strong>Esportazione ZIP XML</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, minHeight: '36px' }}>Pacchetto completo contenente tutti gli XML delle fatture elettroniche attive emesse nel mese.</p>
          <button className="classic-btn classic-btn-primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={handleExportXmlZip}>
            Scarica Archivio ZIP
          </button>
        </div>
      </div>
    </div>
  );
}
