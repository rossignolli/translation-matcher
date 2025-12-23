import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export class PdfService {
  /**
   * Extracts text from a PDF file using pdf-parse v2.
   */
  async extractText(filePath: string): Promise<{ text: string, pageCount: number, info?: any }> {
    const dataBuffer = await fs.promises.readFile(filePath);
    
    const parser = new PDFParse({ data: dataBuffer });
    
    try {
      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();
      
      if (textResult.text.trim().length < 50 && textResult.total > 0) {
        console.warn(`[PdfService] Warning: ${filePath} seems to have little text. OCR may be needed.`);
      }

      await parser.destroy();

      return {
        text: this.normalizeText(textResult.text),
        pageCount: textResult.total,
        info: infoResult.info
      };
    } catch (error) {
      await parser.destroy();
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
