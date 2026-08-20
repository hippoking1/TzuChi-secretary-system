<template>
  <div class="admin-line-bindings">
    <h1 class="text-2xl font-bold mb-6">LINE 帳號綁定管理</h1>

    <div class="card mb-6">
      <h3 class="font-bold mb-2">志工 LINE 官方帳號綁定說明</h3>
      <p class="text-sm text-muted">志工在 LINE 官方帳號輸入「姓名 + 所屬組織名稱」（例如：<code>張志工 第一協力</code>），系統即會自動核身並綁定，以接收隔日值班提醒與開會通知。</p>
    </div>

    <div class="card table-responsive">
      <table class="table">
        <thead>
          <tr>
            <th>志工姓名</th>
            <th>聯絡電話</th>
            <th>LINE 顯示名稱</th>
            <th>綁定時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="bindings.length === 0">
            <td colspan="5" class="text-center text-muted p-4">暫無綁定資料</td>
          </tr>
          <tr v-for="b in bindings" :key="b.id">
            <td class="font-bold">{{ b.memberName }}</td>
            <td>{{ b.memberPhone }}</td>
            <td>{{ b.lineDisplayName || 'LINE 用戶' }}</td>
            <td>{{ b.bindingTime || '-' }}</td>
            <td>
              <button class="btn btn-sm btn-danger" @click="handleUnbind(b.id)">解除綁定</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getCollectionDocs, deleteDocById } from '@/firebase/db';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const bindings = ref([]);

async function loadBindings() {
  bindings.value = await getCollectionDocs('lineBindings');
}

async function handleUnbind(id) {
  if (!confirm('確定要解除此志工的 LINE 綁定嗎？')) return;
  await deleteDocById('lineBindings', id);
  toast.success('已解除綁定');
  await loadBindings();
}

onMounted(() => {
  loadBindings();
});
</script>
