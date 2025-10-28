// src/lib/export-manager.ts
import { DomainTx } from '@/domain/tx';
import { safeStringify } from '@/lib/utils';

export interface ExportOptions {
  format: 'json' | 'yaml' | 'csv' | 'xml' | 'txt' | 'html' | 'pdf';
  includeHex?: boolean;
  includeMetadata?: boolean;
  includeScripts?: boolean;
  includeValidation?: boolean;
  includeCbor?: boolean;
  prettyPrint?: boolean;
  timestamp?: boolean;
}

export interface ExportData {
  transaction: DomainTx;
  hex?: string;
  metadata?: any[];
  scripts?: any[];
  validation?: any[];
  cbor?: any[];
  timestamp?: string;
}

export class ExportManager {
  private static instance: ExportManager;
  
  static getInstance(): ExportManager {
    if (!ExportManager.instance) {
      ExportManager.instance = new ExportManager();
    }
    return ExportManager.instance;
  }

  async exportTransaction(
    tx: DomainTx, 
    txHex: string, 
    options: ExportOptions
  ): Promise<Blob> {
    const data = this.prepareExportData(tx, txHex, options);
    
    switch (options.format) {
      case 'json':
        return this.exportAsJSON(data, options);
      case 'yaml':
        return this.exportAsYAML(data, options);
      case 'csv':
        return this.exportAsCSV(data, options);
      case 'xml':
        return this.exportAsXML(data, options);
      case 'txt':
        return this.exportAsTXT(data, options);
      case 'html':
        return this.exportAsHTML(data, options);
      case 'pdf':
        return this.exportAsPDF(data, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private prepareExportData(tx: DomainTx, txHex: string, options: ExportOptions): ExportData {
    const data: ExportData = { transaction: tx };
    
    if (options.includeHex) {
      data.hex = txHex;
    }
    
    if (options.includeMetadata && tx.metadata) {
      data.metadata = tx.metadata;
    }
    
    if (options.includeScripts && tx.scripts) {
      data.scripts = tx.scripts;
    }
    
    if (options.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    
    return data;
  }

  private exportAsJSON(data: ExportData, options: ExportOptions): Blob {
    const jsonString = safeStringify(data, options.prettyPrint ? 2 : 0);
    
    return new Blob([jsonString], { type: 'application/json' });
  }

  private async exportAsYAML(data: ExportData, options: ExportOptions): Promise<Blob> {
    // For now, we'll convert to JSON and format as YAML-like structure
    // In a real implementation, you'd use a YAML library like js-yaml
    const yamlString = this.convertToYAML(data);
    return new Blob([yamlString], { type: 'text/yaml' });
  }

  private exportAsCSV(data: ExportData, options: ExportOptions): Blob {
    const csvRows: string[] = [];
    
    // Transaction basic info
    csvRows.push('Field,Value');
    csvRows.push(`ID,${data.transaction.id}`);
    csvRows.push(`Size (bytes),${data.transaction.sizeBytes}`);
    csvRows.push(`Fee (lovelace),${data.transaction.feeLovelace}`);
    csvRows.push(`TTL,${data.transaction.ttl}`);
    csvRows.push(`Slot,${data.transaction.slot}`);
    
    // Inputs
    if (data.transaction.inputs.length > 0) {
      csvRows.push('');
      csvRows.push('Inputs');
      csvRows.push('Index,TxId,Address,Value (lovelace)');
      data.transaction.inputs.forEach((input, index) => {
        csvRows.push(`${index},${input.txId},${input.resolved?.address || 'N/A'},${input.resolved?.value?.ada || 0}`);
      });
    }
    
    // Outputs
    if (data.transaction.outputs.length > 0) {
      csvRows.push('');
      csvRows.push('Outputs');
      csvRows.push('Index,Address,Value (lovelace),Assets');
      data.transaction.outputs.forEach((output, index) => {
        const assets = output.assets.length > 0 ? output.assets.map(a => `${a.policyId}.${a.assetName}:${a.quantity}`).join(';') : 'None';
        csvRows.push(`${index},${output.address},${output.ada},${assets}`);
      });
    }
    
    return new Blob([csvRows.join('\n')], { type: 'text/csv' });
  }

  private exportAsXML(data: ExportData, options: ExportOptions): Blob {
    const xmlString = this.convertToXML(data);
    return new Blob([xmlString], { type: 'application/xml' });
  }

  private exportAsTXT(data: ExportData, options: ExportOptions): Blob {
    const txtLines: string[] = [];
    
    txtLines.push('CARDANO TRANSACTION INSPECTOR REPORT');
    txtLines.push('=====================================');
    txtLines.push('');
    
    // Basic info
    txtLines.push('TRANSACTION DETAILS:');
    txtLines.push(`  ID: ${data.transaction.id}`);
    txtLines.push(`  Size: ${data.transaction.sizeBytes} bytes`);
    txtLines.push(`  Fee: ${data.transaction.feeLovelace} lovelace`);
    txtLines.push(`  TTL: ${data.transaction.ttl}`);
    txtLines.push(`  Slot: ${data.transaction.slot}`);
    txtLines.push('');
    
    // Inputs
    if (data.transaction.inputs.length > 0) {
      txtLines.push('INPUTS:');
      data.transaction.inputs.forEach((input, index) => {
        txtLines.push(`  ${index + 1}. ${input.txId}`);
        txtLines.push(`     Address: ${input.resolved?.address || 'N/A'}`);
        txtLines.push(`     Value: ${input.resolved?.value?.ada || 0} lovelace`);
      });
      txtLines.push('');
    }
    
    // Outputs
    if (data.transaction.outputs.length > 0) {
      txtLines.push('OUTPUTS:');
      data.transaction.outputs.forEach((output, index) => {
        txtLines.push(`  ${index + 1}. ${output.address}`);
        txtLines.push(`     Value: ${output.ada} lovelace`);
        if (output.assets.length > 0) {
          txtLines.push(`     Assets: ${output.assets.map(a => `${a.policyId}.${a.assetName}:${a.quantity}`).join(', ')}`);
        }
      });
      txtLines.push('');
    }
    
    // Metadata
    if (data.metadata && data.metadata.length > 0) {
      txtLines.push('METADATA:');
      data.metadata.forEach((meta, index) => {
        txtLines.push(`  ${index + 1}. Label ${meta.label}`);
        if (meta.json) {
          txtLines.push(`     JSON: ${safeStringify(meta.json, 2).replace(/\n/g, '\n     ')}`);
        }
      });
      txtLines.push('');
    }
    
    if (data.timestamp) {
      txtLines.push(`Generated: ${data.timestamp}`);
    }
    
    return new Blob([txtLines.join('\n')], { type: 'text/plain' });
  }

  private exportAsHTML(data: ExportData, options: ExportOptions): Blob {
    const htmlString = this.convertToHTML(data);
    return new Blob([htmlString], { type: 'text/html' });
  }

  private async exportAsPDF(data: ExportData, options: ExportOptions): Promise<Blob> {
    // For now, we'll create an HTML version that can be printed to PDF
    // In a real implementation, you'd use a library like jsPDF or Puppeteer
    const htmlString = this.convertToHTML(data, true); // PDF-optimized
    return new Blob([htmlString], { type: 'text/html' });
  }

  private convertToYAML(data: ExportData): string {
    // Simplified YAML conversion
    const lines: string[] = [];
    
    lines.push('transaction:');
    lines.push(`  id: "${data.transaction.id}"`);
    lines.push(`  sizeBytes: ${data.transaction.sizeBytes}`);
    lines.push(`  feeLovelace: "${data.transaction.feeLovelace}"`);
    lines.push(`  ttl: ${data.transaction.ttl}`);
    lines.push(`  slot: ${data.transaction.slot}`);
    
    if (data.hex) {
      lines.push(`hex: "${data.hex}"`);
    }
    
    if (data.timestamp) {
      lines.push(`timestamp: "${data.timestamp}"`);
    }
    
    return lines.join('\n');
  }

  private convertToXML(data: ExportData): string {
    const lines: string[] = [];
    
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<transaction>');
    lines.push(`  <id>${data.transaction.id}</id>`);
    lines.push(`  <sizeBytes>${data.transaction.sizeBytes}</sizeBytes>`);
    lines.push(`  <feeLovelace>${data.transaction.feeLovelace}</feeLovelace>`);
    lines.push(`  <ttl>${data.transaction.ttl}</ttl>`);
    lines.push(`  <slot>${data.transaction.slot}</slot>`);
    
    if (data.hex) {
      lines.push(`  <hex><![CDATA[${data.hex}]]></hex>`);
    }
    
    if (data.timestamp) {
      lines.push(`  <timestamp>${data.timestamp}</timestamp>`);
    }
    
    lines.push('</transaction>');
    
    return lines.join('\n');
  }

  private convertToHTML(data: ExportData, forPDF: boolean = false): string {
    const styles = forPDF ? `
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        .header { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 20px; }
        .section h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .item { margin: 5px 0; padding: 5px; background: #f9f9f9; border-radius: 3px; }
        .label { font-weight: bold; color: #666; }
        .value { margin-left: 10px; }
        @media print { body { margin: 0; } }
      </style>
    ` : `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #fafafa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin-bottom: 25px; }
        .section h3 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 15px; }
        .item { margin: 8px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #667eea; }
        .label { font-weight: 600; color: #495057; }
        .value { margin-left: 10px; color: #212529; }
        .hex { font-family: 'Monaco', 'Menlo', monospace; background: #f1f3f4; padding: 8px; border-radius: 4px; word-break: break-all; }
      </style>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cardano Transaction Report</title>
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cardano Transaction Inspector Report</h1>
            <p>Transaction ID: ${data.transaction.id}</p>
            ${data.timestamp ? `<p>Generated: ${data.timestamp}</p>` : ''}
          </div>
          
          <div class="section">
            <h3>Transaction Details</h3>
            <div class="item">
              <span class="label">Size:</span>
              <span class="value">${data.transaction.sizeBytes} bytes</span>
            </div>
            <div class="item">
              <span class="label">Fee:</span>
              <span class="value">${data.transaction.feeLovelace} lovelace</span>
            </div>
            <div class="item">
              <span class="label">TTL:</span>
              <span class="value">${data.transaction.ttl}</span>
            </div>
            <div class="item">
              <span class="label">Slot:</span>
              <span class="value">${data.transaction.slot}</span>
            </div>
          </div>
          
          ${data.transaction.inputs.length > 0 ? `
          <div class="section">
            <h3>Inputs (${data.transaction.inputs.length})</h3>
            ${data.transaction.inputs.map((input, index) => `
              <div class="item">
                <div class="label">Input ${index + 1}:</div>
                <div class="value">${input.txId}</div>
                <div class="value">Address: ${input.resolved?.address || 'N/A'}</div>
                <div class="value">Value: ${input.resolved?.value?.ada || 0} lovelace</div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${data.transaction.outputs.length > 0 ? `
          <div class="section">
            <h3>Outputs (${data.transaction.outputs.length})</h3>
            ${data.transaction.outputs.map((output, index) => `
              <div class="item">
                <div class="label">Output ${index + 1}:</div>
                <div class="value">Address: ${output.address}</div>
                <div class="value">Value: ${output.ada} lovelace</div>
                ${output.assets.length > 0 ? `
                  <div class="value">Assets: ${output.assets.map(a => `${a.policyId}.${a.assetName}:${a.quantity}`).join(', ')}</div>
                ` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${data.hex ? `
          <div class="section">
            <h3>Transaction Hex</h3>
            <div class="hex">${data.hex}</div>
          </div>
          ` : ''}
          
          ${data.metadata && data.metadata.length > 0 ? `
          <div class="section">
            <h3>Metadata (${data.metadata.length} entries)</h3>
            ${data.metadata.map((meta, index) => `
              <div class="item">
                <div class="label">Label ${meta.label}:</div>
                <div class="value">${meta.json ? safeStringify(meta.json, 2) : 'No JSON data'}</div>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
    
    return html;
  }

  getSupportedFormats(): string[] {
    return ['json', 'yaml', 'csv', 'xml', 'txt', 'html', 'pdf'];
  }

  getFormatDescription(format: string): string {
    const descriptions: Record<string, string> = {
      'json': 'JSON format - Machine readable, includes all data',
      'yaml': 'YAML format - Human readable, structured data',
      'csv': 'CSV format - Spreadsheet compatible, basic transaction data',
      'xml': 'XML format - Structured markup, includes all data',
      'txt': 'Text format - Plain text report, human readable',
      'html': 'HTML format - Web page with styling, interactive',
      'pdf': 'PDF format - Print-ready document, professional layout'
    };
    
    return descriptions[format] || 'Unknown format';
  }
}
