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
  // 001: 가입 동의란 — 대학 취업지원 정보 제공 범위 + 기업 인재검색 노출 동의.
  university_consent_scope: 'aggregate_only' as 'none' | 'aggregate_only' | 'individual',
  match_consent: true,
});

interface LoginResp {
  access_token: string;
  expires_in: number;
  role: 'student' | 'mentor' | 'university' | 'enterprise' | 'admin' | 'edu_platform';
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
  // 005 고도화: 로그인 후 역할별 전용 메인으로 분기(완전 독점 진입).
  const ROLE_HOME: Record<string, string> = {
    student: '/dashboard',
    mentor: '/missions',
    enterprise: '/company',
    university: '/university',
    admin: '/admin',
    edu_platform: '/partner-portal',
  };
  const target = (route.query.redirect as string | undefined) ?? ROLE_HOME[data.role] ?? '/dashboard';
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
        university_consent_scope: form.university_consent_scope,
        match_consent: form.match_consent,
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

        <!-- 001: 동의란 -->
        <fieldset class="consent">
          <legend>정보 제공 동의</legend>
          <label class="field">
            <span>대학 취업지원 정보 제공</span>
            <select v-model="form.university_consent_scope">
              <option value="none">제공 안 함</option>
              <option value="aggregate_only">통계(집계)로만 제공</option>
              <option value="individual">개인 단위 현황까지 제공</option>
            </select>
          </label>
          <label class="check">
            <input v-model="form.match_consent" type="checkbox" />
            <span>기업 인재 검색에 내 프로필을 노출하는 데 동의합니다.</span>
          </label>
          <p class="consent-note">동의 범위는 가입 후 마이페이지에서 변경할 수 있습니다.</p>
        </fieldset>
      </template>

      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
      <button class="submit" :disabled="submitting" type="submit">
        {{ submitting ? '처리 중…' : mode === 'login' ? '로그인' : '가입 후 로그인' }}
      </button>
    </form>
  </section>

  <!-- 003: 데모 계정 안내 + 멘토↔학생 매핑(시연용). 공통 비밀번호 demo1234! -->
  <section class="demo-guide">
    <h3>데모 계정 안내 <span class="pw">공통 비밀번호 <code>demo1234!</code></span></h3>
    <p class="muted">아래 학생·멘토 계정은 서로 <b>매핑(미션 제출 ↔ 검수 배정)</b>되어 상호작용 시연이 가능합니다.</p>
    <div class="pairs">
      <div class="pair">
        <span class="tag map">매핑 ①</span>
        <div>
          <p>학생 <code>demo-student-backend@p16.local</code> (IT·백엔드)</p>
          <p>↕ 미션 제출물 검수 배정</p>
          <p>멘토 <code>demo-mentor-backend@p16.local</code> (백엔드 현직자)</p>
        </div>
      </div>
    </div>
    <ul class="accts">
      <li>학생: <code>demo-student-backend / frontend / quant @p16.local</code></li>
      <li>멘토: <code>demo-mentor-backend / data @p16.local</code></li>
      <li>대학: <code>demo-university@p16.local</code> · 기업: <code>demo-enterprise@p16.local</code></li>
      <li>교육·활동 플랫폼: <code>demo-partner-edu@p16.local</code> (제휴사 포털)</li>
      <li>관리자: <code>admin@p16.local</code> (비번 <code>admin1234!</code>)</li>
    </ul>
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
.consent { border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.6rem 0.8rem; margin: 0.25rem 0 0.5rem; }
.consent legend { font-size: 0.82rem; font-weight: 700; color: #374151; padding: 0 0.3rem; }
.check { display: flex; align-items: flex-start; gap: 0.45rem; font-size: 0.85rem; color: #374151; margin-top: 0.2rem; }
.check input { margin-top: 0.15rem; }
.consent-note { font-size: 0.76rem; color: #9ca3af; margin: 0.4rem 0 0; }

.demo-guide { max-width: 480px; margin: 1rem auto 3rem; padding: 1rem 1.2rem; border: 1px dashed #c7d2fe; border-radius: 8px; background: #f8faff; }
.demo-guide h3 { margin: 0 0 0.4rem; font-size: 0.98rem; display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.demo-guide .pw { font-size: 0.78rem; font-weight: 400; color: #6b7280; }
.demo-guide .muted { color: #6b7280; font-size: 0.84rem; margin: 0 0 0.6rem; }
.demo-guide code { background: #eef2ff; color: #3730a3; border-radius: 4px; padding: 0.05rem 0.3rem; font-size: 0.82rem; }
.pair { display: flex; gap: 0.6rem; align-items: flex-start; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.6rem 0.8rem; }
.pair p { margin: 0.1rem 0; font-size: 0.84rem; }
.tag.map { font-size: 0.7rem; font-weight: 700; color: #fff; background: #6d28d9; border-radius: 999px; padding: 0.15rem 0.5rem; white-space: nowrap; }
.accts { margin: 0.7rem 0 0; padding-left: 1.1rem; font-size: 0.82rem; color: #374151; line-height: 1.7; }
</style>
