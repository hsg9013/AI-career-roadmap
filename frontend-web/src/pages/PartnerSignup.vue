<script setup lang="ts">
import { ref, computed } from 'vue';
import { getApi } from 'frontend-shared';

// 005 US3(H3): 파트너 유형별 회원가입 — 유형에 맞는 양식 + 역할 계정 발급(partner status=pending, 운영자 활성화 게이트).

const PARTNER_TYPES = [
  { value: 'university', label: '대학 취업지원센터', needsLogin: true },
  { value: 'company', label: '기업 (인재 검색)', needsLogin: true },
  { value: 'mentor_org', label: '현직자/멘토', needsLogin: true },
  { value: 'edu_platform', label: '교육·활동 플랫폼 (제휴)', needsLogin: false },
];

const partnerType = ref<'university' | 'company' | 'mentor_org' | 'edu_platform'>('university');
const orgName = ref('');
const email = ref('');
const password = ref('');
const result = ref<{ status: string; role: string | null; account_created: boolean } | null>(null);
const error = ref('');
const busy = ref(false);

const needsLogin = computed(() => PARTNER_TYPES.find((t) => t.value === partnerType.value)?.needsLogin ?? false);

async function signup(): Promise<void> {
  error.value = '';
  result.value = null;
  busy.value = true;
  try {
    const { data } = await getApi().post('/partners/signup', {
      partner_type: partnerType.value,
      org_name: orgName.value,
      contact_email: email.value,
      password: needsLogin.value ? password.value : undefined,
    });
    result.value = data;
  } catch (e: unknown) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } })?.response;
    error.value = resp?.data?.error?.message ?? '가입에 실패했습니다.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="signup">
    <header>
      <h2>파트너 회원가입</h2>
      <p class="muted">대학·기업·현직자·교육 플랫폼 파트너로 가입하세요. 가입 후 운영자 승인(활성화)을 거칩니다.</p>
    </header>

    <div class="form">
      <label>파트너 유형
        <select v-model="partnerType">
          <option v-for="t in PARTNER_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </label>
      <label>기관/이름
        <input v-model="orgName" placeholder="예: OO대학교 취업지원센터" />
      </label>
      <label>담당자 이메일
        <input v-model="email" type="email" placeholder="contact@example.com" />
      </label>
      <label v-if="needsLogin">로그인 비밀번호
        <input v-model="password" type="password" placeholder="8자 이상" />
      </label>
      <p v-else class="muted hint">교육·활동 플랫폼은 제휴 배너 제공자로 등록되며 로그인 계정은 발급되지 않습니다.</p>
      <button :disabled="busy || !orgName || !email || (needsLogin && password.length < 8)" @click="signup">
        {{ busy ? '가입 중…' : '가입 신청' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="result" class="ok">
      <p>✓ 가입 신청 완료 (상태: 승인 대기)</p>
      <p v-if="result.account_created" class="muted">로그인 계정({{ result.role }})이 생성되었습니다. <b>운영자 승인 전에는 로그인할 수 없으며</b>, 승인되면 바로 로그인하실 수 있습니다.</p>
      <p v-else class="muted">파트너 등록이 접수되었습니다. 운영자 승인을 기다려 주세요.</p>
    </div>
  </section>
</template>

<style scoped>
.signup { max-width: 480px; margin: 0 auto; padding: 1.5rem; }
.muted { color: #6b7280; font-size: 0.9rem; }
.hint { margin: 0; }
.error { color: #b91c1c; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 0.8rem 1rem; margin-top: 1rem; }
.form { display: grid; gap: 0.8rem; margin-top: 1rem; }
.form label { display: grid; gap: 0.3rem; font-size: 0.88rem; color: #374151; }
.form input, .form select { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 0.6rem; }
.form button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1rem; cursor: pointer; }
.form button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
