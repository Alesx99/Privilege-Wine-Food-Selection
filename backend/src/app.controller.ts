import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  Res, 
  Header, 
  BadRequestException 
} from '@nestjs/common';
import { AppService } from './app.service';
import { generateInvoicePdf } from './pdf-generator';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  // ==========================================
  // 1. ENDPOINTS PRODOTTI
  // ==========================================
  @Get('products')
  async getProducts() {
    return this.appService.getProducts();
  }

  @Get('products/:id')
  async getProductById(@Param('id') id: string) {
    return this.appService.getProductById(id);
  }

  @Post('products')
  async saveProduct(@Body() productData: any) {
    return this.appService.saveProduct(productData);
  }

  @Post('products/merge')
  async mergeProducts(@Body() body: { targetProductId: string, sourceProductId: string }) {
    if (!body.targetProductId || !body.sourceProductId) {
      throw new BadRequestException('I parametri targetProductId e sourceProductId sono obbligatori.');
    }
    return this.appService.mergeProducts(body.targetProductId, body.sourceProductId);
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string) {
    return this.appService.deleteProduct(id);
  }

  // ==========================================
  // 2. ENDPOINTS ANAGRAFICHE (PARTNER)
  // ==========================================
  @Get('partners')
  async getPartners() {
    return this.appService.getPartners();
  }

  @Post('partners')
  async savePartner(@Body() partnerData: any) {
    return this.appService.savePartner(partnerData);
  }

  @Delete('partners/:id')
  async deletePartner(@Param('id') id: string) {
    return this.appService.deletePartner(id);
  }

  // ==========================================
  // 3. ENDPOINTS LISTINI & CALCOLO PREZZO
  // ==========================================
  @Get('price-lists')
  async getPriceLists() {
    return this.appService.getPriceLists();
  }

  @Get('calculate-price')
  async calculatePrice(
    @Query('partnerId') partnerId: string,
    @Query('productId') productId: string,
  ) {
    if (!partnerId || !productId) {
      throw new BadRequestException('partnerId e productId sono richiesti.');
    }
    return this.appService.calculatePartnerProductPrice(partnerId, productId);
  }

  // ==========================================
  // 4. ENDPOINTS DOCUMENTI (ORDINI/DDT/FATTURE)
  // ==========================================
  @Get('documents')
  async getDocuments() {
    return this.appService.getDocuments();
  }

  @Get('documents/:id')
  async getDocumentById(@Param('id') id: string) {
    return this.appService.getDocumentById(id);
  }

  @Post('documents')
  async saveDocument(@Body() docData: any) {
    return this.appService.saveDocument(docData);
  }

  @Put('documents/:id/status')
  async updateDocumentStatus(
    @Param('id') id: string,
    @Body('status') status: 'draft' | 'completed' | 'cancelled',
  ) {
    if (!status) throw new BadRequestException('status è richiesto.');
    return this.appService.updateDocumentStatus(id, status);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    return this.appService.deleteDocument(id);
  }

  // ==========================================
  // 5. GENERAZIONE PDF INTERATTIVO (STREAM)
  // ==========================================
  @Get('documents/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: any) {
    const docFull = await this.appService.getDocumentById(id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=documento_${docFull.number.replace(/\//g, '_')}.pdf`,
    );

    generateInvoicePdf(res, docFull, docFull.partner, docFull.items);
  }

  // ==========================================
  // 6. ESPORTAZIONE BACKUP CSV (PRODOTTI / PARTNER)
  // ==========================================
  @Get('export/:table')
  async exportCsv(@Param('table') table: string, @Res() res: any) {
    let data: any[] = [];
    if (table === 'products') {
      data = await this.appService.getProducts();
    } else if (table === 'partners') {
      data = await this.appService.getPartners();
    } else {
      throw new BadRequestException('Tabella non valida per l\'esportazione.');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${table}_export.csv`);

    if (data.length === 0) {
      res.send('');
      return;
    }

    // Custom CSV writer
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        const stringVal = val === null || val === undefined ? '' : '' + val;
        // Escape quotes
        const escaped = stringVal.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    res.send(csvRows.join('\n'));
  }

  // ==========================================
  // 7. IMPORTATORE FILE XML FATTURA ELETTRONICA
  // ==========================================
  @Post('import/xml')
  async importXml(@Body('xml') xml: string) {
    if (!xml) throw new BadRequestException('Contenuto XML richiesto.');
    return this.appService.importXmlInvoice(xml);
  }

  // ==========================================
  // 8. ENDPOINTS ENTERPRISE (DEPOSITI / AGENTI / EXPORTS / RICONCILIAZIONE)
  // ==========================================
  @Get('warehouses')
  async getWarehouses() {
    return this.appService.getWarehouses();
  }

  @Get('agents')
  async getAgents() {
    return this.appService.getAgents();
  }

  @Post('agents')
  async saveAgent(@Body() agentData: any) {
    return this.appService.saveAgent(agentData);
  }

  @Get('agents/commissions')
  async getCommissions() {
    return this.appService.getCommissions();
  }

  @Get('documents/:id/sian')
  @Header('Content-Type', 'application/xml')
  @Header('Content-Disposition', 'attachment; filename=dichiarazione_sian.xml')
  async exportSian(@Param('id') id: string) {
    return this.appService.exportSianXml(id);
  }

  @Get('documents/:id/accise')
  @Header('Content-Type', 'application/xml')
  @Header('Content-Disposition', 'attachment; filename=documento_ead_accise.xml')
  async exportAccise(@Param('id') id: string) {
    return this.appService.exportAcciseXml(id);
  }

  @Post('reconciliation/upload')
  async reconcileBankFile(@Body('fileContent') fileContent: string) {
    if (!fileContent) throw new BadRequestException('Contenuto del file bancario richiesto.');
    return this.appService.reconcileBankFile(fileContent);
  }

  @Post('documents/approve-all-drafts')
  async approveAllDrafts() {
    return this.appService.approveAllDrafts();
  }
}
