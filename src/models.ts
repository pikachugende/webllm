import { GEMMA4_E2B_MODEL_ID } from './types';

export interface ModelOption {
  id: string;
  label: string;
  shortLabel: string;
  minRamGB: number;
  vramRequiredMB?: number;
  source: 'prebuilt' | 'custom';
  description: string;
}

export const QWEN3_0_6B_MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';
export const QWEN3_1_7B_MODEL_ID = 'Qwen3-1.7B-q4f16_1-MLC';
export const QWEN3_4B_MODEL_ID = 'Qwen3-4B-q4f16_1-MLC';
export const QWEN3_8B_MODEL_ID = 'Qwen3-8B-q4f16_1-MLC';

export const MODEL_CATALOG: readonly ModelOption[] = [
  {
    id: GEMMA4_E2B_MODEL_ID,
    label: 'Gemma 4 E2B',
    shortLabel: 'Gemma 4 E2B',
    minRamGB: 6,
    source: 'custom',
    description: 'Most capable option with native thinking.',
  },
  {
    id: QWEN3_8B_MODEL_ID,
    label: 'Qwen3 8B',
    shortLabel: 'Qwen3 8B',
    minRamGB: 8,
    vramRequiredMB: 5695.78,
    source: 'prebuilt',
    description: 'Highest capacity prebuilt model.',
  },
  {
    id: QWEN3_4B_MODEL_ID,
    label: 'Qwen3 4B',
    shortLabel: 'Qwen3 4B',
    minRamGB: 6,
    vramRequiredMB: 3431.59,
    source: 'prebuilt',
    description: 'Balanced size and quality for mid-range devices.',
  },
  {
    id: QWEN3_1_7B_MODEL_ID,
    label: 'Qwen3 1.7B',
    shortLabel: 'Qwen3 1.7B',
    minRamGB: 4,
    vramRequiredMB: 2036.66,
    source: 'prebuilt',
    description: 'Snappy responses on modest hardware.',
  },
  {
    id: QWEN3_0_6B_MODEL_ID,
    label: 'Qwen3 0.6B',
    shortLabel: 'Qwen3 0.6B',
    minRamGB: 2,
    vramRequiredMB: 1403.34,
    source: 'prebuilt',
    description: 'Lightweight model for low-memory devices.',
  },
];

export function getModelLabel(modelId: string | null | undefined): string {
  if (!modelId) return 'Model not selected';
  return MODEL_CATALOG.find(m => m.id === modelId)?.label ?? modelId;
}

export function getRecommendedModelId(memoryGB?: number): string | null {
  if (!memoryGB) return null;
  if (memoryGB >= 8) return QWEN3_8B_MODEL_ID;
  if (memoryGB >= 6) return GEMMA4_E2B_MODEL_ID;
  if (memoryGB >= 4) return QWEN3_1_7B_MODEL_ID;
  return QWEN3_0_6B_MODEL_ID;
}
