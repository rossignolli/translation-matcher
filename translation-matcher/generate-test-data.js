const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const xlsx = require('xlsx');

// Ensure directories exist
const TEST_DIR = path.join(__dirname, 'test-data');
const CORPUS_A_DIR = path.join(TEST_DIR, 'corpus-a-pdf');
const CORPUS_B_DIR = path.join(TEST_DIR, 'corpus-b-pdf');

if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR);
if (!fs.existsSync(CORPUS_A_DIR)) fs.mkdirSync(CORPUS_A_DIR);
if (!fs.existsSync(CORPUS_B_DIR)) fs.mkdirSync(CORPUS_B_DIR);

async function createPDF(filePath, text) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 50, y: 700, size: 12, font, maxWidth: 500 });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(filePath, pdfBytes);
}

async function generate() {
  console.log('Generating synthetic dataset...');

  // Match 1: Direct Translation
  await createPDF(path.join(CORPUS_B_DIR, 'source1.pdf'), 
    "The quick brown fox jumps over the lazy dog. It was a sunny day in London."
  );
  await createPDF(path.join(CORPUS_A_DIR, 'target1.pdf'), 
    "A raposa rápida marrom pula sobre o cão preguiçoso. Era um dia ensolarado em Londres."
  );

  // Match 2: Partial Translation
  await createPDF(path.join(CORPUS_B_DIR, 'source2.pdf'), 
    "Industrial revolution changed the world. Steam engines were key."
  );
  await createPDF(path.join(CORPUS_A_DIR, 'target2.pdf'), 
    "A revolução industrial mudou o mundo. Máquinas a vapor foram fundamentais. O Brasil também se industrializou."
  );

  // No Match
  await createPDF(path.join(CORPUS_B_DIR, 'source3.pdf'), 
    "This is a random text about biology."
  );
  await createPDF(path.join(CORPUS_A_DIR, 'target3.pdf'), 
    "Este é um texto aleatório sobre culinária."
  );

  // Generate Excel Manifests
  const wbA = xlsx.utils.book_new();
  const dataA = [
    { Filename: 'target1.pdf', Title: 'Raposa', Date: '1850' },
    { Filename: 'target2.pdf', Title: 'Industrial', Date: '1860' },
    { Filename: 'target3.pdf', Title: 'Culinaria', Date: '1870' }
  ];
  xlsx.utils.book_append_sheet(wbA, xlsx.utils.json_to_sheet(dataA), 'Sheet1');
  xlsx.writeFile(wbA, path.join(TEST_DIR, 'corpus-a.xlsx'));

  const wbB = xlsx.utils.book_new();
  const dataB = [
    { Filename: 'source1.pdf', Author: 'John Doe', Date: '1849' },
    { Filename: 'source2.pdf', Author: 'Jane Smith', Date: '1859' },
    { Filename: 'source3.pdf', Author: 'Bob Jones', Date: '1869' }
  ];
  xlsx.utils.book_append_sheet(wbB, xlsx.utils.json_to_sheet(dataB), 'Sheet1');
  xlsx.writeFile(wbB, path.join(TEST_DIR, 'corpus-b.xlsx'));

  console.log('Dataset generated in ./test-data');
}

generate().catch(console.error);
