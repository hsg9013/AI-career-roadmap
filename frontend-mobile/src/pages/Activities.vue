<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption, IonButton, IonNote,
} from '@ionic/vue';
import { useActivitiesStore, type ActivityCategory } from 'frontend-shared';

// 004 US1/G1 (mobile): 활동·경험·스펙 기록 — 웹과 동등 제공.
const store = useActivitiesStore();

const CATEGORIES: { value: ActivityCategory; label: string }[] = [
  { value: 'course', label: '수강 과목' },
  { value: 'project', label: '프로젝트' },
  { value: 'club', label: '동아리' },
  { value: 'volunteer', label: '봉사' },
  { value: 'contest', label: '공모전' },
  { value: 'external', label: '대외활동' },
  { value: 'internship', label: '인턴십' },
  { value: 'part_time', label: '아르바이트' },
  { value: 'certification', label: '자격증' },
  { value: 'award', label: '수상' },
];

const form = ref<{ category: ActivityCategory; title: string; started_at: string }>({
  category: 'project',
  title: '',
  started_at: '',
});

onMounted(() => {
  void store.fetchList();
  void store.fetchCompleteness();
});

async function add(): Promise<void> {
  if (!form.value.title || !form.value.started_at) return;
  await store.create({ category: form.value.category, title: form.value.title, started_at: form.value.started_at })
    .then(() => { form.value.title = ''; })
    .catch(() => undefined);
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>활동·스펙</IonTitle></IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <IonNote v-if="store.completeness">
        활동 {{ store.completeness.activities_count }}건 · 스펙 {{ store.completeness.credentials_count }}건
        <span v-if="store.completeness.ready_for_documents"> · 문서 생성 준비 완료</span>
      </IonNote>

      <IonList>
        <IonItem>
          <IonSelect v-model="form.category" label="유형" interface="popover">
            <IonSelectOption v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonInput v-model="form.title" label="제목" placeholder="예: 캡스톤 프로젝트" />
        </IonItem>
        <IonItem>
          <IonInput v-model="form.started_at" type="date" label="시작일" />
        </IonItem>
      </IonList>
      <IonButton expand="block" :disabled="store.loading || !form.title || !form.started_at" @click="add">추가</IonButton>

      <IonList>
        <IonItem v-for="a in store.items" :key="a.id">
          <IonLabel>
            <h3>{{ a.title }}</h3>
            <p>{{ a.category }} · {{ a.started_at }}</p>
          </IonLabel>
          <IonButton slot="end" fill="clear" color="danger" @click="store.remove(a.id)">삭제</IonButton>
        </IonItem>
        <IonItem v-if="!store.items.length"><IonLabel color="medium">아직 기록이 없습니다.</IonLabel></IonItem>
      </IonList>
    </IonContent>
  </IonPage>
</template>
