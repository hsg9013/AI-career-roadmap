<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  useStudentStore,
  StudentProfileForm,
  TargetJobPicker,
} from 'frontend-shared';

// T056 Onboarding — 신규 가입자 흐름
//   1) 프로필 보강 (university/major/year 는 가입 시 입력했지만 졸업예정 등 보강 가능)
//   2) 목표 직무 선택 (최대 3)
//   3) 갭 진단 트리거 → /dashboard

const router = useRouter();
const student = useStudentStore();

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
</style>
