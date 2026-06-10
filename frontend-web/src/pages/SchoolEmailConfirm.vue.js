import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from 'frontend-shared';
// 003 US6(T044): 이메일 링크의 token 으로 학교 이메일 인증을 확정.
const route = useRoute();
const auth = useAuthStore();
const state = ref('loading');
const email = ref(null);
const errorMsg = ref(null);
onMounted(async () => {
    const token = route.query.token;
    if (!token) {
        state.value = 'error';
        errorMsg.value = '인증 토큰이 없습니다.';
        return;
    }
    try {
        const r = await auth.confirmSchoolEmail(token);
        email.value = r.email;
        state.value = 'done';
    }
    catch (err) {
        const code = err.response?.status;
        errorMsg.value = code === 410 ? '인증 링크가 만료되었습니다. 다시 요청하세요.' : '인증에 실패했습니다.';
        state.value = 'error';
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "confirm" },
});
if (__VLS_ctx.state === 'loading') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted" },
    });
}
else if (__VLS_ctx.state === 'done') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "ok" },
    });
    (__VLS_ctx.email);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "err" },
    });
    (__VLS_ctx.errorMsg);
}
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/dashboard",
    ...{ class: "link" },
}));
const __VLS_2 = __VLS_1({
    to: "/dashboard",
    ...{ class: "link" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['confirm']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['ok']} */ ;
/** @type {__VLS_StyleScopedClasses['err']} */ ;
/** @type {__VLS_StyleScopedClasses['link']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            state: state,
            email: email,
            errorMsg: errorMsg,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
