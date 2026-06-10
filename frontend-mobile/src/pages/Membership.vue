<script setup lang="ts">
import { onMounted } from 'vue';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonNote, IonButton,
} from '@ionic/vue';
import { useMembershipStore } from 'frontend-shared';

// 004 US6 (mobile): 멤버십 비교표 + 실무 단건 서비스 — 웹과 동등 제공.
const market = useMembershipStore();

onMounted(() => {
  void market.fetchTiers();
  void market.fetchPaidServices();
});
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>멤버십</IonTitle></IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <IonList v-for="t in market.tiers" :key="t.code">
        <IonItem>
          <IonLabel>
            <h2>{{ t.name }} <IonNote>{{ t.price_month ? '₩' + t.price_month.toLocaleString() + '/월' : '무료' }}</IonNote></h2>
          </IonLabel>
        </IonItem>
        <IonItem v-for="f in t.features" :key="f"><IonLabel>✓ {{ f }}</IonLabel></IonItem>
      </IonList>

      <h3>실무 단건 서비스</h3>
      <IonList>
        <IonItem v-for="s in market.paidServices" :key="s.code">
          <IonLabel>{{ s.name }}</IonLabel>
          <IonNote slot="end">₩{{ s.fee.toLocaleString() }}</IonNote>
          <IonButton slot="end" fill="outline" @click="market.orderPaidService(s.code)">주문</IonButton>
        </IonItem>
      </IonList>
    </IonContent>
  </IonPage>
</template>
