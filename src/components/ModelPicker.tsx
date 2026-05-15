import { Cpu, Sparkles } from 'lucide-react';
import type { ModelOption } from '../models';

interface ModelPickerProps {
  open: boolean;
  models: readonly ModelOption[];
  recommendedModelId: string | null;
  deviceMemoryGB?: number;
  onSelect: (modelId: string) => void;
  onClose?: () => void;
  canClose?: boolean;
}

function formatVram(vramRequiredMB?: number): string {
  if (!vramRequiredMB) return 'N/A';
  const gb = vramRequiredMB / 1024;
  return `${gb.toFixed(1)} GB VRAM`;
}

export function ModelPicker({
  open,
  models,
  recommendedModelId,
  deviceMemoryGB,
  onSelect,
  onClose,
  canClose = false,
}: ModelPickerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414] text-[#ececec]">
      <div className="w-full max-w-5xl px-6 py-10 relative">
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-xs text-[#8e8ea0] hover:text-[#ececec]"
          >
            Close
          </button>
        )}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold">Choose your model</h1>
          <p className="text-sm text-[#9b9bb0] max-w-2xl">
            Models run entirely in your browser. We recommend the best model for your device,
            but you can choose any option below.
          </p>
          <div className="flex items-center gap-2 text-xs text-[#6e6e80] mt-1">
            <Cpu size={14} />
            <span>
              Device memory: {deviceMemoryGB ? `${deviceMemoryGB} GB` : 'Unknown'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
          {models.map(model => {
            const isRecommended = model.id === recommendedModelId;
            return (
              <button
                key={model.id}
                onClick={() => onSelect(model.id)}
                className={`text-left w-full rounded-2xl border px-5 py-4 transition-all
                  ${
                    isRecommended
                      ? 'border-emerald-500/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]'
                      : 'border-[#2a2a2a] bg-[#1d1d1d] hover:border-[#3a3a3a] hover:bg-[#232323]'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <span>{model.label}</span>
                      {isRecommended && (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-[#8e8ea0] mt-1">{model.description}</p>
                  </div>
                  <span className="text-xs text-[#6e6e80]">
                    Min {model.minRamGB} GB RAM
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-[#9b9bb0]">
                  <span className="px-2 py-1 rounded-full bg-[#2a2a2a]">
                    {model.source === 'custom' ? 'Custom MLC' : 'WebLLM prebuilt'}
                  </span>
                  {model.vramRequiredMB && (
                    <span className="px-2 py-1 rounded-full bg-[#2a2a2a]">
                      {formatVram(model.vramRequiredMB)}
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-full bg-[#2a2a2a]">
                    Thinking toggle supported
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-center text-[#6e6e80] mt-8">
          You can change your selection later by clearing local storage or adding a model switcher.
        </p>
      </div>
    </div>
  );
}
