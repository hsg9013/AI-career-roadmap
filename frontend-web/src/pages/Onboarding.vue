<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  useStudentStore,
  StudentProfileForm,
  TargetJobPicker,
} from 'frontend-shared';

// T056/T074 Onboarding 위저드 — 진행률 표시 + 필수 단계 우선
//   1) 프로필 보강  2) 목표 직무 선택  3) 갭 진단 자동 실행 → /dashboard
//   SC-001(첫 진단 15분 이내) 달성을 위해 단계 완료 상태를 시각화한다.

const router = useRouter();
const student = useStudentStore();

// 위저드 진행 단계: 프로필 → 목표직무 → 진단
const steps = computed(() => [
  { label: '프로필', done: student.hasProfile },
  { label: '목표 직무', done: student.targetJobs.length > 0 },
  { label: '갭 진단', done: Object.keys(student.diagnoses).length > 0 },
]);
const progressPct = computed(() => {
  const done = steps.value.filter((s) => s.done).length;
  return Math.round((done / steps.value.length) * 100);
});

onMounted(async () => {
  await student.fetchProfile();
  await student.fetchTargetJobs();
});

async function onProfileSubmit(value: {
  university: string;
  major: string;
  year_in_school: number;
  expected_grad_at: string | null;
}): Promise<void> {
  await student.updateProfile(value);
}

async function onTargetSubmit(jobs: Array<{
  industry_code: string;
  job_role_code: string;
  priority: number;
}>): Promise<void> {
  await student.replaceTargetJobs(jobs);
  const first = student.targetJobs[0];
  if (first) {
    await student.triggerDiagnosis(first.id);
  }
  await router.push('/dashboard');
}
</script>

<template>
  <section class="onboarding">
    <h2>온보딩</h2>
    <p class="muted">프로필을 보강하고 목표 직무를 선택하면 자동으로 갭 진단이 실행됩니다.</p>

    <div class="wizard">
      <div class="bar"><div class="fill" :style="{ width: progressPct + '%' }"></div></div>
      <ol class="steps">
        <li v-for="(s, i) in steps" :key="i" :class="{ done: s.done }">
          <span class="dot">{{ s.done ? '✓' : i + 1 }}</span>{{ s.label }}
        </li>
      </ol>
    </div>

    <h3>1. 프로필</h3>
    <StudentProfileForm
      :initial="student.profile"
      submit-label="프로필 저장"
      :disabled="student.loading"
      @submit="onProfileSubmit"
    />

    <h3>2. 목표 직무 (최대 3)</h3>
    <TargetJobPicker
      :initial="student.targetJobs"
      :disabled="student.loading"
      @submit="onTargetSubmit"
    />

    <p v-if="student.lastError" class="err">{{ student.lastError }}</p>
  </section>
</template>

<style scoped>
.onboarding { max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
h2 { margin-bottom: 0.25rem; }
h3 { margin-top: 2rem; }
.muted { color: #6b7280; }
.err { color: #b91c1c; margin-top: 1rem; }
.wizard { margin: 1rem 0 0.5rem; }
.bar { height: 8px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
.bar .fill { height: 100%; background: #2563eb; transition: width 0.3s; }
.steps { list-style: none; display: flex; gap: 1.2rem; padding: 0.6rem 0 0; margin: 0; }
.steps li { display: flex; align-items: center; gap: 0.4rem; color: #9ca3af; font-size: 0.9rem; }
.steps li.done { color: #166534; font-weight: 600; }
.steps .dot { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: #e5e7eb; font-size: 0.75rem; }
.steps li.done .dot { background: #dcfce7; }
</style>
