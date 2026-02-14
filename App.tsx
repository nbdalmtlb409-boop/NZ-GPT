
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, StopCircle, Trash2, Plus, MessageSquare, History, LogOut, Mail, User as UserIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { Message, Role, ChatSession } from './types';
import { sendMessageToNZGPT } from './services/geminiService';
import MessageItem from './components/MessageItem';

// Firebase Imports
import { auth, googleProvider, db, isFirebaseInitialized } from './firebaseConfig';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// المكون الرسومي للوجو لضمان الدقة
export const BrandLogo = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="25" fill="#10b981"/>
    <path d="M50 20C50 36.5 43.5 50 27 50C43.5 50 50 63.5 50 80C50 63.5 56.5 50 73 50C56.5 50 50 36.5 50 20Z" fill="white"/>
    <path d="M25 25V35M20 30H30" stroke="white" stroke-width="4" stroke-linecap="round"/>
    <path d="M75 65V75M70 70H80" stroke="white" stroke-width="4" stroke-linecap="round"/>
  </svg>
);

function App() {
  const [user, setUser] = useState<User | any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [adRefreshKey, setAdRefreshKey] = useState(0);
  const [messageCountForAds, setMessageCountForAds] = useState(0); 

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (!isFirebaseInitialized || !auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser && db) {
        const q = query(collection(db, "chats"), where("userId", "==", currentUser.uid));
        const unsubscribeChats = onSnapshot(q, (snapshot) => {
          const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
          history.sort((a, b) => b.updatedAt - a.updatedAt);
          setChatHistory(history);
        });
        return () => unsubscribeChats();
      }
    });
    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) setShowHistoryDropdown(false);
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) setShowProfileDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      if (auth && !isGuest) await signOut(auth);
      else { setUser(null); setIsGuest(false); }
      setShowProfileDropdown(false);
    }
  };

  const createNewChat = () => { setMessages([]); setCurrentChatId(null); };

  const loadChat = (session: ChatSession) => {
    setCurrentChatId(session.id);
    setMessages(session.messages);
    setShowHistoryDropdown(false);
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!window.confirm("حذف المحادثة؟") || !db) return;
    try {
      await deleteDoc(doc(db, "chats", chatId));
      if (currentChatId === chatId) createNewChat();
    } catch (error) { showNotification("فشل الحذف"); }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImage || isLoading || isStreaming) return;
    const nextMsgCount = messageCountForAds + 1;
    setMessageCountForAds(nextMsgCount);
    if (nextMsgCount % 3 === 0) setAdRefreshKey(prev => prev + 1);

    const userMsg: Message = { id: Date.now().toString(), role: Role.USER, text: inputText, image: selectedImage || undefined, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    const tempImg = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const botMsgId = (Date.now() + 100).toString();
      let isFirst = true;
      await sendMessageToNZGPT(updatedMessages, userMsg.text, (streamed) => {
        if (isFirst) {
          setIsLoading(false); setIsStreaming(true);
          setMessages(prev => [...prev, { id: botMsgId, role: Role.MODEL, text: streamed, timestamp: Date.now() }]);
          isFirst = false;
        } else {
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: streamed } : m));
        }
      }, tempImg || undefined, abortControllerRef.current.signal);
    } catch (e) { setIsLoading(false); } finally { setIsStreaming(false); }
  };

  const getInitial = (name: string) => {
    return name ? name.trim().charAt(0).toUpperCase() : 'N';
  };

  if (authLoading) return <div className="h-screen w-screen bg-[#212121] flex items-center justify-center"><BrandLogo className="w-16 h-16 animate-pulse" /></div>;

  if (!user) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#212121] items-center justify-center p-6">
        <div className="z-10 bg-[#2a2a2a] border border-white/5 p-10 rounded-[40px] shadow-2xl max-w-md w-full text-center">
          <div className="mb-8 flex justify-center"><BrandLogo className="w-28 h-28" /></div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">NZ GPT PRO</h1>
          <p className="text-gray-400 mb-10">نظام المحادثة الذكي المتطور</p>
          <div className="flex flex-col gap-4">
            <button onClick={async () => { if (!isFirebaseInitialized || !auth || !googleProvider) return; try { await signInWithPopup(auth, googleProvider); } catch (e) { showNotification("فشل تسجيل الدخول"); } }} className="w-full bg-white text-gray-900 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">المتابعة باستخدام Google</button>
            <button onClick={() => { setUser({ uid: 'guest-' + Date.now(), displayName: 'زائر', email: 'guest@nzgpt.pro', photoURL: null }); setIsGuest(true); }} className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 active:scale-95 transition-all">تجربة كزائر</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#212121] text-gray-100 overflow-hidden relative" dir="rtl">
        {/* Header - Fixed to prevent layout shifts */}
        <header className="flex items-center justify-between px-4 sm:px-8 py-3 bg-[#171717] border-b border-white/5 shrink-0 z-[100] relative">
            {/* Visual Right: History Dropdown (Aligned Right in RTL) */}
            <div className="relative" ref={historyDropdownRef}>
                <button onClick={() => setShowHistoryDropdown(!showHistoryDropdown)} className="p-2.5 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all">
                    <History size={22} />
                </button>
                {showHistoryDropdown && (
                    <div className="absolute top-full right-0 mt-3 w-72 sm:w-80 max-h-[70vh] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto z-[110] animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="p-4 border-b border-white/5 sticky top-0 bg-[#1a1a1a] font-bold text-xs text-gray-500">المحادثات السابقة</div>
                        <div className="p-2 space-y-1">
                            {chatHistory.length ? chatHistory.map(c => (
                                <div key={c.id} className="group relative flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" onClick={() => loadChat(c)}>
                                    <MessageSquare size={16} className="text-emerald-500 shrink-0" />
                                    <span className="text-sm truncate flex-1">{c.title}</span>
                                    <button onClick={(e) => handleDeleteChat(e, c.id)} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                </div>
                            )) : <div className="p-8 text-center text-xs text-gray-600">لا يوجد سجل</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Visual Left: New Chat & User Profile (Aligned Left in RTL) */}
            <div className="flex items-center gap-3 sm:gap-6">
                <button onClick={createNewChat} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl transition-all active:scale-95 shadow-lg">
                    <Plus size={18} />
                    <span className="text-sm font-black hidden sm:inline">محادثة جديدة</span>
                </button>

                <div className="relative" ref={profileDropdownRef}>
                    <button 
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)} 
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white/10 bg-emerald-500/10 flex items-center justify-center hover:border-emerald-500 transition-all text-emerald-400 font-black text-lg overflow-hidden shrink-0"
                    >
                        {user.photoURL ? (
                          <img src={user.photoURL} className="w-full h-full object-cover" />
                        ) : (
                          <span>{getInitial(user.displayName)}</span>
                        )}
                    </button>
                    {showProfileDropdown && (
                        <div className="absolute top-full left-0 mt-3 w-64 sm:w-72 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[120] p-1.5 animate-in fade-in zoom-in-95 origin-top-left">
                            <div className="p-4 border-b border-white/5 mb-1 bg-white/5 rounded-t-xl">
                                <p className="text-sm font-black text-white truncate mb-1">{user.displayName || "مستخدم NZ GPT"}</p>
                                <div className="flex items-start gap-2 text-gray-400 mt-2">
                                  <Mail size={12} className="shrink-0 mt-0.5" />
                                  <p className="text-[11px] font-medium break-all leading-tight">{user.email}</p>
                                </div>
                            </div>
                            <div className="mt-1">
                                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all font-black">
                                    <LogOut size={18} className="shrink-0" />
                                    <span>تسجيل الخروج</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>

      <main className="flex-1 overflow-y-auto w-full relative">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
                <div className="mb-8 transform hover:scale-110 transition-transform duration-500">
                   <BrandLogo className="w-24 h-24 sm:w-32 sm:h-32 shadow-2xl rounded-[32px] sm:rounded-[40px] border border-white/10" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tighter">مرحباً {user.displayName?.split(' ')[0]}</h2>
                <p className="text-gray-500 text-sm sm:text-base max-w-sm leading-relaxed font-medium">أنا NZ GPT PRO. رفيقك الذكي في عالم البرمجة والتطوير.</p>
            </div>
          ) : (
            <div className="w-full pb-10">
              {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
              {isLoading && (
                <div className="py-12 px-8 max-w-3xl mx-auto flex gap-6 items-start animate-pulse">
                    <BrandLogo className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex gap-2 mt-4">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
      </main>

      {/* Ad Area */}
      <div key={adRefreshKey} className="w-full flex justify-center bg-[#212121] py-1 border-t border-white/5 shrink-0 overflow-hidden" dangerouslySetInnerHTML={{ __html: `<iframe srcdoc="<html><body style='margin:0;padding:0;display:flex;justify-content:center;'><script>atOptions={'key':'1306df10c9f2f6deae48cc2aa33f8f8e','format':'iframe','height':50,'width':320,'params':{}};</script><script src='https://www.highperformanceformat.com/1306df10c9f2f6deae48cc2aa33f8f8e/invoke.js'></script></body></html>" width="320" height="50" style="border:none" scrolling="no"></iframe>`}} />

      {/* Input Section */}
      <div className="bg-[#212121] border-t border-white/5 p-4 sm:p-6 pb-8 sm:pb-10 shrink-0">
          <div className="max-w-4xl mx-auto relative">
            {selectedImage && (
              <div className="absolute -top-24 right-0 p-2 bg-[#2f2f2f] rounded-2xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-5">
                <img src={selectedImage} className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-xl" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12} /></button>
              </div>
            )}
            <div className="bg-[#2f2f2f] border border-white/10 rounded-[24px] sm:rounded-[32px] shadow-2xl flex items-end overflow-hidden focus-within:border-emerald-500/50 transition-all p-1.5 sm:p-2">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 sm:p-4 text-gray-400 hover:text-white transition-all hover:bg-white/5 rounded-2xl"><Paperclip size={20} /></button>
              <input type="file" ref={fileInputRef} accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setSelectedImage(r.result as string); r.readAsDataURL(f); } }} className="hidden" />
              <textarea 
                ref={textareaRef} 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
                placeholder="اطلب أي كود أو تحليل برمجي..." 
                className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] sm:text-[16px] py-3 sm:py-4 px-2 min-h-[50px] max-h-40 text-white placeholder-gray-500 font-medium resize-none leading-relaxed" 
                rows={1} 
              />
              <div className="p-1">
                {isLoading || isStreaming ? (
                  <button onClick={() => abortControllerRef.current?.abort()} className="p-3 sm:p-4 bg-white text-black rounded-2xl sm:rounded-3xl hover:bg-gray-100 shadow-md active:scale-95 transition-all"><StopCircle size={20} /></button>
                ) : (
                  <button onClick={handleSendMessage} disabled={!inputText.trim() && !selectedImage} className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl transition-all shadow-lg active:scale-95 ${(!inputText.trim() && !selectedImage) ? 'text-gray-600 bg-transparent' : 'bg-emerald-600 text-white'}`}><Send size={20} fill="currentColor" /></button>
                )}
              </div>
            </div>
            <p className="text-center mt-3 text-[10px] text-gray-700 font-black tracking-[3px] uppercase opacity-30">Powered by NZ GPT PRO</p>
          </div>
      </div>
    </div>
  );
}

export default App;
