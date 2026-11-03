<template>
  <div v-if="show" class="modal-backdrop" @click="closeModal">
    <div class="modal-content" style="max-width: 800px;" @click.stop>
      <div class="modal-header">
        <div>
          <h3 class="modal-title flex items-center gap-2">
            🏛️ 道場據點管理
          </h3>
          <p class="text-xs text-muted mt-1">
            自由新增、刪除道場，或修改道場名稱與值班班次時段（改名時將自動同步更新歷史排班與規則）
          </p>
        </div>
        <button class="modal-close" @click="closeModal">×</button>
      </div>

      <div class="modal-body flex flex-col gap-4">
        <!-- 頂部切換按鈕：列表檢視 / 新增道場 -->
        <div class="flex items-center justify-between flex-wrap gap-2 border-b pb-3">
          <div class="flex items-center gap-2">
            <button 
              type="button" 
              class="btn btn-sm"
              :class="activeTab === 'list' ? 'btn-primary' : 'btn-outline'"
              @click="switchToList"
            >
              📋 現有道場據點 ({{ locationsStore.locations.length }})
            </button>
            <button 
              type="button" 
              class="btn btn-sm"
              :class="activeTab === 'form' ? 'btn-primary' : 'btn-outline'"
              @click="openAddForm"
            >
              ➕ 新增道場據點
            </button>
          </div>
          <span class="text-xs text-muted">
            共 {{ locationsStore.locations.length }} 個道場據點
          </span>
        </div>

        <!-- 模式一：現有道場列表檢視 -->
        <div v-if="activeTab === 'list'" class="space-y-3">
          <div 
            v-for="(loc, idx) in locationsStore.locations" 
            :key="loc.id || loc.name"
            class="card p-3.5 border bg-white hover:shadow-xs transition-shadow"
          >
            <div class="flex items-start justify-between flex-wrap gap-2">
              <div class="flex-1 min-w-[200px]">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="font-bold text-base text-gray-800 m-0">
                    🏛️ {{ loc.name }}
                  </h4>
                  <span v-if="loc.isCampus" class="badge badge-primary text-xs">
                    園區/靜思堂 (值週輪替)
                  </span>
                  <span v-else class="badge badge-info text-xs">
                    聯絡處/共修點 (常態輪替)
                  </span>
                  <span class="text-xs text-muted">#順序 {{ idx + 1 }}</span>
                </div>
                <p v-if="loc.note" class="text-xs text-muted mt-1 mb-0">
                  {{ loc.note }}
                </p>
              </div>

              <!-- 操作按鈕 -->
              <div class="flex items-center gap-2">
                <button 
                  type="button" 
                  class="btn btn-xs btn-outline flex items-center gap-1"
                  @click="openEditForm(loc)"
                >
                  ✏️ 編輯名稱與班次
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs btn-danger flex items-center gap-1"
                  :disabled="locationsStore.locations.length <= 1"
                  :title="locationsStore.locations.length <= 1 ? '系統至少需保留一個道場' : '刪除道場'"
                  @click="handleDelete(loc)"
                >
                  🗑️ 刪除
                </button>
              </div>
            </div>

            <!-- 該道場包含的班次與席位配額預覽 -->
            <div class="mt-3 pt-2.5 border-t border-gray-100">
              <span class="text-xs font-bold text-gray-600 block mb-1.5">
                執勤班次與時段 (共 {{ (loc.shifts || []).length }} 個班次)：
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                <div 
                  v-for="s in loc.shifts || []" 
                  :key="s.shiftId"
                  class="bg-gray-50 p-2 rounded border border-gray-200 text-xs flex flex-col justify-between"
                >
                  <div class="flex items-center justify-between font-bold text-gray-800">
                    <span>{{ s.label }} ({{ s.gender || '不拘' }}眾)</span>
                    <span class="text-primary font-mono text-[11px]">{{ s.shiftId }}</span>
                  </div>
                  <div class="flex items-center justify-between text-muted text-[11px] mt-1">
                    <span>⏰ {{ s.startTime }} ~ {{ s.endTime }}</span>
                    <span class="font-bold text-gray-700">席次：{{ s.quota }} 席</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 模式二：新增 / 編輯道場表單 -->
        <div v-else class="space-y-4">
          <div class="card p-4 border bg-gray-50/60">
            <h4 class="font-bold text-sm text-primary mb-3">
              {{ editingLocationId ? `✏️ 編輯道場據點：${formData.name}` : '➕ 建立全新道場據點' }}
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div class="form-group mb-0">
                <label class="form-label font-bold text-xs">
                  道場名稱 <span class="text-danger">*</span>：
                </label>
                <input 
                  v-model="formData.name" 
                  type="text" 
                  class="form-input form-input-sm font-bold" 
                  placeholder="例：羅東聯絡處、礁溪共修處"
                  required
                />
                <small v-if="editingLocationId && originalName !== formData.name" class="text-amber-700 block mt-1 text-[11px]">
                  💡 儲存後，系統將自動同步將既有「{{ originalName }}」之排班紀錄與規則更新為「{{ formData.name }}」。
                </small>
              </div>

              <div class="form-group mb-0">
                <label class="form-label font-bold text-xs">道場類型：</label>
                <div class="flex items-center gap-2 mt-1">
                  <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" v-model="formData.isCampus" :value="false" />
                    <span>聯絡處/共修點 (常態每週輪替)</span>
                  </label>
                  <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="radio" v-model="formData.isCampus" :value="true" />
                    <span>園區/靜思堂 (四和氣週輪替)</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">備註說明：</label>
              <input 
                v-model="formData.note" 
                type="text" 
                class="form-input form-input-sm" 
                placeholder="例如：常態女眾上午班與男眾下午班"
              />
            </div>
          </div>

          <!-- 班次設定區 -->
          <div class="card p-4 border">
            <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <h4 class="font-bold text-sm text-gray-800 m-0">
                  ⏰ 該道場包含之班次時段與名額配置
                </h4>
                <p class="text-[11px] text-muted m-0">
                  排班時將依此班次列表自動產生每日執勤席位
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  type="button" 
                  class="btn btn-xs btn-outline"
                  @click="applyQuickShifts('standard')"
                  title="帶入標準女眾整天班(4席)+男眾二班(各2席)"
                >
                  套用園區標準班次
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs btn-outline"
                  @click="applyQuickShifts('halfday')"
                  title="帶入女眾半天班(2席)+男眾半天班(1席)"
                >
                  套用聯絡處半天班次
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs btn-primary"
                  @click="addShiftRow"
                >
                  ➕ 新增班次
                </button>
              </div>
            </div>

            <!-- 班次清單表格 -->
            <div class="table-responsive">
              <table class="table table-bordered table-sm text-xs">
                <thead>
                  <tr class="bg-gray-100 text-gray-700">
                    <th style="width: 120px;">班次名稱</th>
                    <th style="width: 100px;">班次代碼</th>
                    <th style="width: 80px;">眾別</th>
                    <th style="width: 90px;">起始時間</th>
                    <th style="width: 90px;">結束時間</th>
                    <th style="width: 80px;">席次需求</th>
                    <th style="width: 60px; text-align: center;">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(shift, sIdx) in formData.shifts" :key="sIdx">
                    <td>
                      <input 
                        v-model="shift.label" 
                        type="text" 
                        class="form-input form-input-sm py-1" 
                        placeholder="如: 女眾班"
                        required
                      />
                    </td>
                    <td>
                      <input 
                        v-model="shift.shiftId" 
                        type="text" 
                        class="form-input form-input-sm py-1 font-mono uppercase" 
                        placeholder="如: YL_F"
                        required
                      />
                    </td>
                    <td>
                      <select v-model="shift.gender" class="form-select form-select-sm py-1">
                        <option value="女">女眾</option>
                        <option value="男">男眾</option>
                        <option value="不拘">不拘</option>
                      </select>
                    </td>
                    <td>
                      <input 
                        v-model="shift.startTime" 
                        type="time" 
                        class="form-input form-input-sm py-1" 
                        @change="updateTimeRange(shift)"
                        required
                      />
                    </td>
                    <td>
                      <input 
                        v-model="shift.endTime" 
                        type="time" 
                        class="form-input form-input-sm py-1" 
                        @change="updateTimeRange(shift)"
                        required
                      />
                    </td>
                    <td>
                      <input 
                        v-model.number="shift.quota" 
                        type="number" 
                        min="1" 
                        max="20" 
                        class="form-input form-input-sm py-1 text-center font-bold" 
                        required
                      />
                    </td>
                    <td class="text-center">
                      <button 
                        type="button" 
                        class="btn btn-xs btn-danger py-0.5 px-1.5"
                        :disabled="formData.shifts.length <= 1"
                        @click="removeShiftRow(sIdx)"
                        title="刪除此班次"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 表單按鈕 -->
          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-sm btn-outline" @click="switchToList">
              取消返回
            </button>
            <button 
              type="button" 
              class="btn btn-sm btn-primary"
              :disabled="saving"
              @click="handleSave"
            >
              <span>{{ saving ? '💾 儲存中...' : (editingLocationId ? '💾 儲存修改' : '✨ 確認新增道場') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer flex items-center justify-between">
        <span class="text-xs text-muted">
          道場資料即時同步至雲端資料庫，新增後於排班月曆、排班維護與匯出選單立即可用
        </span>
        <button class="btn btn-outline btn-sm" @click="closeModal">
          關閉視窗
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useLocationsStore } from '@/stores/locations';
import { useToast } from '@/composables/useToast';

const props = defineProps({
  show: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'updated']);

const locationsStore = useLocationsStore();
const toast = useToast();

const activeTab = ref('list'); // 'list' | 'form'
const editingLocationId = ref(null);
const originalName = ref('');
const saving = ref(false);

const formData = reactive({
  name: '',
  note: '',
  isCampus: false,
  shifts: []
});

watch(() => props.show, (newVal) => {
  if (newVal) {
    locationsStore.fetchLocations();
    switchToList();
  }
});

function closeModal() {
  emit('close');
}

function switchToList() {
  activeTab.value = 'list';
  editingLocationId.value = null;
  originalName.value = '';
}

function openAddForm() {
  editingLocationId.value = null;
  originalName.value = '';
  formData.name = '';
  formData.note = '';
  formData.isCampus = false;
  // 給予預設女眾班與男眾班
  applyQuickShifts('halfday');
  activeTab.value = 'form';
}

function openEditForm(loc) {
  editingLocationId.value = loc.id;
  originalName.value = loc.name;
  formData.name = loc.name;
  formData.note = loc.note || '';
  formData.isCampus = !!loc.isCampus;
  formData.shifts = (loc.shifts || []).map(s => ({
    shiftId: s.shiftId,
    label: s.label,
    startTime: s.startTime || '08:00',
    endTime: s.endTime || '16:00',
    timeRange: s.timeRange || `${s.startTime || '08:00'}~${s.endTime || '16:00'}`,
    gender: s.gender || '女',
    quota: s.quota || 2
  }));
  activeTab.value = 'form';
}

function updateTimeRange(shift) {
  shift.timeRange = `${shift.startTime || '08:00'}~${shift.endTime || '16:00'}`;
}

function addShiftRow() {
  const nextNum = formData.shifts.length + 1;
  formData.shifts.push({
    shiftId: `SHIFT_${nextNum}`,
    label: `值班${nextNum}班`,
    startTime: '08:00',
    endTime: '12:00',
    timeRange: '08:00~12:00',
    gender: '女',
    quota: 2
  });
}

function removeShiftRow(idx) {
  if (formData.shifts.length <= 1) return;
  formData.shifts.splice(idx, 1);
}

function applyQuickShifts(type) {
  if (type === 'standard') {
    formData.shifts = [
      { shiftId: 'YL_F', label: '女眾班', startTime: '08:00', endTime: '16:00', timeRange: '08:00~16:00', gender: '女', quota: 4 },
      { shiftId: 'YL_M1', label: '男眾班(一)', startTime: '16:00', endTime: '18:30', timeRange: '16:00~18:30', gender: '男', quota: 2 },
      { shiftId: 'YL_M2', label: '男眾班(二)', startTime: '18:30', endTime: '20:30', timeRange: '18:30~20:30', gender: '男', quota: 2 }
    ];
  } else {
    formData.shifts = [
      { shiftId: 'DG_F', label: '女眾班', startTime: '08:00', endTime: '13:00', timeRange: '08:00~13:00', gender: '女', quota: 2 },
      { shiftId: 'DG_M', label: '男眾班', startTime: '13:00', endTime: '17:00', timeRange: '13:00~17:00', gender: '男', quota: 1 }
    ];
  }
}

async function handleSave() {
  const cleanName = formData.name.trim();
  if (!cleanName) {
    toast.error('請填寫道場名稱！');
    return;
  }
  if (!formData.shifts || formData.shifts.length === 0) {
    toast.error('請至少設定一個值班班次！');
    return;
  }

  // 驗證班次設定
  for (let i = 0; i < formData.shifts.length; i++) {
    const s = formData.shifts[i];
    if (!s.label.trim()) {
      toast.error(`第 ${i + 1} 個班次的名稱不可為空！`);
      return;
    }
    if (!s.shiftId.trim()) {
      toast.error(`第 ${i + 1} 個班次的代碼不可為空！`);
      return;
    }
    updateTimeRange(s);
  }

  saving.value = true;
  try {
    if (editingLocationId.value) {
      // 修改現有道場
      const res = await locationsStore.updateLocation(editingLocationId.value, {
        name: cleanName,
        note: formData.note,
        isCampus: formData.isCampus,
        shifts: formData.shifts,
        syncExisting: true
      });
      if (res.isNameChanged) {
        toast.success(`🎉 道場「${originalName.value}」已成功更名為「${cleanName}」，並自動同步歷史排班與規則！`);
      } else {
        toast.success(`🎉 道場「${cleanName}」設定已成功儲存！`);
      }
    } else {
      // 新增道場
      await locationsStore.addLocation({
        name: cleanName,
        note: formData.note,
        isCampus: formData.isCampus,
        shifts: formData.shifts
      });
      toast.success(`🎉 道場「${cleanName}」已成功建立！`);
    }

    emit('updated', cleanName);
    switchToList();
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}

async function handleDelete(loc) {
  if (locationsStore.locations.length <= 1) {
    toast.error('系統至少需保留一個道場，無法刪除！');
    return;
  }

  // 檢查該道場是否有排班資料
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
    emit('updated');
  } catch (err) {
    toast.error('刪除道場失敗：' + err.message);
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; max-height: 90vh; display: flex; flex-direction: column; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; }
.modal-footer { padding: 1rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }
</style>
