<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useAdminStore, type UsageBucket } from 'frontend-shared';

// 관리자 대시보드 — 서비스유형별 / 기간별 / 사용자별 사용 지표를 막대그래프로 시각화.
// 의존성 없이 CSS 막대로 렌더(배포 단순화).

const admin = useAdminStore();
onMounted(() => admin.fetchUsage().catch(() => undefined));

function maxOf(rows: UsageBucket[]): number {
  return rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
}
const u = computed(() => admin.usage);
</script>

<template>
  <section class="admin">
    <header>
      <h2>관리자 대시보드</h2>
      <p class="muted">사용 이벤트 지표 — 서비스유형 · 기간 · 사용자별 분포</p>
    </header>

    <p v-if="admin.lastError" class="error">{{ admin.lastError }}</p>
    <p v-if="admin.loading" class="muted">불러오는 중…</p>

    <template v-if="u">
      <div class="total">총 이벤트 <b>{{ u.total }}</b>건</div>

      <div class="charts">
        <div class="chart">
          <h3>서비스 유형별</h3>
          <ul>
            <li v-for="r in u.byType" :key="r.key">
              <span class="lbl">{{ r.key }}</span>
              <span class="track"><span class="fill type" :style="{ width: (r.count / maxOf(u.byType) * 100) + '%' }"></span></span>
              <span class="val">{{ r.count }}</span>
            </li>
          </ul>
        </div>

        <div class="chart">
          <h3>기간(월)별</h3>
          <ul>
            <li v-for="r in u.byPeriod" :key="r.key">
              <span class="lbl">{{ r.key }}</span>
              <span class="track"><span class="fill period" :style="{ width: (r.count / maxOf(u.byPeriod) * 100) + '%' }"></span></span>
              <span class="val">{{ r.count }}</span>
            </li>
          </ul>
        </div>

        <div class="chart">
          <h3>사용자별 (상위 20)</h3>
          <ul>
            <li v-for="r in u.byUser" :key="r.key">
              <span class="lbl">#{{ r.key }}</span>
              <span class="track"><span class="fill user" :style="{ width: (r.count / maxOf(u.byUser) * 100) + '%' }"></span></span>
              <span class="val">{{ r.count }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin { max-width: 1000px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.total { margin: 0.5rem 0 1rem; font-size: 1rem; }
.total b { font-size: 1.3rem; color: #2563eb; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.chart { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; }
.chart h3 { margin: 0 0 0.7rem; font-size: 1rem; }
.chart ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.35rem; }
.chart li { display: grid; grid-template-columns: 110px 1fr 36px; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.lbl { color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track { background: #f3f4f6; border-radius: 999px; height: 14px; overflow: hidden; }
.fill { display: block; height: 100%; border-radius: 999px; }
.fill.type { background: #2563eb; }
.fill.period { background: #059669; }
.fill.user { background: #d97706; }
.val { text-align: right; color: #111; font-variant-numeric: tabular-nums; }
@media (max-width: 720px) { .charts { grid-template-columns: 1fr; } }
</style>
