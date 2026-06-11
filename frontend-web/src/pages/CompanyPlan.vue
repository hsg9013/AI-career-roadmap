<script setup lang="ts">
import { ref } from 'vue';

// 005 고도화: 기업 전용 [기업 플랜 서비스]
//   - 인재 열람권 구독 상품(베이직/프로) + 매칭 성사 수수료 안내 + 결제 관리.
//   - 표현/안내 중심(요금제 카드). 실제 구독·결제 연동은 운영 계약 시 활성화.

// 기업 SaaS = 무료 + 멤버십(유료) 2단계.
const PLANS = [
  {
    code: 'free', name: '무료', price: '₩0', highlight: false,
    features: ['월 인재 열람 5건', '산업·직무 기본 검색', '기본 매칭 리포트', '담당자 1석'],
  },
  {
    code: 'membership', name: '멤버십', price: '₩300,000 / 월', highlight: true,
    features: ['월 인재 열람 무제한', '심층 매칭 분석 리포트', '관심 인재 저장·알림', '담당자 5석', '연 결제 시 2개월 할인(₩3,000,000/년)', '우선 지원'],
  },
];
const current = ref('free'); // 데모: 현재 이용 플랜(기본 무료)
</script>

<template>
  <section class="cplan">
    <header>
      <h2>기업 플랜 서비스</h2>
      <p class="muted">무료 플랜과 멤버십 구독, 채용 성사 수수료로 구성된 기업 전용 요금제입니다.</p>
    </header>

    <div class="plans">
      <div v-for="p in PLANS" :key="p.code" class="plan" :class="{ on: p.highlight, current: current === p.code }">
        <div class="p-head">
          <h3>{{ p.name }}<span v-if="current === p.code" class="cur-tag">이용 중</span></h3>
          <p class="price">{{ p.price }}</p>
        </div>
        <ul>
          <li v-for="f in p.features" :key="f">✓ {{ f }}</li>
        </ul>
        <button :disabled="current === p.code" @click="current = p.code">
          {{ current === p.code ? '현재 플랜' : '이 플랜으로 변경' }}
        </button>
      </div>
    </div>

    <p class="sandbox-note">🧪 데모 — 실제 구독 결제는 운영 계약 시 활성화됩니다.</p>

    <div class="fee">
      <h4>채용 성사 수수료</h4>
      <p class="muted">검색·열람은 구독 요금에 포함되며, 실제 <b>채용이 성사된 경우에만</b> 약정 수수료가 별도로 청구됩니다.</p>
      <ul>
        <li>수수료율: 채용 연봉의 <b>10%</b> (계약에 따라 조정)</li>
        <li>정산 주기: 채용 확정 익월 청구</li>
      </ul>
    </div>

    <div class="billing">
      <h4>결제 관리</h4>
      <ul v-if="current === 'membership'" class="bill-list">
        <li><span>구독 — 멤버십 (월)</span><span class="muted">₩300,000 · 다음 결제일 매월 1일</span></li>
        <li><span>등록 결제수단</span><span class="muted">법인카드 ****-1234</span></li>
      </ul>
      <p v-else class="muted">현재 <b>무료 플랜</b> 이용 중 — 구독 결제가 없습니다. 멤버십 전환 시 월 ₩300,000이 청구됩니다.</p>
      <p class="muted small">결제수단 변경·세금계산서 발행은 운영팀(파트너 지원)으로 문의하세요.</p>
    </div>
  </section>
</template>

<style scoped>
.cplan { max-width: 860px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.small { font-size: 0.82rem; }
.plans { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.plan { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.1rem 1.2rem; display: flex; flex-direction: column; }
.plan.on { border-color: #15803d; background: #f0fdf4; }
.p-head h3 { margin: 0; display: flex; align-items: center; gap: 0.5rem; }
.cur-tag { font-size: 0.7rem; font-weight: 700; color: #fff; background: #15803d; border-radius: 999px; padding: 0.1rem 0.5rem; }
.price { font-size: 1.3rem; font-weight: 700; color: #14532d; margin: 0.3rem 0 0.6rem; }
.plan ul { list-style: none; padding: 0; margin: 0 0 0.9rem; font-size: 0.88rem; line-height: 1.8; flex: 1; }
.plan button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.55rem 1rem; cursor: pointer; }
.plan button:disabled { background: #9ca3af; cursor: default; }
.sandbox-note { padding: 0.5rem 0.8rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #92400e; font-size: 0.85rem; }
.fee, .billing { margin-top: 1.4rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
.fee h4, .billing h4 { margin: 0 0 0.4rem; }
.fee ul { margin: 0.3rem 0 0; padding-left: 1.1rem; font-size: 0.88rem; color: #374151; line-height: 1.8; }
.bill-list { list-style: none; padding: 0; margin: 0.4rem 0; }
.bill-list li { display: flex; justify-content: space-between; padding: 0.45rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
@media (max-width: 720px) { .plans { grid-template-columns: 1fr; } }
</style>
