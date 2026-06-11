<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePaymentsStore, useMembershipStore } from 'frontend-shared';

// US3/US8 멤버십 결제 (student). 결제 승인 시 멤버십 활성화 + 영수증 표시.
// 실연동(PortOne)은 pending+redirect → 결제창; dev 무키는 즉시 paid.
// 004 US6: 무료/프리미엄 비교표 + 실무 단건 과금.

const store = usePaymentsStore();
const market = useMembershipStore();
const amount = ref(9900);

const result = computed(() => store.result);

onMounted(() => {
  void market.fetchTiers();
  void market.fetchPaidServices();
});

async function orderService(code: string): Promise<void> {
  await market.orderPaidService(code).catch(() => undefined);
}

const STATUS_LABEL: Record<string, string> = {
  pending: '결제 진행 중',
  paid: '결제 완료',
  failed: '결제 실패',
  canceled: '결제 취소됨',
  refunded: '환불됨',
};

async function pay(forceResult?: 'success' | 'fail'): Promise<void> {
  await store.checkout(amount.value, 'standard', forceResult).catch(() => undefined);
}

// 웹훅 확정(실연동) 후 상태를 다시 불러온다.
async function refresh(): Promise<void> {
  if (result.value) await store.fetchPayment(result.value.payment_id);
}
</script>

<template>
  <section class="membership">
    <header><h2>멤버십</h2>
      <p class="muted">무료와 프리미엄의 차이를 비교하고 업그레이드하세요.</p>
    </header>

    <div v-if="market.tiers.length" class="tiers">
      <div v-for="t in market.tiers" :key="t.code" class="tier" :class="t.code">
        <h3>{{ t.name }} <span v-if="t.price_month" class="price-tag">₩{{ t.price_month.toLocaleString() }}/월</span><span v-else class="price-tag">무료</span></h3>
        <ul>
          <li v-for="f in t.features" :key="f">✓ {{ f }}</li>
        </ul>
      </div>
    </div>

    <!-- 005 US6(H6): 결제는 테스트모드(Sandbox)/가상 시나리오 — 실제 거래가 아님을 명시. -->
    <p class="sandbox-note">🧪 테스트 모드 — 실제 거래가 아닙니다. (결제 성공/실패·등급 변경 시연용)</p>

    <div class="plan">
      <h3>스탠다드</h3>
      <p class="price">₩<input v-model.number="amount" type="number" /> / 월</p>
      <div class="pay-actions">
        <button :disabled="store.loading" @click="pay()">{{ store.loading ? '결제 중…' : '결제하기 (테스트)' }}</button>
        <button class="ghost" :disabled="store.loading" @click="pay('success')">가상 성공</button>
        <button class="ghost danger" :disabled="store.loading" @click="pay('fail')">가상 실패</button>
      </div>
    </div>

    <p v-if="store.lastError" class="error">{{ store.lastError }}</p>

    <div v-if="result" class="receipt" :class="result.status">
      <p class="status">{{ STATUS_LABEL[result.status] ?? result.status }}</p>
      <p v-if="result.status === 'paid' && result.membership_ends_at" class="ok">
        멤버십 만료일 {{ result.membership_ends_at }}
      </p>
      <p v-else-if="result.status === 'pending'" class="muted">
        결제창에서 결제를 완료하면 자동 반영됩니다.
        <button class="link" @click="refresh">상태 새로고침</button>
      </p>
      <ul class="detail muted">
        <li>거래번호: {{ result.pg_tx_id }}</li>
        <li v-if="result.receipt_url">
          영수증: <a :href="result.receipt_url" target="_blank" rel="noopener">영수증 보기</a>
        </li>
      </ul>
    </div>

    <div v-if="market.paidServices.length" class="paid">
      <h3>실무 단건 서비스</h3>
      <p class="muted">필요한 서비스만 건당 결제로 이용할 수 있습니다.</p>
      <ul class="svc">
        <li v-for="s in market.paidServices" :key="s.code">
          <span>{{ s.name }}</span>
          <span class="fee">₩{{ s.fee.toLocaleString() }}</span>
          <button class="ghost" @click="orderService(s.code)">주문</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.membership { max-width: 560px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.ok { color: #166534; margin: 0.3rem 0; }
.sandbox-note { margin: 1rem 0 0; padding: 0.5rem 0.8rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #92400e; font-size: 0.85rem; }
.plan { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.2rem; margin-top: 1rem; }
.price input { width: 90px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.2rem; }
.plan button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1.2rem; cursor: pointer; margin-top: 0.5rem; }
.pay-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
.pay-actions .ghost { background: #fff; color: #2563eb; border: 1px solid #2563eb; }
.pay-actions .ghost.danger { color: #b91c1c; border-color: #b91c1c; }
.receipt { margin-top: 1.2rem; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.2rem; }
.receipt.paid { border-color: #bbf7d0; background: #f0fdf4; }
.receipt.refunded, .receipt.canceled { border-color: #fecaca; background: #fef2f2; }
.receipt .status { font-weight: 700; margin: 0 0 0.3rem; }
.receipt .detail { list-style: none; padding: 0; margin: 0.5rem 0 0; font-size: 0.82rem; }
.receipt a { color: #2563eb; }
.link { background: none; border: 0; color: #2563eb; cursor: pointer; padding: 0; text-decoration: underline; font: inherit; }
.tiers { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
.tier { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.2rem; }
.tier.premium { border-color: #c7d2fe; background: #eef2ff; }
.tier h3 { margin: 0 0 0.6rem; display: flex; justify-content: space-between; align-items: baseline; }
.price-tag { font-size: 0.85rem; color: #4338ca; }
.tier ul { list-style: none; padding: 0; margin: 0; font-size: 0.88rem; line-height: 1.7; }
.paid { margin-top: 1.4rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
.svc { list-style: none; padding: 0; margin: 0.6rem 0 0; }
.svc li { display: flex; align-items: center; gap: 0.8rem; padding: 0.4rem 0; border-bottom: 1px solid #f3f4f6; }
.svc .fee { margin-left: auto; color: #374151; }
.ghost { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.35rem 0.8rem; cursor: pointer; }
</style>
