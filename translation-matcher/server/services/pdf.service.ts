import fs from 'fs';
const pdfParse = require('pdf-parse');

export class PdfService {
  /**
   * Extracts text from a PDF file using pdf-parse.
   */
  async extractText(filePath: string): Promise<{ text: string, pageCount: number, info?: any }> {
    const dataBuffer = await fs.promises.readFile(filePath);
    
    try {
      const data = await pdfParse(dataBuffer);
      
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

  private normalizeText(text: string): string {
    return text
      .replace(/-\n/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const pdfService = new PdfService();
