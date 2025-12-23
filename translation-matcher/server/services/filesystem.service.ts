import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as xlsx from 'xlsx';

export class FileSystemService {
  /**
   * Recursively scans a directory for PDF files.
   * Now takes an absolute path string directly.
   */
  async scanDirectoryForPDFs(dirPath: string): Promise<string[]> {
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory not found: ${dirPath}`);
      return [];
    }
    
    let results: string[] = [];
    const list = await fs.promises.readdir(dirPath);

    for (const file of list) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.promises.stat(filePath);

      if (stat && stat.isDirectory()) {
        results = results.concat(await this.scanDirectoryForPDFs(filePath));
      } else if (file.toLowerCase().endsWith('.pdf')) {
        results.push(filePath);
      }
    }
    return results;
  }

  /**
   * Reads an Excel manifest and returns all sheets with their data and columns
   */
  readManifest(filePath: string): { sheets: { name: string; columns: string[]; data: any[] }[] } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }
    const workbook = xlsx.readFile(filePath);
    
    const sheets = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      const columns = data.length > 0 ? Object.keys(data[0] as object) : [];
      return {
        name: sheetName,
        columns,
        data
      };
    });
    
    return { sheets };
  }

  /**
   * Saves content to a file
   */
  async saveFile(content: string, filename: string): Promise<string> {
    const exportsDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const filePath = path.join(exportsDir, filename);
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Generates a SHA-256 hash of a file for change detection
   */
  async getFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }


  /**
   * Lists contents of a directory for the file picker
   */
  async listDirectory(dirPath?: string): Promise<{ parent: string, current: string, items: any[] }> {
    const targetPath = dirPath ? path.resolve(dirPath) : process.cwd();
    
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Directory not found: ${targetPath}`);
    }

    const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
    
    const items = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(targetPath, entry.name)
    })).sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
    });

    return {
        parent: path.dirname(targetPath),
        current: targetPath,
        items
    };
  }
}

export const fileSystemService = new FileSystemService();
