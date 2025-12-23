import { dbService } from './database.service';
import { openAIService } from './openai.service';
import { pdfService } from './pdf.service';
import { fileSystemService } from './filesystem.service';
import EventEmitter from 'events';

interface Article {
  title: string;
  filename: string;
  sheets: string;
  text: string;
  rowData: any;
}

interface CorpusBDoc {
  id: string;
  filename: string;
  text: string;
}

export class PipelineService extends EventEmitter {
  private isRunning = false;
  private stopRequested = false;
  private corpusBTexts: Map<string, CorpusBDoc> = new Map();
  private corpusAArticles: Article[] = [];

  stopPipeline() {
    if (this.isRunning) {
      this.stopRequested = true;
      this.log('⏹️ Stop requested... finishing current item...');
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      stopRequested: this.stopRequested
    };
  }

  async startPipeline(config: any) {
    if (this.isRunning) {
      this.log('⚠️ Pipeline already running, skipping...');
      return;
    }
    this.isRunning = true;
    this.stopRequested = false;
    this.log('🚀 Pipeline started...');
    this.log(`📋 Corpus A folder: ${config.corpusA?.pdfFolder}`);
    this.log(`📋 Corpus B folder: ${config.corpusB?.pdfFolder}`);

    try {
      if (config.ai.apiKey) {
        this.log('🔑 Initializing OpenAI with provided API key...');
        openAIService.initialize(config.ai.apiKey);
      } else if (openAIService.isConnected()) {
        this.log('🔑 Using OpenAI API key from environment...');
      } else {
        this.log('⚠️ No API key provided!');
        return;
      }

      // Step 1: Extract all texts from Corpus B (French)
      this.log('═══════════════════════════════════════');
      this.log('📚 STEP 1: Extracting Corpus B (French)');
      this.log('═══════════════════════════════════════');
      await this.extractCorpusB(config.corpusB);

      if (this.stopRequested) {
        this.log('═══════════════════════════════════════');
        this.log('⏹️ Pipeline stopped by user. Partial results available.');
        this.log('═══════════════════════════════════════');
        return;
      }

      // Step 2: Process Corpus A with Excel index
      this.log('═══════════════════════════════════════');
      this.log('📚 STEP 2: Processing Corpus A (Portuguese) with Excel Index');
      this.log('═══════════════════════════════════════');
      await this.processCorpusAWithIndex(config.corpusA);

      if (this.stopRequested) {
        this.log('═══════════════════════════════════════');
        this.log('⏹️ Pipeline stopped by user. Partial results available.');
        this.log('═══════════════════════════════════════');
        return;
      }

      // Step 3: Find Match Candidates
      this.log('═══════════════════════════════════════');
      this.log('🔍 STEP 3: Finding Match Candidates');
      this.log('═══════════════════════════════════════');
      await this.findMatchCandidates(config.ai);

      this.log('═══════════════════════════════════════');
      if (this.stopRequested) {
        this.log('⏹️ Pipeline stopped by user. Partial results available.');
      } else {
        this.log('🎉 Pipeline completed successfully!');
      }
      this.log('═══════════════════════════════════════');
    } catch (error: any) {
      this.log(`❌ Pipeline error: ${error.message}`);
      this.log(`📍 Stack: ${error.stack?.split('\n').slice(0, 3).join(' | ')}`);
      console.error(error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Step 1: Extract all texts from Corpus B (French source documents)
   * Keep in cache for matching
   */
  private async extractCorpusB(corpusConfig: any) {
    this.log(`📂 Extracting texts from Corpus B (French)...`);
    this.log(`   → PDF Folder: ${corpusConfig?.pdfFolder || 'NOT SET'}`);
    
    if (!corpusConfig?.pdfFolder) {
      this.log(`   ⚠️ No PDF folder configured for Corpus B!`);
      return;
    }
    
    const files = await fileSystemService.scanDirectoryForPDFs(corpusConfig.pdfFolder);
    this.log(`   → Found ${files.length} PDFs`);
    
    if (files.length === 0) {
      this.log(`   ❌ No PDF files found in Corpus B!`);
      return;
    }

    this.corpusBTexts.clear();
    let processed = 0;
    let errors = 0;
    
    for (const file of files) {
      if (!this.isRunning) break;
      
      const fileName = file.split('/').pop() || file;
      
      try {
        const fileHash = await fileSystemService.getFileHash(file);
        
        // Check cache first
        const existing = dbService.getDb().prepare(
          'SELECT * FROM documents WHERE id = ? AND corpus = ?'
        ).get(fileHash, 'B') as any;
        
        if (existing && existing.extracted_text) {
          this.log(`   ⏭️ [${processed + 1}/${files.length}] Using cached: ${fileName}`);
          this.corpusBTexts.set(fileHash, {
            id: fileHash,
            filename: fileName,
            text: existing.extracted_text
          });
          processed++;
          continue;
        }

        this.log(`   📄 [${processed + 1}/${files.length}] Extracting: ${fileName}`);
        const { text } = await pdfService.extractText(file);
        this.log(`      → Extracted ${text.length} characters`);
        
        // Store in database for caching
        dbService.getDb().prepare(`
          INSERT OR REPLACE INTO documents (id, corpus, filename, path, extracted_text, status)
          VALUES (?, 'B', ?, ?, ?, 'extracted')
        `).run(fileHash, fileName, file, text);
        
        // Store in memory for matching
        this.corpusBTexts.set(fileHash, {
          id: fileHash,
          filename: fileName,
          text: text
        });
        
        processed++;
      } catch (err: any) {
        this.log(`      ❌ Error extracting ${fileName}: ${err.message}`);
        errors++;
      }
    }
    
    this.log(`   📊 Corpus B Summary: ${processed} extracted, ${errors} errors`);
    this.log(`   💾 ${this.corpusBTexts.size} French documents loaded in cache`);
  }

  /**
   * Step 2: Process Corpus A using Excel index
   * The Excel file indexes articles within each PDF file
   */
  private async processCorpusAWithIndex(corpusConfig: any) {
    this.log(`📂 Processing Corpus A with Excel index...`);
    this.log(`   → PDF Folder: ${corpusConfig?.pdfFolder || 'NOT SET'}`);
    this.log(`   → Excel Path: ${corpusConfig?.excelPath || 'NOT SET'}`);
    this.log(`   → Sheets: ${corpusConfig?.sheets?.length || 0}`);
    
    if (!corpusConfig?.pdfFolder) {
      this.log(`   ⚠️ No PDF folder configured for Corpus A!`);
      return;
    }

    this.corpusAArticles = [];
    
    // Get all PDF files
    const pdfFiles = await fileSystemService.scanDirectoryForPDFs(corpusConfig.pdfFolder);
    this.log(`   → Found ${pdfFiles.length} PDFs in folder`);
    
    // Create a map of filename -> path for quick lookup
    const pdfMap = new Map<string, string>();
    for (const file of pdfFiles) {
      const fileName = file.split('/').pop() || '';
      const baseName = fileName.replace('.pdf', '').replace('.PDF', '');
      pdfMap.set(baseName.toLowerCase(), file);
      pdfMap.set(fileName.toLowerCase(), file);
    }
    
    // Process each configured sheet from the Excel index
    for (const sheet of corpusConfig.sheets || []) {
      if (!sheet.selected || !sheet.filenameColumn) continue;
      
      this.log(`   📋 Processing sheet: ${sheet.name}`);
      this.log(`      → Filename column: ${sheet.filenameColumn}`);
      
      // Read the Excel data
      const excelData = fileSystemService.readManifest(corpusConfig.excelPath);
      const sheetData = excelData.sheets.find(s => s.name === sheet.name);
      
      if (!sheetData) {
        this.log(`      ⚠️ Sheet "${sheet.name}" not found in Excel`);
        continue;
      }
      
      this.log(`      → Found ${sheetData.data.length} rows in Excel`);
      
      // Group rows by filename to process PDFs efficiently
      const rowsByFile = new Map<string, any[]>();
      for (const row of sheetData.data) {
        const fileRef = row[sheet.filenameColumn] as string;
        if (!fileRef) continue;
        
        const baseName = fileRef.replace('.pdf', '').replace('.PDF', '').toLowerCase();
        if (!rowsByFile.has(baseName)) {
          rowsByFile.set(baseName, []);
        }
        rowsByFile.get(baseName)!.push(row);
      }
      
      this.log(`      → Found references to ${rowsByFile.size} unique files`);
      
      // Process each PDF file
      let articlesFound = 0;
      for (const [baseName, rows] of rowsByFile) {
        const pdfPath = pdfMap.get(baseName);
        if (!pdfPath) {
          this.log(`      ⚠️ PDF not found for: ${baseName}`);
          continue;
        }
        
        const fileName = pdfPath.split('/').pop() || baseName;
        
        try {
          // Extract text from PDF (use cache if available)
          const fileHash = await fileSystemService.getFileHash(pdfPath);
          let text: string;
          
          const existing = dbService.getDb().prepare(
            'SELECT extracted_text FROM documents WHERE id = ? AND corpus = ?'
          ).get(fileHash, 'A') as any;
          
          if (existing?.extracted_text) {
            text = existing.extracted_text;
            this.log(`      ⏭️ Using cached text for: ${fileName}`);
          } else {
            this.log(`      📄 Extracting: ${fileName}`);
            const result = await pdfService.extractText(pdfPath);
            text = result.text;
            
            // Cache it
            dbService.getDb().prepare(`
              INSERT OR REPLACE INTO documents (id, corpus, filename, path, extracted_text, status)
              VALUES (?, 'A', ?, ?, ?, 'extracted')
            `).run(fileHash, fileName, pdfPath, text);
          }
          
          // Create article entries from Excel rows
          for (const row of rows) {
            const title = row['Title'] || row['Título'] || row['Article'] || row['Artigo'] || 'Unknown';
            const pages = row['Pages'] || row['Páginas'] || row['Page'] || row['Página'] || '';
            
            this.corpusAArticles.push({
              title: title,
              filename: fileName.replace('.pdf', '').replace('.PDF', ''),
              pages: String(pages),
              text: text, // Full PDF text - GPT will find the relevant section
              rowData: row
            });
            articlesFound++;
          }
          
        } catch (err: any) {
          this.log(`      ❌ Error processing ${fileName}: ${err.message}`);
        }
      }
      
      this.log(`      ✓ Found ${articlesFound} articles in sheet`);
    }
    
    this.log(`   📊 Corpus A Summary: ${this.corpusAArticles.length} articles indexed`);
  }

  /**
   * Step 3: Find match candidates using snippet extraction and translation
   */
  private async findMatchCandidates(aiConfig: any) {
    this.log(`🔍 Starting match search...`);
    this.log(`   → Articles to search: ${this.corpusAArticles.length}`);
    this.log(`   → French documents to search against: ${this.corpusBTexts.size}`);
    
    if (this.corpusAArticles.length === 0) {
      this.log('   ⚠️ No articles in Corpus A!');
      return;
    }
    if (this.corpusBTexts.size === 0) {
      this.log('   ⚠️ No documents in Corpus B!');
      return;
    }

    // Clear previous candidates
    dbService.getDb().prepare("DELETE FROM candidates").run();
    
    let totalMatches = 0;

    for (let i = 0; i < this.corpusAArticles.length; i++) {
      const article = this.corpusAArticles[i];
      if (!this.isRunning || this.stopRequested) {
        this.log(`   ⏹️ Stopping after ${i} items processed...`);
        break;
      }
      
      this.log(`   📄 [${i + 1}/${this.corpusAArticles.length}] Searching: ${article.filename} (${article.title.substring(0, 50)}...)`);
      
      try {
        // Step 3a: Extract resilient snippets and translate to 19th c. French
        this.log(`      → Extracting snippets from Portuguese text...`);
        
        // Extract periodical name from filename (e.g., "PSM" from "PSM1827-8s1v4.pdf")
        const periodicalName = article.filename.match(/^[A-Za-z]+/)?.[0] || '';
        
        const snippetPrompt = PROMPTS.EXTRACT_SNIPPETS(
          article.text.substring(0, 6000),
          article.title,
          periodicalName
        );
        
        const snippetResponse = await openAIService.generateCompletion(
          aiConfig.matchingModel,
          "You are an expert in 19th-century translation studies, historical linguistics, and Brazilian-French literary connections.",
          snippetPrompt
        );
        
        if (!snippetResponse.snippets || snippetResponse.snippets.length === 0) {
          this.log(`      → No usable snippets found`);
          continue;
        }
        
        this.log(`      → Generated ${snippetResponse.snippets.length} translated snippets`);
        for (const s of snippetResponse.snippets) {
          this.log(`         • [${s.anchor_type}] "${s.french_translation.substring(0, 40)}..."`);
        }
        
        // Step 3b: Search snippets against Corpus B
        const candidates: Map<string, { doc: CorpusBDoc; matchCount: number; snippets: any[] }> = new Map();
        
        for (const snippet of snippetResponse.snippets) {
          const frenchSnippet = snippet.french_translation.toLowerCase();
          const keyTerms = frenchSnippet
            .split(/\s+/)
            .filter((t: string) => t.length > 3)
            .map((t: string) => t.replace(/[.,;:!?'"]/g, ''));
          
          // Search in each Corpus B document
          for (const [docId, doc] of this.corpusBTexts) {
            const docTextLower = doc.text.toLowerCase();
            
            // Count matching key terms
            const matchingTerms = keyTerms.filter((term: string) => docTextLower.includes(term));
            const matchRatio = keyTerms.length > 0 ? matchingTerms.length / keyTerms.length : 0;
            
            if (matchRatio >= 0.4) { // At least 40% of key terms match
              if (!candidates.has(docId)) {
                candidates.set(docId, { doc, matchCount: 0, snippets: [] });
              }
              const cand = candidates.get(docId)!;
              cand.matchCount++;
              cand.snippets.push({
                portuguese: snippet.portuguese_original,
                french: snippet.french_translation,
                anchor_type: snippet.anchor_type,
                match_ratio: matchRatio,
                matching_terms: matchingTerms
              });
            }
          }
        }
        
        if (candidates.size === 0) {
          this.log(`      → No initial matches found`);
          continue;
        }
        
        this.log(`      → Found ${candidates.size} potential matches, verifying...`);
        
        // Step 3c: Verify top candidates with side-by-side GPT comparison
        const sortedCandidates = Array.from(candidates.entries())
          .sort((a, b) => b[1].matchCount - a[1].matchCount)
          .slice(0, 3);
        
        for (const [docId, candData] of sortedCandidates) {
          // Prepare file references for the prompt
          const ptFileName = article.filename.replace(/\.pdf$/i, '');
          const frFileName = candData.doc.filename.replace(/\.pdf$/i, '');
          const ptFileRef = article.sheets ? `${ptFileName}f${article.sheets}` : ptFileName;
          const frFileRef = frFileName;
          
          const verifyPrompt = PROMPTS.VERIFY_MATCH(
            article.text.substring(0, 4000),
            candData.doc.text.substring(0, 4000),
            candData.snippets,
            article.title,
            ptFileRef,
            frFileRef
          );
          
          const verification = await openAIService.generateCompletion(
            aiConfig.matchingModel,
            "You are an expert in identifying 19th-century translations between Brazilian Portuguese and French texts.",
            verifyPrompt
          );
          
          if (verification.is_match && verification.confidence >= 0.5) {
            // Format result: filename + sheet numbers (e.g., PSM1827-8s1v4f8-23)
            // Remove .pdf extension and format cleanly
            const ptFileName = article.filename.replace(/\.pdf$/i, '');
            const frFileName = candData.doc.filename.replace(/\.pdf$/i, '');
            
            const ptRef = article.sheets 
              ? `${ptFileName}f${article.sheets.replace('-', '-')}`
              : ptFileName;
            
            const frSheets = verification.french_sheets_estimate || '';
            const frRef = frSheets 
              ? `${frFileName}f${frSheets.replace('-', '-')}`
              : frFileName;
            
            // Only include snippets that were actually confirmed in the French text
            const confirmedSnippets = verification.confirmed_snippets || candData.snippets.filter((s: any) => s.match_ratio >= 0.5);
            
            dbService.getDb().prepare(`
              INSERT INTO candidates (doc_a_id, doc_b_id, reason, confidence, gpt_response_json)
              VALUES (?, ?, ?, ?, ?)
            `).run(
              ptRef,  // Portuguese reference with sheets (e.g., PSM1827-8s1v4f8-23)
              frRef,  // French reference with sheets (e.g., GMP1833s2v1f25-30)
              verification.reason,
              verification.confidence,
              JSON.stringify({
                article_title: article.title,
                portuguese_file: article.filename,
                portuguese_sheets: article.sheets,
                french_file: candData.doc.filename,
                french_sheets: frSheets,
                matching_snippets: confirmedSnippets,
                verification: verification
              })
            );
            
            this.log(`      ✓ MATCH FOUND!`);
            this.log(`        ${ptRef} matches ${frRef}`);
            this.log(`        Confidence: ${(verification.confidence * 100).toFixed(0)}%`);
            this.log(`        Reason: ${verification.reason.substring(0, 100)}...`);
            totalMatches++;
          }
        }
        
      } catch (err: any) {
        this.log(`      ❌ Error: ${err.message}`);
      }
    }
    
    this.log(`   📊 Match Summary: ${totalMatches} matches confirmed`);
  }

  private log(message: string) {
    console.log(`[Pipeline] ${message}`);
    this.emit('log', message);
  }
}

const PROMPTS = {
  EXTRACT_SNIPPETS: (text: string, title: string, periodicalName?: string) => `
You are analyzing a 19th-century Brazilian Portuguese newspaper article to find its potential French source.

Article Title: ${title}
${periodicalName ? `Periodical: ${periodicalName}` : ''}

TASK: Extract 2-4 snippets (n-grams of approximately 10 words each) that will help identify the French source document.

PRIORITIZE RESILIENT TEXTUAL ANCHORS (elements that survive translation intact):
1. **Proper names** - people, places, institutions (MOST RELIABLE - often unchanged)
2. **Dates and numbers** - specific dates, quantities, statistics (VERY RELIABLE)
3. **Technical/scientific terms** - often borrowed directly or easily recognized
4. **Distinctive multi-word phrases** - unique expressions with specific meaning
5. **Latin phrases or quotations** - frequently preserved verbatim in both languages
6. **Titles of works, laws, organizations** - usually recognizable across languages

STRICTLY AVOID:
- The periodical title "${periodicalName || title}" and variations
- Editorial text (publication dates, issue numbers, editor names)
- Standard newspaper headers/footers
- Common journalistic phrases ("we inform our readers", "continuation from previous issue", etc.)
- Generic descriptions and common expressions

For each snippet selected, translate it to early 19th-century French (c. 1800-1840 style).

Portuguese Text to Analyze:
${text}

Return JSON:
{
  "snippets": [
    {
      "portuguese_original": "exact ~10-word phrase from the article content",
      "french_translation": "translation in early 19th century French style",
      "anchor_type": "proper_name|date|number|technical_term|distinctive_phrase|latin|title",
      "key_anchors": ["list", "of", "key", "terms", "that", "should", "match"],
      "reasoning": "why this snippet is useful for matching"
    }
  ]
}
`,

  VERIFY_MATCH: (textA: string, textB: string, matchingSnippets: any[], articleTitle: string, ptFileRef: string, frFileRef: string) => `
You are an expert in 19th-century Franco-Brazilian literary connections.

TASK: Determine if the Portuguese text is a translation of the French source.

Article: "${articleTitle}"
Portuguese source: ${ptFileRef}
French candidate: ${frFileRef}

ANCHORS FOUND (snippets that matched between texts):
${JSON.stringify(matchingSnippets, null, 2)}

═══════════════════════════════════════
TEXT A - PORTUGUESE (potential translation):
═══════════════════════════════════════
${textA}

═══════════════════════════════════════
TEXT B - FRENCH (potential source):
═══════════════════════════════════════
${textB}

VERIFICATION PROCESS:
1. Select 2-3 larger passages (~20 words each) from the Portuguese article
2. Translate these passages to early 19th-century French
3. Search for equivalent passages in the French text
4. Compare side-by-side for semantic and structural correspondence

ANALYSIS CRITERIA:
1. **Anchor context**: Do the matching names/dates/terms appear in equivalent narrative contexts?
2. **Structural parallel**: Do paragraphs and arguments follow the same order?
3. **Semantic correspondence**: Beyond anchors, is the meaning equivalent?
4. **Translation patterns**: Typical French→Portuguese translation markers (vocabulary, syntax)?
5. **Length comparison**: Is the Portuguese roughly similar length to French section?

Be CONSERVATIVE - only confirm if evidence is clear. A few shared names doesn't prove translation.

Return JSON:
{
  "is_match": true/false,
  "confidence": 0.0-1.0,
  "b_doc_id": "filename of the French source",
  "reason": "specific explanation citing evidence from both texts",
  "location_file": "${ptFileRef}",
  "likely_match_file": "French filename with sheet estimate (e.g., GMP1833s2v1f25-30)",
  "match_type": "direct_translation|partial_translation|adaptation|no_match",
  "confirmed_snippets": [
    {
      "portuguese": "the Portuguese snippet",
      "french": "the ACTUAL French text found in the document that matches",
      "anchor_type": "type of anchor",
      "location_in_french": "approximate location in French text"
    }
  ],
  "evidence": ["quote 1 from French matching Portuguese", "quote 2...", "etc"],
  "larger_passages_compared": [
    {
      "portuguese_passage": "~20 word passage from Portuguese",
      "french_translation": "translation to 19th c. French",
      "french_match_found": "equivalent passage found in French text or null"
    }
  ],
  "french_sheets_estimate": "estimated sheet range in French source (e.g., 25-30)"
}
`
};

export const pipelineService = new PipelineService();
