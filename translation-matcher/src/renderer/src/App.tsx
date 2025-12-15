import { useState } from 'react';
import ProjectSetup from './components/ProjectSetup';
import ProgressDashboard from './components/ProgressDashboard';
import ResultsViewer from './components/ResultsViewer';
import { LayoutGrid, Playdoh, FileText, Settings, Activity } from 'lucide-react';

// You'd normally npm install lucide-react, but assuming standard setup/icons available or substitute.
// If icons fail, I'll remove them. Let's assume text for now to be safe, or simple SVGs.

function App() {
  const [activeTab, setActiveTab] = useState<'setup' | 'progress' | 'results'>('setup');

  const tabs = [
    { id: 'setup', label: 'Configuration', icon: '⚙️' },
    { id: 'progress', label: 'Live Pipeline', icon: '⚡' },
    { id: 'results', label: 'Analysis Results', icon: '📊' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 bg-opacity-80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                TM
              </div>
              <span className="font-bold text-slate-800 tracking-tight">Translation Matcher</span>
            </div>

            <div className="flex items-center space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
        {activeTab === 'setup' && (
          <div className="space-y-6">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Project Configuration</h1>
              <p className="text-slate-500 max-w-2xl mx-auto">Set up your corpora sources and configure the AI model parameters to begin the matching process.</p>
            </div>
            <ProjectSetup onStart={() => setActiveTab('progress')} />
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="h-[calc(100vh-10rem)]">
            <ProgressDashboard />
          </div>
        )}

        {activeTab === 'results' && (
          <ResultsViewer />
        )}
      </main>
    </div>
  );
}

export default App;
