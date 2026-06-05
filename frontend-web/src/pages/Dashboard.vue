<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, GapDiagnosisChart, type TargetJob } from 'frontend-shared';

// T056 Dashboard — 갭 진단 결과를 직무별로 표시. 활동/직무 미설정 시 온보딩으로 유도.

const router = useRouter();
const student = useStudentStore();
const triggering = ref(false);

const selectedJobId = ref<number | null>(null);

onMounted(async () => {
  await Promise.all([student.fetchProfile(), student.fetchTargetJobs()]);
  if (student.targetJobs.length === 0) {
    await router.push('/onboarding');
    return;
  }
  const first = student.targetJobs[0]!;
  selectedJobId.value = first.id;
  await student.fetchLatestDiagnosis(first.id);
});

const selectedDiagnosis = computed(() =>
  selectedJobId.value !== null ? student.diagnoses[selectedJobId.value] ?? null : null,
);

async function switchJob(job: TargetJob): Promise<void> {
  selectedJobId.value = job.id;
  if (!student.diagnoses[job.id]) {
    await student.fetchLatestDiagnosis(job.id);
  }
}

async function rerunDiagnosis(): Promise<void> {
  if (selectedJobId.value === null) return;
  triggering.value = true;
  try {
    await student.triggerDiagnosis(selectedJobId.value);
  } finally {
    triggering.value = false;
  }
}
</script>

<template>
  <section class="dashboard">
    <header class="head">
      <div>
        <h2>대시보드</h2>
        <p class="muted" v-if="student.profile">
          {{ student.profile.university }} · {{ student.profile.major }} · {{ student.profile.year_in_school }}학년
        </p>
      </div>
      <button class="rerun" :disabled="triggering || selectedJobId === null" @click="rerunDiagnosis">
        {{ triggering ? '진단 중…' : '갭 진단 다시 실행' }}
      </button>
    </header>

    <div class="tabs" v-if="student.targetJobs.length > 0">
      <button
        v-for="job in student.targetJobs"
        :key="job.id"
        :class="['tab', { active: selectedJobId === job.id }]"
        type="button"
        @click="switchJob(job)"
      >
        #{{ job.priority }} {{ job.industry_code }} / {{ job.job_role_code }}
      </button>
    </div>

    <div v-if="selectedDiagnosis" class="chart-wrap">
      <GapDiagnosisChart :diagnosis="selectedDiagnosis" />
    </div>
    <div v-else class="empty">
      <p>이 직무에 대한 진단 이력이 없습니다.</p>
      <button class="rerun" :disabled="triggering" @click="rerunDiagnosis">지금 진단 실행</button>
    </div>

    <p v-if="student.lastError" class="err">{{ student.lastError }}</p>

    <p class="footer">
      <router-link to="/onboarding">목표 직무 변경하기</router-link>
    </p>
  </section>
</template>

<style scoped>
.dashboard { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
.head { display: flex; align-items: flex-end; justify-content: space-between; }
.head h2 { margin: 0; }
.muted { color: #6b7280; font-size: 0.9rem; margin: 0.25rem 0 0; }
.tabs { display: flex; gap: 0.4rem; margin: 1rem 0 1.5rem; flex-wrap: wrap; }
.tab {
  background: #f3f4f6; border: 1px solid transparent; padding: 0.45rem 0.9rem;
  border-radius: 999px; font-size: 0.9rem; cursor: pointer; color: #374151;
}
.tab.active { background: #2563eb; color: #fff; }
.chart-wrap { background: #fff; padding: 1.25rem; border: 1px solid #e5e7eb; border-radius: 8px; }
.empty { text-align: center; color: #6b7280; padding: 3rem 0; }
.rerun {
  padding: 0.5rem 0.9rem; background: #fff; border: 1px solid #d1d5db; border-radius: 4px;
  cursor: pointer; font-size: 0.9rem;
}
.rerun:hover { background: #f9fafb; }
.rerun:disabled { opacity: 0.6; cursor: not-allowed; }
.footer { margin-top: 2rem; font-size: 0.9rem; text-align: center; }
.err { color: #b91c1c; margin-top: 1rem; }
</style>
