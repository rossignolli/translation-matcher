import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { dialog, BrowserWindow } from 'electron';

export class FileSystemService {
  /**
   * Opens a file or folder picker dialog
   */
  async openFileDialog(type: 'file' | 'folder'): Promise<string | null> {
    const properties: ('openFile' | 'openDirectory')[] = type === 'folder' 
      ? ['openDirectory'] 
      : ['openFile'];

    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
      properties,
      filters: type === 'file' ? [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }] : []
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  /**
   * Recursively scans a directory for PDF files
   */
  async scanDirectoryForPDFs(dirPath: string): Promise<string[]> {
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
   * Reads an Excel manifest and returns rows
   */
  readManifest(filePath: string): any[] {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet);
  }

  /**
   * Saves content to a file
   */
  async saveFile(content: string, defaultName: string, extensions: string[]): Promise<boolean> {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
      defaultPath: defaultName,
      filters: [{ name: 'Export', extensions }]
    });

    if (result.canceled || !result.filePath) return false;

    await fs.promises.writeFile(result.filePath, content, 'utf-8');
    return true;
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
}

export const fileSystemService = new FileSystemService();
