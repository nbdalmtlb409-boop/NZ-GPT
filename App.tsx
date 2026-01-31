
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, WifiOff, StopCircle, Sparkles, Trash2, Heart } from 'lucide-react';
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
  
  // حالة النافذة المنبثقة للترحيب/الشكر (مستقلة تماماً)
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  
  // حالة لتحديث الإعلان السفلي (اختياري)
  const [adRefreshKey, setAdRefreshKey] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // دالة لتحديث الإعلان السفلي كل 30 ثانية
  useEffect(() => {
    const interval = setInterval(() => {
      setAdRefreshKey(prev => prev + 1);
    }, 30000); 

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm("هل تريد بدء محادثة جديدة؟ سيتم مسح النصوص الحالية.")) {
      setMessages([]);
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
    
    // --- منطق الإعلان الصارم (كل 6 دقائق) ---
    try {
      // نستخدم مفتاحاً جديداً لضمان عدم تداخل التخزين القديم
      const STORAGE_KEY = 'nz_gpt_timer_v2'; 
      const COOLDOWN_MS = 6 * 60 * 1000; // 6 دقائق بالميلي ثانية
      
      const now = Date.now();
      const lastShownStr = localStorage.getItem(STORAGE_KEY);
      const lastShown = lastShownStr ? parseInt(lastShownStr) : 0;

      // الشرط: إذا لم يظهر أبداً (0) أو مرت 6 دقائق منذ آخر ظهور
      if (lastShown === 0 || (now - lastShown > COOLDOWN_MS)) {
        
        // 1. تحديث المؤقت فوراً لمنع التكرار
        localStorage.setItem(STORAGE_KEY, now.toString());
        
        // 2. حقن السكربت
        console.log('NZ GPT: Ad Timer Expired. Injecting Ad Script.');
        const script = document.createElement('script');
        script.src = "https://pl28591749.effectivegatecpm.com/57/e0/a8/57e0a890f94e142c034f01797d447fec.js";
        script.async = true;
        document.body.appendChild(script);
      } else {
        const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastShown)) / 60000);
        console.log(`NZ GPT: Ad is in cooldown. Next ad in approx ${remainingMinutes} minutes.`);
      }
    } catch (e) {
      console.error("Ad injection logic error", e);
    }
    // ------------------------------------------

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
    <div className="flex flex-col h-screen w-screen bg-[#212121] text-gray-100 overflow-hidden relative">
      
      {/* Welcome Popup Modal - نافذة الشكر والتقدير */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl transform scale-100 animate-in zoom-in-95 duration-300 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
               <Heart className="text-emerald-500 w-7 h-7 fill-emerald-500/20" />
            </div>
            
            <h2 className="text-xl font-black text-white mb-3 tracking-tight">إهداء وتقدير</h2>
            
            <div className="w-12 h-1 bg-emerald-500/30 rounded-full mb-6"></div>

            <p className="text-gray-300 text-[15px] leading-7 font-medium mb-8">
              كل الشكر للمطور
              <br/>
              <span className="text-emerald-400 font-bold text-lg block mt-1">نصرالدين عبد المطلب الزايدي</span>
            </p>
            
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
            >
              موافق
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#212121]/95 z-50 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="font-black text-xl tracking-tighter">NZ GPT</h1>
        </div>
        
        <div className="flex items-center gap-4">
            {messages.length > 0 && (
              <button 
                onClick={handleClearChat} 
                className="p-2 text-gray-500 hover:text-red-500 transition-colors active:scale-90"
                title="بدء محادثة جديدة"
              >
                <Trash2 size={18} />
              </button>
            )}
            
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">متصل</span>
            </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto w-full selection:bg-blue-500/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000">
              <div className="w-20 h-20 mb-8 bg-white/5 rounded-[32px] flex items-center justify-center text-white/10 shadow-inner -rotate-6 border border-white/5">
                <Sparkles size={48} />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">مرحباً بك</h2>
              <p className="text-gray-500 text-sm max-w-xs leading-relaxed font-medium">
                أنا NZ GPT PRO. كيف يمكنني مساعدتك اليوم في مهامك البرمجية؟
              </p>
          </div>
        ) : (
          <div className="w-full pb-6">
            {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
            {isLoading && (
              <div className="py-12 px-8">
                <div className="max-w-3xl mx-auto flex gap-6 items-start">
                  <div className="w-10 h-10 rounded-[14px] bg-emerald-600 flex items-center justify-center shrink-0 shadow-2xl animate-pulse">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Adsterra Banner 320x50 */}
      <div 
        key={adRefreshKey}
        className="w-full flex justify-center bg-[#212121] py-1 shrink-0"
        dangerouslySetInnerHTML={{ __html: `
          <iframe 
            srcdoc="<html><body style='margin:0;padding:0;background:transparent;display:flex;justify-content:center;align-items:center;'><script>atOptions = {'key' : '1306df10c9f2f6deae48cc2aa33f8f8e','format' : 'iframe','height' : 50,'width' : 320,'params' : {}};</script><script src='https://www.highperformanceformat.com/1306df10c9f2f6deae48cc2aa33f8f8e/invoke.js'></script></body></html>"
            width="320"
            height="50"
            style="border:none;overflow:hidden;"
            scrolling="no"
            frameborder="0"
          ></iframe>
        `}} 
      />

      {/* Input Area */}
      <div className="bg-[#212121] border-t border-white/5 p-4 safe-pb z-40 relative">
        <div className="max-w-3xl mx-auto relative">
          
          {selectedImage && (
            <div className="absolute -top-24 right-0 p-2 bg-[#2f2f2f] rounded-2xl border border-white/10 shadow-xl animate-in slide-in-from-bottom-5 z-50">
              <img src={selectedImage} className="h-14 w-14 object-cover rounded-xl" />
              <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-lg active:scale-90"><X size={12} /></button>
            </div>
          )}

          <div className="bg-[#2f2f2f] border border-white/10 rounded-[24px] shadow-lg flex items-end overflow-hidden focus-within:border-white/20 transition-all">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 text-gray-400 hover:text-white active:scale-90 transition-all shrink-0 self-center"
            >
              <Paperclip size={18} />
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleImageUpload} 
              className="hidden" 
            />

            <textarea 
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
              placeholder="اكتب رسالتك..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-3.5 px-1 min-h-[50px] max-h-32 text-white placeholder-gray-500 font-medium overflow-y-auto"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
              }}
            />

            <div className="p-1.5 shrink-0 self-center">
              {isLoading || isStreaming ? (
                <button onClick={() => abortControllerRef.current?.abort()} className="p-2.5 bg-white text-black rounded-full hover:bg-gray-100 shadow-md active:scale-90 transition-all">
                  <StopCircle size={16} />
                </button>
              ) : (
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() && !selectedImage}
                  className={`p-2.5 rounded-full transition-all ${(!inputText.trim() && !selectedImage) ? 'text-gray-600 bg-transparent' : 'bg-emerald-600 text-white shadow-lg active:scale-90'}`}
                >
                  <Send size={16} fill="currentColor" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex justify-center mt-2">
             <p className="text-[8px] text-gray-600 font-bold tracking-[2px] uppercase opacity-40">NZ GPT PRO</p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
