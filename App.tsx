
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, WifiOff, StopCircle, Sparkles, Menu, Plus, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Message, Role } from './types';
import { sendMessageToNZGPT } from './services/geminiService';
import MessageItem from './components/MessageItem';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFirstLaunchNotice, setShowFirstLaunchNotice] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const savedMessages = localStorage.getItem('nz_gpt_history');
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error("Error loading history", e);
      }
    }

    const firstLaunch = localStorage.getItem('nz_gpt_launched');
    if (!firstLaunch) {
      setShowFirstLaunchNotice(true);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('nz_gpt_history', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleFirstLaunchConfirm = () => {
    localStorage.setItem('nz_gpt_launched', 'true');
    setShowFirstLaunchNotice(false);
  };

  const handleClearHistory = () => {
    if (window.confirm("هل تريد مسح سجل المحادثات نهائياً من الهاتف؟")) {
      setMessages([]);
      localStorage.removeItem('nz_gpt_history');
      setIsSidebarOpen(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        textareaRef.current?.focus();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    if (!isOnline) return;
    const textToSend = textOverride || inputText;
    if ((!textToSend.trim() && !selectedImage) || isLoading || isStreaming) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: textToSend,
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    const tempImage = selectedImage;
    setSelectedImage(null);
    
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const botMsgId = (Date.now() + 100).toString();
      let isFirstChunk = true;

      await sendMessageToNZGPT(
        messages, 
        textToSend,
        (streamedText) => {
           if (isFirstChunk) {
             setIsLoading(false);
             setIsStreaming(true);
             setMessages(prev => [...prev, { id: botMsgId, role: Role.MODEL, text: streamedText, timestamp: Date.now() }]);
             isFirstChunk = false;
           } else {
             setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: streamedText } : msg));
           }
        },
        tempImage || undefined,
        abortControllerRef.current.signal
      );
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: "خطأ في الاتصال. تأكد من جودة الإنترنت.", timestamp: Date.now() }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white p-8 text-center animate-in fade-in duration-300">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
          <WifiOff size={48} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">التطبيق متوقف</h1>
        <p className="text-gray-400 mb-10 max-w-xs leading-relaxed font-medium">
          عذراً، تطبيق <span className="text-white font-black">NZ GPT</span> يعمل حصرياً عبر الإنترنت. يرجى الاتصال بالشبكة للمتابعة.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="w-full max-w-xs py-5 bg-white text-black rounded-[20px] font-black text-lg active:scale-95 transition-all shadow-[0_10px_40px_rgba(255,255,255,0.1)] uppercase tracking-wider"
        >
          تحديث الحالة
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#212121] text-gray-100 overflow-hidden relative">
      
      {showFirstLaunchNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#171717] w-full max-w-sm rounded-[32px] border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
               <ShieldCheck size={32} className="text-blue-500" />
            </div>
            <h2 className="text-2xl font-black mb-4">مرحباً بك في NZ GPT</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              نود إعلامك بأن جميع محادثاتك وسجلاتك يتم **حفظها فعلياً في ذاكرة هاتفك المحلية** لضمان الخصوصية والسرعة. لا يتم تخزين بياناتك على أي خوادم خارجية.
            </p>
            <button 
              onClick={handleFirstLaunchConfirm}
              className="w-full py-4 bg-white text-black rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <CheckCircle2 size={20} />
              فهمت ذلك
            </button>
          </div>
        </div>
      )}

      <div 
        className={`fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      <aside className={`fixed md:relative top-0 right-0 h-full w-[300px] bg-[#171717] z-[70] border-l border-white/5 transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col h-full">
          <button onClick={() => { setMessages([]); localStorage.removeItem('nz_gpt_history'); setIsSidebarOpen(false); }} className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-95 mb-8 shadow-inner">
            <Plus size={20} className="text-white" />
            <span className="font-black text-sm uppercase tracking-wider">محادثة جديدة</span>
          </button>
          
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between mb-4">
               <p className="text-[10px] font-black text-gray-500 uppercase tracking-[2px]">السجل المحفوظ (Offline)</p>
               <button onClick={handleClearHistory} className="text-[9px] font-black text-red-500/70 hover:text-red-500 uppercase">مسح الكل</button>
            </div>
            {messages.length > 0 ? (
              <div className="p-4 bg-white/[0.03] rounded-2xl border-r-4 border-emerald-500 text-sm leading-relaxed text-gray-400 animate-in slide-in-from-right-2">
                {messages[messages.length - 1].text.slice(0, 80)}...
              </div>
            ) : (
              <div className="text-center py-10 opacity-20">
                 <p className="text-xs font-bold">لا يوجد سجل حالياً</p>
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-white/5">
             <div className="flex items-center gap-4 p-5 rounded-3xl bg-[#1f1f1f] border border-white/5">
                <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center font-black shadow-[0_8px_20px_rgba(37,99,235,0.3)]">NZ</div>
                <div className="flex-1 min-w-0">
                   <p className="text-sm font-black truncate">NZ GPT PRO</p>
                   <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">تخزين محلي آمن</p>
                </div>
             </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#212121]">
        
        <header className="h-20 flex items-center justify-between px-6 bg-[#212121]/95 z-50 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mr-2 md:hidden active:scale-90 transition-transform">
              <Menu size={28} />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-2xl tracking-tighter">NZ GPT</h1>
              <span className="bg-emerald-500/20 text-emerald-500 text-[10px] px-2 py-0.5 rounded-md font-black border border-emerald-500/20">OFFLINE-SAVE</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">متصل</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pt-4 selection:bg-blue-500/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-1000">
               <div className="w-24 h-24 mb-10 bg-white/5 rounded-[40px] flex items-center justify-center text-white/10 shadow-inner -rotate-6 border border-white/5">
                  <Sparkles size={56} />
               </div>
               <h2 className="text-4xl font-black text-white mb-6 tracking-tighter">قوة المحادثة بين يديك</h2>
               <p className="text-gray-500 text-base max-w-sm leading-relaxed font-medium">
                  ابدأ محادثة ذكية الآن. جميع ردودي سريعة، دقيقة، ومحفوظة في جهازك للأبد.
               </p>
            </div>
          ) : (
            <div className="w-full pb-40">
              {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
              {isLoading && (
                <div className="py-16 px-8">
                  <div className="max-w-3xl mx-auto flex gap-6 items-start">
                    <div className="w-12 h-12 rounded-[18px] bg-emerald-600 flex items-center justify-center shrink-0 shadow-2xl animate-pulse">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div className="flex gap-2.5 mt-5">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce"></div>
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <div className="p-6 bg-gradient-to-t from-[#212121] via-[#212121]/95 to-transparent absolute bottom-0 left-0 right-0 z-50">
          <div className="max-w-3xl mx-auto safe-pb px-2">
            
            {selectedImage && (
              <div className="absolute -top-24 right-4 p-3 bg-[#2f2f2f] rounded-3xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10 z-50">
                <img src={selectedImage} className="h-16 w-16 object-cover rounded-2xl shadow-lg" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -left-3 bg-white text-black rounded-full p-1.5 shadow-2xl border border-black/10 active:scale-75 transition-transform"><X size={12} /></button>
              </div>
            )}

            <div className="bg-[#2f2f2f] border border-white/10 rounded-[28px] shadow-[0_15px_40px_rgba(0,0,0,0.4)] flex items-end overflow-hidden focus-within:border-white/20 transition-all">
              {/* زر مشبك الورق المصمم بعناية */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-4 text-gray-400 hover:text-white active:scale-90 transition-all shrink-0 self-center"
              >
                <Paperclip size={20} />
              </button>
              
              {/* إخفاء مدخل الملفات تماماً بالـ CSS */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
                style={{ display: 'none' }}
              />

              <textarea 
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-[16px] py-4 px-1 min-h-[56px] max-h-40 text-white placeholder-gray-500 font-medium overflow-y-auto"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
                }}
              />

              <div className="p-2 shrink-0 self-center">
                {isLoading || isStreaming ? (
                  <button onClick={() => abortControllerRef.current?.abort()} className="p-3 bg-white text-black rounded-full hover:bg-gray-100 shadow-xl active:scale-90 transition-all">
                    <StopCircle size={18} />
                  </button>
                ) : (
                  <button 
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() && !selectedImage}
                    className={`p-3 rounded-full transition-all ${(!inputText.trim() && !selectedImage) ? 'text-gray-700 bg-transparent opacity-10' : 'bg-white text-black shadow-2xl active:scale-90'}`}
                  >
                    <Send size={18} fill="currentColor" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex justify-center mt-3">
               <p className="text-[9px] text-gray-600 font-black tracking-[3px] uppercase opacity-50">NZ GPT PRO ENGINE</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
