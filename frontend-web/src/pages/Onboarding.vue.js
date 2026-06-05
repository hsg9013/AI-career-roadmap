import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, StudentProfileForm, TargetJobPicker, } from 'frontend-shared';
// T056/T074 Onboarding 위저드 — 진행률 표시 + 필수 단계 우선
//   1) 프로필 보강  2) 목표 직무 선택  3) 갭 진단 자동 실행 → /dashboard
//   SC-001(첫 진단 15분 이내) 달성을 위해 단계 완료 상태를 시각화한다.
const router = useRouter();
const student = useStudentStore();
// 위저드 진행 단계: 프로필 → 목표직무 → 진단
const steps = computed(() => [
    { label: '프로필', done: student.hasProfile },
    { label: '목표 직무', done: student.targetJobs.length > 0 },
    { label: '갭 진단', done: Object.keys(student.diagnoses).length > 0 },
]);
const progressPct = computed(() => {
    const done = steps.value.filter((s) => s.done).length;
    return Math.round((done / steps.value.length) * 100);
});
onMounted(async () => {
    await student.fetchProfile();
    await student.fetchTargetJobs();
});
async function onProfileSubmit(value) {
    await student.updateProfile(value);
}
async function onTargetSubmit(jobs) {
    await student.replaceTargetJobs(jobs);
    const first = student.targetJobs[0];
    if (first) {
        await student.triggerDiagnosis(first.id);
    }
    await router.push('/dashboard');
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['bar']} */ ;
/** @type {__VLS_StyleScopedClasses['steps']} */ ;
/** @type {__VLS_StyleScopedClasses['steps']} */ ;
/** @type {__VLS_StyleScopedClasses['steps']} */ ;
/** @type {__VLS_StyleScopedClasses['steps']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "onboarding" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "wizard" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "bar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "fill" },
    ...{ style: ({ width: __VLS_ctx.progressPct + '%' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.ol, __VLS_intrinsicElements.ol)({
    ...{ class: "steps" },
});
for (const [s, i] of __VLS_getVForSourceType((__VLS_ctx.steps))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (i),
        ...{ class: ({ done: s.done }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "dot" },
    });
    (s.done ? '✓' : i + 1);
    (s.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
const __VLS_0 = {}.StudentProfileForm;
/** @type {[typeof __VLS_components.StudentProfileForm, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onSubmit': {} },
    initial: (__VLS_ctx.student.profile),
    submitLabel: "프로필 저장",
    disabled: (__VLS_ctx.student.loading),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onSubmit': {} },
    initial: (__VLS_ctx.student.profile),
    submitLabel: "프로필 저장",
    disabled: (__VLS_ctx.student.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onSubmit: (__VLS_ctx.onProfileSubmit)
};
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
const __VLS_8 = {}.TargetJobPicker;
/** @type {[typeof __VLS_components.TargetJobPicker, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onSubmit': {} },
    initial: (__VLS_ctx.student.targetJobs),
    disabled: (__VLS_ctx.student.loading),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onSubmit': {} },
    initial: (__VLS_ctx.student.targetJobs),
    disabled: (__VLS_ctx.student.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onSubmit: (__VLS_ctx.onTargetSubmit)
};
var __VLS_11;
if (__VLS_ctx.student.lastError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "err" },
    });
    (__VLS_ctx.student.lastError);
}
/** @type {__VLS_StyleScopedClasses['onboarding']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['wizard']} */ ;
/** @type {__VLS_StyleScopedClasses['bar']} */ ;
/** @type {__VLS_StyleScopedClasses['fill']} */ ;
/** @type {__VLS_StyleScopedClasses['steps']} */ ;
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
/** @type {__VLS_StyleScopedClasses['err']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            StudentProfileForm: StudentProfileForm,
            TargetJobPicker: TargetJobPicker,
            student: student,
            steps: steps,
            progressPct: progressPct,
            onProfileSubmit: onProfileSubmit,
            onTargetSubmit: onTargetSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
