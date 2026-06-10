<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useActivitiesStore, type ActivityCategory } from 'frontend-shared';

// 004 US1/G1: 활동·경험·스펙 기록(수기). 진단·로드맵·문서 자동화의 입력.
// 온보딩 안내·비차단 — 비어 있어도 막지 않되, 입력하면 추천·문서 품질이 올라간다.

const store = useActivitiesStore();

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

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

const form = ref<{ category: ActivityCategory; title: string; started_at: string; outcome: string }>({
  category: 'project',
  title: '',
  started_at: '',
  outcome: '',
});
const selectedSkills = ref<string[]>([]); // 이 활동이 보여주는 역량(태그 → 진단 점수 반영)

function toggleSkill(s: string): void {
  const i = selectedSkills.value.indexOf(s);
  if (i >= 0) selectedSkills.value.splice(i, 1);
  else selectedSkills.value.push(s);
}

onMounted(() => {
  void store.fetchList();
  void store.fetchCompleteness();
  void store.fetchSuggestedSkills();
});

async function add(): Promise<void> {
  if (!form.value.title || !form.value.started_at) return;
  await store
    .create({
      category: form.value.category,
      title: form.value.title,
      started_at: form.value.started_at,
      outcome: form.value.outcome || undefined,
      manual_tags: selectedSkills.value.length ? [...selectedSkills.value] : undefined,
    })
    .then(() => {
      form.value.title = '';
      form.value.outcome = '';
      selectedSkills.value = [];
    })
    .catch(() => undefined);
}
</script>

<template>
  <section class="activities">
    <header>
      <h2>활동·경험·스펙</h2>
      <p class="muted">
        수강·프로젝트·동아리·봉사·공모전·대외활동·인턴십·아르바이트·자격증·수상을 기록하세요.
        기록한 내용은 역량 진단·로드맵·이력서/자소서/포트폴리오 자동 생성에 사용됩니다.
      </p>
    </header>

    <div v-if="store.completeness" class="completeness" :class="{ ready: store.completeness.ready_for_documents }">
      <span>활동 {{ store.completeness.activities_count }}건 · 스펙 {{ store.completeness.credentials_count }}건</span>
      <span v-if="store.completeness.next_recommended_input" class="hint">{{ store.completeness.next_recommended_input }}</span>
      <span v-else class="ok">문서 자동 생성 준비 완료 ✓</span>
    </div>

    <div class="add">
      <select v-model="form.category">
        <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <input v-model="form.title" placeholder="제목 (예: 캡스톤 프로젝트)" class="grow" />
      <input v-model="form.started_at" type="date" />
      <input v-model="form.outcome" placeholder="성과(선택)" />
      <button :disabled="store.loading || !form.title || !form.started_at" @click="add">추가</button>
    </div>

    <div v-if="store.suggestedSkills.length" class="skills">
      <span class="skills-label">이 활동이 보여주는 역량 <small>(선택 — 진단 점수에 반영됩니다)</small></span>
      <div class="chips">
        <button
          v-for="s in store.suggestedSkills"
          :key="s"
          type="button"
          class="chip"
          :class="{ on: selectedSkills.includes(s) }"
          @click="toggleSkill(s)"
        >{{ s }}</button>
      </div>
    </div>
    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>

    <ul class="list">
      <li v-for="a in store.items" :key="a.id">
        <span class="cat">{{ CATEGORY_LABEL[a.category] ?? a.category }}</span>
        <span class="title">{{ a.title }}</span>
        <span class="date muted">{{ a.started_at }}</span>
        <button class="del" @click="store.remove(a.id)">삭제</button>
      </li>
      <li v-if="!store.items.length" class="empty muted">아직 기록이 없습니다. 첫 활동·스펙을 추가해 보세요.</li>
    </ul>
  </section>
</template>

<style scoped>
.activities { max-width: 720px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.ok { color: #166534; }
.completeness { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.6rem 0.9rem; margin: 0.8rem 0; font-size: 0.88rem; }
.completeness.ready { background: #f0fdf4; border-color: #bbf7d0; }
.completeness .hint { color: #92400e; }
.add { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.6rem; }
.add .grow { flex: 1; min-width: 180px; }
.add input, .add select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.45rem 0.6rem; }
.add button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.45rem 1rem; cursor: pointer; }
.add button:disabled { opacity: 0.5; cursor: not-allowed; }
.list { list-style: none; padding: 0; margin: 1rem 0 0; }
.list li { display: flex; align-items: center; gap: 0.8rem; padding: 0.55rem 0; border-bottom: 1px solid #f3f4f6; }
.cat { font-size: 0.72rem; font-weight: 700; background: #eef2ff; color: #4338ca; padding: 0.12rem 0.5rem; border-radius: 999px; }
.title { font-weight: 500; }
.date { margin-left: auto; }
.del { background: none; border: 0; color: #b91c1c; cursor: pointer; }
.empty { padding: 1rem 0; }
.skills { margin-top: 0.7rem; }
.skills-label { font-size: 0.85rem; color: #374151; }
.skills-label small { color: #9ca3af; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.4rem; }
.chip { border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 999px; padding: 0.25rem 0.7rem; font-size: 0.82rem; cursor: pointer; }
.chip.on { background: #2563eb; color: #fff; border-color: #2563eb; }
</style>
