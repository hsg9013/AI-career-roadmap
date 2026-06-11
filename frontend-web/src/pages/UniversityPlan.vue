<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useUniversityStore } from 'frontend-shared';

// 005 고도화: 대학 전용 [대학 기관 플랜 관리]
//   - 캠퍼스 엔터프라이즈 라이선스(B2B/B2G) 현황 + 학생 계정 쿼터 + 갱신일 + 결제 내역.
//   - 쿼터 사용량은 대학 대시보드의 동의 학생 수(실데이터)를 활용.

interface UnivView { stats?: { total_consented?: number } }
const store = useUniversityStore();
onMounted(() => store.fetchStudents().catch(() => undefined));

const QUOTA = 500; // 데모 라이선스 좌석(학생 계정) 한도
const used = computed(() => (store.view as UnivView | null)?.stats?.total_consented ?? 0);
const usedPct = computed(() => Math.min(100, Math.round((used.value / QUOTA) * 100)));
const renewDate = '2027-03-01'; // 데모: 연간 구독 갱신일
</script>

<template>
  <section class="uplan">
    <header>
      <h2>대학 기관 플랜 관리</h2>
      <p class="muted">대학 취업지원실 B2B/B2G 통합 라이선스 구독 현황입니다.</p>
    </header>

    <!-- 현재 플랜 -->
    <div class="plan-card">
      <div>
        <span class="badge">구독 중</span>
        <h3>캠퍼스 엔터프라이즈 플랜</h3>
        <p class="muted">학내 취업률 통계·개인 단위 현황·인재 추천 연동을 포함한 기관 통합 라이선스.</p>
      </div>
      <div class="fee">
        <b>₩6,600,000</b><span class="muted"> / 연 (VAT 별도)</span>
      </div>
    </div>

    <!-- 학생 계정 쿼터 -->
    <div class="quota">
      <div class="q-head">
        <h4>학생 계정 쿼터(좌석)</h4>
        <span class="q-num">{{ used.toLocaleString() }} / {{ QUOTA.toLocaleString() }}</span>
      </div>
      <div class="bar"><div class="fill" :style="{ width: usedPct + '%' }"></div></div>
      <p class="muted small">동의 학생 {{ used.toLocaleString() }}명이 라이선스 좌석을 사용 중입니다(사용률 {{ usedPct }}%).</p>
    </div>

    <!-- 갱신/알림 -->
    <div class="grid2">
      <div class="info-card">
        <h4>연간 구독 갱신</h4>
        <p class="big">{{ renewDate }}</p>
        <p class="muted small">⏰ 갱신일 30일 전 담당자 이메일로 안내됩니다.</p>
      </div>
      <div class="info-card">
        <h4>라이선스 유형</h4>
        <p class="big">B2B · B2G 통합</p>
        <p class="muted small">정부지원(B2G)·자체예산(B2B) 혼합 계약.</p>
      </div>
    </div>

    <!-- 결제 내역 -->
    <h4 class="sec">기관 이용료 결제 내역</h4>
    <table class="btbl">
      <thead><tr><th>청구월</th><th>항목</th><th>금액</th><th>상태</th></tr></thead>
      <tbody>
        <tr><td>2026-03</td><td>캠퍼스 엔터프라이즈(연간, 500석)</td><td>₩6,600,000</td><td><span class="st paid">결제 완료</span></td></tr>
        <tr><td>2025-03</td><td>캠퍼스 엔터프라이즈(연간, 500석)</td><td>₩6,600,000</td><td><span class="st paid">결제 완료</span></td></tr>
      </tbody>
    </table>
    <p class="muted small">세금계산서·계약 변경은 운영팀(기관 파트너 지원)으로 문의하세요.</p>
  </section>
</template>

<style scoped>
.uplan { max-width: 860px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.small { font-size: 0.82rem; }
.plan-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border: 1px solid #c7d2fe; background: #eef2ff; border-radius: 12px; padding: 1.1rem 1.2rem; margin: 1rem 0; }
.plan-card h3 { margin: 0.3rem 0; }
.badge { font-size: 0.7rem; font-weight: 700; color: #fff; background: #4338ca; border-radius: 999px; padding: 0.12rem 0.55rem; }
.plan-card .fee b { font-size: 1.5rem; color: #312e81; }
.quota { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.2rem; margin: 1rem 0; }
.q-head { display: flex; justify-content: space-between; align-items: baseline; }
.q-head h4 { margin: 0; }
.q-num { font-weight: 700; color: #4338ca; }
.bar { height: 12px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin: 0.5rem 0; }
.bar .fill { height: 100%; background: #4f46e5; border-radius: 999px; transition: width 0.4s; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin: 1rem 0; }
.info-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 0.9rem 1.1rem; }
.info-card h4 { margin: 0 0 0.3rem; }
.info-card .big { font-size: 1.2rem; font-weight: 700; margin: 0.2rem 0; color: #1e293b; }
.sec { margin-top: 1.4rem; }
.btbl { width: 100%; border-collapse: collapse; margin: 0.4rem 0; }
.btbl th, .btbl td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; font-size: 0.88rem; }
.st.paid { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: #dcfce7; color: #166534; }
@media (max-width: 720px) { .grid2 { grid-template-columns: 1fr; } }
</style>
