import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, GapDiagnosisChart } from 'frontend-shared';
// T056 Dashboard — 갭 진단 결과를 직무별로 표시. 활동/직무 미설정 시 온보딩으로 유도.
const router = useRouter();
const student = useStudentStore();
const triggering = ref(false);
const selectedJobId = ref(null);
onMounted(async () => {
    await Promise.all([student.fetchProfile(), student.fetchTargetJobs()]);
    if (student.targetJobs.length === 0) {
        await router.push('/onboarding');
        return;
    }
    const first = student.targetJobs[0];
    selectedJobId.value = first.id;
    await student.fetchLatestDiagnosis(first.id);
});
const selectedDiagnosis = computed(() => selectedJobId.value !== null ? student.diagnoses[selectedJobId.value] ?? null : null);
async function switchJob(job) {
    selectedJobId.value = job.id;
    if (!student.diagnoses[job.id]) {
        await student.fetchLatestDiagnosis(job.id);
    }
}
async function rerunDiagnosis() {
    if (selectedJobId.value === null)
        return;
    triggering.value = true;
    try {
        await student.triggerDiagnosis(selectedJobId.value);
    }
    finally {
        triggering.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['rerun']} */ ;
/** @type {__VLS_StyleScopedClasses['rerun']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "dashboard" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
if (__VLS_ctx.student.profile) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted" },
    });
    (__VLS_ctx.student.profile.university);
    (__VLS_ctx.student.profile.major);
    (__VLS_ctx.student.profile.year_in_school);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.rerunDiagnosis) },
    ...{ class: "rerun" },
    disabled: (__VLS_ctx.triggering || __VLS_ctx.selectedJobId === null),
});
(__VLS_ctx.triggering ? '진단 중…' : '갭 진단 다시 실행');
if (__VLS_ctx.student.targetJobs.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tabs" },
    });
    for (const [job] of __VLS_getVForSourceType((__VLS_ctx.student.targetJobs))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.student.targetJobs.length > 0))
                        return;
                    __VLS_ctx.switchJob(job);
                } },
            key: (job.id),
            ...{ class: (['tab', { active: __VLS_ctx.selectedJobId === job.id }]) },
            type: "button",
        });
        (job.priority);
        (job.industry_code);
        (job.job_role_code);
    }
}
if (__VLS_ctx.selectedDiagnosis) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chart-wrap" },
    });
    const __VLS_0 = {}.GapDiagnosisChart;
    /** @type {[typeof __VLS_components.GapDiagnosisChart, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        diagnosis: (__VLS_ctx.selectedDiagnosis),
    }));
    const __VLS_2 = __VLS_1({
        diagnosis: (__VLS_ctx.selectedDiagnosis),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.rerunDiagnosis) },
        ...{ class: "rerun" },
        disabled: (__VLS_ctx.triggering),
    });
}
if (__VLS_ctx.student.lastError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "err" },
    });
    (__VLS_ctx.student.lastError);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "footer" },
});
const __VLS_4 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: "/onboarding",
}));
const __VLS_6 = __VLS_5({
    to: "/onboarding",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
var __VLS_7;
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['rerun']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['rerun']} */ ;
/** @type {__VLS_StyleScopedClasses['err']} */ ;
/** @type {__VLS_StyleScopedClasses['footer']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            GapDiagnosisChart: GapDiagnosisChart,
            student: student,
            triggering: triggering,
            selectedJobId: selectedJobId,
            selectedDiagnosis: selectedDiagnosis,
            switchJob: switchJob,
            rerunDiagnosis: rerunDiagnosis,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
