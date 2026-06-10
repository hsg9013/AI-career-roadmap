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

// 003 US6(T044): 네이버 로그인.
//   • 실연동(VITE_NAVER_CLIENT_ID 설정): 네이버 인증 페이지로 리다이렉트(콜백이 code 회수).
//   • dev(미설정): 합성 code 로 백엔드 dev 경로를 태워 생성/로그인 흐름을 시연.
const naverClientId = (import.meta.env?.VITE_NAVER_CLIENT_ID as string | undefined) ?? '';

async function loginNaver(): Promise<void> {
  errorMsg.value = null;
  if (naverClientId) {
    const redirectUri = `${window.location.origin}/login`;
    const state = Math.random().toString(36).slice(2);
    window.location.assign(
      `https://nid.naver.com/oauth2.0/authorize?response_type=code` +
        `&client_id=${encodeURIComponent(naverClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    );
    return;
  }
  submitting.value = true;
  try {
    const { created } = await auth.loginWithNaver(`web-naver-dev-${Date.now()}`);
    await router.push(created ? '/onboarding' : '/dashboard');
  } catch {
    errorMsg.value = '네이버 로그인에 실패했습니다';
  } finally {
    submitting.value = false;
  }
}

// 실연동 콜백 처리: ?code= 가 있으면 즉시 소셜 로그인 교환.
async function maybeHandleNaverCallback(): Promise<void> {
  const code = route.query.code as string | undefined;
  if (!code) return;
  submitting.value = true;
  try {
    const { created } = await auth.loginWithNaver(code, (route.query.state as string) ?? '');
    await router.push(created ? '/onboarding' : '/dashboard');
  } catch {
    errorMsg.value = '네이버 로그인에 실패했습니다';
  } finally {
    submitting.value = false;
  }
}
void maybeHandleNaverCallback();

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

    <div class="divider"><span>또는</span></div>
    <button class="naver" type="button" :disabled="submitting" @click="loginNaver">
      <strong>N</strong> 네이버로 계속하기
    </button>
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
.divider { display: flex; align-items: center; text-align: center; color: #9ca3af; font-size: 0.8rem; margin: 1rem 0; }
.divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #e5e7eb; }
.divider span { padding: 0 0.6rem; }
.naver { width: 100%; padding: 0.65rem; background: #03c75a; color: #fff; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.naver strong { background: #fff; color: #03c75a; border-radius: 3px; padding: 0 0.4rem; }
.naver:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
