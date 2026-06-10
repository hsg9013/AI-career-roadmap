<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePaymentsStore } from 'frontend-shared';

// US3/US8 멤버십 결제 (student). 결제 승인 시 멤버십 활성화 + 영수증 표시.
// 실연동(PortOne)은 pending+redirect → 결제창; dev 무키는 즉시 paid.

const store = usePaymentsStore();
const amount = ref(9900);

const result = computed(() => store.result);

const STATUS_LABEL: Record<string, string> = {
  pending: '결제 진행 중',
  paid: '결제 완료',
  failed: '결제 실패',
  canceled: '결제 취소됨',
  refunded: '환불됨',
};

async function pay(): Promise<void> {
  await store.checkout(amount.value, 'standard').catch(() => undefined);
}

// 웹훅 확정(실연동) 후 상태를 다시 불러온다.
async function refresh(): Promise<void> {
  if (result.value) await store.fetchPayment(result.value.payment_id);
}
</script>

<template>
  <section class="membership">
    <header><h2>멤버십</h2>
      <p class="muted">유료 멤버십으로 전체 기능을 이용하세요.</p>
    </header>
    <div class="plan">
      <h3>스탠다드</h3>
      <p class="price">₩<input v-model.number="amount" type="number" /> / 월</p>
      <button :disabled="store.loading" @click="pay">{{ store.loading ? '결제 중…' : '결제하기' }}</button>
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
  </section>
</template>

<style scoped>
.membership { max-width: 560px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.ok { color: #166534; margin: 0.3rem 0; }
.plan { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.2rem; margin-top: 1rem; }
.price input { width: 90px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.2rem; }
.plan button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1.2rem; cursor: pointer; margin-top: 0.5rem; }
.receipt { margin-top: 1.2rem; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.2rem; }
.receipt.paid { border-color: #bbf7d0; background: #f0fdf4; }
.receipt.refunded, .receipt.canceled { border-color: #fecaca; background: #fef2f2; }
.receipt .status { font-weight: 700; margin: 0 0 0.3rem; }
.receipt .detail { list-style: none; padding: 0; margin: 0.5rem 0 0; font-size: 0.82rem; }
.receipt a { color: #2563eb; }
.link { background: none; border: 0; color: #2563eb; cursor: pointer; padding: 0; text-decoration: underline; font: inherit; }
</style>
