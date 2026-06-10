<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  useStudentStore,
  useActivitiesStore,
  StudentProfileForm,
  TargetJobPicker,
  type ActivityCategory,
} from 'frontend-shared';

// T056/T074 + 004 US1(G1) Onboarding 위저드
//   1) 프로필  2) 목표 직무  3) 활동·스펙 기록(비차단)  4) 갭 진단 → /dashboard
//   활동·스펙은 진단·로드맵·문서 자동화의 입력. 비워도 진행 가능(나중에 마이페이지에서 추가).

const router = useRouter();
const student = useStudentStore();
const activities = useActivitiesStore();

const targetSaved = ref(false);
const finishing = ref(false);

const CATEGORIES: { value: ActivityCategory; label: string }[] = [
  { value: 'course', label: '수강 과목' },
  { value: 'project', label: '프로젝트' },
  { value: 'club', label: '동아리' },
  { value: 'volunteer', label: '봉사' },
  { value: 'contest', label: '공모전' },
  { value: 'external', label: '대외활동' },
  { value: 'internship', label: '인턴십' },
  { value: 'part_time', label: '아르바이트' },
  { value: 'certification', label: '자격증' },
  { value: 'award', label: '수상' },
];
const actForm = ref<{ category: ActivityCategory; title: string; started_at: string }>({
  category: 'project',
  title: '',
  started_at: '',
});

const steps = computed(() => [
  { label: '프로필', done: student.hasProfile },
  { label: '목표 직무', done: student.targetJobs.length > 0 },
  { label: '활동·스펙', done: activities.items.length > 0 },
  { label: '갭 진단', done: Object.keys(student.diagnoses).length > 0 },
]);
const progressPct = computed(() => {
  const done = steps.value.filter((s) => s.done).length;
  return Math.round((done / steps.value.length) * 100);
});

onMounted(async () => {
  await student.fetchProfile();
  await student.fetchTargetJobs();
  if (student.targetJobs.length > 0) targetSaved.value = true;
  await activities.fetchList();
});

async function onProfileSubmit(value: {
  university: string;
  major: string;
  year_in_school: number;
  expected_grad_at: string | null;
}): Promise<void> {
  await student.updateProfile(value);
}

// 004: 목표 직무 저장만(자동 진단·이동 제거) → 활동·스펙 단계로 진행
async function onTargetSubmit(jobs: Array<{
  industry_code: string;
  job_role_code: string;
  priority: number;
}>): Promise<void> {
  await student.replaceTargetJobs(jobs);
  targetSaved.value = true;
}

async function addActivity(): Promise<void> {
  if (!actForm.value.title || !actForm.value.started_at) return;
  await activities
    .create({ category: actForm.value.category, title: actForm.value.title, started_at: actForm.value.started_at })
    .then(() => { actForm.value.title = ''; actForm.value.started_at = ''; })
    .catch(() => undefined);
}

// 마지막: 갭 진단 실행 후 대시보드 (활동·스펙은 선택이라 비어도 진행)
async function finish(): Promise<void> {
  finishing.value = true;
  try {
    const first = student.targetJobs[0];
    if (first) await student.triggerDiagnosis(first.id);
    await router.push('/dashboard');
  } finally {
    finishing.value = false;
  }
}
</script>

<template>
  <section class="onboarding">
    <h2>온보딩</h2>
    <p class="muted">프로필·목표 직무·활동/스펙을 입력하면 그 데이터로 갭 진단·로드맵·문서가 만들어집니다.</p>

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
    <p v-if="targetSaved" class="ok">목표 직무 저장됨 ✓</p>

    <h3>3. 활동·경험·스펙 <span class="muted">(선택 — 입력하면 추천·문서 품질이 올라갑니다)</span></h3>
    <p class="muted">수강·프로젝트·동아리·봉사·공모전·대외활동·인턴십·아르바이트·자격증·수상을 기록하세요.</p>
    <div class="act-add">
      <select v-model="actForm.category">
        <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <input v-model="actForm.title" placeholder="제목 (예: 캡스톤 프로젝트)" class="grow" />
      <input v-model="actForm.started_at" type="date" />
      <button class="ghost" :disabled="!actForm.title || !actForm.started_at || activities.loading" @click="addActivity">추가</button>
    </div>
    <ul class="act-list">
      <li v-for="a in activities.items" :key="a.id">
        <span class="cat">{{ CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category }}</span>
        <span>{{ a.title }}</span>
        <span class="muted date">{{ a.started_at }}</span>
        <button class="del" @click="activities.remove(a.id)">삭제</button>
      </li>
      <li v-if="!activities.items.length" class="muted empty">아직 없음 — 지금 추가하거나 나중에 마이페이지(활동·스펙)에서 입력할 수 있습니다.</li>
    </ul>

    <h3>4. 갭 진단 실행</h3>
    <button class="finish" :disabled="!targetSaved || finishing" @click="finish">
      {{ finishing ? '진단 실행 중…' : '갭 진단 실행하고 대시보드로' }}
    </button>

    <p v-if="student.lastError" class="err">{{ student.lastError }}</p>
  </section>
</template>

<style scoped>
.onboarding { max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
h2 { margin-bottom: 0.25rem; }
h3 { margin-top: 2rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.ok { color: #166534; font-size: 0.88rem; margin: 0.4rem 0 0; }
.err { color: #b91c1c; margin-top: 1rem; }
.wizard { margin: 1rem 0 0.5rem; }
.bar { height: 8px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
.bar .fill { height: 100%; background: #2563eb; transition: width 0.3s; }
.steps { list-style: none; display: flex; gap: 1.2rem; padding: 0.6rem 0 0; margin: 0; flex-wrap: wrap; }
.steps li { display: flex; align-items: center; gap: 0.4rem; color: #9ca3af; font-size: 0.9rem; }
.steps li.done { color: #166534; font-weight: 600; }
.steps .dot { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: #e5e7eb; font-size: 0.75rem; }
.steps li.done .dot { background: #dcfce7; }
.act-add { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
.act-add .grow { flex: 1; min-width: 160px; }
.act-add input, .act-add select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.45rem 0.6rem; }
.ghost { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.45rem 0.9rem; cursor: pointer; }
.act-list { list-style: none; padding: 0; margin: 0.8rem 0 0; }
.act-list li { display: flex; align-items: center; gap: 0.7rem; padding: 0.45rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
.cat { font-size: 0.72rem; font-weight: 700; background: #eef2ff; color: #4338ca; padding: 0.12rem 0.5rem; border-radius: 999px; }
.date { margin-left: auto; }
.del { background: none; border: 0; color: #b91c1c; cursor: pointer; }
.empty { padding: 0.6rem 0; }
.finish { margin-top: 0.6rem; background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1.2rem; cursor: pointer; font-size: 0.95rem; }
.finish:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
