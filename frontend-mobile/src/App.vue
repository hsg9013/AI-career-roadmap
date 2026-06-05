<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
// T043: 모바일 셸 — IonApp + IonRouterOutlet. 다크 모드는 prefers-color-scheme 자동.
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>

<style>
@media (prefers-color-scheme: dark) {
  :root { --ion-background-color: #0b0b0c; --ion-text-color: #f5f5f7; }
}
</style>
