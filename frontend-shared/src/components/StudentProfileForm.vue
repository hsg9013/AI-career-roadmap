<script setup lang="ts">
import { reactive, watch, ref } from 'vue';
import type { StudentProfile } from '../stores/student.js';

// T053: 학생 프로필 입력 폼 — web/mobile 공유.
// 컨테이너(상위 페이지) 가 submit 결과를 받아 store action 호출.

const props = defineProps<{
  initial?: StudentProfile | null;
  submitLabel?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', value: {
    university: string;
    major: string;
    year_in_school: number;
    expected_grad_at: string | null;
  }): void;
}>();

interface FormState {
  university: string;
  major: string;
  year_in_school: number;
  expected_grad_at: string;
}

function fromInitial(p: StudentProfile | null | undefined): FormState {
  return {
    university: p?.university ?? '',
    major: p?.major ?? '',
    year_in_school: p?.year_in_school ?? 1,
    expected_grad_at: p?.expected_grad_at ?? '',
  };
}

const form = reactive<FormState>(fromInitial(props.initial));
const fieldError = ref<string | null>(null);

watch(
  () => props.initial,
  (next) => Object.assign(form, fromInitial(next)),
);

function onSubmit(): void {
  if (!form.university.trim()) {
    fieldError.value = '대학교를 입력하세요';
    return;
  }
  if (!form.major.trim()) {
    fieldError.value = '전공을 입력하세요';
    return;
  }
  if (form.year_in_school < 1 || form.year_in_school > 6) {
    fieldError.value = '학년은 1~6 사이여야 합니다';
    return;
  }
  fieldError.value = null;
  emit('submit', {
    university: form.university.trim(),
    major: form.major.trim(),
    year_in_school: form.year_in_school,
    expected_grad_at: form.expected_grad_at ? form.expected_grad_at : null,
  });
}
</script>

<template>
  <form class="student-profile-form" @submit.prevent="onSubmit">
    <label class="field">
      <span>대학교</span>
      <input v-model="form.university" :disabled="disabled" type="text" maxlength="120" required />
    </label>
    <label class="field">
      <span>전공</span>
      <input v-model="form.major" :disabled="disabled" type="text" maxlength="120" required />
    </label>
    <label class="field">
      <span>학년</span>
      <select v-model.number="form.year_in_school" :disabled="disabled">
        <option v-for="n in 6" :key="n" :value="n">{{ n }}학년</option>
      </select>
    </label>
    <label class="field">
      <span>졸업 예정 (선택)</span>
      <input v-model="form.expected_grad_at" :disabled="disabled" type="date" />
    </label>
    <p v-if="fieldError" class="err">{{ fieldError }}</p>
    <button type="submit" :disabled="disabled" class="submit">
      {{ submitLabel ?? '저장' }}
    </button>
  </form>
</template>

<style scoped>
.student-profile-form { display: flex; flex-direction: column; gap: 0.75rem; max-width: 420px; }
.field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: #333; }
.field input, .field select {
  padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 1rem;
}
.field input:disabled, .field select:disabled { background: #f3f4f6; }
.submit {
  margin-top: 0.5rem; padding: 0.6rem 1rem; background: #2563eb; color: #fff;
  border: none; border-radius: 4px; font-weight: 600; cursor: pointer;
}
.submit:disabled { background: #93c5fd; cursor: not-allowed; }
.err { color: #b91c1c; font-size: 0.85rem; }
</style>
