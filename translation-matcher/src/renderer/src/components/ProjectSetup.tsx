import { useState } from 'react'
import { api } from '../api'
import { FolderOpen, FileUp, UploadCloud, Check } from 'lucide-react'

type SheetConfig = {
  name: string
  columns: string[]
  filenameColumn: string
  selected: boolean
}

type CorpusConfig = {
  excelPath: string
  pdfFolder: string
  sheets: SheetConfig[]
  activeSheetIndex: number
}

type AIConfig = {
  indexingModel: string
  matchingModel: string
  verificationModel: string
}

const createEmptyCorpus = (): CorpusConfig => ({
  excelPath: '',
  pdfFolder: '',
  sheets: [],
  activeSheetIndex: 0
})

export default function ProjectSetup({ onStart }: { onStart: () => void }) {
  const [corpusA, setCorpusA] = useState<CorpusConfig>(createEmptyCorpus())
  const [corpusB, setCorpusB] = useState<CorpusConfig>(createEmptyCorpus())

  const [aiConfig, setAiConfig] = useState<AIConfig>({
    indexingModel: 'gpt-4o',
    matchingModel: 'gpt-4o',
    verificationModel: 'gpt-4o'
  })

  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({})

  const handleManifestUpload = async (side: 'A' | 'B', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const key = `${side}-excel`
    setUploading((prev) => ({ ...prev, [key]: true }))

    try {
      const res = await api.uploadManifest(file, side)

      // Convert sheets from API to SheetConfig format
      const sheets: SheetConfig[] = res.sheets.map((sheet: any) => {
        // Auto-select "File" column if it exists (case-insensitive)
        const fileColumn = sheet.columns.find((col: string) => 
          col.toLowerCase() === 'file'
        ) || ''
        return {
          name: sheet.name,
          columns: sheet.columns,
          filenameColumn: fileColumn,
          selected: true // Select all sheets by default
        }
      })

      if (side === 'A') {
        setCorpusA((prev) => ({ ...prev, excelPath: res.path, sheets, activeSheetIndex: 0 }))
      } else {
        setCorpusB((prev) => ({ ...prev, excelPath: res.path, sheets, activeSheetIndex: 0 }))
      }
    } catch (err) {
      console.error(err)
      alert('Failed to upload manifest')
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handlePDFUpload = async (side: 'A' | 'B', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const key = `${side}-pdf`
    setUploading((prev) => ({ ...prev, [key]: true }))

    try {
      const res = await api.uploadPDFs(files, side)
      if (side === 'A') {
        setCorpusA((prev) => ({ ...prev, pdfFolder: res.path }))
      } else {
        setCorpusB((prev) => ({ ...prev, pdfFolder: res.path }))
      }
    } catch (err) {
      console.error(err)
      alert('Failed to upload PDFs')
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const updateSheetConfig = (
    side: 'A' | 'B',
    sheetIndex: number,
    updates: Partial<SheetConfig>
  ) => {
    const setCorpus = side === 'A' ? setCorpusA : setCorpusB
    setCorpus((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet, i) => (i === sheetIndex ? { ...sheet, ...updates } : sheet))
    }))
  }

  const setActiveSheet = (side: 'A' | 'B', index: number) => {
    const setCorpus = side === 'A' ? setCorpusA : setCorpusB
    setCorpus((prev) => ({ ...prev, activeSheetIndex: index }))
  }

  const CorpusCard = ({
    title,
    corpus,
    side,
    colorScheme
  }: {
    title: string
    corpus: CorpusConfig
    side: 'A' | 'B'
    colorScheme: { bg: string; text: string; activeBg: string; activeText: string }
  }) => {
    const activeSheet = corpus.sheets[corpus.activeSheetIndex]

    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colorScheme.bg} ${colorScheme.text}`}
          >
            {side}
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        </div>

        <div className="space-y-4">
          {/* Excel Upload */}
          <div className="group">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Manifest (Excel)
            </label>
            <div className="relative flex-1">
              {uploading[`${side}-excel`] ? (
                <div className="text-xs text-indigo-500 animate-pulse flex items-center gap-2 border border-indigo-100 bg-indigo-50 rounded p-2">
                  <UploadCloud size={14} /> Uploading...
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleManifestUpload(side, e)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="inpt font-mono text-xs pr-8 flex items-center text-slate-500 bg-white hover:bg-slate-50 cursor-pointer border border-slate-200 rounded-lg p-2">
                    {corpus.excelPath ? (
                      <span className="text-slate-700 truncate">
                        {corpus.excelPath.split(/[\\/]/).pop()}
                      </span>
                    ) : (
                      'Select Excel File...'
                    )}
                  </div>
                  <FileUp
                    size={14}
                    className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sheet Tabs */}
          {corpus.sheets.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Excel Sheets ({corpus.sheets.filter((s) => s.selected).length} selected)
              </label>
              <div className="flex flex-wrap gap-1 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                {corpus.sheets.map((sheet, index) => (
                  <button
                    key={sheet.name}
                    onClick={() => setActiveSheet(side, index)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      corpus.activeSheetIndex === index
                        ? `${colorScheme.activeBg} ${colorScheme.activeText} ring-1 ring-current`
                        : sheet.selected
                          ? 'bg-white text-slate-600 shadow-sm hover:bg-slate-100'
                          : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                    }`}
                  >
                    {sheet.selected && <Check size={10} className="text-emerald-500" />}
                    {sheet.name}
                  </button>
                ))}
              </div>

              {/* Active Sheet Config */}
              {activeSheet && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      Sheet: <span className={colorScheme.text}>{activeSheet.name}</span>
                    </span>
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeSheet.selected}
                        onChange={(e) =>
                          updateSheetConfig(side, corpus.activeSheetIndex, {
                            selected: e.target.checked
                          })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Include this sheet
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                      Filename Column
                    </label>
                    <div className="relative">
                      <select
                        className="inpt appearance-none text-sm"
                        value={activeSheet.filenameColumn}
                        onChange={(e) =>
                          updateSheetConfig(side, corpus.activeSheetIndex, {
                            filenameColumn: e.target.value
                          })
                        }
                        disabled={!activeSheet.selected}
                      >
                        <option value="">Select Column...</option>
                        {activeSheet.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PDF Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              PDF Directory
            </label>
            <div className="relative">
              {uploading[`${side}-pdf`] ? (
                <div className="text-xs text-indigo-500 animate-pulse flex items-center gap-2 border border-indigo-100 bg-indigo-50 rounded p-2">
                  <UploadCloud size={14} /> Uploading PDFs...
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    {...({ webkitdirectory: '' } as any)}
                    onChange={(e) => handlePDFUpload(side, e)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="inpt font-mono text-xs pr-8 flex items-center text-slate-500 bg-white hover:bg-slate-50 cursor-pointer border border-slate-200 rounded-lg p-2">
                    {corpus.pdfFolder ? (
                      <span className="text-slate-700 truncate">
                        {corpus.pdfFolder.split(/[\\/]/).pop()}
                      </span>
                    ) : (
                      'Select PDF Folder...'
                    )}
                  </div>
                  <FolderOpen
                    size={14}
                    className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary of configured sheets */}
        {corpus.sheets.filter((s) => s.selected && s.filenameColumn).length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
              Configured Sheets
            </p>
            <div className="flex flex-wrap gap-1">
              {corpus.sheets
                .filter((s) => s.selected && s.filenameColumn)
                .map((sheet) => (
                  <span
                    key={sheet.name}
                    className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700"
                  >
                    {sheet.name} → {sheet.filenameColumn}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Check if configuration is valid
  const isConfigValid = () => {
    const activeSheetA = corpusA.sheets[corpusA.activeSheetIndex];
    const activeSheetB = corpusB.sheets[corpusB.activeSheetIndex];
    const hasValidA = corpusA.pdfFolder && activeSheetA?.filenameColumn
    const hasValidB = corpusB.pdfFolder && activeSheetB?.filenameColumn
    return hasValidA && hasValidB
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <CorpusCard
          title="Target (Portuguese)"
          corpus={corpusA}
          side="A"
          colorScheme={{
            bg: 'bg-emerald-100',
            text: 'text-emerald-700',
            activeBg: 'bg-emerald-50',
            activeText: 'text-emerald-700'
          }}
        />
        <CorpusCard
          title="Source (English/French)"
          corpus={corpusB}
          side="B"
          colorScheme={{
            bg: 'bg-blue-100',
            text: 'text-blue-700',
            activeBg: 'bg-blue-50',
            activeText: 'text-blue-700'
          }}
        />
      </div>

      <div className="flex justify-center pt-8 pb-12">
        <button
          onClick={async () => {
            // Only send the active sheet (the one with a configured column)
            const activeSheetA = corpusA.sheets[corpusA.activeSheetIndex];
            const activeSheetB = corpusB.sheets[corpusB.activeSheetIndex];
            
            const config = {
              corpusA: {
                ...corpusA,
                sheets: activeSheetA?.filenameColumn ? [activeSheetA] : []
              },
              corpusB: {
                ...corpusB,
                sheets: activeSheetB?.filenameColumn ? [activeSheetB] : []
              },
              ai: aiConfig
            }
            await api.startPipeline(config)
            onStart()
          }}
          disabled={!isConfigValid()}
          className="btn-primary py-4 px-12 text-lg shadow-xl shadow-indigo-100 disabled:shadow-none hover:-translate-y-0.5 transform"
        >
          🚀 Launch Pipeline
        </button>
      </div>
    </div>
  )
}
