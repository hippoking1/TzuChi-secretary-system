<template>
  <div class="admin-orgs">
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold">三層組織架構 (和氣 ➔ 互愛 ➔ 協力)</h1>
        <p class="text-sm text-muted">自由排定各層組織順序、新增或調整和氣、互愛、協力階層</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button 
          class="btn btn-outline-secondary flex items-center gap-1"
          :disabled="sorting || orgsStore.loading"
          @click="handleAutoSort"
          title="自動將所有階層依名稱數字（一、二、三...）由小到大自動排定標準順序"
        >
          <span>✨ 一鍵依序號自動排序</span>
        </button>
        <button class="btn btn-primary flex items-center gap-1" @click="addRootHeqi">
          <span>➕ 新增和氣單位</span>
        </button>
      </div>
    </div>

    <div class="card p-4">
      <div v-if="orgsStore.orgTree.length === 0" class="text-center text-muted p-8">
        目前尚無組織架構資料，請點擊右上角「➕ 新增和氣單位」開始建立。
      </div>

      <div v-else class="tree-container">
        <ul class="tree-root">
          <li v-for="(heqi, hIdx) in orgsStore.orgTree" :key="heqi.id" class="tree-node">
            <!-- 和氣層 -->
            <div class="node-content heqi-node">
              <div class="flex items-center gap-2">
                <span class="node-title">🌸 和氣：{{ heqi.name }}</span>
                <span class="badge badge-primary text-[11px]">第 {{ hIdx + 1 }} 順位</span>
              </div>
              <div class="node-actions flex gap-1.5 items-center">
                <button 
                  class="btn btn-xs btn-outline-secondary" 
                  :disabled="hIdx === 0" 
                  @click="handleMove(heqi.id, 'up')" 
                  title="上移此和氣"
                >
                  ⬆️
                </button>
                <button 
                  class="btn btn-xs btn-outline-secondary" 
                  :disabled="hIdx === orgsStore.orgTree.length - 1" 
                  @click="handleMove(heqi.id, 'down')" 
                  title="下移此和氣"
                >
                  ⬇️
                </button>
                <button class="btn btn-xs btn-outline-primary" @click="handleRename(heqi)">✏️ 命名</button>
                <button class="btn btn-xs btn-outline" @click="addChild(heqi.id, '互愛')">＋新增互愛</button>
                <button class="btn btn-xs btn-danger" @click="handleDelete(heqi)">刪除</button>
              </div>
            </div>

            <!-- 互愛層 -->
            <ul v-if="heqi.children?.length" class="tree-sub">
              <li v-for="(huhai, huIdx) in heqi.children" :key="huhai.id" class="tree-node">
                <div class="node-content huhai-node">
                  <div class="flex items-center gap-2">
                    <span class="node-title">🌿 互愛：{{ huhai.name }}</span>
                    <span class="badge badge-info text-[11px]">第 {{ huIdx + 1 }} 順位</span>
                  </div>
                  <div class="node-actions flex gap-1.5 items-center">
                    <button 
                      class="btn btn-xs btn-outline-secondary" 
                      :disabled="huIdx === 0" 
                      @click="handleMove(huhai.id, 'up')" 
                      title="上移此互愛"
                    >
                      ⬆️
                    </button>
                    <button 
                      class="btn btn-xs btn-outline-secondary" 
                      :disabled="huIdx === heqi.children.length - 1" 
                      @click="handleMove(huhai.id, 'down')" 
                      title="下移此互愛"
                    >
                      ⬇️
                    </button>
                    <button class="btn btn-xs btn-outline-primary" @click="handleRename(huhai)">✏️ 命名</button>
                    <button class="btn btn-xs btn-outline" @click="addChild(huhai.id, '協力')">＋新增協力</button>
                    <button class="btn btn-xs btn-danger" @click="handleDelete(huhai)">刪除</button>
                  </div>
                </div>

                <!-- 協力層 -->
                <ul v-if="huhai.children?.length" class="tree-sub">
                  <li v-for="(xieli, xIdx) in huhai.children" :key="xieli.id" class="tree-node">
                    <div class="node-content xieli-node">
                      <div class="flex items-center gap-2">
                        <span class="node-title">🌱 協力：{{ xieli.name }}</span>
                        <span class="badge badge-gray text-[11px]">第 {{ xIdx + 1 }} 順位</span>
                      </div>
                      <div class="node-actions flex gap-1.5 items-center">
                        <button 
                          class="btn btn-xs btn-outline-secondary" 
                          :disabled="xIdx === 0" 
                          @click="handleMove(xieli.id, 'up')" 
                          title="上移此協力"
                        >
                          ⬆️
                        </button>
                        <button 
                          class="btn btn-xs btn-outline-secondary" 
                          :disabled="xIdx === huhai.children.length - 1" 
                          @click="handleMove(xieli.id, 'down')" 
                          title="下移此協力"
                        >
                          ⬇️
                        </button>
                        <button class="btn btn-xs btn-outline-primary" @click="handleRename(xieli)">✏️ 命名</button>
                        <button class="btn btn-xs btn-danger" @click="handleDelete(xieli)">刪除</button>
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
import { ref, onMounted } from 'vue';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';

const orgsStore = useOrgsStore();
const toast = useToast();
const sorting = ref(false);

async function addRootHeqi() {
  const name = prompt('請輸入新和氣名稱（例如：和氣三）：');
  if (!name || !name.trim()) return;
  await orgsStore.saveOrg({ name: name.trim(), level: '和氣', parentId: null });
  toast.success(`新增和氣「${name.trim()}」成功！`);
}

async function addChild(parentId, level) {
  const placeholder = level === '互愛' ? '互愛一' : '協力一';
  const name = prompt(`請輸入新 ${level} 名稱（例如：${placeholder}）：`);
  if (!name || !name.trim()) return;
  await orgsStore.saveOrg({ name: name.trim(), parentId, level });
  toast.success(`新增 ${level}「${name.trim()}」成功！`);
}

async function handleRename(org) {
  const newName = prompt(`請輸入「${org.name}」的新名稱：`, org.name);
  if (!newName || !newName.trim() || newName.trim() === org.name) return;
  await orgsStore.saveOrg({ id: org.id, name: newName.trim(), parentId: org.parentId || null, level: org.level });
  toast.success(`已將組織重新命名為「${newName.trim()}」！`);
}

async function handleMove(id, direction) {
  try {
    await orgsStore.moveOrg(id, direction);
  } catch (err) {
    toast.error('移動順序失敗：' + err.message);
  }
}

async function handleAutoSort() {
  if (!confirm('確定要將所有和氣、互愛、協力依照名稱序號（一、二、三...）自動排定標準順序嗎？')) return;
  sorting.value = true;
  try {
    await orgsStore.autoSortAllOrgs();
    toast.success('✨ 已成功將所有組織階層依序號標準排序！');
  } catch (err) {
    toast.error('自動排序失敗：' + err.message);
  } finally {
    sorting.value = false;
  }
}

async function handleDelete(org) {
  const orgName = org.name || '此組織';
  if (!confirm(`警告：刪除組織「${orgName}」將一併刪除其底下所有子組織，確定要執行嗎？`)) return;
  try {
    await orgsStore.deleteOrg(org.id);
    toast.success(`組織「${orgName}」已刪除`);
  } catch (err) {
    toast.error('刪除失敗：' + err.message);
  }
}

onMounted(() => {
  orgsStore.fetchOrgs();
});
</script>

<style scoped>
.tree-root, .tree-sub { list-style: none; padding-left: 1.5rem; }
.tree-node { margin: 0.6rem 0; }
.node-content {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.55rem 0.9rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);
  transition: all 0.15s ease-in-out;
}
.node-content:hover { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
.heqi-node { background: var(--primary-50); border-color: var(--primary-300); font-weight: 700; }
.huhai-node { background: var(--secondary-50); border-color: var(--secondary-300); }
.xieli-node { background: #ffffff; border-color: var(--gray-300); }

.btn-xs {
  padding: 0.2rem 0.45rem;
  font-size: 0.75rem;
  line-height: 1;
}
</style>
