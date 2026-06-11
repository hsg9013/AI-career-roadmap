<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useCompaniesStore, useCatalogStore } from 'frontend-shared';
import { getApi } from 'frontend-shared';

// US7 기업 인재 검색 (B2B) — role=enterprise. 매칭 동의 학생만 노출.
// 005 US4(H4): 산업·직무를 자유 텍스트가 아닌 시스템 목록(catalog)에서 드롭다운 선택 → 코드 매칭.

interface CatalogItem { code: string; name: string }

const store = useCompaniesStore();
const catalog = useCatalogStore();
const industry = ref('');
const role = ref('');
const industries = ref<CatalogItem[]>([]);
const jobs = ref<CatalogItem[]>([]);
const catalogError = ref('');

async function loadIndustries(): Promise<void> {
  try {
    const { data } = await getApi().get<{ items: CatalogItem[] }>('/catalog/industries');
    industries.value = data.items;
  } catch {
    catalogError.value = '산업 목록을 불러오지 못했습니다.';
  }
}

async function loadJobs(industryCode: string): Promise<void> {
  jobs.value = [];
  role.value = '';
  if (!industryCode) return;
  try {
    const { data } = await getApi().get<{ items: CatalogItem[] }>(
      `/catalog/industries/${encodeURIComponent(industryCode)}/jobs`,
    );
    jobs.value = data.items;
  } catch {
    catalogError.value = '직무 목록을 불러오지 못했습니다.';
  }
}

watch(industry, (code) => void loadJobs(code));
onMounted(() => {
  void loadIndustries();
  void catalog.load(); // 후보의 목표 직무를 한글 라벨로 표시(item 14 일관성)
});

async function search(): Promise<void> {
  await store.search({ industry_code: industry.value || undefined, job_role_code: role.value || undefined });
}
</script>

<template>
  <section class="company">
    <header><h2>인재 검색</h2>
      <p class="muted">직무 요건에 맞는 후보를 검색합니다. 매칭에 동의한 학생만 노출됩니다.</p>
    </header>

    <!-- 004(item4): 기업 인재검색 SaaS 목적·요금제 안내 -->
    <div class="saas-banner">
      <span class="saas-badge">기업 인재 검색 SaaS · B2B</span>
      <p class="saas-purpose"><b>목적</b> — 직무 요건에 맞는 인재를 <b>매칭 동의 학생</b> 풀에서 검색·발굴합니다(역량 진단 점수 기반).</p>
      <p class="saas-plan"><b>요금제</b> — <b>채용 성사 기반 수수료</b> 모델 · 검색·열람은 무료, 채용 전환 시 약정 수수료가 청구됩니다.</p>
    </div>

    <div class="filters">
      <select v-model="industry">
        <option value="">산업 선택</option>
        <option v-for="i in industries" :key="i.code" :value="i.code">{{ i.name }}</option>
      </select>
      <select v-model="role" :disabled="!industry || !jobs.length">
        <option value="">직무 선택</option>
        <option v-for="j in jobs" :key="j.code" :value="j.code">{{ j.name }}</option>
      </select>
      <button :disabled="store.loading || !industry" @click="search">검색</button>
    </div>
    <p v-if="catalogError" class="error">{{ catalogError }}</p>
    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>

    <table v-if="store.candidates.length">
      <thead><tr><th>학생</th><th>전공</th><th>학년</th><th>목표</th><th>점수</th></tr></thead>
      <tbody>
        <tr v-for="c in store.candidates" :key="c.student_id">
          <td>#{{ c.student_id }}</td><td>{{ c.major }}</td><td>{{ c.year_in_school }}</td>
          <td>{{ catalog.jobLabel(c.target_industry, c.target_role) }}</td><td>{{ c.latest_score ?? '-' }}</td>
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
.saas-banner { border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 12px; padding: 0.9rem 1.1rem; margin: 1rem 0; }
.saas-badge { display: inline-block; font-size: 0.72rem; font-weight: 700; color: #fff; background: #15803d; border-radius: 999px; padding: 0.15rem 0.6rem; margin-bottom: 0.4rem; }
.saas-purpose, .saas-plan { margin: 0.25rem 0; font-size: 0.88rem; color: #14532d; }
.filters { display: flex; gap: 0.5rem; margin: 1rem 0; }
.filters input, .filters select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem; min-width: 160px; }
.filters select:disabled { background: #f3f4f6; color: #9ca3af; }
.filters button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.45rem; border-bottom: 1px solid #eee; }
</style>
