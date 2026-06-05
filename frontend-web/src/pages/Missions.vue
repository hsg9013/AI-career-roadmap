<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMissionsStore, type Mission } from 'frontend-shared';

// US4 실무 미션 + AI 1차 피드백 페이지

const store = useMissionsStore();
const busy = ref(false);
const openId = ref<number | null>(null);
const content = ref('');
const aiFeedback = ref<string | null>(null);

onMounted(() => store.fetchAll());

function open(m: Mission): void {
  openId.value = m.id;
  content.value = '';
  aiFeedback.value = null;
}

async function submit(): Promise<void> {
  if (openId.value === null || content.value.trim().length === 0) return;
  busy.value = true;
  try {
    const res = await store.submit(openId.value, content.value);
    aiFeedback.value = res.ai_feedback;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="missions">
    <header><h2>실무 미션</h2>
      <p class="muted">미션을 제출하면 AI 1차 피드백이 즉시 제공되고, 현직자 코멘트가 5영업일 내 결합됩니다.</p>
    </header>

    <ul class="list">
      <li v-for="m in store.missions" :key="m.id" class="mission">
        <div class="info">
          <strong>{{ m.title }}</strong>
          <span v-if="m.job_role_code" class="role">{{ m.industry_code }}/{{ m.job_role_code }}</span>
          <p class="muted">{{ m.brief }}</p>
        </div>
        <button @click="open(m)">제출</button>
      </li>
    </ul>

    <div v-if="openId !== null" class="composer">
      <h3>미션 제출</h3>
      <textarea v-model="content" rows="6" placeholder="제출 내용을 작성하세요 (문제정의 → 접근 → 결과)"></textarea>
      <button :disabled="busy || content.trim().length === 0" @click="submit">
        {{ busy ? '제출 중…' : '제출하고 AI 피드백 받기' }}
      </button>
      <p v-if="aiFeedback" class="feedback">{{ aiFeedback }}</p>
    </div>
  </section>
</template>

<style scoped>
.missions { max-width: 760px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.list { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.mission { display: flex; justify-content: space-between; gap: 1rem; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.7rem 0.9rem; }
.mission .role { margin-left: 0.5rem; font-size: 0.78rem; color: #2563eb; }
.mission button, .composer button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer; align-self: center; }
.composer { margin-top: 1.5rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
.composer textarea { width: 100%; box-sizing: border-box; margin-bottom: 0.5rem; }
.feedback { background: #eff6ff; border-radius: 8px; padding: 0.7rem; margin-top: 0.7rem; }
</style>
