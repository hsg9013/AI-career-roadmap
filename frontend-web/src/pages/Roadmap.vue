<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, useRoadmapStore, type TargetJob, type RoadmapItem } from 'frontend-shared';

// US2 로드맵 페이지 — 선배 경로 기반 합격 로드맵을 시기별로 표시, 추천 거부 지원.

const router = useRouter();
const student = useStudentStore();
const roadmap = useRoadmapStore();

const selectedJobId = ref<number | null>(null);
const busy = ref(false);

onMounted(async () => {
  await student.fetchTargetJobs();
  if (student.targetJobs.length === 0) {
    await router.push('/onboarding');
    return;
  }
  const first = student.targetJobs[0]!;
  selectedJobId.value = first.id;
  await roadmap.fetchLatest(first.id);
});

const current = computed(() =>
  selectedJobId.value !== null ? roadmap.roadmaps[selectedJobId.value] ?? null : null,
);

// 시기(period)별로 묶어 타임라인으로 표시
const grouped = computed<Record<string, RoadmapItem[]>>(() => {
  const out: Record<string, RoadmapItem[]> = {};
  for (const it of current.value?.items ?? []) {
    (out[it.period] ??= []).push(it);
  }
  return out;
});

async function switchJob(job: TargetJob): Promise<void> {
  selectedJobId.value = job.id;
  if (!roadmap.roadmaps[job.id]) await roadmap.fetchLatest(job.id);
}

async function generate(): Promise<void> {
  if (selectedJobId.value === null) return;
  busy.value = true;
  try {
    await roadmap.generate(selectedJobId.value);
  } finally {
    busy.value = false;
  }
}

async function reject(item: RoadmapItem): Promise<void> {
  if (selectedJobId.value === null) return;
  busy.value = true;
  try {
    await roadmap.rejectAndRefresh(selectedJobId.value, item.id);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="roadmap">
    <header class="head">
      <div>
        <h2>합격 로드맵</h2>
        <p class="muted">취업에 성공한 선배들의 (익명화된) 경로를 분석해 시기별 준비 과제를 제안합니다.</p>
      </div>
      <button class="primary" :disabled="busy || selectedJobId === null" @click="generate">
        {{ busy ? '생성 중…' : '로드맵 생성/갱신' }}
      </button>
    </header>

    <nav class="tabs" v-if="student.targetJobs.length > 0">
      <button
        v-for="job in student.targetJobs"
        :key="job.id"
        :class="{ active: job.id === selectedJobId }"
        @click="switchJob(job)"
      >
        {{ job.industry_code }}/{{ job.job_role_code }}
      </button>
    </nav>

    <p v-if="roadmap.lastError" class="error">{{ roadmap.lastError }}</p>

    <div v-if="current">
      <div v-if="current.ai_summary" class="ai-summary">
        <span class="ai-badge" :class="current.ai_source === 'ai' ? 'ai' : 'rule'">
          {{ current.ai_source === 'ai' ? 'AI 코칭' : '코칭 요약' }}
        </span>
        <p>{{ current.ai_summary }}</p>
      </div>
      <p v-if="current.notice" class="notice">⚠ {{ current.notice }}</p>
      <p class="meta muted">
        근거: {{ current.source === 'cohort' ? '선배 코호트' : '직무 요구역량 기반' }}
        · 선배 표본 {{ current.cohort_size }}명
        <span v-if="current.cohort_key"> · {{ current.cohort_key }}</span>
      </p>

      <div v-for="(items, period) in grouped" :key="period" class="period">
        <h3>{{ period }}</h3>
        <ul>
          <li v-for="item in items" :key="item.id" class="item">
            <div class="info">
              <span class="type">{{ item.activity_type }}</span>
              <strong>{{ item.title }}</strong>
              <span v-if="item.target_skill" class="skill">#{{ item.target_skill }}</span>
              <p class="rationale muted">{{ item.rationale }}</p>
            </div>
            <button class="reject" :disabled="busy" @click="reject(item)">관심 없음</button>
          </li>
        </ul>
      </div>
    </div>

    <p v-else-if="!roadmap.loading" class="muted empty">
      아직 생성된 로드맵이 없습니다. 위 버튼으로 로드맵을 생성하세요.
    </p>
  </section>
</template>

<style scoped>
.roadmap { max-width: 880px; margin: 0 auto; padding: 1.5rem; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.primary { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1rem; cursor: pointer; }
.primary:disabled { opacity: 0.5; cursor: default; }
.tabs { display: flex; gap: 0.5rem; margin: 1rem 0; flex-wrap: wrap; }
.tabs button { border: 1px solid #d1d5db; background: #fff; border-radius: 999px; padding: 0.35rem 0.9rem; cursor: pointer; }
.tabs button.active { background: #111827; color: #fff; border-color: #111827; }
.notice { background: #fef3c7; color: #92400e; padding: 0.6rem 0.8rem; border-radius: 8px; }
.ai-summary { background: #eff6ff; border-left: 3px solid #2563eb; border-radius: 6px; padding: 0.7rem 0.9rem; margin: 0.8rem 0; }
.ai-summary p { margin: 0.4rem 0 0; color: #1e3a8a; }
.ai-badge { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; }
.ai-badge.ai { background: #dbeafe; color: #1e40af; }
.ai-badge.rule { background: #f3f4f6; color: #4b5563; }
.error { color: #b91c1c; }
.period { margin-top: 1.2rem; }
.period h3 { margin: 0 0 0.5rem; border-left: 4px solid #2563eb; padding-left: 0.5rem; }
.period ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
.item { display: flex; justify-content: space-between; gap: 1rem; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.7rem 0.9rem; }
.item .type { font-size: 0.72rem; text-transform: uppercase; color: #2563eb; margin-right: 0.5rem; }
.item .skill { color: #6b7280; font-size: 0.8rem; margin-left: 0.4rem; }
.item .rationale { margin: 0.3rem 0 0; }
.reject { align-self: center; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 0.4rem 0.7rem; cursor: pointer; white-space: nowrap; }
.reject:disabled { opacity: 0.5; }
.empty { margin-top: 2rem; text-align: center; }
</style>
