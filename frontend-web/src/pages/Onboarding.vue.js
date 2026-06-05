import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, StudentProfileForm, TargetJobPicker, } from 'frontend-shared';
// T056 Onboarding — 신규 가입자 흐름
//   1) 프로필 보강 (university/major/year 는 가입 시 입력했지만 졸업예정 등 보강 가능)
//   2) 목표 직무 선택 (최대 3)
//   3) 갭 진단 트리거 → /dashboard
const router = useRouter();
const student = useStudentStore();
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
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "onboarding" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
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
/** @type {__VLS_StyleScopedClasses['err']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            StudentProfileForm: StudentProfileForm,
            TargetJobPicker: TargetJobPicker,
            student: student,
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
