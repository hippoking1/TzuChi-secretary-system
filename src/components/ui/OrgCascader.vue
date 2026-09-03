<template>
  <div class="org-cascader grid grid-cols-3 gap-2">
    <div>
      <select v-model="selectedHeqi" class="form-select" @change="onHeqiChange">
        <option value="">-- 選擇和氣 --</option>
        <option v-for="h in heqiList" :key="h.id" :value="h.id">{{ h.name }}</option>
      </select>
    </div>
    <div>
      <select v-model="selectedHuhai" class="form-select" :disabled="!selectedHeqi" @change="onHuhaiChange">
        <option value="">-- 選擇互愛 --</option>
        <option v-for="hu in huhaiList" :key="hu.id" :value="hu.id">{{ hu.name }}</option>
      </select>
    </div>
    <div>
      <select v-model="selectedXieli" class="form-select" :disabled="!selectedHuhai" @change="onXieliChange">
        <option value="">-- 選擇協力 --</option>
        <option v-for="x in xieliList" :key="x.id" :value="x.id">{{ x.name }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useOrgsStore } from '@/stores/orgs';

const props = defineProps({
  modelValue: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue', 'change']);

const orgsStore = useOrgsStore();

const selectedHeqi = ref('');
const selectedHuhai = ref('');
const selectedXieli = ref('');

const heqiList = computed(() => orgsStore.orgTree);

const huhaiList = computed(() => {
  if (!selectedHeqi.value) return [];
  const found = orgsStore.orgTree.find(h => h.id === selectedHeqi.value);
  return found?.children || [];
});

const xieliList = computed(() => {
  if (!selectedHuhai.value) return [];
  const found = huhaiList.value.find(hu => hu.id === selectedHuhai.value);
  return found?.children || [];
});

function onHeqiChange() {
  selectedHuhai.value = '';
  selectedXieli.value = '';
  emit('update:modelValue', selectedHeqi.value);
  emit('change', selectedHeqi.value);
}

function onHuhaiChange() {
  selectedXieli.value = '';
  const current = selectedHuhai.value || selectedHeqi.value;
  emit('update:modelValue', current);
  emit('change', current);
}

function onXieliChange() {
  const current = selectedXieli.value || selectedHuhai.value || selectedHeqi.value;
  emit('update:modelValue', current);
  emit('change', current);
}

function syncFromModelValue(val) {
  if (!val) {
    selectedHeqi.value = '';
    selectedHuhai.value = '';
    selectedXieli.value = '';
    return;
  }
  const orgMap = {};
  orgsStore.orgs.forEach(o => { orgMap[o.id] = o; });

  const chain = [];
  let curr = orgMap[val];
  let depth = 0;
  while (curr && depth < 10) {
    chain.unshift(curr);
    curr = curr.parentId ? orgMap[curr.parentId] : null;
    depth++;
  }

  if (chain.length === 1) {
    selectedHeqi.value = chain[0].id;
    selectedHuhai.value = '';
    selectedXieli.value = '';
  } else if (chain.length === 2) {
    selectedHeqi.value = chain[0].id;
    selectedHuhai.value = chain[1].id;
    selectedXieli.value = '';
  } else if (chain.length >= 3) {
    selectedHeqi.value = chain[0].id;
    selectedHuhai.value = chain[1].id;
    selectedXieli.value = chain[2].id;
  }
}

watch(() => props.modelValue, (newVal) => {
  syncFromModelValue(newVal);
});

watch(() => orgsStore.orgs, () => {
  if (props.modelValue) {
    syncFromModelValue(props.modelValue);
  }
});

onMounted(async () => {
  if (orgsStore.orgs.length === 0) {
    await orgsStore.fetchOrgs();
  }
  syncFromModelValue(props.modelValue);
});
</script>
