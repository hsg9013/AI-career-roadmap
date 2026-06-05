<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { TargetJob } from '../stores/student.js';

// T054: 목표 직무 선택 (최대 3, FR-009).
// 산업·직무 코드는 백엔드 시드(V006) 기준 — 운영 단계에선 별도 API 로 옮긴다.

const CATALOG: Array<{ industry_code: string; label: string; roles: Array<{ code: string; label: string }> }> = [
  {
    industry_code: 'IT',
    label: 'IT',
    roles: [
      { code: 'backend', label: '백엔드' },
      { code: 'frontend', label: '프론트엔드' },
      { code: 'data', label: '데이터' },
      { code: 'ml', label: 'ML/AI' },
    ],
  },
  {
    industry_code: 'FIN',
    label: '금융',
    roles: [{ code: 'quant', label: '퀀트' }],
  },
];

const props = defineProps<{
  initial?: TargetJob[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', value: Array<{ industry_code: string; job_role_code: string; priority: number }>): void;
}>();

interface Slot {
  industry_code: string;
  job_role_code: string;
}

const EMPTY_SLOT: Slot = { industry_code: '', job_role_code: '' };

function slotsFromInitial(jobs: TargetJob[] | undefined): Slot[] {
  const sorted = (jobs ?? []).slice().sort((a, b) => a.priority - b.priority);
  const out: Slot[] = sorted.slice(0, 3).map((j) => ({
    industry_code: j.industry_code,
    job_role_code: j.job_role_code,
  }));
  while (out.length < 3) out.push({ ...EMPTY_SLOT });
  return out;
}

const slots = ref<Slot[]>(slotsFromInitial(props.initial));
const fieldError = ref<string | null>(null);

watch(
  () => props.initial,
  (next) => {
    slots.value = slotsFromInitial(next);
  },
);

function rolesFor(industry: string) {
  return CATALOG.find((c) => c.industry_code === industry)?.roles ?? [];
}

function onIndustryChange(idx: number): void {
  const slot = slots.value[idx];
  if (!slot) return;
  // 산업 변경 시 직무 선택 리셋
  slot.job_role_code = '';
}

const filledCount = computed(() =>
  slots.value.filter((s) => s.industry_code && s.job_role_code).length,
);

function onSubmit(): void {
  const filled = slots.value.filter((s) => s.industry_code && s.job_role_code);
  if (filled.length === 0) {
    fieldError.value = '최소 1개의 목표 직무를 선택하세요';
    return;
  }

  // 중복 검사
  const seen = new Set<string>();
  for (const s of filled) {
    const key = `${s.industry_code}::${s.job_role_code}`;
    if (seen.has(key)) {
      fieldError.value = `중복된 직무: ${key}`;
      return;
    }
    seen.add(key);
  }

  fieldError.value = null;
  emit(
    'submit',
    filled.map((s, idx) => ({
      industry_code: s.industry_code,
      job_role_code: s.job_role_code,
      priority: idx + 1,
    })),
  );
}
</script>

<template>
  <form class="target-job-picker" @submit.prevent="onSubmit">
    <p class="hint">우선순위 1 → 3 순서대로 채워주세요. 최대 3개.</p>
    <div v-for="(slot, idx) in slots" :key="idx" class="slot">
      <span class="priority">#{{ idx + 1 }}</span>
      <select v-model="slot.industry_code" :disabled="disabled" @change="onIndustryChange(idx)">
        <option value="">— 산업 —</option>
        <option v-for="c in CATALOG" :key="c.industry_code" :value="c.industry_code">
          {{ c.label }}
        </option>
      </select>
      <select v-model="slot.job_role_code" :disabled="disabled || !slot.industry_code">
        <option value="">— 직무 —</option>
        <option v-for="r in rolesFor(slot.industry_code)" :key="r.code" :value="r.code">
          {{ r.label }}
        </option>
      </select>
    </div>
    <p v-if="fieldError" class="err">{{ fieldError }}</p>
    <button type="submit" :disabled="disabled || filledCount === 0" class="submit">
      저장 ({{ filledCount }}/3)
    </button>
  </form>
</template>

<style scoped>
.target-job-picker { display: flex; flex-direction: column; gap: 0.6rem; max-width: 520px; }
.hint { color: #6b7280; font-size: 0.85rem; margin: 0; }
.slot { display: flex; align-items: center; gap: 0.5rem; }
.priority {
  width: 2rem; text-align: center; font-weight: 600; color: #2563eb;
  background: #eff6ff; padding: 0.4rem 0; border-radius: 4px;
}
.slot select {
  flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;
}
.slot select:disabled { background: #f3f4f6; cursor: not-allowed; }
.submit {
  margin-top: 0.5rem; padding: 0.6rem 1rem; background: #2563eb; color: #fff;
  border: none; border-radius: 4px; font-weight: 600; cursor: pointer;
}
.submit:disabled { background: #93c5fd; cursor: not-allowed; }
.err { color: #b91c1c; font-size: 0.85rem; }
</style>
