<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore, getApi } from 'frontend-shared';

// Phase 3 US1 — 실제 로그인 + 회원가입 폼.
// 회원가입 응답 후 자동 로그인까지 한 번에 처리.

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

const form = reactive({
  email: '',
  password: '',
  university: '',
  major: '',
  year_in_school: 1,
});

interface LoginResp {
  access_token: string;
  expires_in: number;
  role: 'student' | 'mentor' | 'university' | 'enterprise' | 'admin';
}

async function performLogin(): Promise<void> {
  const { data } = await getApi().post<LoginResp>('/auth/login', {
    email: form.email,
    password: form.password,
  });
  auth.setSession(data.access_token, {
    id: 0,
    email: form.email,
    role: data.role,
    scopes: [],
  });
  const target = (route.query.redirect as string | undefined) ?? '/dashboard';
  await router.push(target);
}

async function onSubmit(): Promise<void> {
  errorMsg.value = null;
  submitting.value = true;
  try {
    if (mode.value === 'register') {
      await getApi().post('/auth/register/student', {
        email: form.email,
        password: form.password,
        university: form.university,
        major: form.major,
        year_in_school: form.year_in_school,
      });
    }
    await performLogin();
  } catch (err: unknown) {
    const resp = (err as { response?: { status?: number; data?: { message?: string } } }).response;
    if (resp?.status === 423) {
      errorMsg.value = '로그인 5회 실패로 계정이 일시 잠겼습니다. 잠시 후 다시 시도하세요.';
    } else if (resp?.status === 409) {
      errorMsg.value = '이미 가입된 이메일입니다';
    } else if (resp?.status === 401) {
      errorMsg.value = '이메일 또는 비밀번호가 올바르지 않습니다';
    } else {
      errorMsg.value = resp?.data?.message ?? '오류가 발생했습니다';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="card">
    <div class="tabs">
      <button
        :class="['tab', { active: mode === 'login' }]"
        type="button"
        @click="mode = 'login'"
      >로그인</button>
      <button
        :class="['tab', { active: mode === 'register' }]"
        type="button"
        @click="mode = 'register'"
      >회원가입</button>
    </div>

    <form @submit.prevent="onSubmit">
      <label class="field">
        <span>이메일</span>
        <input v-model="form.email" type="email" required autocomplete="email" />
      </label>
      <label class="field">
        <span>비밀번호 ({{ mode === 'register' ? '8자 이상' : '' }})</span>
        <input
          v-model="form.password"
          type="password"
          :minlength="mode === 'register' ? 8 : 1"
          required
          :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        />
      </label>

      <template v-if="mode === 'register'">
        <label class="field">
          <span>대학교</span>
          <input v-model="form.university" type="text" required />
        </label>
        <label class="field">
          <span>전공</span>
          <input v-model="form.major" type="text" required />
        </label>
        <label class="field">
          <span>학년</span>
          <select v-model.number="form.year_in_school">
            <option v-for="n in 6" :key="n" :value="n">{{ n }}학년</option>
          </select>
        </label>
      </template>

      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
      <button class="submit" :disabled="submitting" type="submit">
        {{ submitting ? '처리 중…' : mode === 'login' ? '로그인' : '가입 후 로그인' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.card { max-width: 480px; margin: 3rem auto; padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 8px; }
.tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; }
.tab {
  flex: 1; background: #f3f4f6; border: none; padding: 0.6rem; border-radius: 4px;
  font-weight: 600; color: #6b7280; cursor: pointer;
}
.tab.active { background: #2563eb; color: #fff; }
.field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; font-size: 0.9rem; }
.field input, .field select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem; }
.submit {
  width: 100%; padding: 0.65rem; background: #2563eb; color: #fff;
  border: none; border-radius: 4px; font-weight: 600; cursor: pointer; margin-top: 0.5rem;
}
.submit:disabled { background: #93c5fd; cursor: not-allowed; }
.err { color: #b91c1c; font-size: 0.9rem; margin: 0.25rem 0; }
</style>
