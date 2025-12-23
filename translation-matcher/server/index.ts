import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileSystemService } from './services/filesystem.service';
import { pipelineService } from './services/pipeline.service';
import { dbService } from './services/database.service';
import { openAIService } from './services/openai.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Initialize OpenAI from environment variable if available
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-api-key-here') {
  openAIService.initialize(process.env.OPENAI_API_KEY);
  console.log('✅ OpenAI initialized from environment variable');
}

// Default upload directory - we'll move files after parsing the corpus
const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
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
    
    // Move file to corpus-specific directory
    const corpus = req.body.corpus || 'default';
    const targetDir = path.join(process.cwd(), 'data', 'uploads', corpus);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, req.file.originalname);
    fs.renameSync(req.file.path, targetPath);
    
    const result = fileSystemService.readManifest(targetPath);
    res.json({ success: true, path: targetPath, sheets: result.sheets });
  } catch (e: any) {
    console.error(`[API Error] /upload/manifest failed:`, e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

app.post('/api/upload/pdfs', upload.array('files'), (req, res) => {
  try {
    if (!req.files || (req.files as any[]).length === 0) return res.status(400).json({ error: 'No files uploaded' });
    
    // Move files to corpus-specific directory
    const corpus = req.body.corpus || 'default';
    const targetDir = path.join(process.cwd(), 'data', 'uploads', corpus);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    for (const file of req.files as Express.Multer.File[]) {
      const targetPath = path.join(targetDir, file.originalname);
      fs.renameSync(file.path, targetPath);
    }
    
    res.json({ success: true, count: (req.files as any[]).length, path: targetDir });
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

app.post('/api/pipeline/stop', (req, res) => {
  pipelineService.stopPipeline();
  res.json({ success: true });
});

app.get('/api/pipeline/status', (req, res) => {
  res.json(pipelineService.getStatus());
});

// Results API
app.get('/api/results', (req, res) => {
  try {
    // Get from candidates table (new pipeline stores results here)
    // doc_a_id now contains the formatted reference (filename + pages)
    const results = dbService.getDb().prepare(`
      SELECT 
        c.id,
        c.doc_a_id as a_reference,
        c.doc_b_id,
        c.confidence,
        c.reason,
        c.gpt_response_json as evidence_json,
        dB.filename as b_filename 
      FROM candidates c
      LEFT JOIN documents dB ON c.doc_b_id = dB.id
      WHERE c.confidence >= 0.5
      ORDER BY c.confidence DESC
    `).all() as any[];
    
    // Transform to expected format
    const transformed = results.map((r: any) => {
      const evidence = r.evidence_json ? JSON.parse(r.evidence_json) : {};
      return {
        ...r,
        a_filename: r.a_reference, // Portuguese ref (e.g., PSM1827-8s1v4f8-23)
        b_filename: r.doc_b_id || evidence.french_file || r.b_filename || 'Unknown', // French ref (e.g., GMP1833s2v1f25-30)
        match_type: evidence.verification?.match_type || 'candidate',
        article_title: evidence.article_title || '',
        portuguese_sheets: evidence.portuguese_sheets || '',
        french_sheets: evidence.french_sheets || '',
        matching_snippets: evidence.matching_snippets || []
      };
    });
    
    res.json(transformed);
  } catch (e: any) {
    console.error('Results API error:', e);
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
