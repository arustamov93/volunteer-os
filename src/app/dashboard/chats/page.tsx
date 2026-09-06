'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  User, 
  Building2, 
  FolderIcon, 
  ArrowRight,
  ShieldCheck,
  Inbox,
  Clock,
  Search,
  RefreshCw
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

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

export default function DashboardChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'management' | 'project' | 'organization'>('all');

  const [role, setRole] = useState<'manager' | 'admin'>('manager');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('currentUserRole') as 'manager' | 'admin';
    if (savedRole) setRole(savedRole);
    setCurrentUserId(localStorage.getItem('currentUserId') || '');
    setCurrentUserName(localStorage.getItem('currentUserName') || '');

    const handleSessionChange = () => {
      const updated = localStorage.getItem('currentUserRole') as 'manager' | 'admin';
      if (updated) setRole(updated);
      setCurrentUserId(localStorage.getItem('currentUserId') || '');
      setCurrentUserName(localStorage.getItem('currentUserName') || '');
    };

    window.addEventListener('auth-session-change', handleSessionChange);
    fetchChats();

    return () => window.removeEventListener('auth-session-change', handleSessionChange);
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchChats() {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        setChats(await res.json());
      }
    } catch (e) {
      console.error('Failed to load chats', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(chatId: string, translate: boolean = false) {
    try {
      const url = `/api/chats/messages?chatId=${chatId}${translate ? '&translateTo=ru' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  }



  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newMessageText.trim()) return;
    const textToSend = newMessageText.trim();
    setNewMessageText('');

    const senderId = currentUserId;
    const senderName = currentUserName || (role === 'admin' ? 'Директор' : 'Координатор');
    const senderRole = role === 'admin' ? 'admin' : 'manager';

    if (!senderId) return;

    try {
      const res = await fetch('/api/chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat.id,
          senderId,
          senderName,
          senderRole,
          text: textToSend
        })
      });

      if (res.ok) {
        fetchMessages(selectedChat.id);
      }
    } catch (e) {
      console.error('Failed to send message', e);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24 bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const filteredChats = chats.filter((chat) => {
    const matchesSearch = chat.title.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' ? true : chat.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Обратная связь и Чат-инбокс</h2>
          <p className="text-xs text-slate-500 mt-1">
            Общение с волонтерами, партнерскими организациями и обсуждения по проектам ({chats.length} диалогов)
          </p>
        </div>
        <button
          onClick={fetchChats}
          className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          Обновить
        </button>
      </div>

      {/* Main Grid split: 1/3 Chat list, 2/3 Active chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch min-h-[580px]">
        
        {/* Left column: Chat List */}
        <div className="lg:col-span-1 glass-panel bg-white p-4 sm:p-5 border border-slate-200 shadow-sm rounded-xl flex flex-col space-y-3.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск диалога..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-100">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Все ({chats.length})
            </button>
            <button
              onClick={() => setTypeFilter('project')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                typeFilter === 'project'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Проекты ({chats.filter(c => c.type === 'project').length})
            </button>
            <button
              onClick={() => setTypeFilter('management')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                typeFilter === 'management'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Волонтеры ({chats.filter(c => c.type === 'management').length})
            </button>
            <button
              onClick={() => setTypeFilter('organization')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                typeFilter === 'organization'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Организации ({chats.filter(c => c.type === 'organization').length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[460px] pr-1">
            {filteredChats.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Диалоги не найдены.
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${
                    selectedChat?.id === chat.id
                      ? 'bg-slate-50 border-slate-300 text-slate-900 shadow-sm'
                      : 'bg-white border-slate-100 text-slate-650 hover:text-slate-900 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      {chat.type === 'management' && <ShieldCheck className="w-4 h-4 text-slate-650" />}
                      {chat.type === 'organization' && <Building2 className="w-4 h-4 text-slate-650" />}
                      {chat.type === 'project' && <FolderIcon className="w-4 h-4 text-slate-650" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate font-bold">{chat.title}</div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5">
                        {chat.type === 'management' && 'От волонтера'}
                        {chat.type === 'organization' && 'Организация'}
                        {chat.type === 'project' && 'Чат проекта'}
                      </span>
                    </div>
                  </div>

                  <ArrowRight className={`w-3.5 h-3.5 text-slate-300 transition-transform ${
                    selectedChat?.id === chat.id ? 'translate-x-0.5 text-slate-900' : 'group-hover:translate-x-0.5'
                  }`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right column: Active Chat Room */}
        <div className="lg:col-span-2 glass-panel bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col justify-between overflow-hidden min-h-[500px]">
          {selectedChat ? (
            <div className="flex flex-col h-full justify-between">
              
              {/* Active Chat Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    {selectedChat.type === 'management' && <ShieldCheck className="w-4.5 h-4.5 text-slate-650" />}
                    {selectedChat.type === 'organization' && <Building2 className="w-4.5 h-4.5 text-slate-650" />}
                    {selectedChat.type === 'project' && <FolderIcon className="w-4.5 h-4.5 text-slate-650" />}
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-xs leading-snug">{selectedChat.title}</h4>
                    <span className="text-[9px] text-slate-450 uppercase tracking-widest font-semibold block">
                      {selectedChat.type === 'management' && 'Обратная связь'}
                      {selectedChat.type === 'organization' && 'Партнерская переписка'}
                      {selectedChat.type === 'project' && 'Чат проекта'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={autoTranslate} 
                      onChange={e => setAutoTranslate(e.target.checked)} 
                      className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900" 
                    />
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Авто-перевод</span>
                  </label>
                  {selectedChat.type === 'project' && selectedChat.project_id && (
                    <Link 
                      href={`/dashboard/projects/${selectedChat.project_id}`}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-700 transition-colors"
                    >
                      К проекту →
                    </Link>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/20 max-h-[380px]">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs py-24">
                    Нет сообщений.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === currentUserId;

                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col max-w-[70%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        {!isMine && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 px-1">
                            {msg.sender_name} ({msg.sender_role === 'volunteer' ? 'Волонтер' : 'Куратор'})
                          </span>
                        )}
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMine 
                            ? 'bg-slate-900 text-white rounded-tr-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}>
                          {msg.text}
                          {autoTranslate && !isMine && msg.translatedText && (
                            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded">
                              <span className="font-bold text-slate-600 block mb-0.5">Перевод:</span>
                              {msg.translatedText}
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-slate-400 font-semibold mt-1 px-1">
                          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-3 bg-white shrink-0">
                <input
                  type="text"
                  required
                  placeholder="Введите сообщение куратора..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 transition-all text-xs font-semibold shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Отправить
                </button>
              </form>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 py-36">
              <MessageSquare className="w-10 h-10 text-slate-300" />
              <p className="text-slate-450 text-xs">Выберите активный диалог в левой панели для начала общения</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
