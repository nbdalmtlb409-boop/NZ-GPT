
import React from 'react';
import { Message, Role } from '../types';
import { ExternalLink, User } from 'lucide-react';
import CodeBlock from './CodeBlock';
import { BrandLogo } from '../App';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-white/10 text-gray-200 px-1.5 py-0.5 rounded text-[13px] font-mono mx-0.5" dir="ltr">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (match) {
          return (
            <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-0.5 mx-1">
              {match[1]} <ExternalLink size={10} />
            </a>
          );
        }
      }
      return part;
    });
  };

  const renderContent = (fullText: string) => {
    const parts = fullText.split(/(```[\s\S]*?```|```[\s\S]*$)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        let content = part.slice(3);
        if (content.endsWith('```')) content = content.slice(0, -3);
        const firstLineBreak = content.indexOf('\n');
        let language = 'code';
        let code = content;
        if (firstLineBreak > -1) {
            const potentialLang = content.substring(0, firstLineBreak).trim();
            if (potentialLang.length < 15 && !potentialLang.includes(' ')) {
                language = potentialLang || 'code';
                code = content.substring(firstLineBreak + 1);
            }
        }
        return <CodeBlock key={index} code={code.trim()} language={language} />;
      }
      
      if (part.trim() === '') return null;

      return (
        <div key={index} className="space-y-4">
          {part.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-2"></div>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-black text-white mt-6 mb-2 leading-tight">{renderInlineStyles(line.replace(/^###\s+/, ''))}</h3>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-black text-white mt-8 mb-4 leading-tight">{renderInlineStyles(line.replace(/^##\s+/, ''))}</h2>;
            if (line.match(/^[\-\*]\s/)) return <div key={i} className="flex gap-3 pr-2"><span className="text-gray-500 mt-2 text-[6px]">●</span><span className="text-gray-300 flex-1 leading-relaxed text-[15px]">{renderInlineStyles(line.replace(/^[\-\*]\s+/, ''))}</span></div>;
            if (line.match(/^\d+\.\s/)) return <div key={i} className="flex gap-3 pr-1"><span className="text-gray-500 font-mono text-sm mt-0.5">{line.match(/^\d+/)?.[0]}.</span><span className="text-gray-300 flex-1 leading-relaxed text-[15px]">{renderInlineStyles(line.replace(/^\d+\.\s+/, ''))}</span></div>;
            return <p key={i} className="leading-relaxed text-[#f0f0f0] text-[15px]">{renderInlineStyles(line)}</p>;
          })}
        </div>
      );
    });
  };

  return (
    <div className={`w-full py-10 px-4 md:px-6 border-b border-white/[0.03] animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className="max-w-3xl mx-auto flex gap-4 md:gap-6 items-start">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-md overflow-hidden ${
          isUser ? 'bg-[#3f3f3f] border-white/10 text-white' : 'bg-transparent border-emerald-500/20'
        }`}>
          {isUser ? <User size={20} /> : <BrandLogo className="w-full h-full" />}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[11px] font-black uppercase tracking-[2px] text-gray-500 mb-3">{isUser ? 'أنت' : 'NZ GPT PRO'}</p>
          <div className="text-[16px] selection:bg-emerald-500/20">
            {message.image && <div className="mb-5 rounded-2xl overflow-hidden border border-white/10 shadow-2xl inline-block"><img src={message.image} alt="Upload" className="max-w-full h-auto max-h-[400px] object-contain" /></div>}
            <div className="overflow-x-auto">
              {isUser ? <p className="whitespace-pre-wrap text-gray-100 leading-relaxed font-medium">{message.text}</p> : <div className="prose prose-invert max-w-none">{renderContent(message.text)}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
