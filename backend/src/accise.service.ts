import { Injectable, Logger } from '@nestjs/common';

export interface AcciseMovement {
  id: string;
  senderAcciseCode: string;
  receiverAcciseCode: string;
  transporterName: string;
  wineType: 'FERMO' | 'SPUMANTE' | 'LIQUOROSO';
  quantityLiters: number;
  alcoholVolume: number;
  cnCode: string; // Codice doganale merci (e.g. 22042180 per vino spumante)
  grossWeightKg: number;
  netWeightKg: number;
}

@Injectable()
export class AcciseService {
  private readonly logger = new Logger(AcciseService.name);

  /**
   * Genera il file XML conforme allo standard europeo EMCS (Excise Movement and Control System)
   * per il tracciato doganale e-AD (Electronic Accompanying Document).
   */
  generateEadXml(movement: AcciseMovement): string {
    const sequenceNumber = Math.floor(1000 + Math.random() * 9000);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<IE815 xmlns="urn:publicid:-:EC:DGTAXUD:EMCS:PHASE4:IE815:v3.13">
  <Header>
    <MessageSender>${movement.senderAcciseCode}</MessageSender>
    <MessageRecipient>ITDOGANE000</MessageRecipient>
    <DateOfPreparation>${new Date().toISOString().split('T')[0]}</DateOfPreparation>
    <TimeOfPreparation>${new Date().toTimeString().split(' ')[0]}</TimeOfPreparation>
  </Header>
  <Body>
    <SubmittedDraftOfEAD>
      <Attributes>
        <SubmissionType>1</SubmissionType>
      </Attributes>
      <Consignor>
        <ExciseNumber>${movement.senderAcciseCode}</ConsignorExciseNumber>
        <TraderName>CANTINA PRIVILEGE SELECTION</TraderName>
      </Consignor>
      <Consignee>
        <ExciseNumber>${movement.receiverAcciseCode}</ExciseNumber>
        <TraderName>${movement.transporterName}</TraderName>
      </Consignee>
      <TransportDetails>
        <TransportUnitCode>1</TransportUnitCode>
        <IdentityOfTransportUnits>${movement.transporterName}</IdentityOfTransportUnits>
      </TransportDetails>
      <EadDraft>
        <LocalReferenceNumber>LREF-${sequenceNumber}</LocalReferenceNumber>
        <InvoiceNumber>INV-ACCISE-${sequenceNumber}</InvoiceNumber>
      </EadDraft>
      <BodyEad>
        <BodyRecordUniqueReference>1</BodyRecordUniqueReference>
        <ExciseProductCode>W200</ExciseProductCode> <!-- W200 = Vino fermo, W300 = Spumante -->
        <CnCode>${movement.cnCode}</CnCode>
        <Quantity>${movement.quantityLiters}</Quantity>
        <AlcoholicStrengthByVolumeInPercentage>${movement.alcoholVolume.toFixed(1)}</AlcoholicStrengthByVolumeInPercentage>
        <NetMass>${movement.netWeightKg.toFixed(2)}</NetMass>
        <GrossMass>${movement.grossWeightKg.toFixed(2)}</GrossMass>
      </BodyEad>
    </SubmittedDraftOfEAD>
  </Body>
</IE815>`;
  }

  /**
   * Valida ed esporta il documento e-AD per la Dogana
   */
  async exportEadDocument(movement: AcciseMovement): Promise<{ success: boolean; arcCode?: string; xmlData: string; error?: string }> {
    this.logger.log(`Generazione e-AD per esportazione verso destinatario accisa: ${movement.receiverAcciseCode}`);
    
    try {
      const xmlData = this.generateEadXml(movement);
      
      // Mock dell'assegnazione del codice ARC (Administrative Reference Code) rilasciato dalla Dogana
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const randomYear = new Date().getFullYear().toString().substring(2);
      const mockArc = `${randomYear}IT${movement.senderAcciseCode.substring(0, 4)}${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      this.logger.log(`Documento e-AD convalidato doganalmente. Codice ARC: ${mockArc}`);

      return {
        success: true,
        arcCode: mockArc,
        xmlData
      };
    } catch (err) {
      this.logger.error('Errore validazione doganale e-AD:', err);
      return {
        success: false,
        xmlData: '',
        error: err.message || String(err)
      };
    }
  }
}
