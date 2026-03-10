import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, accurate, and concise AI assistant. Answer the user's questions directly and honestly.`;

interface SettingsModalProps {
  open: boolean;
  systemPrompt: string;
  onSave: (prompt: string) => void;
  onClose: () => void;
}

export function SettingsModal({ open, systemPrompt, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState(systemPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset draft whenever the modal opens
  useEffect(() => {
    if (open) {
      setDraft(systemPrompt);
      // Focus the textarea after the animation frame
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, systemPrompt]);

  if (!open) return null;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-[#1e1e1e] border border-[#3a3a3a]
                   rounded-2xl shadow-2xl flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-base font-semibold text-[#ececec]">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8ea0] hover:bg-[#2a2a2a] hover:text-[#ececec]
                       transition-colors"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          {/* System Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#ececec]">
                System Prompt
              </label>
              <button
                onClick={() => setDraft(DEFAULT_SYSTEM_PROMPT)}
                className="flex items-center gap-1.5 text-xs text-[#6e6e80] hover:text-[#ececec]
                           transition-colors"
                title="Reset to default"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
            <p className="text-xs text-[#6e6e80]">
              Sets the assistant's behaviour for all new and existing conversations.
            </p>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={6}
              className="w-full rounded-lg bg-[#2a2a2a] border border-[#3a3a3a]
                         text-sm text-[#ececec] placeholder-[#6e6e80] resize-y
                         px-3 py-2.5 outline-none focus:border-[#555] transition-colors"
              placeholder="Enter a system prompt…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2a2a2a]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[#8e8ea0] hover:bg-[#2a2a2a]
                       hover:text-[#ececec] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white
                       hover:bg-emerald-500 transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
