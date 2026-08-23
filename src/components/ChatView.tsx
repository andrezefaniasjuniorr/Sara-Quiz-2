import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserProfile, Qualification } from '../types';
import { QUALIFICATIONS_LIST } from '../data/qualifications';
import { SupabaseDB } from '../lib/supabase';
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
  X
} from 'lucide-react';

interface ChatViewProps {
  user: UserProfile;
}

export const ChatView: React.FC<ChatViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'private'>('global');
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Private chat peer selection
  const [selectedPeerId, setSelectedPeerId] = useState<string>('user-eletro-mestre');
  const [selectedPeerName, setSelectedPeerName] = useState<string>('Carlos Eletrotécnico');
  const [selectedPeerAvatar, setSelectedPeerAvatar] = useState<string>('👨‍🔧');

  // Reporting modal
  const [reportingTarget, setReportingTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState('Spam / Mensagem Repetitiva');
  const [reportSuccess, setReportSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // List of other players for private chat
  const AVAILABLE_PEERS = [
    { id: 'user-eletro-mestre', name: 'Carlos Eletrotécnico', avatar: '👨‍🔧', qualification: 'Eletricidade Industrial' as Qualification, isOnline: true },
    { id: 'user-tech-joao', name: 'João Developer', avatar: '👨‍💻', qualification: 'Informática & Tecnologia' as Qualification, isOnline: true },
    { id: 'user-mec-ana', name: 'Engª. Ana Valente', avatar: '👩‍🔧', qualification: 'Mecânica Industrial' as Qualification, isOnline: true },
    { id: 'user-civil-mateus', name: 'Mateus Construtor', avatar: '👷‍♂️', qualification: 'Construção Civil' as Qualification, isOnline: true },
    { id: 'user-geral-fatima', name: 'Profª. Fátima Mondlane', avatar: '👩‍🏫', qualification: 'Ensino Geral' as Qualification, isOnline: true },
    { id: 'user-cont-lucia', name: 'Dra. Lúcia Contábil', avatar: '👩‍💼', qualification: 'Contabilidade' as Qualification, isOnline: false },
    { id: 'user-gest-antonio', name: 'António Gestor', avatar: '🧑‍💼', qualification: 'Gestão' as Qualification, isOnline: true },
  ];

  // Load Global Chat Messages
  const loadGlobalMessages = async () => {
    try {
      const messages = await SupabaseDB.getGlobalMessages();
      if (messages) {
        setGlobalMessages(messages);
      }
    } catch (err) {
      console.error('Error fetching global chat from Supabase:', err);
    }
  };

  // Load Private Chat Messages
  const loadPrivateMessages = async () => {
    if (!selectedPeerId) return;
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
    loadGlobalMessages();
    const interval = setInterval(loadGlobalMessages, 3000);
    return () => clearInterval(interval);
  }, [user.id]);

  useEffect(() => {
    if (activeTab === 'private') {
      loadPrivateMessages();
      const interval = setInterval(loadPrivateMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, selectedPeerId, user.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages, privateMessages, activeTab]);

  // Anti-spam cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending || cooldown > 0) return;

    setIsSending(true);

    try {
      if (activeTab === 'global') {
        const newMsg = await SupabaseDB.sendGlobalMessage({
          user_id: user.id,
          user_name: user.name,
          user_avatar: user.avatar,
          user_qualification: user.qualification_interest || 'Eletricidade Industrial',
          message: inputMessage.trim(),
        });
        setGlobalMessages((prev) => [...prev, newMsg]);
        setInputMessage('');
        setCooldown(3); // 3 seconds anti-spam cooldown
      } else {
        const newPriv = await SupabaseDB.sendPrivateMessage({
          sender_id: user.id,
          sender_name: user.name,
          sender_avatar: user.avatar,
          recipient_id: selectedPeerId,
          recipient_name: selectedPeerName,
          message: inputMessage.trim(),
        });
        setPrivateMessages((prev) => [...prev, newPriv]);
        setInputMessage('');
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

  return (
    <div id="screen-chat" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      
      {/* Header with Title & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Comunidade em Tempo Real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Sala de <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Conversação</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Conecte-se com estudantes e profissionais de todas as qualificações.
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
            <User className="w-4 h-4" />
            <span>👤 Chat Privado</span>
          </button>
        </div>
      </div>

      {/* Main Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[620px]">
        
        {/* Left Sidebar (Private Contacts list if private tab, or Online Active Players if global) */}
        <div className="hidden lg:flex flex-col border-r border-slate-800 bg-slate-950/50 p-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>{activeTab === 'global' ? 'Jogadores Conectados' : 'Conversas Privadas'}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {AVAILABLE_PEERS.map((peer) => {
              const isSelected = activeTab === 'private' && selectedPeerId === peer.id;

              return (
                <div
                  key={peer.id}
                  onClick={() => {
                    setSelectedPeerId(peer.id);
                    setSelectedPeerName(peer.name);
                    setSelectedPeerAvatar(peer.avatar);
                    if (activeTab === 'global') setActiveTab('private');
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 text-white'
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
                    <h4 className="text-xs font-bold truncate text-slate-200">{peer.name}</h4>
                    <span className="text-[10px] text-slate-500 truncate block">{peer.qualification}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
            🔒 Mensagens protegidas e anônimas
          </div>
        </div>

        {/* Chat Feed & Input Arena */}
        <div className="lg:col-span-3 flex flex-col h-full bg-slate-900/70">
          
          {/* Channel Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">
                {activeTab === 'global' ? '🌎' : selectedPeerAvatar}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  {activeTab === 'global' ? 'Canal Geral de Discussão Técnica' : selectedPeerName}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {activeTab === 'global'
                    ? 'Todos os membros podem ler e interagir respeitosamente'
                    : 'Mensagem privada de usuário para usuário'}
                </span>
              </div>
            </div>

            {activeTab === 'global' && (
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                Livre de spam
              </span>
            )}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            const currentList = activeTab === 'global' ? globalMessages : privateMessages;

            {(activeTab === 'global' ? globalMessages : privateMessages).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-sm">
                <MessageSquare className="w-10 h-10 text-slate-700 mb-2" />
                <p>Nenhuma mensagem ainda neste canal.</p>
                <p className="text-xs text-slate-600 mt-1">Seja o primeiro a enviar uma mensagem técnica!</p>
              </div>
            ) : (
              (activeTab === 'global' ? globalMessages : privateMessages).map((msg) => {
                const isMe = msg.user_id === user.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    {/* User Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
                      {msg.user_avatar}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[75%] sm:max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Name & Time */}
                      <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
                        <span className="font-bold text-slate-200">{msg.user_name}</span>
                        {msg.user_qualification && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-300/90 border border-slate-700">
                            {msg.user_qualification}
                          </span>
                        )}
                        <span className="text-slate-500 font-mono text-[10px]">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Content Box */}
                      <div
                        className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed relative ${
                          isMe
                            ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md shadow-amber-500/10'
                            : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        {msg.message}
                      </div>

                      {/* Action buttons (Report / Block) on hover for other users */}
                      {!isMe && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500">
                          <button
                            onClick={() => setReportingTarget(msg)}
                            className="hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Flag className="w-3 h-3" />
                            <span>Denunciar</span>
                          </button>
                          <span>•</span>
                          <button
                            onClick={() => handleBlockUser(msg.user_id)}
                            className="hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Bloquear</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2 sm:gap-3"
          >
            <input
              type="text"
              placeholder={
                cooldown > 0
                  ? `Aguarde ${cooldown}s para enviar outra mensagem...`
                  : activeTab === 'global'
                  ? 'Digite sua mensagem no Chat Global...'
                  : `Mensagem privada para ${selectedPeerName}...`
              }
              value={inputMessage}
              disabled={cooldown > 0}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={250}
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
