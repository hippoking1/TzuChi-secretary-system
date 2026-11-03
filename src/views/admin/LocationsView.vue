<template>
  <div class="admin-locations-view">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          🏛️ 道場據點管理
        </h1>
        <p class="text-sm text-muted mt-1">
          自由維護道場據點名稱、類型與執勤班次時段。支援修改道場名稱並自動同步歷史排班與規則！
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button 
          type="button" 
          class="btn btn-primary flex items-center gap-1.5"
          @click="showModal = true"
        >
          <span>➕ 建立新道場據點</span>
        </button>
      </div>
    </div>

    <!-- 道場列表卡片區 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        v-for="(loc, idx) in locationsStore.locations" 
        :key="loc.id || loc.name"
        class="card p-5 border bg-white shadow-xs flex flex-col justify-between"
      >
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-bold text-lg text-gray-800 m-0">
                  🏛️ {{ loc.name }}
                </h3>
                <span v-if="loc.isCampus" class="badge badge-primary text-xs">
                  園區/靜思堂 (值週輪替)
                </span>
                <span v-else class="badge badge-info text-xs">
                  聯絡處/共修點 (常態輪替)
                </span>
              </div>
              <p class="text-xs text-muted mt-1 mb-0">
                {{ loc.note || '尚無特別備註說明' }}
              </p>
            </div>

            <div class="flex items-center gap-1">
              <button 
                type="button" 
                class="btn btn-xs btn-outline"
                @click="editLocation(loc)"
                title="編輯名稱與班次"
              >
                ✏️ 編輯
              </button>
              <button 
                type="button" 
                class="btn btn-xs btn-danger"
                :disabled="locationsStore.locations.length <= 1"
                @click="deleteLocation(loc)"
                title="刪除道場"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- 班次預覽 -->
          <div class="mt-4 pt-3 border-t border-gray-100">
            <div class="flex items-center justify-between text-xs font-bold text-gray-700 mb-2">
              <span>⏰ 包含班次 (共 {{ (loc.shifts || []).length }} 班)：</span>
              <span class="text-muted font-normal text-[11px]">排班時自動帶入</span>
            </div>
            <div class="space-y-1.5">
              <div 
                v-for="s in loc.shifts || []" 
                :key="s.shiftId"
                class="bg-gray-50 px-3 py-1.5 rounded border border-gray-200 text-xs flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-800">{{ s.label }}</span>
                  <span class="badge badge-gray text-[10px]">{{ s.gender || '不拘' }}眾</span>
                  <span class="font-mono text-gray-500 text-[11px]">{{ s.shiftId }}</span>
                </div>
                <div class="flex items-center gap-3 text-muted text-[11px]">
                  <span>⏰ {{ s.startTime }} ~ {{ s.endTime }}</span>
                  <span class="font-bold text-primary">{{ s.quota }} 席</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部快捷連結 -->
        <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
          <span class="text-muted">#順序序號 {{ idx + 1 }}</span>
          <div class="flex items-center gap-2">
            <router-link :to="`/admin/duty-schedule`" class="text-primary hover:underline">
              🗓️ 查看月曆
            </router-link>
            <span class="text-gray-300">|</span>
            <router-link :to="`/admin/duty-form`" class="text-primary hover:underline">
              ✏️ 進行排班
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- 彈出視窗組件 -->
    <LocationManageModal 
      :show="showModal"
      @close="showModal = false"
      @updated="onLocationUpdated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useLocationsStore } from '@/stores/locations';
import { useToast } from '@/composables/useToast';
import LocationManageModal from '@/components/duty/LocationManageModal.vue';

const locationsStore = useLocationsStore();
const toast = useToast();

const showModal = ref(false);

function editLocation(loc) {
  showModal.value = true;
}

function onLocationUpdated() {
  locationsStore.fetchLocations();
}

async function deleteLocation(loc) {
  if (locationsStore.locations.length <= 1) {
    toast.error('系統至少需保留一個道場！');
    return;
  }
  const usage = await locationsStore.checkLocationUsage(loc.name);
  let confirmMsg = `確定要刪除道場【${loc.name}】嗎？`;

  if (usage.dutyCount > 0 || usage.ruleCount > 0) {
    confirmMsg = `⚠️ 警告：道場【${loc.name}】目前在系統中尚有：\n\n`
      + `• ${usage.dutyCount} 筆已排定之排班紀錄\n`
      + `• ${usage.ruleCount} 條排班規則\n\n`
      + `確定要刪除此道場嗎？\n點選「確定」將會保留歷史排班紀錄僅自選單移除此道場據點。`;
  }

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    await locationsStore.deleteLocation(loc.id, false);
    toast.success(`道場「${loc.name}」已成功刪除！`);
  } catch (err) {
    toast.error('刪除道場失敗：' + err.message);
  }
}

onMounted(() => {
  locationsStore.fetchLocations();
});
</script>
