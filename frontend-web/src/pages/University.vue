<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useUniversityStore } from 'frontend-shared';

// US6 대학 대시보드 (B2G) — role=university. 동의 범위에 따라 집계/개인 표시.

const store = useUniversityStore();
onMounted(() => store.fetchStudents().catch(() => undefined));

interface View {
  staff_scope: string;
  stats: { total_consented: number; avg_diagnosis_score: number | null; by_major: { major: string; count: number }[] };
  students: { student_id: number; major: string; year_in_school: number; latest_score: number | null }[] | null;
}
const v = computed(() => store.view as View | null);
</script>

<template>
  <section class="univ">
    <header><h2>대학 취업지원 대시보드</h2>
      <p class="muted">학생 동의 범위에 따라 통계(집계) 또는 개인 단위 현황을 제공합니다.</p>
    </header>

    <!-- 004(item4): 대학 SaaS 목적·요금제 안내 -->
    <div class="saas-banner univ">
      <span class="saas-badge">대학 취업지원 SaaS · B2G</span>
      <p class="saas-purpose"><b>목적</b> — 재학생의 취업 역량 현황을 개인정보 없이 <b>집계</b>로 제공해 학과·학교 단위 취업지원 정책 수립을 돕습니다.</p>
      <p class="saas-plan"><b>요금제</b> — 대학 SaaS <b>연간 라이선스</b> · 학생 동의 범위에 따라 집계/개인 단위 데이터 제공(개인정보 보호 게이트 적용).</p>
    </div>

    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>

    <div v-if="v" class="grid">
      <div class="card"><span class="k">동의 학생 수</span><b>{{ v.stats.total_consented }}</b></div>
      <div class="card"><span class="k">평균 진단 점수</span><b>{{ v.stats.avg_diagnosis_score ?? '-' }}</b></div>
      <div class="card"><span class="k">권한 범위</span><b>{{ v.staff_scope }}</b></div>
    </div>

    <h3 v-if="v">전공별 분포</h3>
    <ul v-if="v" class="bars">
      <li v-for="m in v.stats.by_major" :key="m.major"><span>{{ m.major }}</span><b>{{ m.count }}</b></li>
    </ul>

    <template v-if="v && v.students">
      <h3>개인 단위 현황 (개인 동의 학생)</h3>
      <table>
        <thead><tr><th>학생</th><th>전공</th><th>학년</th><th>최근 점수</th></tr></thead>
        <tbody>
          <tr v-for="s in v.students" :key="s.student_id">
            <td>#{{ s.student_id }}</td><td>{{ s.major }}</td><td>{{ s.year_in_school }}</td><td>{{ s.latest_score ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </template>
    <p v-else-if="v" class="muted">개인 단위 조회 권한이 없거나 개인 동의 학생이 없습니다(집계만 제공).</p>
  </section>
</template>

<style scoped>
.univ { max-width: 820px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.saas-banner { border: 1px solid #c7d2fe; background: #eef2ff; border-radius: 12px; padding: 0.9rem 1.1rem; margin: 1rem 0; }
.saas-badge { display: inline-block; font-size: 0.72rem; font-weight: 700; color: #fff; background: #4338ca; border-radius: 999px; padding: 0.15rem 0.6rem; margin-bottom: 0.4rem; }
.saas-purpose, .saas-plan { margin: 0.25rem 0; font-size: 0.88rem; color: #312e81; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin: 1rem 0; }
.card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.8rem; display: flex; flex-direction: column; }
.card .k { font-size: 0.8rem; color: #6b7280; }
.card b { font-size: 1.4rem; }
.bars { list-style: none; padding: 0; display: grid; gap: 0.3rem; }
.bars li { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding: 0.3rem 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.45rem; border-bottom: 1px solid #eee; }
</style>
