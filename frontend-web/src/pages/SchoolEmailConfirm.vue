<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from 'frontend-shared';

// 003 US6(T044): 이메일 링크의 token 으로 학교 이메일 인증을 확정.

const route = useRoute();
const auth = useAuthStore();
const state = ref<'loading' | 'done' | 'error'>('loading');
const email = ref<string | null>(null);
const errorMsg = ref<string | null>(null);

onMounted(async () => {
  const token = route.query.token as string | undefined;
  if (!token) {
    state.value = 'error';
    errorMsg.value = '인증 토큰이 없습니다.';
    return;
  }
  try {
    const r = await auth.confirmSchoolEmail(token);
    email.value = r.email;
    state.value = 'done';
  } catch (err: unknown) {
    const code = (err as { response?: { status?: number } }).response?.status;
    errorMsg.value = code === 410 ? '인증 링크가 만료되었습니다. 다시 요청하세요.' : '인증에 실패했습니다.';
    state.value = 'error';
  }
});
</script>

<template>
  <section class="confirm">
    <p v-if="state === 'loading'" class="muted">인증을 확인하는 중…</p>
    <p v-else-if="state === 'done'" class="ok">✓ 학교 이메일 인증 완료 — {{ email }}</p>
    <p v-else class="err">{{ errorMsg }}</p>
    <router-link to="/dashboard" class="link">대시보드로 이동</router-link>
  </section>
</template>

<style scoped>
.confirm { max-width: 480px; margin: 3rem auto; padding: 1.5rem; text-align: center; }
.muted { color: #6b7280; }
.ok { color: #166534; font-weight: 600; }
.err { color: #b91c1c; }
.link { display: inline-block; margin-top: 1rem; color: #2563eb; }
</style>
