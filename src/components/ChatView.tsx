import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserProfile, Qualification } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { SupabaseDB, supabase } from '../lib/supabase';
import { 
  MessageSquare, 
  Send, 
  Globe, 
  User, 
  ShieldAlert, 
  Ban, 
  Flag, 
  Check, 
  AlertCircle, 
  Clock, 
  Smile,
  Search,
  MoreVertical,
  X,
  Reply,
  Bot,
  Sparkles,
  Zap,
  HelpCircle,
  BookOpen
} from 'lucide-react';

interface ChatViewProps {
  user: UserProfile;
}

interface PeerItem {
  id: string;
  name: string;
  avatar: string;
  qualification: string;
  isOnline: boolean;
}

const SARA_SUGGESTIONS = [
  '⚡ O que é a Lei de Ohm e como calcular?',
  '💰 Como funciona o levantamento via M-Pesa e E-Mola?',
  '⚙️ Qual a fórmula de torque e rendimento mecânico?',
  '💻 O que é o modelo OSI e endereço IP?',
  '📊 O que é Débito e Crédito na contabilidade?',
  '📐 Qual o traço ideal para concreto estrutural?',
  '🏆 Como funciona a pontuação e taxa de erro no Sara Quiz?',
];

export const ChatView: React.FC<ChatViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'private'>('global');
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Peers list from Supabase / server
  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [peerSearchTerm, setPeerSearchTerm] = useState('');
  const [selectedPeerId, setSelectedPeerId] = useState<string>('sara-ai-assistant');
  const [selectedPeerName, setSelectedPeerName] = useState<string>('Sara (Tutora IA)');
  const [selectedPeerAvatar, setSelectedPeerAvatar] = useState<string>('🤖');
  const [isSaraTyping, setIsSaraTyping] = useState(false);

  // Reporting modal
  const [reportingTarget, setReportingTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState('Spam / Mensagem Repetitiva');
  const [reportSuccess, setReportSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Peers List
  const loadPeers = async () => {
    try {
      const fetchedPeers = await SupabaseDB.getPeers(user.id);
      if (fetchedPeers && fetchedPeers.length > 0) {
        setPeers(fetchedPeers as PeerItem[]);
      }
    } catch (err) {
      console.warn('Error loading peers:', err);
    }
  };

  // Load Global Chat Messages
  const loadGlobalMessages = async () => {
    try {
      const messages = await SupabaseDB.getGlobalMessages();
      if (messages && messages.length > 0) {
        setGlobalMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          prev.forEach((m) => map.set(m.id, m));
          messages.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      }
    } catch (err) {
      console.error('Error fetching global chat from Supabase:', err);
    }
  };

  // Load Private Chat Messages
  const loadPrivateMessages = async () => {
    if (!selectedPeerId) return;

    if (selectedPeerId === 'sara-ai-assistant') {
      // Load Sara chat from local cache
      try {
        const saved = localStorage.getItem(`sara_ai_chat_${user.id}`);
        if (saved) {
          setPrivateMessages(JSON.parse(saved));
          return;
        }
      } catch {}

      // Initial welcome message from Sara
      const welcome: ChatMessage = {
        id: 'sara-welcome-msg',
        user_id: 'sara-ai-assistant',
        user_name: 'Sara (Tutora IA)',
        user_avatar: '🤖',
        user_qualification: 'Informática & Tecnologia' as Qualification,
        message: `Olá, ${user.name}! 👋 Eu sou a Sara, sua assistente inteligente e tutora técnica no Sara Quiz. Estou aqui para te ajudar com dúvidas em qualquer qualificação (Eletricidade, Mecânica, Construção, Gestão, Contabilidade, Informática e Ensino Geral) ou explicar como funciona o jogo e as retiradas em Meticais (MT)! Como posso te ajudar hoje?`,
        created_at: new Date().toISOString(),
        reported: false,
        report_count: 0,
      };
      setPrivateMessages([welcome]);
      return;
    }

    try {
      const messages = await SupabaseDB.getPrivateMessages(user.id, selectedPeerId);
      if (messages) {
        setPrivateMessages(messages);
      }
    } catch (err) {
      console.error('Error fetching private chat from Supabase:', err);
    }
  };

  useEffect(() => {
    loadPeers();
  }, [user.id]);

  // Realtime subscription for Global Chat Messages
  useEffect(() => {
    loadGlobalMessages();

    const channel = supabase
      .channel('public:chat_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newRow = payload.new as any;
          if (newRow && !newRow.is_private) {
            let parsedReply = undefined;
            if (newRow.reply_to) {
              try {
                parsedReply = typeof newRow.reply_to === 'string' ? JSON.parse(newRow.reply_to) : newRow.reply_to;
              } catch {}
            } else if (newRow.reply_to_user_name) {
              parsedReply = {
                id: newRow.reply_to_id || '',
                user_name: newRow.reply_to_user_name,
                message: newRow.reply_to_message || '',
              };
            }

            setGlobalMessages((prev) => {
              if (prev.some((m) => m.id === newRow.id)) return prev;
              return [
                ...prev,
                {
                  id: newRow.id,
                  user_id: newRow.user_id || newRow.sender_id,
                  user_name: newRow.user_name || newRow.sender_name || 'Jogador',
                  user_avatar: newRow.user_avatar || newRow.sender_avatar || '👨‍🎓',
                  user_qualification: (newRow.user_qualification || 'Eletricidade Industrial') as Qualification,
                  message: newRow.content || newRow.message || '',
                  created_at: newRow.created_at || newRow.timestamp || new Date().toISOString(),
                  reported: Boolean(newRow.reported),
                  report_count: Number(newRow.report_count) || 0,
                  reply_to: parsedReply,
                },
              ];
            });
          }
        }
      )
      .subscribe();

    const interval = setInterval(loadGlobalMessages, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user.id]);

  useEffect(() => {
    if (activeTab === 'private') {
      loadPrivateMessages();
      if (selectedPeerId !== 'sara-ai-assistant') {
        const interval = setInterval(loadPrivateMessages, 3000);
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, selectedPeerId, user.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages, privateMessages, activeTab, isSaraTyping]);

  // Anti-spam cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isSending || cooldown > 0) return;

    setIsSending(true);

    const replyPayload = replyingTo
      ? {
          id: replyingTo.id,
          user_name: replyingTo.user_name,
          message: replyingTo.message,
        }
      : undefined;

    try {
      if (activeTab === 'global') {
        const newMsg = await SupabaseDB.sendGlobalMessage({
          user_id: user.id,
          user_name: user.name,
          user_avatar: user.avatar,
          user_qualification: user.qualification_interest || 'Eletricidade Industrial',
          message: textToSend,
          reply_to: replyPayload,
        });
        setGlobalMessages((prev) => [...prev, newMsg]);
        setInputMessage('');
        setReplyingTo(null);
        setCooldown(2);

        // If user tagged @Sara or @sara in global chat, trigger Sara to reply in global chat!
        if (textToSend.toLowerCase().includes('@sara') || textToSend.toLowerCase().startsWith('sara,')) {
          setTimeout(async () => {
            try {
              const cleanPrompt = textToSend.replace(/@sara/gi, '').trim();
              const saraResponse = await SupabaseDB.askSaraAssistant({
                message: cleanPrompt,
                user_id: user.id,
                user_name: user.name,
                user_qualification: user.qualification_interest,
              });

              const saraGlobalMsg = await SupabaseDB.sendGlobalMessage({
                user_id: 'sara-ai-assistant',
                user_name: 'Sara (Tutora IA)',
                user_avatar: '🤖',
                user_qualification: 'Assistente Inteligente & Tutora Oficial' as any,
                message: saraResponse.reply,
                reply_to: {
                  id: newMsg.id,
                  user_name: user.name,
                  message: newMsg.message,
                },
              });
              setGlobalMessages((prev) => [...prev, saraGlobalMsg]);
            } catch {}
          }, 1200);
        }
      } else {
        // Private Chat
        if (selectedPeerId === 'sara-ai-assistant') {
          const userMsg: ChatMessage = {
            id: `pmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            user_id: user.id,
            user_name: user.name,
            user_avatar: user.avatar,
            user_qualification: user.qualification_interest,
            recipient_id: 'sara-ai-assistant',
            recipient_name: 'Sara (Tutora IA)',
            message: textToSend,
            reply_to: replyPayload,
            created_at: new Date().toISOString(),
            reported: false,
            report_count: 0,
          };

          const updatedList = [...privateMessages, userMsg];
          setPrivateMessages(updatedList);
          setInputMessage('');
          setReplyingTo(null);
          setIsSaraTyping(true);

          try {
            localStorage.setItem(`sara_ai_chat_${user.id}`, JSON.stringify(updatedList.slice(-60)));
          } catch {}

          // Call Sara AI
          try {
            const aiRes = await SupabaseDB.askSaraAssistant({
              message: textToSend,
              user_id: user.id,
              user_name: user.name,
              user_qualification: user.qualification_interest,
            });

            const saraMsg: ChatMessage = {
              id: `sara-reply-${Date.now()}`,
              user_id: 'sara-ai-assistant',
              user_name: 'Sara (Tutora IA)',
              user_avatar: '🤖',
              user_qualification: 'Informática & Tecnologia' as Qualification,
              recipient_id: user.id,
              recipient_name: user.name,
              message: aiRes.reply,
              created_at: new Date().toISOString(),
              reported: false,
              report_count: 0,
            };

            const finalList = [...updatedList, saraMsg];
            setPrivateMessages(finalList);
            try {
              localStorage.setItem(`sara_ai_chat_${user.id}`, JSON.stringify(finalList.slice(-60)));
            } catch {}
          } catch (aiErr) {
            console.warn('Sara AI error:', aiErr);
          } finally {
            setIsSaraTyping(false);
          }
        } else {
          // Regular peer private message
          const newPriv = await SupabaseDB.sendPrivateMessage({
            sender_id: user.id,
            sender_name: user.name,
            sender_avatar: user.avatar,
            recipient_id: selectedPeerId,
            recipient_name: selectedPeerName,
            message: textToSend,
            reply_to: replyPayload,
          });
          setPrivateMessages((prev) => [...prev, newPriv]);
          setInputMessage('');
          setReplyingTo(null);
        }
      }
    } catch (err) {
      console.error('Error sending message to Supabase:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReportMessage = async () => {
    if (!reportingTarget) return;

    try {
      await SupabaseDB.reportModeration({
        message_id: reportingTarget.id,
        message_content: reportingTarget.message || '',
        reported_user_id: reportingTarget.user_id || '',
        reported_user_name: reportingTarget.user_name || 'Usuário',
        reporting_user_id: user.id,
        reason: reportReason,
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportingTarget(null);
        setReportSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Error reporting message to Supabase:', err);
    }
  };

  const handleBlockUser = async (targetUserId: string) => {
    setGlobalMessages((prev) => prev.filter((m) => m.user_id !== targetUserId));
    setPrivateMessages((prev) => prev.filter((m) => m.user_id !== targetUserId));
  };

  const filteredPeers = peers.filter((p) =>
    p.name.toLowerCase().includes(peerSearchTerm.toLowerCase()) ||
    p.qualification.toLowerCase().includes(peerSearchTerm.toLowerCase())
  );

  return (
    <div id="screen-chat" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Header with Title & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Comunidade & Tutoria Inteligente</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Sala de <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Conversação & Sara IA</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Converse com todos os usuários cadastrados e tire dúvidas técnicas com a <strong>Sara (Tutora IA)</strong>.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex items-center gap-1 self-start sm:self-auto">
          <button
            id="tab-chat-global"
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'global'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>🌎 Chat Global</span>
          </button>

          <button
            id="tab-chat-private"
            onClick={() => setActiveTab('private')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'private'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>💬 Privado & Sara IA</span>
          </button>
        </div>
      </div>

      {/* Main Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[660px]">
        
        {/* Left Sidebar (Contacts list & Peer Directory) */}
        <div className="hidden lg:flex flex-col border-r border-slate-800 bg-slate-950/50 p-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Usuários & Tutora IA</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Search peer */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar usuário ou matéria..."
              value={peerSearchTerm}
              onChange={(e) => setPeerSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/80"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {filteredPeers.map((peer) => {
              const isSelected = activeTab === 'private' && selectedPeerId === peer.id;
              const isSara = peer.id === 'sara-ai-assistant';

              return (
                <div
                  key={peer.id}
                  onClick={() => {
                    setSelectedPeerId(peer.id);
                    setSelectedPeerName(peer.name);
                    setSelectedPeerAvatar(peer.avatar);
                    if (activeTab === 'global') setActiveTab('private');
                  }}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? isSara 
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-amber-500/10 border-amber-500/40 text-white'
                      : isSara
                      ? 'bg-slate-900/90 border-amber-500/30 hover:border-amber-400 text-amber-200'
                      : 'bg-slate-900/60 border-slate-850 hover:bg-slate-850/80 text-slate-300'
                  }`}
                >
                  <div className="relative">
                    <span className="text-2xl">{peer.avatar}</span>
                    {peer.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold truncate ${isSara ? 'text-amber-400 flex items-center gap-1' : 'text-slate-200'}`}>
                        {peer.name}
                        {isSara && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block">{peer.qualification}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Dica: Use <strong>@Sara</strong> no Chat Global</span>
          </div>
        </div>

        {/* Chat Feed & Input Arena */}
        <div className="lg:col-span-3 flex flex-col h-full bg-slate-900/70">
          
          {/* Channel Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-750 flex items-center justify-center text-xl shrink-0 shadow-inner">
                {activeTab === 'global' ? '🌎' : selectedPeerAvatar}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>{activeTab === 'global' ? 'Canal Geral de Discussão & Dúvidas' : selectedPeerName}</span>
                  {selectedPeerId === 'sara-ai-assistant' && activeTab === 'private' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-extrabold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      IA OFICIAL
                    </span>
                  )}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {activeTab === 'global'
                    ? 'Todos os usuários cadastrados podem ler e interagir. Mencione @Sara para pedir ajuda à IA.'
                    : selectedPeerId === 'sara-ai-assistant'
                    ? 'Tire dúvidas conceituais de qualquer disciplina técnica ou tire dúvidas do jogo!'
                    : 'Conversa privada 100% segura entre usuários cadastrados.'}
                </span>
              </div>
            </div>

            {selectedPeerId === 'sara-ai-assistant' && activeTab === 'private' && (
              <button
                onClick={() => {
                  setPrivateMessages([]);
                  try {
                    localStorage.removeItem(`sara_ai_chat_${user.id}`);
                  } catch {}
                  loadPrivateMessages();
                }}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-750 border border-slate-700 transition-all cursor-pointer"
              >
                Limpar Chat
              </button>
            )}
          </div>

          {/* Quick Suggestions Chips (Especially active when chatting with Sara) */}
          {(selectedPeerId === 'sara-ai-assistant' || activeTab === 'global') && (
            <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1 shrink-0 mr-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Perguntas Rápidas:
              </span>
              {SARA_SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (activeTab === 'global') {
                      setInputMessage(`@Sara ${sug}`);
                      inputRef.current?.focus();
                    } else {
                      handleSendMessage(undefined, sug);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-[11px] text-slate-300 hover:text-amber-200 whitespace-nowrap transition-all cursor-pointer shrink-0"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            {(activeTab === 'global' ? globalMessages : privateMessages).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-sm">
                <MessageSquare className="w-10 h-10 text-slate-700 mb-2" />
                <p>Nenhuma mensagem ainda neste canal.</p>
                <p className="text-xs text-slate-600 mt-1">
                  {activeTab === 'global' 
                    ? 'Envie a primeira mensagem para a comunidade!' 
                    : 'Escreva uma mensagem para iniciar a conversa.'}
                </p>
              </div>
            ) : (
              (activeTab === 'global' ? globalMessages : privateMessages).map((msg) => {
                const isMe = msg.user_id === user.id;
                const isSaraMsg = msg.user_id === 'sara-ai-assistant' || msg.user_name.includes('Sara (Tutora IA)');

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    {/* User Avatar */}
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-md ${
                      isSaraMsg 
                        ? 'bg-amber-500/20 border border-amber-500 text-2xl' 
                        : 'bg-slate-800 border border-slate-700'
                    }`}>
                      {msg.user_avatar}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Name & Time */}
                      <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
                        <span className={`font-bold ${isSaraMsg ? 'text-amber-400 flex items-center gap-1' : 'text-slate-200'}`}>
                          {msg.user_name}
                          {isSaraMsg && <Sparkles className="w-3 h-3 text-amber-400" />}
                        </span>
                        {msg.user_qualification && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                            isSaraMsg
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {msg.user_qualification}
                          </span>
                        )}
                        <span className="text-slate-500 font-mono text-[10px]">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Content Box */}
                      <div
                        className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed relative ${
                          isMe
                            ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md shadow-amber-500/10'
                            : isSaraMsg
                            ? 'bg-slate-900 border-2 border-amber-500/40 text-slate-100 rounded-tl-none shadow-lg shadow-amber-500/5'
                            : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        {/* Render Quoted Reply if message was a response */}
                        {msg.reply_to && (
                          <div
                            className={`mb-2 px-2.5 py-1.5 rounded-xl text-[11px] border-l-2 ${
                              isMe
                                ? 'bg-amber-600/25 border-slate-950 text-slate-950'
                                : 'bg-slate-950/80 border-amber-400 text-slate-300'
                            }`}
                          >
                            <div className="font-bold flex items-center gap-1 text-[10px] opacity-90">
                              <Reply className="w-2.5 h-2.5" />
                              <span>{msg.reply_to.user_name}</span>
                            </div>
                            <p className="truncate line-clamp-1 opacity-80 italic">
                              "{msg.reply_to.message}"
                            </p>
                          </div>
                        )}

                        <div className="whitespace-pre-wrap">{msg.message}</div>
                      </div>

                      {/* Action buttons (Reply / Report / Block) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(msg);
                            inputRef.current?.focus();
                          }}
                          className="hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Responder a esta mensagem"
                        >
                          <Reply className="w-3 h-3" />
                          <span>Responder</span>
                        </button>

                        {!isMe && !isSaraMsg && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setReportingTarget(msg)}
                              className="hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Flag className="w-3 h-3" />
                              <span>Denunciar</span>
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleBlockUser(msg.user_id)}
                              className="hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Bloquear</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Sara is Typing Animation */}
            {isSaraTyping && (
              <div className="flex items-start gap-3 animate-fadeIn">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-xl shrink-0">
                  🤖
                </div>
                <div className="bg-slate-900 border border-amber-500/30 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-slate-400 ml-1">Sara está elaborando a resposta técnica...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Active Reply Banner */}
          {replyingTo && (
            <div className="px-4 py-2 bg-slate-900 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-300 animate-fadeIn">
              <div className="flex items-center gap-2 truncate">
                <Reply className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400">Respondendo a</span>
                <strong className="text-amber-300 truncate">@{replyingTo.user_name}:</strong>
                <span className="text-slate-300 truncate max-w-[220px] sm:max-w-md italic">
                  "{replyingTo.message}"
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
                title="Cancelar resposta"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => handleSendMessage(e)}
            className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2 sm:gap-3"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={
                cooldown > 0
                  ? `Aguarde ${cooldown}s para enviar outra mensagem...`
                  : replyingTo
                  ? `Respondendo a @${replyingTo.user_name}...`
                  : activeTab === 'global'
                  ? 'Digite sua mensagem no Chat Global (ou mencione @Sara)...'
                  : selectedPeerId === 'sara-ai-assistant'
                  ? 'Pergunte qualquer dúvida para a Tutora Sara...'
                  : `Mensagem privada para ${selectedPeerName}...`
              }
              value={inputMessage}
              disabled={cooldown > 0}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={300}
              className="flex-1 bg-slate-900 border border-slate-750 focus:border-amber-400/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || isSending || cooldown > 0}
              className="w-11 h-11 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-slate-950 font-bold flex items-center justify-center transition-all shadow-md shadow-amber-500/20 shrink-0 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

        </div>

      </div>

      {/* Moderation Report Modal Dialog */}
      {reportingTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <ShieldAlert className="w-5 h-5" />
                <span>Denunciar Mensagem</span>
              </div>
              <button
                onClick={() => setReportingTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="py-6 text-center text-emerald-400 font-bold text-sm flex flex-col items-center gap-2">
                <Check className="w-8 h-8 text-emerald-500" />
                <span>Denúncia enviada com sucesso para a moderação!</span>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-300 mb-4">
                  Selecione o motivo da denúncia. Nossa moderação analisará a mensagem imediatamente.
                </p>

                <div className="space-y-2 mb-6">
                  {[
                    'Spam / Mensagens Repetitivas',
                    'Linguagem Ofensiva ou Inadequada',
                    'Divulgação de Dados Pessoais / Fraude',
                    'Desrespeito ou Assédio',
                  ].map((r) => (
                    <label
                      key={r}
                      onClick={() => setReportReason(r)}
                      className={`block p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        reportReason === r
                          ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      {r}
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportingTarget(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleReportMessage}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                  >
                    Enviar Denúncia
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

