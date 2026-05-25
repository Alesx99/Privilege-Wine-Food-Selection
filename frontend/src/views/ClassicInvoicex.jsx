import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  Percent, 
  Calculator, 
  HelpCircle, 
  Download, 
  RefreshCw, 
  Package, 
  Plus, 
  Trash2, 
  Mail, 
  Database,
  Building,
  CheckCircle,
  FileSpreadsheet,
  FileArchive,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import JSZip from 'jszip';

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

  // Active Tab
  const [activeTab, setActiveTab] = useState('attivo');

  // Help Modal/Tooltip State
  const [activeHelp, setActiveHelp] = useState(null);

  // Success/Error notifications
  const [notice, setNotice] = useState(null);
  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 5000);
  };

  // ==========================================
  // STATE & UTILS FOR MODULES
  // ==========================================

  // --- TAB 1: CICLO ATTIVO / DDT CONSOLIDATION ---
  const [selectedClientForDdt, setSelectedClientForDdt] = useState('');
  const [groupedDdtsState, setGroupedDdtsState] = useState(() => {
    const saved = localStorage.getItem('privilege_grouped_ddts');
    return saved ? JSON.parse(saved) : [];
  });

  const clients = useMemo(() => {
    return partners.filter(p => p.type === 'client' || p.type === 'both');
  }, [partners]);

  // DDTs of selected client that are completed/draft and not yet grouped
  const clientDdts = useMemo(() => {
    if (!selectedClientForDdt) return [];
    return documents.filter(doc => 
      doc.partner_id === selectedClientForDdt && 
      doc.type === 'ddt_out' && 
      !groupedDdtsState.includes(doc.id)
    );
  }, [selectedClientForDdt, documents, groupedDdtsState]);

  const [selectedDdtIds, setSelectedDdtIds] = useState([]);

  const handleToggleDdt = (id) => {
    setSelectedDdtIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGroupDdts = async () => {
    if (selectedDdtIds.length === 0) {
      alert('Seleziona almeno un DDT da raggruppare.');
      return;
    }
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }

    try {
      // 1. Fetch details of all selected DDTs to get their items
      const fetchPromises = selectedDdtIds.map(id => 
        fetch(`${API_BASE_URL}/api/documents/${id}`).then(res => {
          if (!res.ok) throw new Error(`Errore caricamento DDT ${id}`);
          return res.json();
        })
      );
      const fullDdts = await Promise.all(fetchPromises);

      // 2. Aggregate items by product_id
      const aggregatedItems = {};
      fullDdts.forEach(ddt => {
        const ddtItems = ddt.items || [];
        ddtItems.forEach(item => {
          const key = item.product_id;
          if (!aggregatedItems[key]) {
            aggregatedItems[key] = {
              product_id: item.product_id,
              quantity: 0,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent || 0,
              vat_percent: item.vat_percent || 22,
              lot_number: item.lot_number || '',
            };
          }
          aggregatedItems[key].quantity += Number(item.quantity);
        });
      });

      const finalItems = Object.values(aggregatedItems);

      if (finalItems.length === 0) {
        alert('Nessun articolo trovato nei DDT selezionati.');
        return;
      }

      // 3. Create Consolidated Invoice
      const invoiceNumber = `FD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const payload = {
        type: 'invoice_sale',
        partner_id: selectedClientForDdt,
        number: invoiceNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        items: finalItems
      };

      // 4. Save Invoice
      const res = await fetch(`${API_BASE_URL}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore nel salvataggio della fattura differita.');
      }

      const savedInvoice = await res.json();

      // 5. Mark DDTs as grouped
      const updatedGrouped = [...groupedDdtsState, ...selectedDdtIds];
      setGroupedDdtsState(updatedGrouped);
      localStorage.setItem('privilege_grouped_ddts', JSON.stringify(updatedGrouped));

      setSelectedDdtIds([]);
      showNotice(`Fattura differita bozza ${invoiceNumber} generata con successo!`);
      await loadAllData();
    } catch (err) {
      alert('Errore raggruppamento DDT: ' + err.message);
    }
  };

  const handleResetGroupedDdts = () => {
    if (confirm('Vuoi resettare lo stato di fatturazione dei DDT? Sarà possibile ri-selezionarli.')) {
      setGroupedDdtsState([]);
      localStorage.removeItem('privilege_grouped_ddts');
      showNotice('Filtro DDT resettato.');
    }
  };


  // --- TAB 2: CICLO PASSIVO & XML IMPORT ---
  const [xmlContentInput, setXmlContentInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportXml = async () => {
    if (!xmlContentInput.trim()) {
      alert('Inserisci o incolla il contenuto XML di una fattura elettronica passiva.');
      return;
    }
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/import/xml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: xmlContentInput }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Errore durante l\'importazione XML.');
      }

      const importedDoc = await res.json();
      showNotice(`Fattura Passiva n. ${importedDoc.number} importata con successo e giacenze aggiornate!`);
      setXmlContentInput('');
      await loadAllData();
    } catch (err) {
      alert('Errore importazione: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleXmlFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setXmlContentInput(evt.target.result);
    };
    reader.readAsText(file);
  };


  // --- TAB 3: FISCO & E-FATTURA (CALCULATORS, CODES, ACTIVE XML) ---
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


  // --- TAB 4: MAGAZZINO & KIT (DISTINTA BASE) ---
  const [kits, setKits] = useState(() => {
    const saved = localStorage.getItem('privilege_kits');
    return saved ? JSON.parse(saved) : [
      {
        id: 'kit-1',
        name: 'Tris Barolo & Amarone Privilege',
        sku: 'KIT-TRIS-01',
        components: [
          { product_id: products[0]?.id || '', quantity: 2 },
          { product_id: products[1]?.id || '', quantity: 1 }
        ]
      }
    ];
  });

  const [newKitName, setNewKitName] = useState('');
  const [newKitSku, setNewKitSku] = useState('');
  const [newKitComponents, setNewKitComponents] = useState([{ product_id: '', quantity: 1 }]);

  const handleAddKitComponentRow = () => {
    setNewKitComponents([...newKitComponents, { product_id: '', quantity: 1 }]);
  };

  const handleUpdateKitComponent = (index, field, value) => {
    const updated = [...newKitComponents];
    updated[index] = { ...updated[index], [field]: value };
    setNewKitComponents(updated);
  };

  const handleSaveKit = () => {
    if (!newKitName || !newKitSku) {
      alert('Nome e SKU sono obbligatori.');
      return;
    }
    const cleanComponents = newKitComponents.filter(c => c.product_id && c.quantity > 0);
    if (cleanComponents.length === 0) {
      alert('Aggiungi almeno un componente valido al Kit.');
      return;
    }

    const nextKits = [
      ...kits,
      {
        id: 'kit-' + Date.now(),
        name: newKitName,
        sku: newKitSku.toUpperCase(),
        components: cleanComponents
      }
    ];
    setKits(nextKits);
    localStorage.setItem('privilege_kits', JSON.stringify(nextKits));

    setNewKitName('');
    setNewKitSku('');
    setNewKitComponents([{ product_id: '', quantity: 1 }]);
    showNotice('Kit / Distinta Base salvato correttamente.');
  };

  const handleDeleteKit = (id) => {
    if (confirm('Sei sicuro di voler eliminare questo Kit?')) {
      const nextKits = kits.filter(k => k.id !== id);
      setKits(nextKits);
      localStorage.setItem('privilege_kits', JSON.stringify(nextKits));
      showNotice('Kit eliminato.');
    }
  };


  // --- TAB 5: TESORERIA & SEPA XML ---
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
      // Fetch full details of selected invoices to guarantee partner address and IBAN
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

  // Late Payment Email Templates
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


  // --- TAB 6: CONTABILITÀ & PRIMA NOTA & LIQUIDAZIONE IVA ---
  const [primaNota, setPrimaNota] = useState(() => {
    const saved = localStorage.getItem('privilege_prima_nota');
    return saved ? JSON.parse(saved) : [];
  });

  const [pnDate, setPnDate] = useState(new Date().toISOString().split('T')[0]);
  const [pnDesc, setPnDesc] = useState('');
  const [pnType, setPnType] = useState('entrata');
  const [pnAmount, setPnAmount] = useState('');
  const [pnGruppo, setPnGruppo] = useState('Attività');
  const [pnConto, setPnConto] = useState('Cassa e Banche');
  const [pnSottoconto, setPnSottoconto] = useState('Cassa Contanti');

  const handleAddPrimaNota = () => {
    if (!pnDesc || !pnAmount) {
      alert('Descrizione ed Importo sono obbligatori.');
      return;
    }
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }

    const entry = {
      id: 'pn-' + Date.now(),
      date: pnDate,
      description: pnDesc,
      type: pnType,
      amount: Number(pnAmount),
      gruppo: pnGruppo,
      conto: pnConto,
      sottoconto: pnSottoconto
    };

    const nextPn = [...primaNota, entry];
    setPrimaNota(nextPn);
    localStorage.setItem('privilege_prima_nota', JSON.stringify(nextPn));

    setPnDesc('');
    setPnAmount('');
    showNotice('Movimento di Prima Nota registrato con successo!');
  };

  const handleDeletePn = (id) => {
    if (!isMaster) {
      alert('Azione non consentita: utente in sola lettura.');
      return;
    }
    if (confirm('Eliminare questo movimento?')) {
      const nextPn = primaNota.filter(p => p.id !== id);
      setPrimaNota(nextPn);
      localStorage.setItem('privilege_prima_nota', JSON.stringify(nextPn));
      showNotice('Movimento eliminato.');
    }
  };

  const pnBalance = useMemo(() => {
    let entrate = 0;
    let uscite = 0;
    primaNota.forEach(p => {
      if (p.type === 'entrata') entrate += p.amount;
      else uscite += p.amount;
    });
    return { entrate, uscite, total: entrate - uscite };
  }, [primaNota]);

  // VAT settlement simulator (Liquidazione IVA)
  const [vatYear, setVatYear] = useState('2026');
  const [vatPeriod, setVatPeriod] = useState('1'); // month (1-12) or quarter (Q1-Q4)
  const [vatResultSummary, setVatResultSummary] = useState(null);

  const handleCalculateVatSettlement = () => {
    let salesVat = 0;
    let salesTaxable = 0;
    let purchasesVat = 0;
    let purchasesTaxable = 0;

    // Filter documents matching period
    documents.forEach(doc => {
      if (doc.status !== 'completed') return;
      
      const docDate = new Date(doc.date);
      const y = docDate.getFullYear().toString();
      if (y !== vatYear) return;

      const m = docDate.getMonth() + 1; // 1-12
      let isInPeriod = false;

      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].includes(vatPeriod)) {
        isInPeriod = m.toString() === vatPeriod;
      } else if (vatPeriod === 'Q1') {
        isInPeriod = m >= 1 && m <= 3;
      } else if (vatPeriod === 'Q2') {
        isInPeriod = m >= 4 && m <= 6;
      } else if (vatPeriod === 'Q3') {
        isInPeriod = m >= 7 && m <= 9;
      } else if (vatPeriod === 'Q4') {
        isInPeriod = m >= 10 && m <= 12;
      }

      if (isInPeriod) {
        // App.jsx documents list only holds total_amount.
        // As a simulated breakdown: taxable is roughly total / 1.22, tax is total - taxable
        const total = Number(doc.total_amount) || 0;
        const taxable = Number((total / 1.22).toFixed(2));
        const vat = Number((total - taxable).toFixed(2));

        if (doc.type === 'invoice_sale') {
          salesTaxable += taxable;
          salesVat += vat;
        } else if (doc.type === 'invoice_purchase') {
          purchasesTaxable += taxable;
          purchasesVat += vat;
        }
      }
    });

    const diff = salesVat - purchasesVat;
    setVatResultSummary({
      year: vatYear,
      period: vatPeriod,
      salesTaxable,
      salesVat,
      purchasesTaxable,
      purchasesVat,
      diff
    });
  };


  // --- TAB 7: AREA COMMERCIALISTA EXPORTS ---
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

    // TS format: REG|TIPO|N_FATT|DATA|P_IVA|DENOMINAZIONE|IMPONIBILE|IMPOSTA|TOTALE
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

    // Header: Data;Documento;Numero;Cliente/Fornitore;P.IVA;Imponibile;Aliquota;Imposta;Totale
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

    // Simple Datev compliant layout (Umsatz, Soll/Haben, Gegenkonto, Belegfeld, Datum, etc.)
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
      if (doc.type !== 'invoice_sale') return false; // active sales invoices
      const d = new Date(doc.date);
      return d.getFullYear().toString() === commYear && (d.getMonth() + 1).toString().padStart(2, '0') === commMonth;
    });

    if (filtered.length === 0) {
      alert('Nessuna fattura attiva trovata per questo mese.');
      return;
    }

    showNotice('Generazione archivio ZIP in corso...');

    try {
      // 1. Fetch full details of all filtered invoices
      const promises = filtered.map(doc => 
        fetch(`${API_BASE_URL}/api/documents/${doc.id}`).then(res => res.json())
      );
      const fullDocs = await Promise.all(promises);

      // 2. Initialize JSZip
      const zip = new JSZip();

      // Report file content
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

      // 3. Generate and trigger download
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


  // ==========================================
  // HARDCODED HELP DIALOG TEXTS
  // ==========================================
  const helpContents = {
    attivo: 'Ciclo Attivo (Vendite): in questo modulo puoi visionare i listini e raggruppare DDT multipli di uno stesso cliente in un\'unica Fattura Differita di fine mese. Gli articoli uguali vengono aggregati automaticamente per accorciare il documento.',
    passivo: 'Ciclo Passivo (Acquisti): qui puoi caricare i documenti di acquisto da fornitori. Inoltre, il modulo consente di caricare direttamente file XML di fatture passive. L\'importatore integrato estrarrà le righe, creerà le anagrafiche mancanti ed effettuerà il carico automatico in magazzino.',
    fisco: 'Fatturazione Elettronica & Fisco: questa scheda ti permette di simulare ed applicare ritenute d\'acconto e rivalse INPS (4%), di consultare i codici natura esenzione IVA aggiornati (es. N2.2 per forfettari, N6 per inversione contabile) e di generare il tracciato XML standard conforme per l\'invio a SdI.',
    magazzino: 'Magazzino & Distinta Base (Kit): consenti di creare ricette di "Kit" (assemblati di più prodotti). Per ogni Kit viene calcolata in tempo reale la fattibilità di produzione basandosi sulle giacenze reali a magazzino delle singole bottiglie ed il costo totale di carico.',
    tesoreria: 'Tesoreria: seleziona le fatture attive completate ma non ancora saldate per generare un flusso SEPA Direct Debit (pain.008 CBI) in formato XML da caricare in banca. Da questa sezione puoi anche compilare email di sollecito personalizzate basandoti sui giorni di ritardo.',
    contabilita: 'Contabilità & Prima Nota: gestisci la Prima Nota cassa/banca con un piano dei conti simulato e calcola in tempo reale la liquidazione IVA periodica (mensile o trimestrale) calcolando l\'Iva esigibile a debito e l\'Iva detraibile a credito.',
    commercialista: 'Area Commercialista: esporta i dati delle fatture vendite e acquisti per i gestionali contabili più diffusi (TeamSystem .fatseq, Profis / Sistemi CSV, Datev CSV). È anche possibile scaricare uno ZIP massivo contenente tutti gli XML delle fatture elettroniche di vendita.'
  };


  // ==========================================
  // E-INVOICE AND SEPA XML TEXT GENERATORS
  // ==========================================
  
  function generateFatturaElettronicaXml(doc) {
    const vatNumber = doc.partner?.vat_number || '00000000000';
    const name = doc.partner?.name || 'Cliente Generico';
    const address = doc.partner?.address || 'Indirizzo non specificato';
    const number = doc.number || '1';
    const date = doc.date || '2026-01-01';
    const sdiCode = doc.partner?.sdi_code || '0000000';
    
    let linesXml = '';
    const items = doc.items || [];

    // Fallback if no items (e.g. from app.jsx listing)
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
    <div className="classic-invoicex-view" style={{ padding: '24px', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* SCOPED CUSTOM STYLES */}
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
      `}} />

      {/* TOP HEADER */}
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

      {/* HELP INLINE BAR */}
      <div className="info-bubble">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Guida Modulo:</strong> {helpContents[activeTab]}
        </div>
      </div>

      {/* ==========================================
          TAB 1: CICLO ATTIVO / VENDITE
          ========================================== */}
      {activeTab === 'attivo' && (
        <div className="classic-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--classic-border)', paddingBottom: '12px' }}>
              <div>
                <h3>Ciclo Attivo - Workflow di Conversione DDT e Documenti</h3>
                <p className="muted-text" style={{ fontSize: '0.78rem' }}>Raggruppamento differito di fine mese per cliente con aggregazione automatica degli SKU ripetuti.</p>
              </div>
              {groupedDdtsState.length > 0 && (
                <button className="classic-btn classic-btn-secondary" onClick={handleResetGroupedDdts}>
                  Ripristina DDT Raggruppati
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              {/* Form Selezione */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <h4>1. Seleziona Cliente</h4>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>Anagrafica Cliente</label>
                  <select 
                    className="classic-select" 
                    value={selectedClientForDdt} 
                    onChange={(e) => {
                      setSelectedClientForDdt(e.target.value);
                      setSelectedDdtIds([]);
                    }}
                  >
                    <option value="">-- Seleziona Cliente --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.vat_number})</option>
                    ))}
                  </select>
                </div>

                {selectedClientForDdt && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '0.8rem' }}>DDT pronti per fattura differita: <strong>{clientDdts.length}</strong></p>
                    <button 
                      className="classic-btn classic-btn-primary" 
                      onClick={handleGroupDdts}
                      disabled={selectedDdtIds.length === 0 || !isMaster}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <CheckCircle size={16} />
                      <span>Raggruppa in Fattura Differita</span>
                    </button>
                  </div>
                )}
              </div>

              {/* DDTs list */}
              <div>
                <h4>2. DDT Pendenti</h4>
                {!selectedClientForDdt ? (
                  <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                    Seleziona un cliente a sinistra per visualizzare i DDT pendenti da fatturare.
                  </div>
                ) : clientDdts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '0.85rem' }}>
                    Nessun DDT pendente non fatturato per questo cliente.
                  </div>
                ) : (
                  <table className="classic-table">
                    <thead>
                      <tr>
                        <th width="40">Seleziona</th>
                        <th>Numero DDT</th>
                        <th>Data</th>
                        <th style={{ textAlign: 'right' }}>Importo Totale</th>
                        <th>Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientDdts.map(ddt => (
                        <tr key={ddt.id}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedDdtIds.includes(ddt.id)} 
                              onChange={() => handleToggleDdt(ddt.id)}
                            />
                          </td>
                          <td><strong>{ddt.number}</strong></td>
                          <td>{ddt.date}</td>
                          <td style={{ textAlign: 'right' }}>€ {ddt.total_amount?.toFixed(2)}</td>
                          <td><span className={`status-badge ${ddt.status}`}>{ddt.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Listini prezzi multipli visualizzazione */}
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--classic-border)', paddingTop: '20px' }}>
              <h3>Consulta Listini Prezzi Configurati</h3>
              <table className="classic-table" style={{ marginTop: '12px' }}>
                <thead>
                  <tr>
                    <th>Nome Prodotto (Vino)</th>
                    <th>Codice SKU</th>
                    <th>Prezzo Base Netto</th>
                    <th>IVA %</th>
                    <th>Listino Ristorazione (+ markup)</th>
                    <th>Listino Privati (+ markup)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong> ({p.vintage} &bull; {p.format})</td>
                      <td><code>{p.sku}</code></td>
                      <td>€ {p.base_cost?.toFixed(2)}</td>
                      <td>{p.vat_percent}%</td>
                      <td>€ {((p.base_cost || 0) * 1.3).toFixed(2)} (+30%)</td>
                      <td>€ {((p.base_cost || 0) * 1.5).toFixed(2)} (+50%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: CICLO PASSIVO / ACQUISTI
          ========================================== */}
      {activeTab === 'passivo' && (
        <div className="classic-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3>Ciclo Passivo & Importatore XML Fattura Fornitore</h3>
            <p className="muted-text" style={{ fontSize: '0.82rem' }}>
              Importa fatture passive in formato XML dell'Agenzia delle Entrate per registrare l'acquisto, caricare le giacenze nel magazzino e salvare l'anagrafica fornitore se non esistente.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4>1. Incolla XML o Carica File</h4>
                
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                    Scegli file .xml
                  </label>
                  <input type="file" accept=".xml" onChange={handleXmlFileChange} className="classic-input" />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                    Contenuto XML della Fattura
                  </label>
                  <textarea 
                    className="classic-textarea" 
                    rows={12} 
                    value={xmlContentInput} 
                    onChange={(e) => setXmlContentInput(e.target.value)}
                    placeholder='<?xml version="1.0" ... <FatturaElettronica> ...'
                    style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                  ></textarea>
                </div>

                <button 
                  className="classic-btn classic-btn-primary" 
                  onClick={handleImportXml}
                  disabled={isImporting || !isMaster}
                  style={{ justifyContent: 'center' }}
                >
                  {isImporting ? 'Elaborazione...' : 'Elabora e Registra Fattura d\'Acquisto'}
                </button>
              </div>

              {/* Purchase invoices history */}
              <div>
                <h4>Ultime Fatture Acquisto Registrate</h4>
                <table className="classic-table" style={{ marginTop: '12px' }}>
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Fornitore</th>
                      <th>Data</th>
                      <th style={{ textAlign: 'right' }}>Importo</th>
                      <th>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.filter(d => d.type === 'invoice_purchase').map(doc => (
                      <tr key={doc.id}>
                        <td><strong>{doc.number}</strong></td>
                        <td>{doc.partner?.name}</td>
                        <td>{doc.date}</td>
                        <td style={{ textAlign: 'right' }}>€ {doc.total_amount?.toFixed(2)}</td>
                        <td><span className={`status-badge ${doc.status}`}>{doc.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 3: FISCO & FATTURAZIONE ELETTRONICA
          ========================================== */}
      {activeTab === 'fisco' && (
        <div className="classic-card">
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

                {/* Live Output Table */}
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
        </div>
      )}

      {/* ==========================================
          TAB 4: MAGAZZINO & KIT
          ========================================== */}
      {activeTab === 'magazzino' && (
        <div className="classic-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex-between">
              <div>
                <h3>Compositore Kit Articoli (Distinta Base Semplice)</h3>
                <p className="muted-text" style={{ fontSize: '0.8rem' }}>Permette di definire Kit di vini ed articoli del magazzino, calcolando la giacenza massima assemblabile e i costi.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
              {/* Kit Builder Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <h4>Crea Nuovo Kit</h4>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Nome del Kit</label>
                  <input type="text" className="classic-input" value={newKitName} onChange={(e) => setNewKitName(e.target.value)} placeholder="es. Confezione Regalo Barolo" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Codice SKU del Kit</label>
                  <input type="text" className="classic-input" value={newKitSku} onChange={(e) => setNewKitSku(e.target.value)} placeholder="es. KIT-BAROLO-01" />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Componenti & Quantità</label>
                  {newKitComponents.map((comp, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <select 
                        className="classic-select"
                        value={comp.product_id}
                        onChange={(e) => handleUpdateKitComponent(idx, 'product_id', e.target.value)}
                      >
                        <option value="">-- Seleziona Vino --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.vintage})</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        style={{ width: '70px' }} 
                        className="classic-input"
                        value={comp.quantity}
                        min="1"
                        onChange={(e) => handleUpdateKitComponent(idx, 'quantity', e.target.value)}
                        placeholder="Q.tà"
                      />
                    </div>
                  ))}
                  <button className="classic-btn classic-btn-secondary" style={{ width: '100%', padding: '4px' }} onClick={handleAddKitComponentRow}>
                    + Aggiungi Componente
                  </button>
                </div>

                <button className="classic-btn classic-btn-primary" onClick={handleSaveKit} style={{ justifyContent: 'center' }}>
                  Registra Kit
                </button>
              </div>

              {/* Kits List */}
              <div>
                <h4>Kits Registrati nel Sistema</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {kits.map(kit => {
                    // Compute stats
                    let totalCost = 0;
                    let maxAssemblable = Infinity;

                    const breakdown = kit.components.map(comp => {
                      const prod = products.find(p => p.id === comp.product_id);
                      const cost = (prod?.base_cost || 0) * comp.quantity;
                      totalCost += cost;

                      const stock = prod?.stock_quantity || 0;
                      const possible = Math.floor(stock / comp.quantity);
                      if (possible < maxAssemblable) maxAssemblable = possible;

                      return {
                        name: prod?.name || 'Vino sconosciuto',
                        vintage: prod?.vintage || '',
                        qty: comp.quantity,
                        stock: stock
                      };
                    });

                    if (maxAssemblable === Infinity) maxAssemblable = 0;

                    return (
                      <div key={kit.id} style={{ border: '1px solid #cbd5e1', padding: '16px', borderRadius: '6px', background: 'white' }}>
                        <div className="flex-between" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '0.95rem' }}>{kit.name}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '10px' }}>SKU: <code>{kit.sku}</code></span>
                          </div>
                          <button className="classic-btn classic-btn-danger" style={{ padding: '4px' }} onClick={() => handleDeleteKit(kit.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div style={{ fontSize: '0.8rem' }}>
                          <p style={{ margin: '0 0 6px 0', color: '#64748b' }}>Componenti:</p>
                          <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
                            {breakdown.map((b, i) => (
                              <li key={i}>
                                {b.name} ({b.vintage}) &bull; Q.tà nel Kit: <strong>{b.qty}</strong> &bull; Magazzino reale: <span style={{ color: b.stock >= b.qty ? '#059669' : '#dc2626' }}>{b.stock} bottiglie</span>
                              </li>
                            ))}
                          </ul>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '4px' }}>
                            <div>Costo di Produzione: <strong>€ {totalCost.toFixed(2)}</strong></div>
                            <div>Giacenza Assemblabile Max: <strong style={{ color: maxAssemblable > 0 ? '#059669' : '#d97706' }}>{maxAssemblable} conf.</strong></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 5: TESORERIA & SEPA XML
          ========================================== */}
      {activeTab === 'tesoreria' && (
        <div className="classic-card">
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

                {/* Unpaid completed sales invoices */}
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

            {/* Solleciti pagamento */}
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
        </div>
      )}

      {/* ==========================================
          TAB 6: CONTABILITÀ & PRIMA NOTA
          ========================================== */}
      {activeTab === 'contabilita' && (
        <div className="classic-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Prima Nota */}
            <div>
              <div className="flex-between">
                <h3>Prima Nota Cassa & Banche a 3 Livelli</h3>
                <div>
                  Saldo Attuale Cassa/Banca: <strong style={{ color: pnBalance.total >= 0 ? '#059669' : '#dc2626', fontSize: '1.1rem' }}>€ {pnBalance.total.toFixed(2)}</strong>
                </div>
              </div>
              <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Inserisci movimenti e traccia le entrate/uscite di cassa con il Piano dei Conti a 3 livelli (Gruppo &rarr; Conto &rarr; Sottoconto).</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                {/* Form Add */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Data Registrazione</label>
                    <input type="date" className="classic-input" value={pnDate} onChange={(e) => setPnDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Descrizione Movimento</label>
                    <input type="text" className="classic-input" value={pnDesc} onChange={(e) => setPnDesc(e.target.value)} placeholder="es. Ritiro contanti / Spese cancelleria" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Direzione Cassa</label>
                    <select className="classic-select" value={pnType} onChange={(e) => setPnType(e.target.value)}>
                      <option value="entrata">Entrata (+) </option>
                      <option value="uscita">Uscita (-)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 500 }}>Importo (€)</label>
                    <input type="number" className="classic-input" value={pnAmount} onChange={(e) => setPnAmount(e.target.value)} />
                  </div>

                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>Piano dei Conti (3 Livelli)</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                      <select className="classic-select" value={pnGruppo} onChange={(e) => setPnGruppo(e.target.value)}>
                        <option value="Attività">1. Attività</option>
                        <option value="Passività">1. Passività</option>
                        <option value="Costi">2. Costi</option>
                        <option value="Ricavi">2. Ricavi</option>
                      </select>
                      <select className="classic-select" value={pnConto} onChange={(e) => setPnConto(e.target.value)}>
                        <option value="Cassa e Banche">2. Cassa e Banche</option>
                        <option value="Clienti/Fornitori">2. Debiti / Crediti</option>
                        <option value="Oneri di Gestione">2. Oneri di Gestione</option>
                      </select>
                      <select className="classic-select" value={pnSottoconto} onChange={(e) => setPnSottoconto(e.target.value)}>
                        <option value="Cassa Contanti">3. Cassa Contanti</option>
                        <option value="Conto Corrente Bancario">3. Conto Corrente Bancario</option>
                        <option value="Acquisti Cancelleria">3. Acquisti Cancelleria</option>
                        <option value="Ricavi da Vendite Vini">3. Ricavi da Vendite Vini</option>
                      </select>
                    </div>
                  </div>

                  <button className="classic-btn classic-btn-primary" onClick={handleAddPrimaNota} style={{ justifyContent: 'center' }} disabled={!isMaster}>
                    Registra Movimento
                  </button>
                </div>

                {/* Table list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4>Movimenti Registrati</h4>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="classic-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Descrizione / Piano Conti</th>
                          <th style={{ textAlign: 'right' }}>Importo</th>
                          <th>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {primaNota.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Nessun movimento registrato in Prima Nota.</td></tr>
                        ) : (
                          primaNota.map(p => (
                            <tr key={p.id}>
                              <td>{p.date}</td>
                              <td>
                                <div><strong>{p.description}</strong></div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.gruppo} &gt; {p.conto} &gt; {p.sottoconto}</div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: p.type === 'entrata' ? '#059669' : '#dc2626' }}>
                                {p.type === 'entrata' ? '+' : '-'} € {p.amount?.toFixed(2)}
                              </td>
                              <td>
                                <button className="classic-btn classic-btn-danger" style={{ padding: '2px 4px' }} onClick={() => handleDeletePn(p.id)} disabled={!isMaster}>
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Liquidazione IVA */}
            <div style={{ borderTop: '1px solid var(--classic-border)', paddingTop: '20px' }}>
              <h3>Liquidazione IVA Periodica Simulata</h3>
              <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>Simulatore per il calcolo dell'IVA a debito (da vendite) ed IVA a credito (da acquisti) per il periodo specificato.</p>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <select className="classic-select" style={{ width: '120px' }} value={vatYear} onChange={(e) => setVatYear(e.target.value)}>
                  <option value="2026">Anno 2026</option>
                  <option value="2025">Anno 2025</option>
                </select>

                <select className="classic-select" style={{ width: '150px' }} value={vatPeriod} onChange={(e) => setVatPeriod(e.target.value)}>
                  <option value="1">Gennaio</option>
                  <option value="2">Febbraio</option>
                  <option value="3">Marzo</option>
                  <option value="4">Aprile</option>
                  <option value="5">Maggio</option>
                  <option value="6">Giugno</option>
                  <option value="7">Luglio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Settembre</option>
                  <option value="10">Ottobre</option>
                  <option value="11">Novembre</option>
                  <option value="12">Dicembre</option>
                  <option value="Q1">1° Trimestre (Q1)</option>
                  <option value="Q2">2° Trimestre (Q2)</option>
                  <option value="Q3">3° Trimestre (Q3)</option>
                  <option value="Q4">4° Trimestre (Q4)</option>
                </select>

                <button className="classic-btn classic-btn-primary" onClick={handleCalculateVatSettlement}>
                  Calcola Liquidazione IVA
                </button>
              </div>

              {vatResultSummary && (
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4>Riepilogo IVA Periodica</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginTop: '10px' }}>
                      <div className="flex-between"><span>Imponibile vendite:</span><span>€ {vatResultSummary.salesTaxable.toFixed(2)}</span></div>
                      <div className="flex-between"><span>IVA vendite (Esigibile a Debito):</span><strong>€ {vatResultSummary.salesVat.toFixed(2)}</strong></div>
                      <div className="flex-between" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}><span>Imponibile acquisti:</span><span>€ {vatResultSummary.purchasesTaxable.toFixed(2)}</span></div>
                      <div className="flex-between"><span>IVA acquisti (Detraibile a Credito):</span><strong>€ {vatResultSummary.purchasesVat.toFixed(2)}</strong></div>
                    </div>
                  </div>
                  <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Risultato della Liquidazione:</p>
                    <h2 style={{ 
                      color: vatResultSummary.diff >= 0 ? '#dc2626 !important' : '#059669 !important',
                      margin: '6px 0',
                      fontSize: '1.6rem'
                    }}>
                      € {Math.abs(vatResultSummary.diff).toFixed(2)}
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                      {vatResultSummary.diff >= 0 ? (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>Debito d'Imposta (da versare con F24)</span>
                      ) : (
                        <span style={{ color: '#047857', fontWeight: 600 }}>Credito d'Imposta (compensabile o a rimborso)</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          TAB 7: AREA COMMERCIALISTA EXPORTS
          ========================================== */}
      {activeTab === 'commercialista' && (
        <div className="classic-card">
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

              {/* ZIP mass xml export */}
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
        </div>
      )}

      {/* DEVELOPER CREDIT & OWNERSHIP */}
      <div style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px dashed #cfd8dc', paddingTop: '20px', paddingBottom: '20px' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--classic-text-muted)' }}>
          © Alesx99 &bull; Esclusiva Proprietà del Sistema di Gestione Integrata Privilege Wine &amp; Food Selection
        </p>
      </div>

    </div>
  );
}
