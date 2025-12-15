import { useState, useEffect } from 'react';
import { api } from '../api';
import { Folder, FileText, ChevronUp, Check, X } from 'lucide-react';

type FilePickerProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    initialPath?: string;
    mode: 'file' | 'folder';
};

export default function FilePickerModal({ isOpen, onClose, onSelect, initialPath, mode }: FilePickerProps) {
    const [currentPath, setCurrentPath] = useState(initialPath || '');
    const [items, setItems] = useState<any[]>([]);
    const [parentPath, setParentPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) loadPath(currentPath);
    }, [isOpen, currentPath]);

    const loadPath = async (path: string) => {
        setLoading(true);
        setError('');
        try {
            const data = await api.listDirectory(path);
            setItems(data.items);
            setParentPath(data.parent);
            setCurrentPath(data.current);
        } catch (e: any) {
            setError(e.message || 'Failed to load directory');
        } finally {
            setLoading(false);
        }
    };

    const handleItemClick = (item: any) => {
        if (item.isDirectory) {
            loadPath(item.path);
        } else if (mode === 'file') {
            onSelect(item.path);
            onClose();
        }
    };

    const handleSelectCurrentFolder = () => {
        if (mode === 'folder') {
            onSelect(currentPath);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800">
                        {mode === 'file' ? 'Select File' : 'Select Folder'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Path Bar */}
                <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-2">
                    <button
                        onClick={() => loadPath(parentPath)}
                        disabled={!parentPath || parentPath === currentPath}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                    >
                        <ChevronUp size={18} />
                    </button>
                    <input
                        type="text"
                        value={currentPath}
                        readOnly
                        className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600"
                    />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                    {loading ? (
                        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : error ? (
                        <div className="p-4 text-center text-red-500 text-sm">{error}</div>
                    ) : (
                        <div className="space-y-0.5">
                            {items.map((item) => (
                                <div
                                    key={item.path}
                                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${item.isDirectory
                                        ? 'hover:bg-indigo-50 text-slate-700'
                                        : mode === 'file' ? 'hover:bg-emerald-50 text-slate-600' : 'text-slate-400 cursor-default opacity-60'
                                        }`}
                                    onClick={() => handleItemClick(item)}
                                >
                                    {item.isDirectory ? <Folder size={16} className="text-indigo-400" /> : <FileText size={16} className="text-slate-400" />}
                                    <span className="text-sm truncate flex-1">{item.name}</span>
                                </div>
                            ))}
                            {items.length === 0 && <div className="text-center text-slate-400 text-sm p-4">Empty Directory</div>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
                    {mode === 'folder' && (
                        <button
                            onClick={handleSelectCurrentFolder}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2"
                        >
                            <Check size={16} /> Select Current Folder
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
