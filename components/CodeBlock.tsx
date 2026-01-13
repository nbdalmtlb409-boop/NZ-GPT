import React, { useState } from 'react';
import { Check, Copy, Terminal, Download } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'code' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Determine extension
    let ext = 'txt';
    const lang = language.toLowerCase();
    if (['javascript', 'js', 'jsx'].includes(lang)) ext = 'js';
    else if (['typescript', 'ts', 'tsx'].includes(lang)) ext = 'ts';
    else if (['python', 'py'].includes(lang)) ext = 'py';
    else if (['html', 'htm'].includes(lang)) ext = 'html';
    else if (['css'].includes(lang)) ext = 'css';
    else if (['json'].includes(lang)) ext = 'json';
    else if (['sql'].includes(lang)) ext = 'sql';
    else if (['java'].includes(lang)) ext = 'java';
    else if (['cpp', 'c++'].includes(lang)) ext = 'cpp';
    else if (['c'].includes(lang)) ext = 'c';
    else if (['c#', 'csharp', 'cs'].includes(lang)) ext = 'cs';
    else if (['php'].includes(lang)) ext = 'php';
    else if (['bash', 'sh', 'shell'].includes(lang)) ext = 'sh';

    a.download = `nz-gpt-code-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-5 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl dir-ltr text-left group">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-sm"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-sm"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-sm"></div>
          </div>
          <span className="text-xs text-slate-400 font-mono font-medium lowercase flex items-center gap-1.5 opacity-80 select-none">
            <Terminal size={10} strokeWidth={3} />
            {language}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
            <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md transition-all duration-200 bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-600 hover:bg-slate-700"
            title="تحميل الملف"
            >
            <Download size={12} />
            <span className="uppercase tracking-wider hidden sm:inline">Download</span>
            </button>

            <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md transition-all duration-200 border ${
                copied 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600 hover:bg-slate-700'
            }`}
            title="نسخ الكود"
            >
            {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
            <span className="uppercase tracking-wider hidden sm:inline">{copied ? 'COPIED' : 'COPY'}</span>
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        <pre className="p-5 overflow-x-auto text-[13px] md:text-sm font-mono leading-7 text-slate-300 whitespace-pre-wrap font-medium selection:bg-slate-700 selection:text-white">
          <code style={{ fontFamily: '"Fira Code", monospace' }}>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;