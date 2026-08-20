<template>
  <div class="admin-orgs">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">三層組織架構 (和氣 ➔ 互愛 ➔ 協力)</h1>
      <button class="btn btn-primary" @click="addRootHeqi">➕ 新增和氣單位</button>
    </div>

    <div class="card">
      <div class="tree-container">
        <ul class="tree-root">
          <li v-for="heqi in orgsStore.orgTree" :key="heqi.id" class="tree-node">
            <div class="node-content heqi-node">
              <span class="node-title">🌸 和氣：{{ heqi.name }}</span>
              <div class="node-actions flex gap-2">
                <button class="btn btn-sm btn-outline" @click="addChild(heqi.id, '互愛')">＋新增互愛</button>
                <button class="btn btn-sm btn-danger" @click="handleDelete(heqi.id)">刪除</button>
              </div>
            </div>

            <!-- 互愛層 -->
            <ul v-if="heqi.children?.length" class="tree-sub">
              <li v-for="huhai in heqi.children" :key="huhai.id" class="tree-node">
                <div class="node-content huhai-node">
                  <span class="node-title">🌿 互愛：{{ huhai.name }}</span>
                  <div class="node-actions flex gap-2">
                    <button class="btn btn-sm btn-outline" @click="addChild(huhai.id, '協力')">＋新增協力</button>
                    <button class="btn btn-sm btn-danger" @click="handleDelete(huhai.id)">刪除</button>
                  </div>
                </div>

                <!-- 協力層 -->
                <ul v-if="huhai.children?.length" class="tree-sub">
                  <li v-for="xieli in huhai.children" :key="xieli.id" class="tree-node">
                    <div class="node-content xieli-node">
                      <span class="node-title">🌱 協力：{{ xieli.name }}</span>
                      <div class="node-actions flex gap-2">
                        <button class="btn btn-sm btn-danger" @click="handleDelete(xieli.id)">刪除</button>
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
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';

const orgsStore = useOrgsStore();
const toast = useToast();

async function addRootHeqi() {
  const name = prompt('請輸入新和氣名稱：');
  if (!name) return;
  await orgsStore.saveOrg({ name, level: '和氣', parentId: null });
  toast.success('新增和氣成功！');
}

async function addChild(parentId, level) {
  const name = prompt(`請輸入新 ${level} 名稱：`);
  if (!name) return;
  await orgsStore.saveOrg({ name, parentId, level });
  toast.success('新增組織成功！');
}

async function handleDelete(id) {
  if (!confirm('警告：刪除組織將一併刪除其所屬子組織，確定要執行嗎？')) return;
  await orgsStore.deleteOrg(id);
  toast.success('組織已刪除');
}

onMounted(() => {
  orgsStore.fetchOrgs();
});
</script>

<style scoped>
.tree-root, .tree-sub { list-style: none; padding-left: 1.5rem; }
.tree-node { margin: 0.75rem 0; }
.node-content {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.6rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);
}
.heqi-node { background: var(--primary-50); border-color: var(--primary-300); font-weight: 700; }
.huhai-node { background: var(--secondary-50); border-color: var(--secondary-300); }
.xieli-node { background: #ffffff; }
</style>
