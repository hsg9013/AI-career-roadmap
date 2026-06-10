import { onMounted, ref } from 'vue';
import { useAuthStore } from 'frontend-shared';
// 003 US6(T044): 학교 이메일(.ac.kr) 인증 요청 + 상태 표시.
const auth = useAuthStore();
const email = ref('');
const busy = ref(false);
const status = ref('none');
const verifiedEmail = ref(null);
const message = ref(null);
const errorMsg = ref(null);
const devToken = ref(null);
async function refreshStatus() {
    const s = await auth.schoolEmailStatus();
    status.value = s.status;
    verifiedEmail.value = s.email;
}
onMounted(refreshStatus);
async function submit() {
    errorMsg.value = null;
    message.value = null;
    devToken.value = null;
    busy.value = true;
    try {
        const r = await auth.requestSchoolEmail(email.value);
        status.value = r.status;
        message.value = '인증 메일을 보냈습니다. 메일의 링크로 인증을 완료하세요.';
        if (r.devToken)
            devToken.value = r.devToken; // dev 편의: 바로 확인 가능
    }
    catch (err) {
        const resp = err.response;
        errorMsg.value = resp?.status === 422
            ? '학교 이메일은 .ac.kr 주소만 인증할 수 있습니다.'
            : '인증 요청에 실패했습니다.';
    }
    finally {
        busy.value = false;
    }
}
async function confirmDev() {
    if (!devToken.value)
        return;
    busy.value = true;
    try {
        await auth.confirmSchoolEmail(devToken.value);
        await refreshStatus();
        message.value = '학교 이메일 인증이 완료되었습니다.';
        devToken.value = null;
    }
    finally {
        busy.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['submit']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "school" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({});
if (__VLS_ctx.status === 'verified') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "ok" },
    });
    (__VLS_ctx.verifiedEmail);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.submit) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "email",
        placeholder: "you@univ.ac.kr",
        required: true,
    });
    (__VLS_ctx.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "submit" },
        disabled: (__VLS_ctx.busy),
        type: "submit",
    });
    (__VLS_ctx.busy ? '처리 중…' : '인증 메일 보내기');
}
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "info" },
    });
    (__VLS_ctx.message);
}
if (__VLS_ctx.errorMsg) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "err" },
    });
    (__VLS_ctx.errorMsg);
}
if (__VLS_ctx.devToken) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dev" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.confirmDev) },
        ...{ class: "link" },
        disabled: (__VLS_ctx.busy),
    });
}
/** @type {__VLS_StyleScopedClasses['school']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['ok']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['submit']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['err']} */ ;
/** @type {__VLS_StyleScopedClasses['dev']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['link']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            email: email,
            busy: busy,
            status: status,
            verifiedEmail: verifiedEmail,
            message: message,
            errorMsg: errorMsg,
            devToken: devToken,
            submit: submit,
            confirmDev: confirmDev,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
