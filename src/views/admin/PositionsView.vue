<template>
  <div class="admin-positions">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">幹部職稱架構管理</h1>
        <p class="text-sm text-muted">管理組織內各幹部階層職務（合心幹事 ➔ 和氣幹事 ➔ 各功能幹事），可自由彈性增減</p>
      </div>
      <div class="flex gap-2">
        <button 
          v-if="posStore.positions.length === 0" 
          class="btn btn-outline-primary"
          :disabled="loadingInit"
          @click="handleInitDefault"
        >
          🌸 {{ loadingInit ? '初始化中...' : '一鍵載入慈濟標準幹部架構' }}
        </button>
        <button class="btn btn-primary" @click="openAddRoot">➕ 新增最上層職務/職稱</button>
      </div>
    </div>

    <div class="card">
      <div v-if="posStore.loading && posStore.positions.length === 0" class="text-center p-8 text-muted">
        <div class="text-base font-bold mb-1">載入幹部職稱架構中...</div>
      </div>

      <!-- 空白狀態 -->
      <div v-else-if="posStore.positionTree.length === 0" class="text-center p-8">
        <div class="text-4xl mb-3">🎖️</div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">目前尚未建立任何幹部職稱</h3>
        <p class="text-sm text-muted mb-4">您可以點擊「一鍵載入慈濟標準幹部架構」快速建立標準職務，或點擊右上角手動新增。</p>
        <div class="flex justify-center gap-3">
          <button class="btn btn-primary" :disabled="loadingInit" @click="handleInitDefault">
            🌸 {{ loadingInit ? '載入中...' : '一鍵載入慈濟標準幹部架構' }}
          </button>
          <button class="btn btn-outline-primary" @click="openAddRoot">
            ➕ 手動建立第一個職稱
          </button>
        </div>
      </div>

      <!-- 樹狀架構清單 -->
      <div v-else class="tree-container">
        <ul class="tree-root">
          <li v-for="node in posStore.positionTree" :key="node.id" class="tree-node">
            <div class="node-content root-node">
              <span class="node-title flex items-center gap-2">
                <span class="badge badge-primary font-bold">{{ node.level || '合心' }}</span>
                <span class="font-bold text-gray-900 text-base">{{ node.name }}</span>
              </span>
              <div class="node-actions flex gap-2">
                <button class="btn btn-sm btn-outline-primary" @click="openAddChild(node)">＋新增子職務</button>
                <button class="btn btn-sm btn-outline" @click="openEdit(node)">✏️ 修改</button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(node)">刪除</button>
              </div>
            </div>

            <!-- 第二層 (例如：和氣幹事 或 各項合心職務) -->
            <ul v-if="node.children?.length" class="tree-sub">
              <li v-for="sub in node.children" :key="sub.id" class="tree-node">
                <div class="node-content sub-node">
                  <span class="node-title flex items-center gap-2">
                    <span class="badge badge-info">{{ sub.level || '和氣' }}</span>
                    <span class="text-gray-800 font-medium">{{ sub.name }}</span>
                  </span>
                  <div class="node-actions flex gap-2">
                    <button class="btn btn-sm btn-outline" @click="openAddChild(sub)">＋新增子職務</button>
                    <button class="btn btn-sm btn-outline" @click="openEdit(sub)">✏️ 修改</button>
                    <button class="btn btn-sm btn-danger" @click="handleDelete(sub)">刪除</button>
                  </div>
                </div>

                <!-- 第三層 (例如：細部功能職稱) -->
                <ul v-if="sub.children?.length" class="tree-sub">
                  <li v-for="subsub in sub.children" :key="subsub.id" class="tree-node">
                    <div class="node-content subsub-node">
                      <span class="node-title flex items-center gap-2">
                        <span class="badge badge-gray text-xs">{{ subsub.level || '組員' }}</span>
                        <span class="text-gray-700 text-sm">{{ subsub.name }}</span>
                      </span>
                      <div class="node-actions flex gap-2">
                        <button class="btn btn-sm btn-outline" @click="openEdit(subsub)">✏️ 修改</button>
                        <button class="btn btn-sm btn-danger" @click="handleDelete(subsub)">刪除</button>
                      </div>
                    </div>
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <!-- 職稱 新增 / 編輯 Modal -->
    <div v-if="showModal" class="modal-backdrop" @click="showModal = false">
      <div class="modal-content" style="max-width: 500px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title font-bold text-lg">
            {{ isEditing ? '✏️ 修改幹部職稱' : (posForm.parentId ? `➕ 在「${parentName}」下新增子職務` : '➕ 新增最上層職稱/職務') }}
          </h3>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>

        <form @submit.prevent="handleSave">
          <div class="modal-body p-5 space-y-4">
            <div v-if="posForm.parentId" class="form-group">
              <label class="form-label">上層所屬職稱</label>
              <input :value="parentName" type="text" class="form-input bg-gray-50" disabled />
            </div>

            <div class="form-group">
              <label class="form-label required">職稱名稱</label>
              <input 
                v-model="posForm.name" 
                type="text" 
                class="form-input" 
                placeholder="例如：合心關懷幹事、和氣活動幹事" 
                required 
                autofocus
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label required">職稱層級</label>
                <select v-model="posForm.level" class="form-select" required>
                  <option value="合心">合心</option>
                  <option value="和氣">和氣</option>
                  <option value="互愛">互愛</option>
                  <option value="協力">協力</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">排序權重 (數字小在前)</label>
                <input v-model.number="posForm.sortOrder" type="number" class="form-input" placeholder="0" />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? '儲存中...' : (isEditing ? '儲存修改' : '確認新增') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { usePositionsStore } from '@/stores/positions';
import { useToast } from '@/composables/useToast';

const posStore = usePositionsStore();
const toast = useToast();

const showModal = ref(false);
const isEditing = ref(false);
const saving = ref(false);
const loadingInit = ref(false);
const parentName = ref('');

const posForm = ref({
  id: null,
  name: '',
  level: '合心',
  parentId: null,
  sortOrder: 0
});

function openAddRoot() {
  isEditing.value = false;
  parentName.value = '';
  posForm.value = {
    id: null,
    name: '',
    level: '合心',
    parentId: null,
    sortOrder: (posStore.positions.length + 1) * 2
  };
  showModal.value = true;
}

function openAddChild(parentNode) {
  isEditing.value = false;
  parentName.value = parentNode.name;
  posForm.value = {
    id: null,
    name: '',
    level: parentNode.level === '合心' ? '和氣' : parentNode.level,
    parentId: parentNode.id,
    sortOrder: 0
  };
  showModal.value = true;
}

function openEdit(node) {
  isEditing.value = true;
  parentName.value = '';
  posForm.value = {
    id: node.id,
    name: node.name,
    level: node.level || '合心',
    parentId: node.parentId || null,
    sortOrder: node.sortOrder || 0
  };
  showModal.value = true;
}

async function handleSave() {
  if (!posForm.value.name.trim()) {
    toast.warning('請填寫職稱名稱');
    return;
  }

  saving.value = true;
  try {
    await posStore.savePosition(posForm.value);
    toast.success(isEditing.value ? '職稱更新成功！' : `成功新增「${posForm.value.name}」！`);
    showModal.value = false;
  } catch (err) {
    console.error('儲存職稱錯誤:', err);
    toast.error('儲存失敗：' + (err.message || '權限不足或網路問題'));
  } finally {
    saving.value = false;
  }
}

async function handleDelete(node) {
  if (!confirm(`確定要刪除「${node.name}」嗎？若其底下有子職稱將一併刪除。`)) return;
  try {
    await posStore.deletePosition(node.id);
    toast.success(`職稱「${node.name}」已刪除`);
  } catch (err) {
    console.error('刪除職稱錯誤:', err);
    toast.error('刪除失敗：' + err.message);
  }
}

async function handleInitDefault() {
  if (!confirm('確定要載入慈濟標準幹部架構（合心/和氣各功能組幹事）嗎？')) return;
  loadingInit.value = true;
  try {
    await posStore.initDefaultPositions();
    toast.success('慈濟標準幹部架構已載入成功！');
  } catch (err) {
    console.error('初始化架構錯誤:', err);
    toast.error('載入失敗：' + err.message);
  } finally {
    loadingInit.value = false;
  }
}

onMounted(async () => {
  await posStore.fetchPositions();
});
</script>

<style scoped>
.tree-root, .tree-sub { list-style: none; padding-left: 1.5rem; }
.tree-node { margin: 0.75rem 0; }
.node-content {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200); background: #ffffff;
}
.root-node { background: #f0fdf4; border-color: #86efac; }
.sub-node { background: #f0f9ff; border-color: #bae6fd; }
.subsub-node { background: #fafafa; border-color: #e5e7eb; }

.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 100%; box-shadow: var(--shadow-lg); }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
</style>
