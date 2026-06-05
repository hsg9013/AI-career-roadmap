import { ref, computed } from 'vue';
import { useAlumniStore } from 'frontend-shared';
// US9 선배 합격 경로 기부 — 익명화 저장 후 보상. 누구나(졸업 선배) 가능.
const store = useAlumniStore();
const form = ref({ industry_code: 'IT', job_role_code: 'backend', major_field: 'engineering', grade_band: 'y4plus', success_year: 2025 });
const activities = ref([{ period: 'Y3', activity_type: 'internship', detail: '', skill_tag: '' }]);
const result = computed(() => store.result);
function addRow() {
    activities.value.push({ period: 'Y4', activity_type: 'project', detail: '', skill_tag: '' });
}
async function submit() {
    await store
        .donate({ ...form.value, activities: activities.value.filter((a) => a.detail.trim().length > 0) })
        .catch(() => undefined);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "donate" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: "산업(IT)",
});
(__VLS_ctx.form.industry_code);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: "직무(backend)",
});
(__VLS_ctx.form.job_role_code);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: "전공계열",
});
(__VLS_ctx.form.major_field);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
    placeholder: "합격 연도",
});
(__VLS_ctx.form.success_year);
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
for (const [a, i] of __VLS_getVForSourceType((__VLS_ctx.activities))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (i),
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "Y3",
    });
    (a.period);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "internship",
    });
    (a.activity_type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "활동 내용",
        ...{ class: "grow" },
    });
    (a.detail);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: "skill(spring)",
    });
    (a.skill_tag);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.addRow) },
    ...{ class: "ghost" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.submit) },
    disabled: (__VLS_ctx.store.loading),
});
(__VLS_ctx.store.loading ? '제출 중…' : '기부하기');
if (__VLS_ctx.store.lastError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.store.lastError);
}
if (__VLS_ctx.result) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "ok" },
    });
    (__VLS_ctx.result.reward_type);
}
/** @type {__VLS_StyleScopedClasses['donate']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['ok']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            store: store,
            form: form,
            activities: activities,
            result: result,
            addRow: addRow,
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
