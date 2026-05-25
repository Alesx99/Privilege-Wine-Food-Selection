import { BadRequestException } from '@nestjs/common';

export interface ParsedXmlInvoiceItem {
  sku: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_percent: number;
  format: string;
  vintage: string;
}

export interface ParsedXmlInvoice {
  supplierName: string;
  supplierVat: string;
  supplierAddress: string;
  docDate: string;
  docNumber: string;
  items: ParsedXmlInvoiceItem[];
}

// Helper to find a tag value with optional namespace prefix
export function getTagValue(xml: string, tag: string): string {
  if (!xml) return '';
  const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}\\b[^>]*>([^<]*)<\\/\\1?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[2].trim() : '';
}

// Helper to extract a section with optional namespace prefix
export function getSection(xml: string, tag: string): string {
  if (!xml) return '';
  const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/\\1?${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[2] : '';
}

// Helper to get base SKU (normalize it)
export function getBaseSku(sku: string): string {
  if (!sku) return '';
  return sku.trim().toUpperCase().replace(/[-/_.]?[a-zA-Z0-9]{1,2}$/, '');
}

export function parseXmlInvoice(xmlContent: string): ParsedXmlInvoice {
  // Extract Supplier (CedentePrestatore)
  const cedenteSection = getSection(xmlContent, 'CedentePrestatore');
  const supplierName = getTagValue(cedenteSection, 'Denominazione');
  const supplierVat = getTagValue(cedenteSection, 'IdCodice');
  
  const indirizzo = getTagValue(cedenteSection, 'Indirizzo');
  const cap = getTagValue(cedenteSection, 'CAP');
  const comune = getTagValue(cedenteSection, 'Comune');
  const supplierAddress = `${indirizzo}, ${cap} ${comune}`.trim().replace(/^,\s*/, '');

  // Extract Document Headers (FatturaElettronicaBody)
  const bodySection = getSection(xmlContent, 'FatturaElettronicaBody');
  const docDate = getTagValue(bodySection, 'Data');
  const docNumber = getTagValue(bodySection, 'Numero');

  const finalDocDate = docDate || new Date().toISOString().split('T')[0];

  if (!supplierVat || !docNumber) {
    throw new BadRequestException('Formato XML Fattura Elettronica non valido o non riconosciuto (Partita IVA o Numero documento mancanti).');
  }

  const items: ParsedXmlInvoiceItem[] = [];
  const detailRegex = /<([a-zA-Z0-9]+:)?DettaglioLinee\b[^>]*>([\s\S]*?)<\/\1?DettaglioLinee>/gi;
  const detailMatches = [...xmlContent.matchAll(detailRegex)];

  for (const match of detailMatches) {
    const cleanedLine = match[2];
    const desc = getTagValue(cleanedLine, 'Descrizione');
    const qty = Number(getTagValue(cleanedLine, 'Quantita')) || 0;
    const price = Number(getTagValue(cleanedLine, 'PrezzoUnitario')) || 0;
    const vat = Number(getTagValue(cleanedLine, 'AliquotaIVA')) || 22.00;

    // Discount percent extraction
    let discount = 0;
    const scontoSection = getSection(cleanedLine, 'ScontoMaggiorazione');
    if (scontoSection) {
      discount = Number(getTagValue(scontoSection, 'Percentuale')) || 0;
    }

    // Skip informational lines (0 qty or 0 price) unless 100% discounted free item
    if (qty === 0 || (price === 0 && discount < 100)) {
      continue;
    }

    // Extract SKU from supplier code or general article code
    let sku = '';
    const codiceArticoloRegex = /<([a-zA-Z0-9]+:)?CodiceArticolo\b[^>]*>([\s\S]*?)<\/\1?CodiceArticolo>/gi;
    const artMatches = [...cleanedLine.matchAll(codiceArticoloRegex)];
    
    for (const artMatch of artMatches) {
      const artSection = artMatch[2];
      const tipo = getTagValue(artSection, 'CodiceTipo');
      const valore = getTagValue(artSection, 'CodiceValore');
      if (tipo.toLowerCase().includes('fornitore')) {
        sku = valore;
        break;
      }
    }
    
    // If not found, use the first CodiceArticolo value as fallback
    if (!sku && artMatches.length > 0) {
      sku = getTagValue(artMatches[0][2], 'CodiceValore');
    }

    if (!sku) {
      sku = 'IMP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Try parsing vintage and format from description (e.g. "LT.0,75", "2019", "MAGNUM")
    let format = '0.75L';
    if (desc.toLowerCase().includes('magnum') || desc.toLowerCase().includes('1,5') || desc.toLowerCase().includes('1.5')) {
      format = '1.5L';
    } else if (desc.toLowerCase().includes('0,375') || desc.toLowerCase().includes('0.375')) {
      format = '0.375L';
    }

    let vintage = 'NV';
    const yearMatch = desc.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      vintage = yearMatch[0];
    }

    items.push({
      sku,
      description: desc,
      quantity: qty,
      unit_price: price,
      discount_percent: discount,
      vat_percent: vat,
      format,
      vintage,
    });
  }

  return {
    supplierName: supplierName || 'FORNITORE IMPORTATO',
    supplierVat,
    supplierAddress: supplierAddress || 'Indirizzo non specificato',
    docDate: finalDocDate,
    docNumber,
    items,
  };
}
