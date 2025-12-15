import { dbService } from './database.service';
import { openAIService } from './openai.service';
import { pdfService } from './pdf.service';
import { fileSystemService } from './filesystem.service';
import EventEmitter from 'events';

export class PipelineService extends EventEmitter {
  private isRunning = false;

  async startPipeline(config: any) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log('Pipeline started...');

    try {
      if (config.ai.apiKey) {
        openAIService.initialize(config.ai.apiKey);
      }

      // Step 1: Index Corpus B
      await this.indexCorpus(config.corpusB, 'B', config.ai);

      // Step 2: Index Corpus A
      await this.indexCorpus(config.corpusA, 'A', config.ai);

      // Step 3: Match Candidates
      await this.findCandidates(config.ai);

      // Step 4: Verify Matches
      await this.verifyMatches(config.ai);

      // Step 5: Citation Generation
      await this.generateCitations(config.ai);

      this.log('Pipeline completed successfully.');
    } catch (error: any) {
      this.log(`Pipeline error: ${error.message}`);
      console.error(error);
    } finally {
      this.isRunning = false;
    }
  }

  private async indexCorpus(corpusConfig: any, type: 'A' | 'B', aiConfig: any) {
    this.log(`Indexing Corpus ${type}...`);
    const files = await fileSystemService.scanDirectoryForPDFs(corpusConfig.pdfFolder);
    
    for (const file of files) {
      if (!this.isRunning) break;
      const fileHash = await fileSystemService.getFileHash(file);
      
      const existing = dbService.getDb().prepare('SELECT * FROM documents WHERE id = ?').get(fileHash);
      if (existing) {
        this.log(`Skipping cached ${type}: ${file}`);
        continue;
      }

      this.log(`Processing ${type}: ${file}`);
      const { text } = await pdfService.extractText(file);
      
      const prompt = type === 'B' 
        ? PROMPTS.INDEX_B(text.substring(0, 15000)) 
        : PROMPTS.INDEX_A(text.substring(0, 15000));

      const indexData = await openAIService.generateCompletion(
        aiConfig.indexingModel,
        "You are an expert archivist.",
        prompt
      );

      dbService.getDb().prepare(`
        INSERT INTO documents (id, corpus, filename, path, extracted_text, gpt_index_json, status)
        VALUES (?, ?, ?, ?, ?, ?, 'indexed')
      `).run(fileHash, type, file, file, text, JSON.stringify(indexData));
    }
  }

  private async findCandidates(aiConfig: any) {
    this.log('Finding candidates (Step 3)...');
    const docsA = dbService.getDb().prepare("SELECT * FROM documents WHERE corpus = 'A'").all();
    const docsB = dbService.getDb().prepare("SELECT * FROM documents WHERE corpus = 'B'").all();

    for (const docA of docsA as any[]) {
      if (!this.isRunning) break;
      this.log(`Finding matches for: ${docA.filename}`);
      
      const bSummaries = docsB.map((d: any) => ({
        id: d.id,
        index: JSON.parse(d.gpt_index_json)
      }));

      const prompt = PROMPTS.CANDIDATE_SELECTION(
        JSON.parse(docA.gpt_index_json),
        bSummaries
      );

      const response = await openAIService.generateCompletion(
        aiConfig.matchingModel,
        "You are a comparative literature expert.",
        prompt
      );

      if (response && response.candidates) {
        for (const cand of response.candidates) {
          dbService.getDb().prepare(`
            INSERT INTO candidates (doc_a_id, doc_b_id, reason, confidence, gpt_response_json)
            VALUES (?, ?, ?, ?, ?)
          `).run(docA.id, cand.b_doc_id, cand.reason, cand.confidence, JSON.stringify(cand));
        }
      }
    }
  }

  private async verifyMatches(aiConfig: any) {
    this.log('Verifying matches (Step 4)...');
    const candidates = dbService.getDb().prepare("SELECT * FROM candidates WHERE confidence > 0.6").all();

    for (const cand of candidates as any[]) {
      if (!this.isRunning) break;
      const docA = dbService.getDb().prepare("SELECT * FROM documents WHERE id = ?").get(cand.doc_a_id) as any;
      const docB = dbService.getDb().prepare("SELECT * FROM documents WHERE id = ?").get(cand.doc_b_id) as any;
      
      this.log(`Verifying: ${docA.filename} vs ${docB.filename}`);

      const prompt = PROMPTS.VERIFICATION(
        docA.extracted_text.substring(0, 5000), 
        docB.extracted_text.substring(0, 5000)
      );

      const verification = await openAIService.generateCompletion(
        aiConfig.verificationModel,
        "You are a translation detective.",
        prompt
      );

      if (verification.match_type !== 'no_match') {
          dbService.getDb().prepare(`
            INSERT INTO matches (doc_a_id, doc_b_id, match_type, confidence, evidence_json)
            VALUES (?, ?, ?, ?, ?)
          `).run(cand.doc_a_id, cand.doc_b_id, verification.match_type, verification.confidence, JSON.stringify(verification));
          
          this.log(`MATCH FOUND: ${docA.filename} -> ${docB.filename}`);
      }
    }
  }

  private async generateCitations(aiConfig: any) {
    this.log('Generating citations (Step 5)...');
    const matches = dbService.getDb().prepare("SELECT * FROM matches WHERE citation_json IS NULL").all();

    for (const match of matches as any[]) {
      if (!this.isRunning) break;
      const docB = dbService.getDb().prepare("SELECT * FROM documents WHERE id = ?").get(match.doc_b_id) as any;
      
      const prompt = PROMPTS.CITATION(JSON.parse(docB.gpt_index_json));
      const citation = await openAIService.generateCompletion(
        aiConfig.verificationModel,
        "You are a bibliographer.",
        prompt
      );

      dbService.getDb().prepare("UPDATE matches SET citation_json = ? WHERE id = ?")
        .run(JSON.stringify(citation), match.id);
        
      this.log(`Citation generated for match ID: ${match.id}`);
    }
  }

  private log(message: string) {
    console.log(`[Pipeline] ${message}`);
    this.emit('log', message);
  }
}

const PROMPTS = {
  INDEX_B: (text: string) => `
    Analyze this text from 19th-century French/English corpus.
    Produce JSON: { "b_doc_id": "HASH", "filename": "...", "languages_detected": [], "document_summary": "...", "keywords": [], "estimated_date_or_year": "..." }
    Text: ${text}
  `,
  INDEX_A: (text: string) => `
    Analyze this text from 19th-century Brazilian Portuguese corpus.
    Produce JSON: { "a_doc_id": "HASH", "filename": "...", "document_summary_pt": "...", "keywords_pt": [], "estimated_date_or_year": "..." }
    Text: ${text}
  `,
  CANDIDATE_SELECTION: (docA: any, docsB: any[]) => `
    Target (A): ${JSON.stringify(docA)}
    Potential Sources (B): ${JSON.stringify(docsB)}
    
    Return JSON: { "candidates": [ { "b_doc_id": "...", "reason": "...", "confidence": 0.0-1.0 } ] }
  `,
  VERIFICATION: (textA: string, textB: string) => `
    Compare these two texts.
    Text A: ${textA}
    Text B: ${textB}
    Is A a translation of B?
    Return JSON: { "match_type": "direct_translation|partial_translation|adaptation|no_match", "confidence": 0.0-1.0, "explanation": "..." }
  `,
  CITATION: (docBIndex: any) => `
    Generate Chicago bibliography.
    Metadata: ${JSON.stringify(docBIndex)}
    Return JSON: { "b_doc_id": "${docBIndex.b_doc_id}", "chicago_bibliography": "...", "fields": { "author": "...", "title": "...", "date": "..." } }
  `
};

export const pipelineService = new PipelineService();
