import { onMounted, ref } from 'vue';
import { useNotificationsStore } from 'frontend-shared';
// US4/US5 알림 센터 + 채널 설정(FR-009). in_app 은 항상 on, push/email 토글.
const store = useNotificationsStore();
const saving = ref(false);
const savedAt = ref(null);
onMounted(async () => {
    await Promise.all([store.fetchAll(), store.fetchSettings()]);
});
async function toggle(channel) {
    saving.value = true;
    savedAt.value = null;
    try {
        await store.updateSettings({
            push: channel === 'push' ? !store.settings.push : store.settings.push,
            email: channel === 'email' ? !store.settings.email : store.settings.email,
        });
        savedAt.value = '저장됨';
    }
    finally {
        saving.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['settings']} */ ;
/** @type {__VLS_StyleScopedClasses['toggles']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['on']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['noti']} */ ;
/** @type {__VLS_StyleScopedClasses['noti']} */ ;
/** @type {__VLS_StyleScopedClasses['noti']} */ ;
/** @type {__VLS_StyleScopedClasses['noti']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "notifications" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "settings" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "toggles" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "switch on disabled" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    checked: true,
    disabled: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "slider" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "switch" },
    ...{ class: ({ on: __VLS_ctx.store.settings.push }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.toggle('push');
        } },
    type: "checkbox",
    checked: (__VLS_ctx.store.settings.push),
    disabled: (__VLS_ctx.saving),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "slider" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "switch" },
    ...{ class: ({ on: __VLS_ctx.store.settings.email }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.toggle('email');
        } },
    type: "checkbox",
    checked: (__VLS_ctx.store.settings.email),
    disabled: (__VLS_ctx.saving),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
    ...{ class: "slider" },
});
if (__VLS_ctx.savedAt) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
        ...{ class: "saved" },
    });
    (__VLS_ctx.savedAt);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "list" },
});
for (const [n] of __VLS_getVForSourceType((__VLS_ctx.store.notifications))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (n.id),
        ...{ class: "noti" },
        ...{ class: ({ unread: !n.read_at }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (n.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "type" },
    });
    (n.type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "time" },
    });
    (n.sent_at);
    if (!n.read_at) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!n.read_at))
                        return;
                    __VLS_ctx.store.markRead(n.id);
                } },
        });
    }
}
if (!__VLS_ctx.store.loading && __VLS_ctx.store.notifications.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted empty" },
    });
}
/** @type {__VLS_StyleScopedClasses['notifications']} */ ;
/** @type {__VLS_StyleScopedClasses['settings']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['toggles']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['on']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['switch']} */ ;
/** @type {__VLS_StyleScopedClasses['slider']} */ ;
/** @type {__VLS_StyleScopedClasses['saved']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
/** @type {__VLS_StyleScopedClasses['noti']} */ ;
/** @type {__VLS_StyleScopedClasses['type']} */ ;
/** @type {__VLS_StyleScopedClasses['time']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            store: store,
            saving: saving,
            savedAt: savedAt,
            toggle: toggle,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
