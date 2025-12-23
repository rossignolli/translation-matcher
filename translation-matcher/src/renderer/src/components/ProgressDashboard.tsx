import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

export default function ProgressDashboard({ onComplete }: { onComplete?: () => void }) {
    const [logs, setLogs] = useState<string[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cleanup = api.subscribeToLogs((msg) => {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
            
            // Detect pipeline completion or stop
            if (msg.includes('Pipeline completed successfully') || msg.includes('Partial results available')) {
                setIsComplete(true);
                setIsStopping(false);
                // Auto-switch to results after 2 seconds
                setTimeout(() => {
                    onComplete?.();
                }, 2000);
            }
        });
        return cleanup;
    }, [onComplete]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleStop = async () => {
        setIsStopping(true);
        await api.stopPipeline();
    };

    const handleViewResults = () => {
        onComplete?.();
    };

    return (
        <div className="h-full flex flex-col rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-[#0d1117]">
            {/* Terminal Header */}
            <div className="bg-[#161b22] px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="ml-3 text-xs font-mono text-slate-400">pipeline_execution.log</span>
                </div>
                <div className="flex items-center gap-3">
                    {!isComplete && logs.length > 0 && (
                        <button
                            onClick={handleStop}
                            disabled={isStopping}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isStopping ? '⏳ Stopping...' : '⏹ Stop & View Results'}
                        </button>
                    )}
                    {isComplete && (
                        <button
                            onClick={handleViewResults}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                        >
                            📊 View Results
                        </button>
                    )}
                    <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isComplete ? 'bg-blue-400' : 'bg-emerald-400'} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isComplete ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                    </span>
                    <span className={`text-xs font-medium tracking-wide ${isComplete ? 'text-blue-500' : 'text-emerald-500'}`}>
                        {isComplete ? 'DONE' : 'LIVE'}
                    </span>
                </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
                        <div className="w-16 h-16 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
                        <p>Waiting for pipeline initialization...</p>
                    </div>
                )}

                {logs.map((log, i) => {
                    // Simple highlighting logic
                    const isError = log.toLowerCase().includes('error');
                    const isSuccess = log.toLowerCase().includes('success') || log.includes('MATCH FOUND');
                    const isStep = log.includes('Step');

                    return (
                        <div key={i} className={`break-words ${isError ? 'text-red-400' :
                                isSuccess ? 'text-emerald-400 font-semibold' :
                                    isStep ? 'text-blue-400 pt-2 font-bold' :
                                        'text-slate-300'
                            }`}>
                            <span className="select-none text-slate-600 mr-3 opacity-50 text-xs">$</span>
                            {log}
                        </div>
                    );
                })}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
}
