import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Trash2, CheckCircle2, HardDrive, Pencil, Search, X, Settings, Brain, Bot, Zap } from 'lucide-react';
import type { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  modelCached: boolean;
  modelName: string;
  onNewChat: () => void;
  onLoadConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onOpenSettings: () => void;
  reasoningCached: boolean;
  preloadProgress: number | null;
  preloadText: string;
}

export function Sidebar({
  conversations,
  activeConversationId,
  modelCached,
  modelName,
  onNewChat,
  onLoadConversation,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  reasoningCached,
  preloadProgress,
  preloadText,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  // Focus the rename input as soon as it appears
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conv.title);
    setEditingId(conv.id);
  };

  const commitRename = (id: string) => {
    if (editTitle.trim()) onRenameConversation(id, editTitle.trim());
    setEditingId(null);
  };

  // Derive a short display name
  const shortModel = modelName.replace('-MLC', '').replace(/-q4f\w+/i, '');

  return (
    <aside className="flex flex-col w-64 min-h-0 shrink-0 bg-[#171717] select-none">
      {/* ── New Chat + Search ─────────────────────────────────────── */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium
                     text-[#ececec] hover:bg-[#212121] transition-colors duration-150 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
              <Bot size={16} className="text-[#212121]" />
            </div>
            <span>New chat</span>
          </div>
          <MessageSquarePlus size={16} className="text-[#ececec]" />
        </button>
      </div>

      <div className="px-3 pb-2 space-y-1">
        {searchOpen ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2a]
                          ring-1 ring-[#3a3a3a] focus-within:ring-[#555] transition-shadow">
            <Search size={14} className="shrink-0 text-[#6e6e80]" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeSearch()}
              placeholder="Search chats…"
              className="flex-1 bg-transparent text-sm text-[#ececec] placeholder-[#6e6e80]
                         outline-none min-w-0"
            />
            <button
              onClick={closeSearch}
              className="shrink-0 text-[#6e6e80] hover:text-[#ececec] transition-colors"
              aria-label="Close search"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm
                       text-[#ececec] hover:bg-[#2a2a2a] transition-colors duration-150"
          >
            <Search size={16} />
            <span>Search chats</span>
          </button>
        )}
      </div>

      {/* ── Conversation list ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-0.5 mt-2">
        {filteredConversations.length === 0 ? (
          <p className="text-xs text-[#6e6e80] text-center mt-6 px-2">
            {searchQuery.trim() ? 'No matching chats.' : 'No conversations yet.'}
          </p>
        ) : (
          <>
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider
                           text-[#6e6e80] mt-4 mb-1">
              {searchQuery.trim() ? 'Results' : 'Today'}
            </p>

            {filteredConversations.map(conv => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => !isEditing && onLoadConversation(conv.id)}
                  className={`group flex items-center justify-between px-3 py-2.5
                              rounded-lg cursor-pointer text-[13px] transition-colors duration-100
                              ${isActive
                                ? 'bg-[#212121] text-white font-medium'
                                : 'text-[#ececec] hover:bg-[#212121]'
                              }`}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => commitRename(conv.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-transparent text-sm text-[#ececec] outline-none
                                 border-b border-[#555] pb-0.5 mr-1"
                    />
                  ) : (
                    <span className="truncate flex-1">{conv.title}</span>
                  )}

                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-1">
                      <button
                        onClick={e => startRename(conv, e)}
                        className="p-1 rounded hover:text-[#ececec] transition-colors"
                        aria-label="Rename conversation"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="p-1 rounded hover:text-red-400 transition-colors"
                        aria-label="Delete conversation"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Model status footer ─────────────────────────────────────────── */}
      <div className="p-4 space-y-1">
        {/* Instant model row */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#212121] transition-colors">
          <div className="flex items-start gap-2.5 min-w-0">
            {modelCached ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <HardDrive size={15} className="text-[#6e6e80] shrink-0 mt-0.5 animate-pulse" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-medium ${modelCached ? 'text-emerald-400' : 'text-[#8e8ea0]'}`}>
                {modelCached ? 'Instant cached' : 'Downloading…'}
              </p>
              <p className="text-[11px] text-[#6e6e80] truncate">{shortModel}</p>
            </div>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-1.5 shrink-0 rounded-lg text-[#6e6e80] hover:bg-[#2a2a2a]
                       hover:text-[#ececec] transition-colors"
            aria-label="Open settings"
          >
            <Settings size={15} />
          </button>
        </div>

        {/* Reasoning model row */}
        <div className="px-2 py-1.5 rounded-lg hover:bg-[#212121] transition-colors">
          <div className="flex items-start gap-2.5">
            {reasoningCached ? (
              <CheckCircle2 size={15} className="text-violet-400 shrink-0 mt-0.5" />
            ) : (
              <Brain size={15} className={`text-[#6e6e80] shrink-0 mt-0.5 ${
                preloadProgress !== null ? 'animate-pulse' : ''
              }`} />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-medium ${
                reasoningCached ? 'text-violet-400'
                : preloadProgress !== null ? 'text-[#8e8ea0]'
                : 'text-[#6e6e80]'
              }`}>
                {reasoningCached
                  ? 'Reasoning cached'
                  : preloadProgress !== null
                  ? `Downloading… ${preloadProgress}%`
                  : 'Reasoning model'}
              </p>
              <p className="text-[11px] text-[#6e6e80] truncate">Qwen3 1.7B</p>
              {preloadProgress !== null && (
                <div className="mt-1.5 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${preloadProgress}%` }}
                  />
                </div>
              )}
              {preloadProgress !== null && preloadText && (
                <p className="text-[10px] text-[#6e6e80] truncate mt-0.5">{preloadText}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

