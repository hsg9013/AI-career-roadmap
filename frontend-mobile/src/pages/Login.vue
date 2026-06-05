<script setup lang="ts">
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/vue';
import { i18n } from 'frontend-shared';
const { t } = i18n;
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('auth.login') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <p>모바일 로그인 화면 — Phase 3 (US1) 에서 구현</p>
    </IonContent>
  </IonPage>
</template>
