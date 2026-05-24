import { Injectable, Logger } from '@nestjs/common';

export interface SianDeclaration {
  id: string;
  operationType: 'FERMENTAZIONE' | 'ARRICCHIMENTO' | 'IMBOTTIGLIAMENTO' | 'DECLASSAMENTO';
  date: string;
  productSku: string;
  quantityLiters: number;
  alcoholVolume: number;
  lotNumber: string;
  recipientVat?: string; // per vendite sfuse
}

@Injectable()
export class SianService {
  private readonly logger = new Logger(SianService.name);

  /**
   * Genera il file XML conforme alle specifiche tecniche SIAN
   * (Sistema Informativo Agricolo Nazionale) per i registri telematici di cantina.
   */
  generateSianXml(declaration: SianDeclaration): string {
    const timestamp = new Date().toISOString();
    
    // Generazione del tracciato XML standard SIAN
    return `<?xml version="1.0" encoding="UTF-8"?>
<SianRegistroTelematico xmlns="http://www.sian.it/schema/vitivinicolo" versione="2.1">
  <Intestazione>
    <CodiceFiscaleDichiarante>IT00845920966</CodiceFiscaleDichiarante>
    <CodiceICQRF>ICQRF-VR-12345</CodiceICQRF>
    <DataInvio>${timestamp}</DataInvio>
  </Intestazione>
  <Operazione>
    <TipoOperazione>${declaration.operationType}</TipoOperazione>
    <DataOperazione>${declaration.date}</DataOperazione>
    <Prodotto>
      <SKU>${declaration.productSku}</SKU>
      <QuantitaEttolitri>${(declaration.quantityLiters / 100).toFixed(4)}</QuantitaEttolitri>
      <GradoAlcolico>${declaration.alcoholVolume.toFixed(2)}</GradoAlcolico>
      <LottoDichiarato>${declaration.lotNumber}</LottoDichiarato>
    </Prodotto>
    ${declaration.recipientVat ? `<Destinatario><PartitaIVA>${declaration.recipientVat}</PartitaIVA></Destinatario>` : ''}
  </Operazione>
</SianRegistroTelematico>`;
  }

  /**
   * Invia la dichiarazione ai web services del Ministero dell'Agricoltura (MIPAAF - SIAN)
   */
  async submitToSianWebService(declaration: SianDeclaration): Promise<{ success: boolean; protocolNumber?: string; error?: string }> {
    this.logger.log(`Invio operazione SIAN ${declaration.operationType} per lotto ${declaration.lotNumber}...`);
    
    try {
      const xml = this.generateSianXml(declaration);
      
      // In produzione qui si effettua una chiamata SOAP con firma digitale/certificato client.
      // Eseguiamo un mock della sottomissione
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockProtocol = 'SIAN-PROTO-' + Math.floor(100000 + Math.random() * 900000);
      this.logger.log(`Operazione inviata con successo. Protocollo: ${mockProtocol}`);

      return {
        success: true,
        protocolNumber: mockProtocol
      };
    } catch (err) {
      this.logger.error('Errore durante l\'invio a SIAN:', err);
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }
}
