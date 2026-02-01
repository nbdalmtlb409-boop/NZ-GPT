
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, StopCircle, Sparkles, Trash2, LogIn, LogOut, Menu, Plus, MessageSquare, History, AlertTriangle, User as UserIcon, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { Message, Role, ChatSession } from './types';
import { sendMessageToNZGPT } from './services/geminiService';
import MessageItem from './components/MessageItem';

// Firebase Imports
import { auth, googleProvider, db, isFirebaseInitialized } from './firebaseConfig';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';

function App() {
  // Authentication State
  const [user, setUser] = useState<User | any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  
  // UI State - Dropdowns
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // UI State - General
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Notifications
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [adRefreshKey, setAdRefreshKey] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Helper to show notification
  const showNotification = (message: string, type: 'error' | 'success' = 'error') => {
    setNotification({ message, type });
    const duration = type === 'error' ? 10000 : 4000;
    setTimeout(() => setNotification(null), duration);
  };

  // --- Authentication Monitor ---
  useEffect(() => {
    if (!isFirebaseInitialized || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser && db) {
        // Load Real Cloud History from Firebase
        const q = query(
          collection(db, "chats"), 
          where("userId", "==", currentUser.uid)
        );
        
        const unsubscribeChats = onSnapshot(q, (snapshot) => {
          const history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as ChatSession));
          
          history.sort((a, b) => b.updatedAt - a.updatedAt);
          setChatHistory(history);
        }, (error) => {
           console.error("Firestore Read Error:", error);
           if (error.code === 'permission-denied') {
             showNotification("تنبيه: يرجى تسجيل الخروج ثم الدخول مرة أخرى لتحديث صلاحيات قراءة السجل.", "error");
           }
        });
        return () => unsubscribeChats();
      } else {
        setChatHistory([]);
        setMessages([]);
        setCurrentChatId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Network Monitor ---
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

  // --- Ad Timer ---
  useEffect(() => {
    const interval = setInterval(() => {
      setAdRefreshKey(prev => prev + 1);
    }, 30000); 
    return () => clearInterval(interval);
  }, []);

  // --- Auto Scroll ---
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // --- Click Outside Handlers for Dropdowns ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
        setShowHistoryDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleGoogleLogin = async () => {
    if (!isFirebaseInitialized || !auth || !googleProvider) {
      showNotification("يرجى إعداد مفاتيح Firebase لتفعيل تسجيل الدخول.", "error");
      return;
    }
    
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-closed-by-user') {
      } else if (error.code === 'auth/unauthorized-domain') {
         showNotification(`النطاق غير مصرح به.`, "error");
      } else {
        showNotification(`فشل تسجيل الدخول: ${error.message}`, "error");
      }
    }
  };

  const handleGuestLogin = () => {
    const guestUser = {
      uid: 'guest-' + Date.now(),
      displayName: 'زائر',
      email: null,
      photoURL: null,
      isAnonymous: true
    };
    setIsGuest(true);
    setUser(guestUser);
    setChatHistory([]);
  };

  const handleLogout = async () => {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      if (auth && !isGuest) {
        await signOut(auth);
      } else {
        setUser(null);
        setIsGuest(false);
        setMessages([]);
        setChatHistory([]);
      }
      setShowProfileDropdown(false);
    }
  };

  const createNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const loadChat = (session: ChatSession) => {
    setCurrentChatId(session.id);
    setMessages(session.messages);
    setShowHistoryDropdown(false);
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!window.confirm("هل أنت متأكد من حذف هذه المحادثة؟")) return;

    if (!db || !user || isGuest) return;

    try {
        await deleteDoc(doc(db, "chats", chatId));
        if (currentChatId === chatId) {
            createNewChat();
        }
        showNotification("تم حذف المحادثة بنجاح", "success");
    } catch (error: any) {
        console.error("Delete error:", error);
        showNotification("حدث خطأ أثناء الحذف", "error");
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

  const saveChatToFirebase = async (updatedMessages: Message[], newMsgText: string, chatIdOverride?: string | null): Promise<string | null> => {
    if (!user || isGuest) return null;
    if (!db) return null;

    const sanitizedMessages = updatedMessages.map(msg => {
        const cleanMsg: any = { 
            id: msg.id,
            role: msg.role,
            text: msg.text,
            timestamp: msg.timestamp
        };
        if (msg.image) {
            cleanMsg.image = msg.image;
        }
        return cleanMsg;
    });

    const targetChatId = chatIdOverride || currentChatId;

    try {
      if (!targetChatId) {
        const title = newMsgText.length > 30 ? newMsgText.substring(0, 30) + "..." : newMsgText;
        const docRef = await addDoc(collection(db, "chats"), {
          userId: user.uid,
          title: title,
          messages: sanitizedMessages,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        setCurrentChatId(docRef.id);
        return docRef.id;
      } else {
        const chatRef = doc(db, "chats", targetChatId);
        await updateDoc(chatRef, {
          messages: sanitizedMessages,
          updatedAt: Date.now()
        });
        return targetChatId;
      }
    } catch (error: any) {
      console.error("Error saving to Firestore:", error);
      return null;
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    if (!isOnline) {
        showNotification("أنت غير متصل بالإنترنت.", "error");
        return;
    }

    const textToSend = textOverride || inputText;
    if ((!textToSend.trim() && !selectedImage) || isLoading || isStreaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: textToSend,
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    const tempImage = selectedImage;
    setSelectedImage(null);
    
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    let activeChatId = currentChatId;

    if (user && !isGuest) {
        const savedId = await saveChatToFirebase(updatedMessages, textToSend, activeChatId);
        if (savedId) {
            activeChatId = savedId;
            setCurrentChatId(savedId);
        }
    }

    try {
      const botMsgId = (Date.now() + 100).toString();
      let isFirstChunk = true;
      let finalBotText = "";

      await sendMessageToNZGPT(
        updatedMessages, 
        textToSend,
        (streamedText) => {
           finalBotText = streamedText;
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

      if (user && !isGuest) {
        const messagesWithBot = [...updatedMessages, { id: botMsgId, role: Role.MODEL, text: finalBotText, timestamp: Date.now() }];
        await saveChatToFirebase(messagesWithBot, textToSend, activeChatId);
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        const errorMessage = error.message.includes("API Key") 
          ? "مفتاح الذكاء الاصطناعي مفقود." 
          : "خطأ في الاتصال. تأكد من جودة الإنترنت.";
        
        setMessages(prev => [...prev, { id: Date.now().toString(), role: Role.MODEL, text: errorMessage, timestamp: Date.now() }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };


  // --- Render: Login Screen ---
  if (authLoading) {
    return <div className="h-screen w-screen bg-[#212121] flex items-center justify-center"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#212121] items-center justify-center p-6 relative overflow-hidden">
        {notification && (
          <div className={`absolute top-10 right-1/2 translate-x-1/2 md:translate-x-0 md:right-10 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-5 fade-in ${
              notification.type === 'error' ? 'bg-red-500/10 border border-red-500/50 text-red-200' : 'bg-green-500/10 border border-green-500/50 text-green-200'
          }`}>
             {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
             <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="z-10 bg-[#2a2a2a] border border-white/5 p-8 rounded-[32px] shadow-2xl max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[24px] mx-auto mb-6 flex items-center justify-center shadow-lg transform rotate-3">
             <Sparkles className="text-white w-10 h-10" />
          </div>
          
          <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">NZ GPT PRO</h1>
          <p className="text-gray-400 mb-8 font-medium">نظام المحادثة الذكي المتطور</p>
          
          <div className="flex flex-col gap-3 w-full">
            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white text-gray-900 font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all transform shadow-xl hover:bg-gray-50 active:scale-95"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              المتابعة باستخدام Google
            </button>
            <button 
              onClick={handleGuestLogin}
              className="w-full font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 bg-white/5 hover:bg-white/10 text-white border border-white/10"
            >
              <UserIcon className="w-6 h-6" />
              تجربة كزائر
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Main App ---
  return (
    <div className="flex flex-col h-screen w-screen bg-[#212121] text-gray-100 overflow-hidden relative">
      
       {notification && (
          <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full shadow-xl animate-in fade-in slide-in-from-top-2 ${
              notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
             {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
             <span className="text-xs font-bold">{notification.message}</span>
          </div>
        )}

        {/* 
            HEADER 
            Note: flex-row-reverse is used here to enforce Visual Left-to-Right order even in RTL:
            Visual Left: Connection -> History -> New Chat -> Profile : Visual Right
        */}
        <header className="flex flex-row-reverse items-center justify-between px-4 py-3 bg-[#171717] border-b border-white/5 shrink-0 z-50">
            
            {/* Visual Left Group: Connection & History */}
            <div className="flex items-center gap-4">
                {/* 1. Connection Status */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10" title={isOnline ? 'متصل' : 'غير متصل'}>
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${isOnline ? 'bg-green-500 shadow-green-500/60' : 'bg-red-500 shadow-red-500/60'} animate-pulse`}></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:block">{isOnline ? 'متصل' : 'غير متصل'}</span>
                </div>

                {/* 2. History Button & Dropdown */}
                <div className="relative" ref={historyDropdownRef}>
                    <button 
                        onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                        className={`p-2 rounded-xl transition-all ${showHistoryDropdown ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        title="السجل"
                    >
                        <History size={20} />
                    </button>

                    {/* Dropdown Menu */}
                    {showHistoryDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-72 max-h-[70vh] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-y-auto z-[100] animate-in fade-in zoom-in-95 duration-200">
                             <div className="p-3 border-b border-white/5 sticky top-0 bg-[#1a1a1a] z-10 flex justify-between items-center">
                                 <span className="text-xs font-bold text-gray-400 uppercase">المحادثات السابقة</span>
                                 {isGuest && <span className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle size={10}/> زائر</span>}
                             </div>
                             
                             {isGuest ? (
                                <div className="p-8 text-center opacity-40">
                                    <AlertTriangle size={24} className="mx-auto mb-2" />
                                    <p className="text-xs">السجل غير متاح للزوار</p>
                                </div>
                             ) : chatHistory.length === 0 ? (
                                <div className="p-8 text-center opacity-40">
                                    <History size={24} className="mx-auto mb-2" />
                                    <p className="text-xs">لا يوجد سجل</p>
                                </div>
                             ) : (
                                <div className="p-2 space-y-1">
                                    {chatHistory.map(chat => (
                                        <div key={chat.id} className="relative group flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => loadChat(chat)}>
                                            <MessageSquare size={14} className="text-emerald-500 shrink-0" />
                                            <span className="text-sm text-gray-300 truncate flex-1 text-right">{chat.title}</span>
                                            <button 
                                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>
                    )}
                </div>
            </div>

            {/* Visual Right Group: New Chat & Profile */}
            <div className="flex items-center gap-4">
                 {/* 3. New Chat */}
                 <button 
                    onClick={createNewChat}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
                 >
                    <Plus size={18} />
                    <span className="text-sm font-bold hidden sm:inline">محادثة جديدة</span>
                 </button>

                 {/* 4. Profile & Dropdown */}
                 <div className="relative" ref={profileDropdownRef}>
                    <button 
                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                        className="flex items-center gap-2 focus:outline-none group"
                    >
                        <img 
                            src={user.photoURL || "https://ui-avatars.com/api/?name=" + (isGuest ? "Guest" : user.displayName) + "&background=random"} 
                            alt="Profile" 
                            className={`w-9 h-9 rounded-full border-2 transition-all ${showProfileDropdown ? 'border-emerald-500' : 'border-white/10 group-hover:border-white/30'}`}
                        />
                    </button>

                    {/* Profile Dropdown */}
                    {showProfileDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-white/5">
                                <p className="text-sm font-bold text-white truncate">{user.displayName || "مستخدم"}</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{isGuest ? "حساب زائر" : user.email}</p>
                            </div>
                            <div className="p-1">
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 p-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-right"
                                >
                                    <LogOut size={16} />
                                    <span>تسجيل الخروج</span>
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
            </div>

        </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto w-full selection:bg-emerald-500/30">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 mb-8 bg-white/5 rounded-[32px] flex items-center justify-center text-white/10 shadow-inner -rotate-6 border border-white/5">
                  <Sparkles size={48} />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">مرحباً {user.displayName?.split(' ')[0]}</h2>
                <p className="text-gray-500 text-sm max-w-xs leading-relaxed font-medium">
                  {isGuest 
                    ? "أنا NZ GPT PRO. وضع الزائر مفعل." 
                    : "أنا NZ GPT PRO. تم حفظ محادثاتك بأمان في حسابك."
                  }
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

      {/* Adsterra Banner */}
      <div 
          key={adRefreshKey}
          className="w-full flex justify-center bg-[#212121] py-1 shrink-0 border-t border-white/5"
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
