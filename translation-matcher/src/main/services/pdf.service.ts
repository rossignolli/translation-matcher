import fs from 'fs';
const pdfParse = require('pdf-parse');

export class PdfService {
  /**
   * Extracts text from a PDF file using pdf-parse.
   * If text appears insufficient (scanned), OCR would be triggered here in a real implementation.
   */
  async extractText(filePath: string): Promise<{ text: string, pageCount: number, info?: any }> {
    const dataBuffer = await fs.promises.readFile(filePath);
    
    try {
      const data = await pdfParse(dataBuffer);
      
      // Basic heuristic: if text length is very low compared to page count, it might be an image scan.
      // In a full implementation, we'd trigger OCR here.
      if (data.text.trim().length < 50 && data.numpages > 0) {
        console.warn(`[PdfService] Warning: ${filePath} seems to have little text. OCR may be needed.`);
      }

      return {
        text: this.normalizeText(data.text),
        pageCount: data.numpages,
        info: data.info
      };
    } catch (error) {
      console.error(`[PdfService] Error parsing PDF ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Basic text normalization to clean up PDF artifacts
   */
  private normalizeText(text: string): string {
    return text
      .replace(/-\n/g, '') // Join hyphenated words across lines
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }
}

export const pdfService = new PdfService();
