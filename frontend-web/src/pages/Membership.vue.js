import { ref, computed } from 'vue';
import { usePaymentsStore } from 'frontend-shared';
// US3/US8 멤버십 결제 (student). 결제 승인 시 멤버십 활성화 + 영수증 표시.
// 실연동(PortOne)은 pending+redirect → 결제창; dev 무키는 즉시 paid.
const store = usePaymentsStore();
const amount = ref(9900);
const result = computed(() => store.result);
const STATUS_LABEL = {
    pending: '결제 진행 중',
    paid: '결제 완료',
    failed: '결제 실패',
    canceled: '결제 취소됨',
    refunded: '환불됨',
};
async function pay() {
    await store.checkout(amount.value, 'standard').catch(() => undefined);
}
// 웹훅 확정(실연동) 후 상태를 다시 불러온다.
async function refresh() {
    if (result.value)
        await store.fetchPayment(result.value.payment_id);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['plan']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "membership" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "plan" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "price" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
});
(__VLS_ctx.amount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.pay) },
    disabled: (__VLS_ctx.store.loading),
});
(__VLS_ctx.store.loading ? '결제 중…' : '결제하기');
if (__VLS_ctx.store.lastError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.store.lastError);
}
if (__VLS_ctx.result) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "receipt" },
        ...{ class: (__VLS_ctx.result.status) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "status" },
    });
    (__VLS_ctx.STATUS_LABEL[__VLS_ctx.result.status] ?? __VLS_ctx.result.status);
    if (__VLS_ctx.result.status === 'paid' && __VLS_ctx.result.membership_ends_at) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "ok" },
        });
        (__VLS_ctx.result.membership_ends_at);
    }
    else if (__VLS_ctx.result.status === 'pending') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "muted" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.refresh) },
            ...{ class: "link" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "detail muted" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    (__VLS_ctx.result.pg_tx_id);
    if (__VLS_ctx.result.receipt_url) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: (__VLS_ctx.result.receipt_url),
            target: "_blank",
            rel: "noopener",
        });
    }
}
/** @type {__VLS_StyleScopedClasses['membership']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['plan']} */ ;
/** @type {__VLS_StyleScopedClasses['price']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['receipt']} */ ;
/** @type {__VLS_StyleScopedClasses['status']} */ ;
/** @type {__VLS_StyleScopedClasses['ok']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['link']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            store: store,
            amount: amount,
            result: result,
            STATUS_LABEL: STATUS_LABEL,
            pay: pay,
            refresh: refresh,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
