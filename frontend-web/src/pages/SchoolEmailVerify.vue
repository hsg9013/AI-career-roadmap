<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAuthStore } from 'frontend-shared';

// 003 US6(T044): 학교 이메일(.ac.kr) 인증 요청 + 상태 표시.

const auth = useAuthStore();
const email = ref('');
const busy = ref(false);
const status = ref<string>('none');
const verifiedEmail = ref<string | null>(null);
const message = ref<string | null>(null);
const errorMsg = ref<string | null>(null);
const devToken = ref<string | null>(null);

async function refreshStatus(): Promise<void> {
  const s = await auth.schoolEmailStatus();
  status.value = s.status;
  verifiedEmail.value = s.email;
}

onMounted(refreshStatus);

async function submit(): Promise<void> {
  errorMsg.value = null;
  message.value = null;
  devToken.value = null;
  busy.value = true;
  try {
    const r = await auth.requestSchoolEmail(email.value);
    status.value = r.status;
    message.value = '인증 메일을 보냈습니다. 메일의 링크로 인증을 완료하세요.';
    if (r.devToken) devToken.value = r.devToken; // dev 편의: 바로 확인 가능
  } catch (err: unknown) {
    const resp = (err as { response?: { status?: number } }).response;
    errorMsg.value = resp?.status === 422
      ? '학교 이메일은 .ac.kr 주소만 인증할 수 있습니다.'
      : '인증 요청에 실패했습니다.';
  } finally {
    busy.value = false;
  }
}

async function confirmDev(): Promise<void> {
  if (!devToken.value) return;
  busy.value = true;
  try {
    await auth.confirmSchoolEmail(devToken.value);
    await refreshStatus();
    message.value = '학교 이메일 인증이 완료되었습니다.';
    devToken.value = null;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="school">
    <header>
      <h2>학교 이메일 인증</h2>
      <p class="muted">대학 소속 인증을 위해 <code>.ac.kr</code> 학교 이메일을 인증하세요.</p>
    </header>

    <p v-if="status === 'verified'" class="ok">
      ✓ 인증 완료 — {{ verifiedEmail }}
    </p>

    <form v-else @submit.prevent="submit">
      <label class="field">
        <span>학교 이메일</span>
        <input v-model="email" type="email" placeholder="you@univ.ac.kr" required />
      </label>
      <button class="submit" :disabled="busy" type="submit">{{ busy ? '처리 중…' : '인증 메일 보내기' }}</button>
    </form>

    <p v-if="message" class="info">{{ message }}</p>
    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

    <div v-if="devToken" class="dev">
      <p class="muted">개발 환경: 메일 대신 아래로 즉시 확인할 수 있습니다.</p>
      <button class="link" :disabled="busy" @click="confirmDev">지금 인증 완료</button>
    </div>
  </section>
</template>

<style scoped>
.school { max-width: 480px; margin: 2rem auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; }
.field input { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem; }
.submit { width: 100%; padding: 0.65rem; background: #2563eb; color: #fff; border: 0; border-radius: 4px; font-weight: 600; cursor: pointer; }
.submit:disabled { background: #93c5fd; }
.ok { color: #166534; font-weight: 600; }
.info { color: #1e40af; }
.err { color: #b91c1c; }
.dev { margin-top: 1rem; border-top: 1px dashed #e5e7eb; padding-top: 0.8rem; }
.link { background: none; border: 0; color: #2563eb; cursor: pointer; text-decoration: underline; padding: 0; font: inherit; }
</style>
