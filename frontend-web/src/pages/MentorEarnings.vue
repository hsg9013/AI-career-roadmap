<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { usePaymentsStore } from 'frontend-shared';

// 005 고도화: 멘토 전용 [정산 및 활동 등급]
//   - 활동 등급/보상 배지 현황 + 정산(코멘트 수익·매칭 수수료) 대시보드.
//   - 정산 데이터는 /payments/mentor-payouts(월별 산정). 없으면 안내 상태.

interface Payout { period?: string; amount?: number; status?: string; basis?: string }
const payments = usePaymentsStore();
const loaded = ref(false);

onMounted(async () => {
  await payments.fetchPayouts().catch(() => undefined);
  loaded.value = true;
});

const payouts = computed(() => (payments.payouts as Payout[]) ?? []);
const totalAccrued = computed(() =>
  payouts.value.filter((p) => p.status !== 'paid').reduce((s, p) => s + (p.amount ?? 0), 0),
);
const totalPaid = computed(() =>
  payouts.value.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0),
);
const won = (n: number) => `₩${(n ?? 0).toLocaleString()}`;
const STATUS_LABEL: Record<string, string> = { accrued: '적립(정산 예정)', paid: '지급 완료', pending: '대기' };
</script>

<template>
  <section class="earn">
    <header>
      <h2>정산 및 활동 등급</h2>
      <p class="muted">현직자 멘토 활동에 따른 보상·정산 현황입니다.</p>
    </header>

    <!-- 활동 등급/배지 -->
    <div class="grade">
      <div class="grade-badge">
        <span class="tier">VERIFIED 멘토</span>
        <span class="muted">검증된 현직자</span>
      </div>
      <ul class="rewards">
        <li><span class="r-ico">🏅</span> 합격 경험 공유 배지 — 공유 1건당 지급</li>
        <li><span class="r-ico">💬</span> 심층 코멘트 — 검수 완료 건당 정산</li>
        <li><span class="r-ico">🤝</span> 학생 매칭 수수료 — 채용 성사 트랙</li>
      </ul>
    </div>

    <!-- 정산 요약 -->
    <div class="summary">
      <div class="s-card accrued"><span class="k">적립(정산 예정)</span><b>{{ won(totalAccrued) }}</b></div>
      <div class="s-card paid"><span class="k">지급 완료</span><b>{{ won(totalPaid) }}</b></div>
      <div class="s-card"><span class="k">정산 항목</span><b>{{ payouts.length }}건</b></div>
    </div>

    <h3>정산 내역</h3>
    <table v-if="payouts.length" class="ptbl">
      <thead><tr><th>정산월</th><th>구분</th><th>금액</th><th>상태</th></tr></thead>
      <tbody>
        <tr v-for="(p, i) in payouts" :key="i">
          <td>{{ p.period ?? '-' }}</td>
          <td>{{ p.basis === 'commission' ? '채용 수수료' : '코멘트 정액' }}</td>
          <td>{{ won(p.amount ?? 0) }}</td>
          <td><span class="badge" :class="p.status">{{ STATUS_LABEL[p.status ?? ''] ?? p.status }}</span></td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="loaded" class="muted empty">
      아직 정산 내역이 없습니다. 검수 코멘트를 작성하면 월말 정산에 반영됩니다.
    </p>

    <div class="note">
      <h4>정산 기준</h4>
      <ul>
        <li><b>정액 트랙</b> — 검수 심층 코멘트 1건당 고정 보상이 정산 원장에 적립됩니다.</li>
        <li><b>수수료 트랙</b> — 매칭한 학생의 채용 성사 시 약정 수수료가 정산됩니다.</li>
        <li>적립(accrued) → 월말 지급(paid)으로 전환됩니다.</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.earn { max-width: 820px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.empty { padding: 1rem 0; }
.grade { display: flex; gap: 1.2rem; align-items: center; flex-wrap: wrap; border: 1px solid #ddd6fe; background: #f5f3ff; border-radius: 12px; padding: 1rem 1.2rem; margin: 1rem 0; }
.grade-badge { display: flex; flex-direction: column; gap: 0.2rem; }
.tier { font-weight: 800; color: #6d28d9; font-size: 1.05rem; }
.rewards { list-style: none; padding: 0; margin: 0; font-size: 0.88rem; color: #4c1d95; line-height: 1.9; }
.r-ico { margin-right: 0.4rem; }
.summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; margin: 1rem 0; }
.s-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.8rem; display: flex; flex-direction: column; }
.s-card .k { font-size: 0.8rem; color: #6b7280; }
.s-card b { font-size: 1.3rem; }
.s-card.accrued b { color: #b45309; }
.s-card.paid b { color: #166534; }
.ptbl { width: 100%; border-collapse: collapse; margin-top: 0.4rem; }
.ptbl th, .ptbl td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; font-size: 0.88rem; }
.badge { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: #fef3c7; color: #92400e; }
.badge.paid { background: #dcfce7; color: #166534; }
.note { margin-top: 1.4rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
.note h4 { margin: 0 0 0.4rem; }
.note ul { margin: 0; padding-left: 1.1rem; font-size: 0.88rem; color: #374151; line-height: 1.8; }
@media (max-width: 720px) { .summary { grid-template-columns: 1fr; } }
</style>
