<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import type { TargetJob } from '../stores/student.js';
import { getApi } from '../api/client.js';

// T054 + 003 US2(T014): 목표 직무 선택 (최대 3, FR-009).
// 산업·직무 선택지는 백엔드 직무·산업 사전 API(/catalog/*)에서 동적으로 로드(산업 10·직무 ~50).

interface Industry {
  code: string;
  name: string;
}
interface JobRole {
  code: string;
  name: string;
}

const industries = ref<Industry[]>([]);
const jobsByIndustry = ref<Record<string, JobRole[]>>({});
const catalogError = ref<string | null>(null);

async function loadIndustries(): Promise<void> {
  try {
    const { data } = await getApi().get<{ items: Industry[] }>('/catalog/industries');
    industries.value = data.items;
  } catch {
    catalogError.value = '산업 목록을 불러오지 못했습니다.';
  }
}

async function loadJobs(industryCode: string): Promise<void> {
  if (!industryCode || jobsByIndustry.value[industryCode]) return;
  try {
    const { data } = await getApi().get<{ items: JobRole[] }>(
      `/catalog/industries/${encodeURIComponent(industryCode)}/jobs`,
    );
    jobsByIndustry.value = { ...jobsByIndustry.value, [industryCode]: data.items };
  } catch {
    catalogError.value = '직무 목록을 불러오지 못했습니다.';
  }
}

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

function rolesFor(industry: string): JobRole[] {
  return jobsByIndustry.value[industry] ?? [];
}

function onIndustryChange(idx: number): void {
  const slot = slots.value[idx];
  if (!slot) return;
  // 산업 변경 시 직무 선택 리셋 + 해당 산업 직무 목록 로드
  slot.job_role_code = '';
  void loadJobs(slot.industry_code);
}

onMounted(async () => {
  await loadIndustries();
  // 기존 선택값이 있으면 해당 산업의 직무도 미리 로드
  for (const s of slots.value) {
    if (s.industry_code) await loadJobs(s.industry_code);
  }
});

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
        <option v-for="c in industries" :key="c.code" :value="c.code">
          {{ c.name }}
        </option>
      </select>
      <select v-model="slot.job_role_code" :disabled="disabled || !slot.industry_code">
        <option value="">— 직무 —</option>
        <option v-for="r in rolesFor(slot.industry_code)" :key="r.code" :value="r.code">
          {{ r.name }}
        </option>
      </select>
    </div>
    <p v-if="catalogError" class="err">{{ catalogError }}</p>
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
