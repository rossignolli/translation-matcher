import express from 'express';
import cors from 'cors';
import { fileSystemService } from './services/filesystem.service';
import { pipelineService } from './services/pipeline.service';
import { dbService } from './services/database.service';
import { openAIService } from './services/openai.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', req.body.corpus || 'default');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename but prevent duplicates if needed
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// SSE Stream for Logs
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onLog = (msg: string) => {
    res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);
  };

  pipelineService.on('log', onLog);

  req.on('close', () => {
    pipelineService.off('log', onLog);
  });
});



app.post('/api/upload/manifest', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const data = fileSystemService.readManifest(req.file.path);
    res.json({ success: true, path: req.file.path, data });
  } catch (e: any) {
    console.error(`[API Error] /upload/manifest failed:`, e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

app.post('/api/upload/pdfs', upload.array('files'), (req, res) => {
  try {
    if (!req.files || (req.files as any[]).length === 0) return res.status(400).json({ error: 'No files uploaded' });
    // Return the directory path where files were saved
    const corpus = req.body.corpus || 'default';
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', corpus);
    res.json({ success: true, count: (req.files as any[]).length, path: uploadDir });
  } catch (e: any) {
    console.error(`[API Error] /upload/pdfs failed:`, e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

// Deprecated but kept for backward compatibility if needed
app.post('/api/fs/read-excel', (req, res) => {
  try {
    const { path } = req.body;
    const data = fileSystemService.readManifest(path);
    res.json(data);
  } catch (e: any) {
    console.error(`[API Error] /fs/read-excel failed for path '${req.body.path}':`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fs/export', async (req, res) => {
  try {
    const { content, filename } = req.body;
    const filePath = await fileSystemService.saveFile(content, filename);
    res.json({ success: true, path: filePath });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// AI & Pipeline APIs
app.post('/api/ai/test', async (req, res) => {
  const { apiKey } = req.body;
  openAIService.initialize(apiKey);
  const success = await openAIService.testConnection();
  res.json({ success });
});

app.post('/api/pipeline/start', (req, res) => {
  const config = req.body;
  pipelineService.startPipeline(config);
  res.json({ success: true });
});

// Results API
app.get('/api/results', (req, res) => {
  try {
    const results = dbService.getDb().prepare(`
      SELECT 
        m.*, 
        dA.filename as a_filename, 
        dB.filename as b_filename 
      FROM matches m
      JOIN documents dA ON m.doc_a_id = dA.id
      JOIN documents dB ON m.doc_b_id = dB.id
      ORDER BY m.confidence DESC
    `).all();
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Helper to keep process alive if something is closing it unexpectedly
process.stdin.resume();

process.on('uncaughtException', (err) => {
   console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});
