import PDFDocument from 'pdfkit';

export function generateInvoicePdf(
  res: any,
  invoice: any,
  partner: any,
  items: any[],
) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Stream the PDF to the response
  doc.pipe(res);

  // --- HEADER SECTION ---
  doc
    .fillColor('#922b3e')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('CANTINA PRIVILEGE', 50, 50);

  doc
    .fillColor('#4b5563')
    .font('Helvetica')
    .fontSize(9)
    .text('DI CORTESE TOMMASO', 50, 75)
    .text('Corso Vittorio Emanuele II 48, 70032 Bitonto (BA)', 50, 88)
    .text('P.IVA: IT09127380724 | C.F.: CRTTMS81D20F262M', 50, 101)
    .text('Email: info@cantinaprivilege.it | Tel: +39 080 123456', 50, 114);

  // Document Type & Number
  const docTypeName = 
    invoice.type === 'invoice_sale' ? 'FATTURA DI VENDITA' :
    invoice.type === 'invoice_purchase' ? 'FATTURA ACQUISTO' :
    invoice.type === 'ddt_out' ? 'DOCUMENTO DI TRASPORTO (DDT)' :
    invoice.type === 'ddt_in' ? 'DDT DI CARICO' : 'DOCUMENTO';

  doc
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(docTypeName, 350, 50, { align: 'right', width: 200 })
    .font('Helvetica')
    .fontSize(10)
    .text(`Numero: ${invoice.number}`, 350, 70, { align: 'right', width: 200 })
    .text(`Data: ${invoice.date}`, 350, 85, { align: 'right', width: 200 })
    .text(`Stato: ${invoice.status.toUpperCase()}`, 350, 100, { align: 'right', width: 200 });

  doc.moveDown(4);
  doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 140).lineTo(545, 140).stroke();

  // --- PARTNER INFO SECTION ---
  const partnerHeader = 
    invoice.type.endsWith('purchase') || invoice.type.endsWith('in') 
      ? 'CEDENTE / FORNITORE' 
      : 'CESSIONARIO / CLIENTE';

  doc
    .fillColor('#922b3e')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(partnerHeader, 50, 160);

  doc
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(partner.name, 50, 175);

  doc
    .fillColor('#4b5563')
    .font('Helvetica')
    .fontSize(9)
    .text(`Indirizzo: ${partner.address || 'N/D'}`, 50, 190, { width: 250 })
    .text(`P.IVA: ${partner.vat_number}`, 50, 215)
    .text(`Cod. SDI: ${partner.sdi_code || '0000000'}`, 50, 228);

  // Box outline for Client info
  doc
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .roundedRect(45, 150, 500, 95, 6)
    .stroke();

  doc.moveDown(3);

  // --- ITEMS TABLE SECTION ---
  const tableTop = 270;
  doc
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(9);

  // Header columns
  doc.text('Descrizione Prodotto', 50, tableTop, { width: 200 });
  doc.text('Codice', 250, tableTop, { width: 50 });
  doc.text('Q.tà', 310, tableTop, { width: 30, align: 'right' });
  doc.text('P. Unitario', 350, tableTop, { width: 60, align: 'right' });
  doc.text('Sconto %', 420, tableTop, { width: 45, align: 'right' });
  doc.text('Tot. Netto', 475, tableTop, { width: 70, align: 'right' });

  // Draw header line
  doc.strokeColor('#922b3e').lineWidth(1.5).moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();

  let currentY = tableTop + 22;
  let totalNet = 0;
  let totalVat = 0;

  doc.font('Helvetica').fontSize(9).fillColor('#111827');

  items.forEach((item, index) => {
    // Check page height limit (A4 length is 842 pt, margins are 50 pt)
    if (currentY > 700) {
      doc.addPage();
      currentY = 50; // reset to top of new page
    }

    const netAmount = Number((item.quantity * item.unit_price * (1 - item.discount_percent / 100)).toFixed(2));
    const vatAmount = Number((netAmount * (item.vat_percent / 100)).toFixed(2));
    
    totalNet += netAmount;
    totalVat += vatAmount;

    // Display values
    doc.text(item.product_name || `Prodotto #${index + 1}`, 50, currentY, { width: 190 });
    doc.text(item.product_sku || '-', 250, currentY, { width: 50 });
    doc.text(item.quantity.toString(), 310, currentY, { width: 30, align: 'right' });
    doc.text(`${Number(item.unit_price).toFixed(2)}`, 350, currentY, { width: 60, align: 'right' });
    doc.text(item.discount_percent > 0 ? `${Number(item.discount_percent).toFixed(0)}%` : '-', 420, currentY, { width: 45, align: 'right' });
    doc.text(`${netAmount.toFixed(2)}`, 475, currentY, { width: 70, align: 'right' });

    // Draw horizontal separator
    currentY += 28;
    doc.strokeColor('#f3f4f6').lineWidth(0.5).moveTo(50, currentY - 6).lineTo(545, currentY - 6).stroke();
  });

  // --- TOTALS SECTION ---
  const summaryTop = currentY + 10;
  doc
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .moveTo(320, summaryTop)
    .lineTo(545, summaryTop)
    .stroke();

  doc
    .fillColor('#4b5563')
    .fontSize(9)
    .font('Helvetica')
    .text('Imponibile:', 350, summaryTop + 10, { width: 100, align: 'left' })
    .text(`${totalNet.toFixed(2)} EUR`, 450, summaryTop + 10, { width: 95, align: 'right' });

  doc
    .text('Imposta (IVA 22%):', 350, summaryTop + 25, { width: 100, align: 'left' })
    .text(`${totalVat.toFixed(2)} EUR`, 450, summaryTop + 25, { width: 95, align: 'right' });

  doc
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .moveTo(350, summaryTop + 40)
    .lineTo(545, summaryTop + 40)
    .stroke();

  const grandTotal = totalNet + totalVat;
  doc
    .fillColor('#922b3e')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('TOTALE DOCUMENTO:', 320, summaryTop + 48, { width: 130, align: 'left' })
    .text(`${grandTotal.toFixed(2)} EUR`, 450, summaryTop + 48, { width: 95, align: 'right' });

  // --- FOOTER SECTION (Bank Details) ---
  doc
    .fillColor('#9b2c3c')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Dettagli di Pagamento (IBAN)', 50, 730);

  doc
    .fillColor('#4b5563')
    .font('Helvetica')
    .fontSize(8)
    .text('Banca: FinecoBank | Beneficiario: Cantina Privilege di Cortese Tommaso', 50, 742)
    .text('IBAN: IT19F0569620400000002071X73 | BIC/SWIFT: FINCIT33XXX', 50, 754);

  doc
    .fillColor('#9ca3af')
    .fontSize(7)
    .text('Generato automaticamente dal sistema gestionale Cantina Privilege ERP.', 50, 775, { align: 'center', width: 495 });

  doc.end();
}
