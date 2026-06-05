import { onMounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStudentStore, useRoadmapStore } from 'frontend-shared';
// US2 로드맵 페이지 — 선배 경로 기반 합격 로드맵을 시기별로 표시, 추천 거부 지원.
const router = useRouter();
const student = useStudentStore();
const roadmap = useRoadmapStore();
const selectedJobId = ref(null);
const busy = ref(false);
onMounted(async () => {
    await student.fetchTargetJobs();
    if (student.targetJobs.length === 0) {
        await router.push('/onboarding');
        return;
    }
    const first = student.targetJobs[0];
    selectedJobId.value = first.id;
    await roadmap.fetchLatest(first.id);
});
const current = computed(() => selectedJobId.value !== null ? roadmap.roadmaps[selectedJobId.value] ?? null : null);
// 시기(period)별로 묶어 타임라인으로 표시
const grouped = computed(() => {
    const out = {};
    for (const it of current.value?.items ?? []) {
        (out[it.period] ??= []).push(it);
    }
    return out;
});
async function switchJob(job) {
    selectedJobId.value = job.id;
    if (!roadmap.roadmaps[job.id])
        await roadmap.fetchLatest(job.id);
}
async function generate() {
    if (selectedJobId.value === null)
        return;
    busy.value = true;
    try {
        await roadmap.generate(selectedJobId.value);
    }
    finally {
        busy.value = false;
    }
}
async function reject(item) {
    if (selectedJobId.value === null)
        return;
    busy.value = true;
    try {
        await roadmap.rejectAndRefresh(selectedJobId.value, item.id);
    }
    finally {
        busy.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['period']} */ ;
/** @type {__VLS_StyleScopedClasses['period']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['reject']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "roadmap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.generate) },
    ...{ class: "primary" },
    disabled: (__VLS_ctx.busy || __VLS_ctx.selectedJobId === null),
});
(__VLS_ctx.busy ? '생성 중…' : '로드맵 생성/갱신');
if (__VLS_ctx.student.targetJobs.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
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
            ...{ class: ({ active: job.id === __VLS_ctx.selectedJobId }) },
        });
        (job.industry_code);
        (job.job_role_code);
    }
}
if (__VLS_ctx.roadmap.lastError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.roadmap.lastError);
}
if (__VLS_ctx.current) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    if (__VLS_ctx.current.notice) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "notice" },
        });
        (__VLS_ctx.current.notice);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "meta muted" },
    });
    (__VLS_ctx.current.source === 'cohort' ? '코호트' : '폴백');
    (__VLS_ctx.current.cohort_size);
    if (__VLS_ctx.current.cohort_key) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.current.cohort_key);
    }
    for (const [items, period] of __VLS_getVForSourceType((__VLS_ctx.grouped))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (period),
            ...{ class: "period" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
        (period);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
        for (const [item] of __VLS_getVForSourceType((items))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                key: (item.id),
                ...{ class: "item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "info" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "type" },
            });
            (item.activity_type);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (item.title);
            if (item.target_skill) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "skill" },
                });
                (item.target_skill);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "rationale muted" },
            });
            (item.rationale);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.current))
                            return;
                        __VLS_ctx.reject(item);
                    } },
                ...{ class: "reject" },
                disabled: (__VLS_ctx.busy),
            });
        }
    }
}
else if (!__VLS_ctx.roadmap.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted empty" },
    });
}
/** @type {__VLS_StyleScopedClasses['roadmap']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['notice']} */ ;
/** @type {__VLS_StyleScopedClasses['meta']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['period']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['type']} */ ;
/** @type {__VLS_StyleScopedClasses['skill']} */ ;
/** @type {__VLS_StyleScopedClasses['rationale']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['reject']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            student: student,
            roadmap: roadmap,
            selectedJobId: selectedJobId,
            busy: busy,
            current: current,
            grouped: grouped,
            switchJob: switchJob,
            generate: generate,
            reject: reject,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
