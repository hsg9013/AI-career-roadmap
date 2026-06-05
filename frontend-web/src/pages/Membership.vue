<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePaymentsStore } from 'frontend-shared';

// US8 멤버십 결제 (student). 결제 성공 시 권한 활성화.

const store = usePaymentsStore();
const amount = ref(9900);

interface CheckoutResult { status: string; membership_ends_at: string | null }
const result = computed(() => store.result as CheckoutResult | null);

async function pay(): Promise<void> {
  await store.checkout(amount.value, 'standard').catch(() => undefined);
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
    <p v-if="result" class="ok">결제 완료 · 멤버십 만료일 {{ result.membership_ends_at }}</p>
  </section>
</template>

<style scoped>
.membership { max-width: 560px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.error { color: #b91c1c; }
.ok { color: #166534; }
.plan { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.2rem; margin-top: 1rem; }
.price input { width: 90px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.2rem; }
.plan button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1.2rem; cursor: pointer; margin-top: 0.5rem; }
</style>
