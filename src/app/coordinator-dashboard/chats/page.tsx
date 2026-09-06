'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  User, 
  Building2, 
  FolderIcon, 
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Search,
  RefreshCw,
  ExternalLink,
  Bot
} from 'lucide-react';
import Link from 'next/link';

interface Chat {
  id: string;
  type: 'management' | 'organization' | 'project';
  title: string;
  project_id?: string | null;
  volunteer_id?: string | null;
  target_org_id?: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  text: string;
  created_at: string;
  translatedText?: string;
}

export default function CoordinatorChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'management' | 'project' | 'organization'>('all');
  const [autoTranslate, setAutoTranslate] = useState(false);

  const [currentUserId, setCurrentUserId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem('currentUserId') || '');
    loadChats();
  }, []);

  // Poll messages when a chat is open
  useEffect(() => {
    if (!selectedChat) return;

    fetchMessages(selectedChat.id, autoTranslate);
    const interval = setInterval(() => {
      fetchMessages(selectedChat.id, autoTranslate);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedChat, autoTranslate]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadChats() {
    setLoading(true);
    try {
      const res = await fetch('/api/chats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const chatList = Array.isArray(data) ? data : [];
        setChats(chatList);
        if (chatList.length > 0 && !selectedChat) {
          setSelectedChat(chatList[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load chats:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(chatId: string, translate: boolean = false) {
    try {
      const url = `/api/chats/messages?chatId=${chatId}${translate ? '&translateTo=ru' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChat || !newMessageText.trim() || sending) return;
    const textToSend = newMessageText.trim();
    setNewMessageText('');
    setSending(true);

    try {
      const res = await fetch('/api/chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chatId: selectedChat.id,
          text: textToSend
        })
      });

      if (res.ok) {
        await fetchMessages(selectedChat.id, autoTranslate);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  }

  const filteredChats = chats.filter((chat) => {
    const matchesSearch = chat.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' ? true : chat.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          Загрузка чатов...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Чаты координатора</h1>
          <p className="text-xs text-slate-500 mt-1">
            Прямое общение с волонтерами, партнерскими организациями и обсуждения проектов ({chats.length} диалогов)
          </p>
        </div>
        <button
          onClick={loadChats}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          Обновить
        </button>
      </div>

      {/* Main Grid: Left Column (Chat List), Right Column (Active Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[640px]">
        
        {/* Left column: Chat List & Filters */}
        <div className="lg:col-span-1 bg-white p-4 sm:p-5 border border-slate-200 shadow-sm rounded-2xl flex flex-col space-y-3.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск диалога или волонтера..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Все ({chats.length})
            </button>
            <button
              onClick={() => setTypeFilter('project')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                typeFilter === 'project'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Проекты ({chats.filter(c => c.type === 'project').length})
            </button>
            <button
              onClick={() => setTypeFilter('management')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                typeFilter === 'management'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Волонтеры ({chats.filter(c => c.type === 'management').length})
            </button>
            <button
              onClick={() => setTypeFilter('organization')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                typeFilter === 'organization'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Организации ({chats.filter(c => c.type === 'organization').length})
            </button>
          </div>

          {/* Chat List Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[520px] pr-1">
            {filteredChats.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Диалоги не найдены.
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = selectedChat?.id === chat.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-200 text-slate-900 shadow-sm'
                        : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        chat.type === 'management' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                        chat.type === 'project' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {chat.type === 'management' && <ShieldCheck className="w-4 h-4" />}
                        {chat.type === 'organization' && <Building2 className="w-4 h-4" />}
                        {chat.type === 'project' && <FolderIcon className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-blue-950' : 'text-slate-900'}`}>
                          {chat.title}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mt-0.5">
                          {chat.type === 'management' && 'От волонтера'}
                          {chat.type === 'organization' && 'Организация'}
                          {chat.type === 'project' && 'Чат проекта'}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${
                      isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300'
                    }`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Active Chat Room */}
        <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col justify-between overflow-hidden min-h-[560px]">
          {selectedChat ? (
            <div className="flex flex-col h-full justify-between">
              
              {/* Active Chat Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedChat.type === 'management' ? 'bg-indigo-100 text-indigo-700' :
                    selectedChat.type === 'project' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {selectedChat.type === 'management' && <ShieldCheck className="w-5 h-5" />}
                    {selectedChat.type === 'organization' && <Building2 className="w-5 h-5" />}
                    {selectedChat.type === 'project' && <FolderIcon className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <h2 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate leading-snug">
                      {selectedChat.title}
                    </h2>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                      {selectedChat.type === 'management' && 'Обращение волонтера'}
                      {selectedChat.type === 'organization' && 'Партнерская переписка'}
                      {selectedChat.type === 'project' && 'Обсуждение проекта'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="hidden sm:flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm text-slate-700">
                    <input 
                      type="checkbox" 
                      checked={autoTranslate} 
                      onChange={e => setAutoTranslate(e.target.checked)} 
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                    />
                    <span className="text-[10px] font-bold uppercase">Авто-перевод</span>
                  </label>
                  {selectedChat.type === 'project' && selectedChat.project_id && (
                    <Link 
                      href={`/coordinator-dashboard/projects/${selectedChat.project_id}`}
                      className="text-[11px] bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-slate-700 transition-colors flex items-center gap-1 shadow-sm"
                    >
                      К проекту
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/30 max-h-[460px]">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-400 text-xs py-28">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                    <span>В этом диалоге пока нет сообщений. Напишите первое!</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === currentUserId || msg.sender_role === 'coordinator' || msg.sender_role === 'admin';
                    const isBot = msg.sender_name.includes('ИИ-Секретарь') || msg.sender_id === 'bot_secretary';

                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col max-w-[82%] sm:max-w-[70%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          {isBot && <Bot className="w-3 h-3 text-purple-600" />}
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            isBot ? 'text-purple-600' : isMine ? 'text-blue-600' : 'text-slate-500'
                          }`}>
                            {msg.sender_name} {isMine ? '(Вы)' : `(${msg.sender_role === 'volunteer' ? 'Волонтер' : msg.sender_role})`}
                          </span>
                        </div>
                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMine 
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : isBot
                            ? 'bg-purple-50 border border-purple-200 text-purple-950 rounded-tl-none font-mono text-[11px]'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}>
                          {msg.text}
                          {autoTranslate && !isMine && msg.translatedText && (
                            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                              <span className="font-bold text-slate-700 block mb-0.5">Перевод:</span>
                              {msg.translatedText}
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-semibold mt-1 px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} className="p-3.5 sm:p-4 border-t border-slate-100 flex gap-2.5 bg-white shrink-0">
                <input
                  type="text"
                  required
                  placeholder="Напишите ответ волонтеру..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessageText.trim()}
                  className="px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white flex items-center justify-center gap-1.5 transition-all text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{sending ? 'Отправка...' : 'Отправить'}</span>
                </button>
              </form>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 py-36">
              <MessageSquare className="w-12 h-12 text-slate-300" />
              <p className="text-slate-500 text-xs font-medium">Выберите диалог в левой панели для начала общения</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
