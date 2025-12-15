import { useState } from 'react';
import { api } from '../api';
import { FolderOpen, FileUp, UploadCloud } from 'lucide-react';

type CorpusConfig = {
    excelPath: string;
    pdfFolder: string;
    filenameColumn: string;
    titleColumn: string;
    dateColumn: string;
    multiArticle: boolean;
};

type AIConfig = {
    apiKey: string;
    indexingModel: string;
    matchingModel: string;
    verificationModel: string;
};

export default function ProjectSetup({ onStart }: { onStart: () => void }) {
    const [corpusA, setCorpusA] = useState<CorpusConfig>({
        excelPath: '', pdfFolder: '', filenameColumn: '', titleColumn: '', dateColumn: '', multiArticle: false
    });
    const [corpusB, setCorpusB] = useState<CorpusConfig>({
        excelPath: '', pdfFolder: '', filenameColumn: '', titleColumn: '', dateColumn: '', multiArticle: false
    });

    const [aiConfig, setAiConfig] = useState<AIConfig>({
        apiKey: '',
        indexingModel: 'gpt-4-turbo',
        matchingModel: 'gpt-4-turbo',
        verificationModel: 'gpt-4o'
    });

    const [aColumns, setAColumns] = useState<string[]>([]);
    const [bColumns, setBColumns] = useState<string[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});

    const handleManifestUpload = async (corpus: 'A' | 'B', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const key = `${corpus}-excel`;
        setUploading(prev => ({ ...prev, [key]: true }));

        try {
            const res = await api.uploadManifest(file, corpus);

            // Note: res.path is the server-side path where file was saved
            if (corpus === 'A') {
                setCorpusA(prev => ({ ...prev, excelPath: res.path }));
                const columns = res.data.length > 0 ? Object.keys(res.data[0]) : [];
                setAColumns(columns);
            } else {
                setCorpusB(prev => ({ ...prev, excelPath: res.path }));
                const columns = res.data.length > 0 ? Object.keys(res.data[0]) : [];
                setBColumns(columns);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload manifest');
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handlePDFUpload = async (corpus: 'A' | 'B', e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const key = `${corpus}-pdf`;
        setUploading(prev => ({ ...prev, [key]: true }));

        try {
            const res = await api.uploadPDFs(files, corpus);

            // res.path is the directory where files were saved
            if (corpus === 'A') {
                setCorpusA(prev => ({ ...prev, pdfFolder: res.path }));
            } else {
                setCorpusB(prev => ({ ...prev, pdfFolder: res.path }));
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload PDFs');
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }));
        }
    };

    const testConnection = async () => {
        setConnectionStatus('testing');
        const result = await api.testAI(aiConfig.apiKey);
        setConnectionStatus(result ? 'success' : 'failed');
    };

    const CorpusCard = ({ title, corpus, setCorpus, columns, type }: { title: string, corpus: CorpusConfig, setCorpus: any, columns: string[], type: 'A' | 'B' }) => (
        <div className="card p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${type === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {type}
                </div>
                <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            </div>

            <div className="space-y-4">
                <div className="group">
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Manifest (Excel)</label>
                    <div className="relative flex-1">
                        {uploading[`${type}-excel`] ? (
                            <div className="text-xs text-indigo-500 animate-pulse flex items-center gap-2 border border-indigo-100 bg-indigo-50 rounded p-2">
                                <UploadCloud size={14} /> Uploading...
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={(e) => handleManifestUpload(type, e)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="inpt font-mono text-xs pr-8 flex items-center text-slate-500 bg-white hover:bg-slate-50 cursor-pointer border border-slate-200 rounded-lg p-2">
                                    {corpus.excelPath ? (<span className="text-slate-700 truncate">{corpus.excelPath.split(/[\\/]/).pop()}</span>) : "Select Excel File..."}
                                </div>
                                <FileUp size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Filename Column</label>
                    <div className="relative">
                        <select className="inpt appearance-none" value={corpus.filenameColumn} onChange={e => setCorpus({ ...corpus, filenameColumn: e.target.value })}>
                            <option value="">Select Column...</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">PDF Directory</label>
                    <div className="relative">
                        {uploading[`${type}-pdf`] ? (
                            <div className="text-xs text-indigo-500 animate-pulse flex items-center gap-2 border border-indigo-100 bg-indigo-50 rounded p-2">
                                <UploadCloud size={14} /> Uploading PDFs...
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="file"
                                    multiple
                                    {...{ webkitdirectory: "" } as any}
                                    onChange={(e) => handlePDFUpload(type, e)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="inpt font-mono text-xs pr-8 flex items-center text-slate-500 bg-white hover:bg-slate-50 cursor-pointer border border-slate-200 rounded-lg p-2">
                                    {corpus.pdfFolder ? (<span className="text-slate-700 truncate">{corpus.pdfFolder.split(/[\\/]/).pop()}</span>) : "Select PDF Folder..."}
                                </div>
                                <FolderOpen size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <CorpusCard
                    title="Target (Portuguese)"
                    corpus={corpusA}
                    setCorpus={setCorpusA}
                    columns={aColumns}
                    type="A"
                />
                <CorpusCard
                    title="Source (English/French)"
                    corpus={corpusB}
                    setCorpus={setCorpusB}
                    columns={bColumns}
                    type="B"
                />
            </div>

            <div className="card p-6 max-w-2xl mx-auto bg-slate-900 text-white border-slate-800">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span>🔑</span> AI Configuration
                </h2>
                <div className="flex gap-3">
                    <input
                        type="password"
                        value={aiConfig.apiKey}
                        onChange={e => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                        className="inpt bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500 flex-1"
                        placeholder="sk-..."
                    />
                    <button
                        onClick={testConnection}
                        disabled={!aiConfig.apiKey || connectionStatus === 'testing'}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${connectionStatus === 'success' ? 'bg-emerald-500 text-white' :
                            connectionStatus === 'failed' ? 'bg-red-500 text-white' :
                                'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                    >
                        {connectionStatus === 'testing' ? 'Testing...' :
                            connectionStatus === 'success' ? 'Connected' :
                                connectionStatus === 'failed' ? 'Failed' : 'Verify'}
                    </button>
                </div>
            </div>

            <div className="flex justify-center pt-8 pb-12">
                <button
                    onClick={async () => {
                        const config = { corpusA, corpusB, ai: aiConfig };
                        await api.startPipeline(config);
                        onStart();
                    }}
                    disabled={!corpusA.pdfFolder || !corpusB.pdfFolder || !aiConfig.apiKey}
                    className="btn-primary py-4 px-12 text-lg shadow-xl shadow-indigo-100 disabled:shadow-none hover:-translate-y-0.5 transform">
                    🚀 Launch Pipeline
                </button>
            </div>
        </div>
    );
}
