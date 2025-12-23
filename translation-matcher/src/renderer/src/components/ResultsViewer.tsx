import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ResultsViewer() {
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadResults();
    }, []);

    const loadResults = async () => {
        try {
            const data = await api.getResults();
            setMatches(data);
        } catch (error) {
            console.error("Failed to load results", error);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = async () => {
        if (matches.length === 0) return;
        const header = ['Confidence', 'Type', 'Portuguese Article', 'French Source', 'Match', 'Reason'].join(',') + '\n';
        const rows = matches.map(m => {
            const evidence = m.evidence_json ? JSON.parse(m.evidence_json) : {};
            const reason = m.reason || evidence?.verification?.reason || evidence?.explanation || '';
            return [
                m.confidence,
                m.match_type || 'candidate',
                `"${m.a_filename}"`,
                `"${m.b_filename}"`,
                `"${m.a_filename} matches ${m.b_filename}"`,
                `"${reason.replace(/"/g, '""')}"`
            ].join(',');
        }).join('\n');

        await api.exportFile(header + rows, 'results.csv');
    };

    const exportJSON = async () => {
        if (matches.length === 0) return;
        await api.exportFile(JSON.stringify(matches, null, 2), 'results.json');
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 space-y-4">
            <div className="w-10 h-10 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
            <p>Analyzing database...</p>
        </div>
    );

    if (matches.length === 0) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 space-y-4 border-2 border-dashed border-slate-200 rounded-xl">
            <div className="text-4xl">🔍</div>
            <p className="font-medium">No matches found yet.</p>
            <p className="text-sm">Run the pipeline to generate results.</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Analysis Results</h2>
                    <p className="text-slate-500 text-sm mt-1">Found {matches.length} potential matches above threshold.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={exportCSV} className="btn-secondary text-xs flex items-center gap-2">
                        <span>📄</span> Export CSV
                    </button>
                    <button onClick={exportJSON} className="btn-secondary text-xs flex items-center gap-2">
                        <span>📦</span> Export JSON
                    </button>
                    <button onClick={loadResults} className="btn-secondary text-xs">
                        🔄 Refresh
                    </button>
                </div>
            </div>

            <div className="card shadow-lg ring-1 ring-black/5">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                        <tr>
                            <th className="p-4 w-24">Score</th>
                            <th className="p-4 w-32">Type</th>
                            <th className="p-4">Portuguese Article</th>
                            <th className="p-4 text-center">↔</th>
                            <th className="p-4">French Source</th>
                            <th className="p-4 w-20 text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {matches.map(match => (
                            <tr key={match.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className={`
                                        inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border
                                        ${match.confidence > 0.85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            match.confidence > 0.7 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                'bg-amber-50 text-amber-700 border-amber-200'}
                                    `}>
                                        {(match.confidence * 100).toFixed(0)}%
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                        {(match.match_type || 'candidate').replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="font-mono font-medium text-slate-900">{match.a_filename}</div>
                                    {match.article_title && (
                                        <div className="text-xs text-slate-500 mt-1 truncate max-w-xs" title={match.article_title}>
                                            {match.article_title}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-center text-emerald-600 font-bold">matches</td>
                                <td className="p-4 font-mono font-medium text-slate-900">{match.b_filename}</td>
                                <td className="p-4 text-right">
                                    <details className="group/details relative">
                                        <summary className="list-none">
                                            <span className="cursor-pointer p-2 rounded-md hover:bg-slate-200 text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                👁️
                                            </span>
                                        </summary>

                                        {/* Modal / Popover Overlay */}
                                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 hidden group-open/details:flex items-center justify-center p-4">
                                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                                {/* Header */}
                                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                    <h3 className="font-bold text-slate-800">Match Evidence</h3>
                                                    <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"
                                                        onClick={(e) => (e.target as HTMLElement).closest('details')!.removeAttribute('open')}>
                                                        ✕
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="p-6 overflow-y-auto space-y-6">
                                                    {/* Evidence Section */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Match Reason</h4>
                                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed">
                                                            {(() => {
                                                                const evidence = match.evidence_json ? JSON.parse(match.evidence_json) : {};
                                                                return match.reason || evidence?.verification?.reason || evidence?.explanation || 'No explanation available';
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Confirmed Matching Snippets - Only snippets actually found in French text */}
                                                    {match.evidence_json && JSON.parse(match.evidence_json)?.matching_snippets && JSON.parse(match.evidence_json).matching_snippets.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Confirmed Matching Snippets</h4>
                                                            <div className="space-y-2">
                                                                {JSON.parse(match.evidence_json).matching_snippets.map((snippet: any, i: number) => (
                                                                    <div key={i} className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-sm">
                                                                        <div className="text-indigo-700"><strong>PT:</strong> {snippet.portuguese}</div>
                                                                        <div className="text-indigo-600"><strong>FR (found):</strong> {snippet.french}</div>
                                                                        <div className="text-indigo-400 text-xs mt-1">
                                                                            Type: {snippet.anchor_type}
                                                                            {snippet.location_in_french && ` • Location: ${snippet.location_in_french}`}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Raw Data (Collapsed) */}
                                                    <details>
                                                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-indigo-500 mt-4">Show Raw JSON</summary>
                                                        <pre className="mt-2 text-xs bg-slate-900 text-slate-300 p-4 rounded-lg overflow-x-auto">
                                                            {JSON.stringify(match, null, 2)}
                                                        </pre>
                                                    </details>
                                                </div>
                                            </div>

                                            {/* Backdrop Close Trigger */}
                                            <div className="absolute inset-0 -z-10" onClick={(e) => (e.target as HTMLElement).closest('details')!.removeAttribute('open')}></div>
                                        </div>
                                    </details>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
