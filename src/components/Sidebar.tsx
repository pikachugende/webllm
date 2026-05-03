import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Trash2, CheckCircle2, HardDrive, Pencil, Search, X, Settings } from 'lucide-react';
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
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.select();
  }, [editingId]);

  const filtered = search.trim()
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(search.toLowerCase()))
      )
    : conversations;

  const handleStartEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveEdit = (id: string) => {
    onRenameConversation(id, editTitle);
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') handleSaveEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  const displayName = modelName.includes('E4B') ? 'Gemma 4 E4B' : 'Gemma 4 E2B';

  return (
    <aside className="w-72 md:w-80 shrink-0 bg-[#171717] flex flex-col border-r border-[#2a2a2a]">
      {/* New chat button */}
      <div className="p-3 shrink-0">
        <button
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                     bg-[#2a2a2a] text-[#ececec] text-sm font-medium
                     hover:bg-[#3a3a3a] transition-colors"
        >
          <MessageSquarePlus size={16} />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6e6e80]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg
                       text-xs text-[#ececec] placeholder-[#6e6e80]
                       pl-8 pr-3 py-2 outline-none focus:border-[#555] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6e6e80] hover:text-[#ececec]"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {filtered.map(conv => {
          const isActive = conv.id === activeConversationId;
          const isEditing = conv.id === editingId;

          return (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-2 py-2 rounded-lg text-sm cursor-pointer
                          transition-colors
                          ${isActive ? 'bg-[#2f2f2f]' : 'hover:bg-[#252525]'}`}
              onClick={() => { if (!isEditing) onLoadConversation(conv.id); }}
            >
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => handleEditKeyDown(e, conv.id)}
                  onBlur={() => handleSaveEdit(conv.id)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-[#1a1a1a] border border-[#444] rounded px-2 py-0.5
                             text-xs text-[#ececec] outline-none"
                  autoFocus
                />
              ) : (
                <>
                  <span className="flex-1 truncate text-[#adadbe] group-hover:text-[#ececec]">
                    {conv.title || 'New Chat'}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {conv.messages.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(conv.id, conv.title); }}
                        className="p-1 rounded text-[#6e6e80] hover:text-[#ececec] hover:bg-[#3a3a3a]"
                        aria-label="Rename"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                      className="p-1 rounded text-[#6e6e80] hover:text-red-400 hover:bg-[#3a3a3a]"
                      aria-label="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-xs text-[#6e6e80] text-center pt-8 px-4">
            {search.trim() ? 'No conversations match your search.' : 'No conversations yet. Start a new chat!'}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-3 py-3 border-t border-[#2a2a2a] space-y-2">
        {/* Model status */}
        <div className="flex items-center gap-2 text-xs text-[#8e8ea0]">
          {modelCached ? (
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
          ) : (
            <HardDrive size={13} className="text-[#6e6e80] shrink-0" />
          )}
          <span className="truncate">{displayName}</span>
        </div>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 w-full text-xs text-[#6e6e80] hover:text-[#ececec]
                     transition-colors px-1"
        >
          <Settings size={13} />
          Settings
        </button>
      </div>
    </aside>
  );
}
