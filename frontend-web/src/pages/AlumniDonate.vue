<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAlumniStore, type DonateActivityInput } from 'frontend-shared';

// US9 선배 합격 경로 기부 — 익명화 저장 후 보상. 누구나(졸업 선배) 가능.

const store = useAlumniStore();
const form = ref({ industry_code: 'IT', job_role_code: 'backend', major_field: 'engineering', grade_band: 'y4plus', success_year: 2025 });
const activities = ref<DonateActivityInput[]>([{ period: 'Y3', activity_type: 'internship', detail: '', skill_tag: '' }]);

interface DonateResult { anonymized: boolean; reward_type: string }
const result = computed(() => store.result as DonateResult | null);

function addRow(): void {
  activities.value.push({ period: 'Y4', activity_type: 'project', detail: '', skill_tag: '' });
}

async function submit(): Promise<void> {
  await store
    .donate({ ...form.value, activities: activities.value.filter((a) => a.detail.trim().length > 0) })
    .catch(() => undefined);
}
</script>

<template>
  <section class="donate">
    <header><h2>합격 경로 기부</h2>
      <p class="muted">개인 식별 정보 없이 익명화되어 후배 추천에 활용됩니다. 기부 시 보상(배지)이 지급됩니다.</p>
    </header>

    <div class="row">
      <input v-model="form.industry_code" placeholder="산업(IT)" />
      <input v-model="form.job_role_code" placeholder="직무(backend)" />
      <input v-model="form.major_field" placeholder="전공계열" />
      <input v-model.number="form.success_year" type="number" placeholder="합격 연도" />
    </div>

    <h3>활동 (시기별)</h3>
    <div v-for="(a, i) in activities" :key="i" class="row">
      <input v-model="a.period" placeholder="Y3" />
      <input v-model="a.activity_type" placeholder="internship" />
      <input v-model="a.detail" placeholder="활동 내용" class="grow" />
      <input v-model="a.skill_tag" placeholder="skill(spring)" />
    </div>
    <button class="ghost" @click="addRow">+ 활동 추가</button>

    <div class="actions">
      <button :disabled="store.loading" @click="submit">{{ store.loading ? '제출 중…' : '기부하기' }}</button>
    </div>
    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>
    <p v-if="result" class="ok">기부 완료 · 익명화 저장됨 · 보상: {{ result.reward_type }}</p>
  </section>
</template>

<style scoped>
.donate { max-width: 720px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; } .ok { color: #166534; }
.row { display: flex; gap: 0.4rem; margin-bottom: 0.4rem; }
.row input { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.45rem; flex: 1; min-width: 0; }
.row input.grow { flex: 2; }
.ghost { border: 1px dashed #9ca3af; background: #fff; border-radius: 8px; padding: 0.4rem 0.8rem; cursor: pointer; }
.actions { margin-top: 1rem; }
.actions button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1.2rem; cursor: pointer; }
</style>
