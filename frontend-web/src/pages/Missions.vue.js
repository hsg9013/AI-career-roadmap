import { onMounted, ref } from 'vue';
import { useMissionsStore } from 'frontend-shared';
// US4 실무 미션 + AI 1차 피드백 페이지
const store = useMissionsStore();
const busy = ref(false);
const openId = ref(null);
const content = ref('');
const aiFeedback = ref(null);
onMounted(() => store.fetchAll());
function open(m) {
    openId.value = m.id;
    content.value = '';
    aiFeedback.value = null;
}
async function submit() {
    if (openId.value === null || content.value.trim().length === 0)
        return;
    busy.value = true;
    try {
        const res = await store.submit(openId.value, content.value);
        aiFeedback.value = res.ai_feedback;
    }
    finally {
        busy.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['mission']} */ ;
/** @type {__VLS_StyleScopedClasses['mission']} */ ;
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "missions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "list" },
});
for (const [m] of __VLS_getVForSourceType((__VLS_ctx.store.missions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (m.id),
        ...{ class: "mission" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (m.title);
    if (m.job_role_code) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "role" },
        });
        (m.industry_code);
        (m.job_role_code);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted" },
    });
    (m.brief);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.open(m);
            } },
    });
}
if (__VLS_ctx.openId !== null) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "composer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.content),
        rows: "6",
        placeholder: "제출 내용을 작성하세요 (문제정의 → 접근 → 결과)",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.submit) },
        disabled: (__VLS_ctx.busy || __VLS_ctx.content.trim().length === 0),
    });
    (__VLS_ctx.busy ? '제출 중…' : '제출하고 AI 피드백 받기');
    if (__VLS_ctx.aiFeedback) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "feedback" },
        });
        (__VLS_ctx.aiFeedback);
    }
}
/** @type {__VLS_StyleScopedClasses['missions']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
/** @type {__VLS_StyleScopedClasses['mission']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['role']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
/** @type {__VLS_StyleScopedClasses['feedback']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            store: store,
            busy: busy,
            openId: openId,
            content: content,
            aiFeedback: aiFeedback,
            open: open,
            submit: submit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
