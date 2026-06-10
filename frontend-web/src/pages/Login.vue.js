import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore, getApi } from 'frontend-shared';
// Phase 3 US1 — 실제 로그인 + 회원가입 폼.
// 회원가입 응답 후 자동 로그인까지 한 번에 처리.
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const mode = ref('login');
const submitting = ref(false);
const errorMsg = ref(null);
const form = reactive({
    email: '',
    password: '',
    university: '',
    major: '',
    year_in_school: 1,
});
async function performLogin() {
    const { data } = await getApi().post('/auth/login', {
        email: form.email,
        password: form.password,
    });
    auth.setSession(data.access_token, {
        id: 0,
        email: form.email,
        role: data.role,
        scopes: [],
    });
    const target = route.query.redirect ?? '/dashboard';
    await router.push(target);
}
// 003 US6(T044): 네이버 로그인.
//   • 실연동(VITE_NAVER_CLIENT_ID 설정): 네이버 인증 페이지로 리다이렉트(콜백이 code 회수).
//   • dev(미설정): 합성 code 로 백엔드 dev 경로를 태워 생성/로그인 흐름을 시연.
const naverClientId = import.meta.env?.VITE_NAVER_CLIENT_ID ?? '';
async function loginNaver() {
    errorMsg.value = null;
    if (naverClientId) {
        const redirectUri = `${window.location.origin}/login`;
        const state = Math.random().toString(36).slice(2);
        window.location.assign(`https://nid.naver.com/oauth2.0/authorize?response_type=code` +
            `&client_id=${encodeURIComponent(naverClientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`);
        return;
    }
    submitting.value = true;
    try {
        const { created } = await auth.loginWithNaver(`web-naver-dev-${Date.now()}`);
        await router.push(created ? '/onboarding' : '/dashboard');
    }
    catch {
        errorMsg.value = '네이버 로그인에 실패했습니다';
    }
    finally {
        submitting.value = false;
    }
}
// 실연동 콜백 처리: ?code= 가 있으면 즉시 소셜 로그인 교환.
async function maybeHandleNaverCallback() {
    const code = route.query.code;
    if (!code)
        return;
    submitting.value = true;
    try {
        const { created } = await auth.loginWithNaver(code, route.query.state ?? '');
        await router.push(created ? '/onboarding' : '/dashboard');
    }
    catch {
        errorMsg.value = '네이버 로그인에 실패했습니다';
    }
    finally {
        submitting.value = false;
    }
}
void maybeHandleNaverCallback();
async function onSubmit() {
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
    }
    catch (err) {
        const resp = err.response;
        if (resp?.status === 423) {
            errorMsg.value = '로그인 5회 실패로 계정이 일시 잠겼습니다. 잠시 후 다시 시도하세요.';
        }
        else if (resp?.status === 409) {
            errorMsg.value = '이미 가입된 이메일입니다';
        }
        else if (resp?.status === 401) {
            errorMsg.value = '이메일 또는 비밀번호가 올바르지 않습니다';
        }
        else {
            errorMsg.value = resp?.data?.message ?? '오류가 발생했습니다';
        }
    }
    finally {
        submitting.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['submit']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['naver']} */ ;
/** @type {__VLS_StyleScopedClasses['naver']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tabs" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mode = 'login';
        } },
    ...{ class: (['tab', { active: __VLS_ctx.mode === 'login' }]) },
    type: "button",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mode = 'register';
        } },
    ...{ class: (['tab', { active: __VLS_ctx.mode === 'register' }]) },
    type: "button",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.onSubmit) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "field" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "email",
    required: true,
    autocomplete: "email",
});
(__VLS_ctx.form.email);
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "field" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.mode === 'register' ? '8자 이상' : '');
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "password",
    minlength: (__VLS_ctx.mode === 'register' ? 8 : 1),
    required: true,
    autocomplete: (__VLS_ctx.mode === 'register' ? 'new-password' : 'current-password'),
});
(__VLS_ctx.form.password);
if (__VLS_ctx.mode === 'register') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.form.university),
        type: "text",
        required: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.form.major),
        type: "text",
        required: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.form.year_in_school),
    });
    for (const [n] of __VLS_getVForSourceType((6))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (n),
            value: (n),
        });
        (n);
    }
}
if (__VLS_ctx.errorMsg) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "err" },
    });
    (__VLS_ctx.errorMsg);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ class: "submit" },
    disabled: (__VLS_ctx.submitting),
    type: "submit",
});
(__VLS_ctx.submitting ? '처리 중…' : __VLS_ctx.mode === 'login' ? '로그인' : '가입 후 로그인');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "divider" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.loginNaver) },
    ...{ class: "naver" },
    type: "button",
    disabled: (__VLS_ctx.submitting),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['err']} */ ;
/** @type {__VLS_StyleScopedClasses['submit']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['naver']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            mode: mode,
            submitting: submitting,
            errorMsg: errorMsg,
            form: form,
            loginNaver: loginNaver,
            onSubmit: onSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
