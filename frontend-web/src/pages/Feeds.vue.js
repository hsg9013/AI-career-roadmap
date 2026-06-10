import { onMounted, ref } from 'vue';
import { useFeedsStore } from 'frontend-shared';
// 003 US5(T041): 외부 수집 정보(채용·자격증·공모전). 신선도 기준 초과는 '최신 아님' 표시.
const store = useFeedsStore();
const active = ref('');
const TABS = [
    { value: '', label: '전체' },
    { value: 'jobposting', label: '채용' },
    { value: 'certification', label: '자격증' },
    { value: 'contest', label: '공모전' },
];
async function load(kind) {
    active.value = kind;
    await store.fetchItems(kind ? { kind } : {});
}
onMounted(() => load(''));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "feeds" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "tabs" },
});
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.TABS))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.load(t.value);
            } },
        key: (t.value),
        ...{ class: ({ active: __VLS_ctx.active === t.value }) },
    });
    (t.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "list" },
});
for (const [it] of __VLS_getVForSourceType((__VLS_ctx.store.items))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (it.id),
        ...{ class: "item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "kind" },
    });
    (it.kind);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (it.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "src" },
    });
    (it.source);
    if (it.freshness === 'stale') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "stale" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "fresh" },
        });
    }
}
if (!__VLS_ctx.store.loading && __VLS_ctx.store.items.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted empty" },
    });
}
/** @type {__VLS_StyleScopedClasses['feeds']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['kind']} */ ;
/** @type {__VLS_StyleScopedClasses['src']} */ ;
/** @type {__VLS_StyleScopedClasses['stale']} */ ;
/** @type {__VLS_StyleScopedClasses['fresh']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            store: store,
            active: active,
            TABS: TABS,
            load: load,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
