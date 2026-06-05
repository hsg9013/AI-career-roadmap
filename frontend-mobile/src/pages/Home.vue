<script setup lang="ts">
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/vue';
import { i18n } from 'frontend-shared';
const { t } = i18n;
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('app.title') }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <h2>{{ t('app.tagline') }}</h2>
      <p>Mobile build: Capacitor 6 + Ionic Vue (R-6)</p>
      <p>API: <code>p16.sumzip.com/api/v1</code></p>
    </IonContent>
  </IonPage>
</template>
