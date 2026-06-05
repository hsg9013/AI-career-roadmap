<script setup lang="ts">
import { ref } from 'vue';
import { useCompaniesStore } from 'frontend-shared';

// US7 기업 인재 검색 (B2B) — role=enterprise. 매칭 동의 학생만 노출.

const store = useCompaniesStore();
const industry = ref('IT');
const role = ref('backend');

async function search(): Promise<void> {
  await store.search({ industry_code: industry.value || undefined, job_role_code: role.value || undefined });
}
</script>

<template>
  <section class="company">
    <header><h2>인재 검색</h2>
      <p class="muted">직무 요건에 맞는 후보를 검색합니다. 매칭에 동의한 학생만 노출됩니다.</p>
    </header>
    <div class="filters">
      <input v-model="industry" placeholder="산업 코드 (예: IT)" />
      <input v-model="role" placeholder="직무 코드 (예: backend)" />
      <button :disabled="store.loading" @click="search">검색</button>
    </div>
    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>

    <table v-if="store.candidates.length">
      <thead><tr><th>학생</th><th>전공</th><th>학년</th><th>목표</th><th>점수</th></tr></thead>
      <tbody>
        <tr v-for="c in store.candidates" :key="c.student_id">
          <td>#{{ c.student_id }}</td><td>{{ c.major }}</td><td>{{ c.year_in_school }}</td>
          <td>{{ c.target_industry }}/{{ c.target_role }}</td><td>{{ c.latest_score ?? '-' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!store.loading" class="muted">검색 결과가 없습니다 (동의 학생 없음 또는 조건 불일치).</p>
  </section>
</template>

<style scoped>
.company { max-width: 820px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.filters { display: flex; gap: 0.5rem; margin: 1rem 0; }
.filters input { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem; }
.filters button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.45rem; border-bottom: 1px solid #eee; }
</style>
