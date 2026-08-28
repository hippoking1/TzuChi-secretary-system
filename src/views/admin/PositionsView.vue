<template>
  <div class="admin-positions">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">幹部職稱架構管理</h1>
        <p class="text-sm text-muted">管理組織內各幹部階層職務（合心幹事 ➔ 和氣幹事 ➔ 各功能幹事），可自由彈性增減</p>
      </div>
      <button class="btn btn-primary" @click="addRootPosition">➕ 新增最上層職務/職稱</button>
    </div>

    <div class="card">
      <div v-if="posStore.loading && posStore.positions.length === 0" class="text-center p-6 text-muted">
        載入幹部職稱架構中...
      </div>
      <div v-else class="tree-container">
        <ul class="tree-root">
          <li v-for="node in posStore.positionTree" :key="node.id" class="tree-node">
            <div class="node-content root-node">
              <span class="node-title flex items-center gap-2">
                <span class="badge badge-primary font-bold">{{ node.level || '合心' }}</span>
                <span class="font-bold text-gray-900 text-base">{{ node.name }}</span>
              </span>
              <div class="node-actions flex gap-2">
                <button class="btn btn-sm btn-outline-primary" @click="addChild(node.id, node.name, '和氣')">＋新增子職務</button>
                <button class="btn btn-sm btn-outline" @click="editPosition(node)">✏️ 修改名稱</button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(node.id, node.name)">刪除</button>
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
                    <button class="btn btn-sm btn-outline" @click="addChild(sub.id, sub.name, '組隊')">＋新增子職務</button>
                    <button class="btn btn-sm btn-outline" @click="editPosition(sub)">✏️ 修改</button>
                    <button class="btn btn-sm btn-danger" @click="handleDelete(sub.id, sub.name)">刪除</button>
                  </div>
                </div>

                <!-- 第三層 (例如：和氣功能組細部職稱) -->
                <ul v-if="sub.children?.length" class="tree-sub">
                  <li v-for="subsub in sub.children" :key="subsub.id" class="tree-node">
                    <div class="node-content subsub-node">
                      <span class="node-title flex items-center gap-2">
                        <span class="badge badge-gray text-xs">{{ subsub.level || '組員' }}</span>
                        <span class="text-gray-700 text-sm">{{ subsub.name }}</span>
                      </span>
                      <div class="node-actions flex gap-2">
                        <button class="btn btn-sm btn-outline" @click="editPosition(subsub)">✏️ 修改</button>
                        <button class="btn btn-sm btn-danger" @click="handleDelete(subsub.id, subsub.name)">刪除</button>
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
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { usePositionsStore } from '@/stores/positions';
import { useToast } from '@/composables/useToast';

const posStore = usePositionsStore();
const toast = useToast();

async function addRootPosition() {
  const name = prompt('請輸入最上層幹部職稱名稱（例如：合心幹事、和氣幹事）：');
  if (!name || !name.trim()) return;
  const level = prompt('請輸入職稱層級（如：合心、和氣）：', '合心') || '合心';
  await posStore.savePosition({ name: name.trim(), level: level.trim(), parentId: null });
  toast.success(`成功新增職稱「${name}」！`);
}

async function addChild(parentId, parentName, defaultLevel = '和氣') {
  const name = prompt(`請輸入在「${parentName}」下新增的幹部職稱名稱：`);
  if (!name || !name.trim()) return;
  const level = prompt('請輸入職稱層級（如：合心、和氣、互愛、協力）：', defaultLevel) || defaultLevel;
  await posStore.savePosition({ name: name.trim(), level: level.trim(), parentId });
  toast.success(`成功在 ${parentName} 下新增「${name}」！`);
}

async function editPosition(pos) {
  const name = prompt('修改幹部職稱名稱：', pos.name);
  if (!name || !name.trim()) return;
  await posStore.savePosition({ ...pos, name: name.trim() });
  toast.success('職稱名稱更新成功！');
}

async function handleDelete(id, name) {
  if (!confirm(`確定要刪除「${name}」嗎？若其底下有子職稱將一併刪除。`)) return;
  await posStore.deletePosition(id);
  toast.success('職稱已刪除');
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
</style>
