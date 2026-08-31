<template>
  <div class="admin-members">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">志工名冊維護</h1>
        <p class="text-sm text-muted">維護志工名冊基本資料、組織歸屬與指派兼任之幹部職稱</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline-primary" @click="showImportModal = true">📥 批次匯入名冊</button>
        <button class="btn btn-primary" @click="openCreate">➕ 新增志工</button>
      </div>
    </div>

    <!-- 搜尋與篩選列 (4 欄式) -->
    <div class="card mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <input v-model="search" type="text" class="form-input" placeholder="🔍 搜尋志工姓名、電話、職務..." @input="handleSearch" />
      <select v-model="orgFilter" class="form-select" @change="handleSearch">
        <option value="">🏛️ 全部組織架構 (不限)</option>
        <option v-for="org in flattenedOrgs" :key="org.id" :value="org.id">
          {{ org.indentText }}{{ org.name }} ({{ org.level }})
        </option>
      </select>
      <select v-model="genderFilter" class="form-select" @change="handleSearch">
        <option value="">全部眾別 (男眾 / 女眾)</option>
        <option value="男">男眾 (師兄)</option>
        <option value="女">女眾 (師姊)</option>
      </select>
      <select v-model="positionFilter" class="form-select" @change="handleSearch">
        <option value="">全部幹部職稱 / 職務 (不限)</option>
        <option v-for="p in posStore.allPositionNames" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <div class="card table-responsive">
      <div class="flex items-center justify-between p-3 border-b border-gray-100 flex-wrap gap-2 text-xs text-muted">
        <div>
          <span>共 <strong>{{ sortedMembers.length }}</strong> 位志工</span>
          <span v-if="orgFilter" class="ml-2 badge badge-info">已篩選組織</span>
        </div>
        <div class="flex items-center gap-2">
          <span>排序方式：</span>
          <button 
            class="btn btn-xs" 
            :class="sortMode === 'org' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="sortMode = 'org'"
          >
            🏛️ 依組織 (和氣/互愛/協力)
          </button>
          <button 
            class="btn btn-xs" 
            :class="sortMode === 'name' ? 'btn-primary' : 'btn-outline-secondary'"
            @click="sortMode = 'name'"
          >
            🔤 依姓名筆劃
          </button>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th class="cursor-pointer hover:text-primary select-none" @click="sortMode = 'name'" title="點擊依姓名排序">
              姓名 <span v-if="sortMode === 'name'">▼</span>
            </th>
            <th>幹部職稱 / 職務</th>
            <th>眾別</th>
            <th>電話</th>
            <th>委員/慈誠編號</th>
            <th class="cursor-pointer hover:text-primary select-none" @click="sortMode = 'org'" title="點擊依組織階層排序">
              所屬組織 (和氣 / 互愛 / 協力) <span v-if="sortMode === 'org'">▼</span>
            </th>
            <th>法號</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="sortedMembers.length === 0">
            <td colspan="8" class="text-center text-muted p-4">查無符合條件的志工資料</td>
          </tr>
          <tr v-for="m in sortedMembers" :key="m.id">
            <td class="font-bold text-gray-900">{{ m.name }}</td>
            <td>
              <div v-if="(m.cadreRoles && m.cadreRoles.length) || (m.positions && m.positions.length)" class="flex flex-wrap gap-1">
                <span 
                  v-for="role in (m.cadreRoles || m.positions)" 
                  :key="role" 
                  class="badge text-xs"
                  :class="role.includes('合心') ? 'badge-primary' : (role.includes('和氣') ? 'badge-info' : 'badge-gray')"
                >
                  {{ role }}
                </span>
              </div>
              <span v-else class="text-xs text-muted">無</span>
            </td>
            <td>
              <span class="badge" :class="m.gender === '男' ? 'badge-primary' : 'badge-secondary'">
                {{ m.gender || '女' }}
              </span>
            </td>
            <td>{{ m.phone || '-' }}</td>
            <td>{{ m.volunteerCode || '-' }}</td>
            <td>
              <span v-if="orgsStore.getOrgPath(m.orgId)" class="font-medium text-gray-700">
                {{ orgsStore.getOrgPath(m.orgId) }}
              </span>
              <span v-else class="text-muted">-</span>
            </td>
            <td>{{ m.dharmaName || '-' }}</td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-outline-primary" @click="openEdit(m)">✏️ 編輯/指派職務</button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(m)">刪除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 志工資料 新增 / 編輯 Modal (含幹部職稱兼任指派) -->
    <div v-if="showMemberModal" class="modal-backdrop" @click="showMemberModal = false">
      <div class="modal-content" style="max-width: 650px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title font-bold text-lg">
            {{ isEditing ? '✏️ 編輯志工資料與職稱' : '➕ 新增志工' }}
          </h3>
          <button class="modal-close" @click="showMemberModal = false">×</button>
        </div>
        
        <form @submit.prevent="handleSaveMember">
          <div class="modal-body p-5 space-y-4" style="max-height: 72vh; overflow-y: auto;">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label required">志工姓名</label>
                <input v-model="memberForm.name" type="text" class="form-input" placeholder="請輸入姓名" required />
              </div>
              <div class="form-group">
                <label class="form-label required">性別 / 眾別</label>
                <select v-model="memberForm.gender" class="form-select" required>
                  <option value="女">女眾 (師姊)</option>
                  <option value="男">男眾 (師兄)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label">聯絡電話 (手機或家用電話)</label>
                <input v-model="memberForm.phone" type="tel" class="form-input" placeholder="例如：0912345678 或 03-9123456" />
              </div>
              <div class="form-group">
                <label class="form-label">法號</label>
                <input v-model="memberForm.dharmaName" type="text" class="form-input" placeholder="例如：慈明、誠正" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">委員 / 慈誠編號</label>
              <input v-model="memberForm.volunteerCode" type="text" class="form-input" placeholder="請輸入編號" />
            </div>

            <div class="form-group">
              <label class="form-label">所屬組織架構 (和氣 / 互愛 / 協力)</label>
              <OrgCascader v-model="memberForm.orgId" />
            </div>

            <!-- 擔任幹部職稱 / 職務 (可多選兼任) -->
            <div class="form-group">
              <div class="flex items-center justify-between mb-2">
                <label class="form-label font-bold text-gray-800 m-0">
                  🎖️ 擔任幹部職稱 / 職務 (可多選兼任)
                </label>
                <span class="text-xs text-primary font-bold">
                  已選取 {{ (memberForm.cadreRoles || []).length }} 個職務
                </span>
              </div>
              
              <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-64 overflow-y-auto space-y-3">
                <div v-for="root in posStore.positionTree" :key="root.id" class="border-b border-gray-200 pb-3 last:border-b-0 space-y-2">
                  <div class="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <span class="badge badge-primary text-[10px]">{{ root.level || '合心' }}</span>
                    <span>📌 {{ root.name }} 系列架構：</span>
                  </div>
                  
                  <!-- 第一層職稱 -->
                  <div class="flex flex-wrap gap-2 pl-2">
                    <label 
                      class="position-pill" 
                      :class="{ active: isRoleSelected(root.name) }"
                      @click.prevent="toggleRole(root.name)"
                    >
                      <span v-if="isRoleSelected(root.name)">✓</span>
                      <span>{{ root.name }}</span>
                    </label>
                  </div>

                  <!-- 第二層職稱 (例如：各功能組幹事、和氣組長/隊長) -->
                  <div v-if="root.children?.length" class="pl-3 border-l-2 border-primary-200 space-y-2 mt-1">
                    <div v-for="sub in root.children" :key="sub.id" class="space-y-1.5">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="badge badge-info text-[10px]">{{ sub.level || '和氣' }}</span>
                        <label 
                          class="position-pill" 
                          :class="{ active: isRoleSelected(sub.name) }"
                          @click.prevent="toggleRole(sub.name)"
                        >
                          <span v-if="isRoleSelected(sub.name)">✓</span>
                          <span>{{ sub.name }}</span>
                        </label>
                      </div>

                      <!-- 第三層職稱 (例如：互愛一組長、互愛二組長、互愛隊長等) -->
                      <div v-if="sub.children?.length" class="flex flex-wrap gap-2 pl-4 py-1.5 bg-white/70 rounded border border-gray-100">
                        <template v-for="subsub in sub.children" :key="subsub.id">
                          <label 
                            class="position-pill" 
                            :class="{ active: isRoleSelected(subsub.name) }"
                            @click.prevent="toggleRole(subsub.name)"
                          >
                            <span v-if="isRoleSelected(subsub.name)">✓</span>
                            <span class="text-xs text-secondary-700 font-medium">[{{ subsub.level || '互愛' }}]</span>
                            <span>{{ subsub.name }}</span>
                          </label>

                          <!-- 第四層職稱 (例如：協力) -->
                          <div v-if="subsub.children?.length" class="w-full flex flex-wrap gap-2 pl-4 pt-1">
                            <label 
                              v-for="sub4 in subsub.children" 
                              :key="sub4.id" 
                              class="position-pill"
                              :class="{ active: isRoleSelected(sub4.name) }"
                              @click.prevent="toggleRole(sub4.name)"
                            >
                              <span v-if="isRoleSelected(sub4.name)">✓</span>
                              <span class="text-xs text-gray-500 font-medium">[{{ sub4.level || '協力' }}]</span>
                              <span>{{ sub4.name }}</span>
                            </label>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p class="text-xs text-muted mt-1">點擊上方職稱標籤即可自由勾選或取消，一人可同時兼任多個幹部職務。</p>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="showMemberModal = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? '儲存中...' : (isEditing ? '確認儲存變更' : '確認新增志工') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 批次匯入 Modal (含即時預覽表格) -->
    <div v-if="showImportModal" class="modal-backdrop" @click="showImportModal = false">
      <div class="modal-content" style="max-width: 800px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">批次匯入志工名單 (Excel / CSV 複製貼上)</h3>
          <button class="modal-close" @click="showImportModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-muted mb-2">請從 Excel 複製表格內容並直接貼上於下方文字框（格式：姓名, 性別, 電話, 委員編號, 法號）：</p>
          <textarea v-model="rawImportText" class="form-textarea" placeholder="王大明, 男, 0912345678, 12345, 慈明" style="min-height: 120px;" @input="parseImportText"></textarea>

          <div v-if="parsedRows.length > 0" class="mt-4">
            <h4 class="font-bold text-sm mb-2">解析預覽 (共 {{ parsedRows.length }} 筆)：</h4>
            <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
              <table class="table">
                <thead>
                  <tr><th>姓名</th><th>性別</th><th>電話</th><th>編號</th><th>法號</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(p, idx) in parsedRows" :key="idx">
                    <td>{{ p.name }}</td><td>{{ p.gender }}</td><td>{{ p.phone }}</td><td>{{ p.volunteerCode }}</td><td>{{ p.dharmaName }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showImportModal = false">取消</button>
          <button class="btn btn-primary" :disabled="parsedRows.length === 0 || importing" @click="submitBatchImport">
            {{ importing ? '匯入中...' : '確認批次匯入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { usePositionsStore } from '@/stores/positions';
import OrgCascader from '@/components/ui/OrgCascader.vue';
import { useToast } from '@/composables/useToast';

const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const posStore = usePositionsStore();
const toast = useToast();

const search = ref('');
const orgFilter = ref('');
const genderFilter = ref('');
const positionFilter = ref('');
const sortMode = ref('org'); // 'org': 依和氣/互愛/協力, 'name': 依姓名
const showImportModal = ref(false);
const rawImportText = ref('');
const parsedRows = ref([]);
const importing = ref(false);
const saving = ref(false);

const showMemberModal = ref(false);
const isEditing = ref(false);
const memberForm = ref({
  id: null,
  name: '',
  gender: '女',
  phone: '',
  volunteerCode: '',
  dharmaName: '',
  orgId: '',
  cadreRoles: []
});

/**
 * 展平組織樹，提供下拉選單使用（含層級階梯縮排）
 */
const flattenedOrgs = computed(() => {
  const result = [];
  function traverse(nodes, depth = 0) {
    (nodes || []).forEach(node => {
      const indent = '　'.repeat(depth) + (depth > 0 ? '└ ' : '');
      result.push({
        id: node.id,
        name: node.name,
        level: node.level || '組織',
        indentText: indent
      });
      if (node.children && node.children.length > 0) {
        traverse(node.children, depth + 1);
      }
    });
  }
  traverse(orgsStore.orgTree);
  return result;
});

/**
 * 依照組織階層 (和氣/互愛/協力) 或姓名進行智慧排序
 */
const sortedMembers = computed(() => {
  const list = [...membersStore.members];

  if (sortMode.value === 'org') {
    list.sort((a, b) => {
      const pathA = orgsStore.getOrgPath(a.orgId);
      const pathB = orgsStore.getOrgPath(b.orgId);

      // 有組織的排在前面，無組織排在後面
      if (!pathA && pathB) return 1;
      if (pathA && !pathB) return -1;
      if (!pathA && !pathB) return (a.name || '').localeCompare(b.name || '', 'zh-Hant');

      const orgCompare = pathA.localeCompare(pathB, 'zh-Hant', { numeric: true });
      if (orgCompare !== 0) return orgCompare;

      // 組織相同時，依姓名排序
      return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
    });
  } else if (sortMode.value === 'name') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
  }

  return list;
});

function isRoleSelected(roleName) {
  return (memberForm.value.cadreRoles || []).includes(roleName);
}

function toggleRole(roleName) {
  if (!memberForm.value.cadreRoles) memberForm.value.cadreRoles = [];
  const idx = memberForm.value.cadreRoles.indexOf(roleName);
  if (idx > -1) {
    memberForm.value.cadreRoles.splice(idx, 1);
  } else {
    memberForm.value.cadreRoles.push(roleName);
  }
}

async function handleSearch() {
  let orgIds = [];
  if (orgFilter.value) {
    orgIds = orgsStore.getDescendantOrgIds(orgFilter.value);
  }

  await membersStore.fetchMembers({ 
    search: search.value, 
    gender: genderFilter.value,
    position: positionFilter.value,
    orgIds: orgIds.length > 0 ? orgIds : undefined
  });
}

function parseImportText() {
  const lines = rawImportText.value.split(/\r?\n/).filter(l => l.trim().length > 0);
  parsedRows.value = lines.map(line => {
    const parts = line.split(/[,	]+/).map(p => p.trim());
    return {
      name: parts[0] || '',
      gender: parts[1] || '女',
      phone: parts[2] || '',
      volunteerCode: parts[3] || '',
      dharmaName: parts[4] || '',
      cadreRoles: []
    };
  });
}

async function submitBatchImport() {
  importing.value = true;
  try {
    await membersStore.batchImportMembers(parsedRows.value);
    toast.success(`成功匯入 ${parsedRows.value.length} 筆志工資料！`);
    showImportModal.value = false;
    rawImportText.value = '';
    parsedRows.value = [];
    await handleSearch();
  } catch (err) {
    toast.error('匯入失敗：' + err.message);
  } finally {
    importing.value = false;
  }
}

async function openCreate() {
  await posStore.fetchPositions();
  isEditing.value = false;
  memberForm.value = {
    id: null,
    name: '',
    gender: '女',
    phone: '',
    volunteerCode: '',
    dharmaName: '',
    orgId: orgFilter.value || '',
    cadreRoles: []
  };
  showMemberModal.value = true;
}

async function openEdit(m) {
  await posStore.fetchPositions();
  isEditing.value = true;
  memberForm.value = {
    id: m.id,
    name: m.name || '',
    gender: m.gender || '女',
    phone: m.phone || '',
    volunteerCode: m.volunteerCode || '',
    dharmaName: m.dharmaName || '',
    orgId: m.orgId || '',
    cadreRoles: [...(m.cadreRoles || m.positions || [])]
  };
  showMemberModal.value = true;
}

async function handleSaveMember() {
  saving.value = true;
  try {
    await membersStore.saveMember(memberForm.value);
    toast.success(isEditing.value ? '志工資料與職稱更新成功！' : '志工新增成功！');
    showMemberModal.value = false;
    await handleSearch();
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}

async function handleDelete(m) {
  const memberName = m.name || '此志工';
  if (!confirm(`確定要刪除志工「${memberName}」的資料嗎？刪除後無法復原。`)) return;
  
  try {
    await membersStore.deleteMember(m.id);
    toast.success(`已成功刪除志工「${memberName}」`);
    await handleSearch();
  } catch (err) {
    console.error('Delete member error:', err);
    toast.error('刪除失敗：' + (err.message || '請確認權限'));
  }
}

onMounted(async () => {
  await Promise.all([
    orgsStore.fetchOrgs(),
    posStore.fetchPositions(),
    membersStore.fetchMembers()
  ]);
  // 檢測並自動同步活動報名時填寫的最新志工電話
  const updatedCount = await membersStore.syncPhonesFromRegistrations();
  if (updatedCount > 0) {
    await membersStore.fetchMembers();
    toast.info(`已自動為 ${updatedCount} 位志工同步活動報名時填寫的最新電話！`);
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 100%; box-shadow: var(--shadow-lg); }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.5rem; }
.modal-footer { padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }

.position-pill {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.35rem 0.75rem; border-radius: 9999px;
  background: #ffffff; border: 1px solid var(--gray-300);
  font-size: 0.75rem; color: var(--gray-700); cursor: pointer;
  transition: all 0.15s ease-in-out; user-select: none;
}
.position-pill:hover {
  border-color: var(--primary-400); background: #f0fdf4;
}
.position-pill.active {
  background: var(--primary-600); border-color: var(--primary-600); color: #ffffff; font-weight: 600;
}
</style>

