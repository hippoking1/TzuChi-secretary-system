<template>
  <div class="admin-duty-rules">
    <!-- 頂部標題與快捷導覽列 -->
    <div class="flex items-center justify-between mb-5 flex-wrap gap-4">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          ⚙️ 道場值班排班規則管理
        </h1>
        <p class="text-sm text-muted">
          管理宜蘭園區與東港聯絡處之各和氣、男女眾值班組別名冊，排班時可一鍵套用規則自動指派
        </p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <button class="btn btn-primary" @click="openCreateRuleModal">
          ➕ 新增排班規則
        </button>
        <router-link to="/admin/duty-form" class="btn btn-outline">
          ✏️ 前往排班表
        </router-link>
        <router-link to="/admin/duty-schedule" class="btn btn-outline">
          🗓️ 查看值班月曆
        </router-link>
      </div>
    </div>

    <!-- 1. 和氣週輪值設定卡片 (宜蘭園區專屬，支援收合/展開) -->
    <div class="card mb-6">
      <div 
        class="card-header flex items-center justify-between cursor-pointer select-none"
        @click="showRotationCard = !showRotationCard"
      >
        <div class="flex items-center gap-2">
          <span class="text-xl">🔄</span>
          <div>
            <h2 class="text-base font-bold m-0">1. 和氣週輪值設定（宜蘭園區值班輪流負責）</h2>
            <span class="text-xs text-muted">四個和氣每週依序輪值園區勤務，點擊可{{ showRotationCard ? '收折' : '展開' }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button 
            v-if="showRotationCard" 
            class="btn btn-primary btn-sm" 
            :disabled="savingRotation" 
            @click.stop="handleSaveWeekRotation"
          >
            {{ savingRotation ? '儲存中...' : '💾 儲存週輪值設定' }}
          </button>
          <span class="text-gray-400 font-bold">{{ showRotationCard ? '▲' : '▼' }}</span>
        </div>
      </div>

      <div v-show="showRotationCard" class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">基準週起始日期（週一）：</label>
            <input v-model="rotationForm.baseStartDate" type="date" class="form-input form-input-sm" />
            <span class="text-xs text-muted">例：2027-01-04 (當週為和氣一值週起點)</span>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">基準週起始和氣：</label>
            <select v-model="rotationForm.baseStartHeqi" class="form-select form-select-sm">
              <option v-for="h in rotationForm.rotationOrder" :key="h" :value="h">
                {{ h }}
              </option>
            </select>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">輪值次序循環：</label>
            <div class="flex items-center gap-1 flex-wrap mt-1">
              <span 
                v-for="(h, idx) in rotationForm.rotationOrder" 
                :key="h" 
                class="badge badge-info flex items-center gap-1 text-xs py-1 px-2"
              >
                {{ idx + 1 }}. {{ h }}
                <span v-if="idx < rotationForm.rotationOrder.length - 1">→</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 未來數週和氣輪值預覽表格 -->
        <div class="mt-3 pt-3 border-t">
          <h4 class="text-xs font-bold text-gray-700 mb-2">🗓️ 近期週次負責和氣即時預覽：</h4>
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div 
              v-for="w in upcomingWeeksPreview" 
              :key="w.startDate" 
              class="preview-week-box"
              :class="{ 'box-highlight': w.heqi === '和氣二' }"
            >
              <div class="font-bold text-xs">{{ w.dateRange }}</div>
              <div class="heqi-tag" :class="w.heqi === '和氣二' ? 'text-primary font-bold' : 'text-gray-700'">
                {{ w.heqi }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 道場排班規則主面板 (多道場 / 多和氣 / 多眾別導覽與編輯) -->
    <div class="card mb-6">
      <!-- 規則篩選與選擇導航條 -->
      <div class="card-header bg-gray-50 border-b">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">📋</span>
            <h2 class="text-base font-bold m-0">2. 排班規則清單與名冊維護</h2>
          </div>

          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="font-bold text-gray-600">快速篩選：</span>
            <!-- 道場過濾 -->
            <select v-model="filterLocation" class="form-select form-select-sm" style="width: 130px;">
              <option value="">全部道場</option>
              <option value="宜蘭園區">宜蘭園區</option>
              <option value="東港聯絡處">東港聯絡處</option>
            </select>

            <!-- 眾別過濾 -->
            <select v-model="filterGender" class="form-select form-select-sm" style="width: 110px;">
              <option value="">全部眾別</option>
              <option value="女">女眾班</option>
              <option value="男">男眾班</option>
            </select>

            <!-- 和氣過濾 -->
            <select v-model="filterHeqi" class="form-select form-select-sm" style="width: 120px;">
              <option value="">全部和氣</option>
              <option value="和氣一">和氣一</option>
              <option value="和氣二">和氣二</option>
              <option value="和氣三">和氣三</option>
              <option value="和氣四">和氣四</option>
              <option value="全區通用">全區通用</option>
            </select>
          </div>
        </div>

        <!-- 規則分頁標籤按鈕列 (Rule Tabs) -->
        <div class="rule-tabs-row flex items-center gap-2 overflow-x-auto pb-1">
          <button 
            v-for="r in filteredRules" 
            :key="r.id"
            type="button"
            class="rule-tab-btn"
            :class="{ 'rule-tab-btn-active': activeRuleId === r.id }"
            @click="selectRule(r.id)"
          >
            <span class="mr-1">
              {{ r.location === '宜蘭園區' ? '🌸' : '⚓' }}
            </span>
            <span class="font-bold">
              {{ r.ruleName || `${r.location} - ${r.heqiGroup} - ${r.shiftLabel}` }}
            </span>
            <span class="badge badge-sm ml-1.5" :class="r.genderType === '女' ? 'badge-danger' : 'badge-info'">
              {{ r.genderType }}眾
            </span>
            <span class="badge badge-sm badge-gray ml-1">
              {{ r.ruleType === 'weekday_weekend_sequential' ? '平假日雙軌' : '星期整組' }}
            </span>
          </button>

          <span v-if="filteredRules.length === 0" class="text-xs text-muted py-2">
            查無符合目前篩選條件的規則
          </span>
        </div>
      </div>

      <!-- 當前選定規則編輯區 -->
      <div v-if="activeRule" class="card-body">
        <!-- 規則基本設定列與操作按鈕 -->
        <div class="flex items-center justify-between mb-5 pb-4 border-b flex-wrap gap-4">
          <div class="flex items-center gap-3 flex-wrap">
            <div>
              <span class="text-xs text-muted block mb-0.5">規則名稱：</span>
              <input 
                v-model="activeRule.ruleName" 
                class="form-input form-input-sm font-bold text-gray-800" 
                style="min-width: 260px;" 
                placeholder="輸入規則名稱..."
              />
            </div>

            <div>
              <span class="text-xs text-muted block mb-0.5">所屬道場：</span>
              <span class="badge badge-light border text-sm py-1.5 px-3 font-bold">
                {{ activeRule.location }}
              </span>
            </div>

            <div>
              <span class="text-xs text-muted block mb-0.5">班次時段：</span>
              <span class="badge badge-light border text-sm py-1.5 px-3">
                {{ activeRule.shiftLabel }} ({{ activeRule.shiftId }})
              </span>
            </div>

            <div>
              <span class="text-xs text-muted block mb-0.5">所屬和氣：</span>
              <select v-model="activeRule.heqiGroup" class="form-select form-select-sm" style="min-width: 120px;">
                <option value="和氣一">和氣一</option>
                <option value="和氣二">和氣二</option>
                <option value="和氣三">和氣三</option>
                <option value="和氣四">和氣四</option>
                <option value="全區通用">全區通用</option>
              </select>
            </div>

            <div>
              <span class="text-xs text-muted block mb-0.5">規則類型：</span>
              <span class="badge badge-primary py-1 px-2.5 text-xs">
                {{ activeRule.ruleType === 'weekday_weekend_sequential' ? '🏢🏖️ 平日/假日雙軌循序輪替' : '📅 星期 × 整組循環輪替' }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button 
              type="button" 
              class="btn btn-outline btn-sm" 
              @click="handleResetActiveRule"
              title="還原為標準名冊"
            >
              ↺ 還原預設名冊
            </button>
            <button 
              v-if="!isCoreRule(activeRule.id)" 
              type="button" 
              class="btn btn-outline btn-danger btn-sm" 
              @click="handleDeleteActiveRule"
            >
              🗑️ 刪除此規則
            </button>
            <button 
              type="button" 
              class="btn btn-primary btn-sm" 
              :disabled="savingRule" 
              @click="handleSaveActiveRule"
            >
              {{ savingRule ? '儲存中...' : '💾 儲存此規則' }}
            </button>
          </div>
        </div>

        <!-- ─── 類型 A：東港聯絡處男眾班 (平日/假日雙軌循序輪替) ─── -->
        <div v-if="activeRule.ruleType === 'weekday_weekend_sequential'" class="sequential-rule-container">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- 1. 平日輪值名冊卡片 (週一至週五) -->
            <div class="card p-4 border bg-gray-50/40 rounded-lg">
              <div class="flex items-center justify-between mb-3 border-b pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🏢</span>
                  <h3 class="font-bold text-sm text-gray-800 m-0">平日輪值人員名冊 (週一至週五)</h3>
                </div>
                <span class="badge badge-primary">
                  共 {{ (activeRule.weekdayMembers || []).length }} 位志工
                </span>
              </div>
              <p class="text-xs text-muted mb-3">
                平日輪值採每日 1 人循序推進；若遇園區排班衝突以園區優先，東港自動調動下一位接替
              </p>

              <!-- 平日志工標籤膠囊列表 -->
              <div class="member-chip-list flex flex-wrap gap-2 mb-4 p-3 bg-white rounded border min-h-[140px]">
                <div 
                  v-for="(member, idx) in activeRule.weekdayMembers" 
                  :key="idx" 
                  class="member-order-chip"
                >
                  <span class="chip-idx">{{ idx + 1 }}.</span>
                  <span class="chip-name font-bold">{{ member }}</span>
                  <div class="chip-actions">
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      :disabled="idx === 0" 
                      @click="moveSequentialMember(activeRule.weekdayMembers, idx, -1)"
                      title="上移"
                    >
                      ↑
                    </button>
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      :disabled="idx === activeRule.weekdayMembers.length - 1" 
                      @click="moveSequentialMember(activeRule.weekdayMembers, idx, 1)"
                      title="下移"
                    >
                      ↓
                    </button>
                    <button 
                      type="button" 
                      class="btn-chip-del" 
                      @click="removeSequentialMember(activeRule.weekdayMembers, idx)"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <span v-if="!activeRule.weekdayMembers || activeRule.weekdayMembers.length === 0" class="text-xs text-muted py-4 w-full text-center">
                  目前尚無平日輪值志工，請於下方新增
                </span>
              </div>

              <!-- 新增平日人員輸入列 -->
              <div class="add-member-form flex items-center gap-2 flex-wrap">
                <select 
                  v-model="quickSelectedWeekdayMember" 
                  class="form-select form-select-sm flex-1 min-w-[160px]"
                  @change="onSelectMemberToList(activeRule.weekdayMembers, quickSelectedWeekdayMember, () => quickSelectedWeekdayMember = '')"
                >
                  <option value="">-- 從男眾名冊選擇加入 --</option>
                  <option v-for="m in maleMembers" :key="m.id" :value="m.name">
                    {{ m.name }}
                  </option>
                </select>

                <input 
                  v-model="newWeekdayMemberText" 
                  type="text" 
                  class="form-input form-input-sm" 
                  placeholder="或直接輸入姓名..." 
                  style="width: 140px;"
                  @keyup.enter="onAddMemberToList(activeRule.weekdayMembers, newWeekdayMemberText, () => newWeekdayMemberText = '')"
                />

                <button 
                  type="button" 
                  class="btn btn-sm btn-outline" 
                  :disabled="!newWeekdayMemberText"
                  @click="onAddMemberToList(activeRule.weekdayMembers, newWeekdayMemberText, () => newWeekdayMemberText = '')"
                >
                  ＋ 加入
                </button>
              </div>
            </div>

            <!-- 2. 假日輪值名冊卡片 (週六至週日) -->
            <div class="card p-4 border bg-gray-50/40 rounded-lg">
              <div class="flex items-center justify-between mb-3 border-b pb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🏖️</span>
                  <h3 class="font-bold text-sm text-gray-800 m-0">假日輪值人員名冊 (週六至週日)</h3>
                </div>
                <span class="badge badge-info">
                  共 {{ (activeRule.weekendMembers || []).length }} 位志工
                </span>
              </div>
              <p class="text-xs text-muted mb-3">
                假日輪值採每日 1 人循序推進；若遇園區排班衝突以園區優先，東港自動調動下一位接替
              </p>

              <!-- 假日志工標籤膠囊列表 -->
              <div class="member-chip-list flex flex-wrap gap-2 mb-4 p-3 bg-white rounded border min-h-[140px]">
                <div 
                  v-for="(member, idx) in activeRule.weekendMembers" 
                  :key="idx" 
                  class="member-order-chip chip-weekend"
                >
                  <span class="chip-idx">{{ idx + 1 }}.</span>
                  <span class="chip-name font-bold">{{ member }}</span>
                  <div class="chip-actions">
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      :disabled="idx === 0" 
                      @click="moveSequentialMember(activeRule.weekendMembers, idx, -1)"
                      title="上移"
                    >
                      ↑
                    </button>
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      :disabled="idx === activeRule.weekendMembers.length - 1" 
                      @click="moveSequentialMember(activeRule.weekendMembers, idx, 1)"
                      title="下移"
                    >
                      ↓
                    </button>
                    <button 
                      type="button" 
                      class="btn-chip-del" 
                      @click="removeSequentialMember(activeRule.weekendMembers, idx)"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <span v-if="!activeRule.weekendMembers || activeRule.weekendMembers.length === 0" class="text-xs text-muted py-4 w-full text-center">
                  目前尚無假日輪值志工，請於下方新增
                </span>
              </div>

              <!-- 新增假日人員輸入列 -->
              <div class="add-member-form flex items-center gap-2 flex-wrap">
                <select 
                  v-model="quickSelectedWeekendMember" 
                  class="form-select form-select-sm flex-1 min-w-[160px]"
                  @change="onSelectMemberToList(activeRule.weekendMembers, quickSelectedWeekendMember, () => quickSelectedWeekendMember = '')"
                >
                  <option value="">-- 從男眾名冊選擇加入 --</option>
                  <option v-for="m in maleMembers" :key="m.id" :value="m.name">
                    {{ m.name }}
                  </option>
                </select>

                <input 
                  v-model="newWeekendMemberText" 
                  type="text" 
                  class="form-input form-input-sm" 
                  placeholder="或直接輸入姓名..." 
                  style="width: 140px;"
                  @keyup.enter="onAddMemberToList(activeRule.weekendMembers, newWeekendMemberText, () => newWeekendMemberText = '')"
                />

                <button 
                  type="button" 
                  class="btn btn-sm btn-outline" 
                  :disabled="!newWeekendMemberText"
                  @click="onAddMemberToList(activeRule.weekendMembers, newWeekendMemberText, () => newWeekendMemberText = '')"
                >
                  ＋ 加入
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── 類型 B：宜蘭園區和氣女眾班 (星期 × 整組輪替) ─── -->
        <div v-else class="weekday-group-rule-container">
          <!-- 星期切換分頁 Tab -->
          <div class="weekday-tabs flex items-center gap-2 border-b pb-3 mb-4 overflow-x-auto">
            <button 
              v-for="d in weekdays" 
              :key="d.key"
              type="button"
              class="tab-btn"
              :class="{ 'tab-btn-active': activeWeekday === d.key }"
              @click="activeWeekday = d.key"
            >
              <span>{{ d.label }}</span>
              <span class="badge badge-sm ml-1" :class="activeWeekday === d.key ? 'badge-light' : 'badge-gray'">
                {{ (activeRule.weekdayTeams?.[d.key] || []).length }}組
              </span>
            </button>
          </div>

          <!-- 該星期組別列表 -->
          <div class="teams-container flex flex-col gap-4">
            <div 
              v-for="(team, teamIdx) in (activeRule.weekdayTeams?.[activeWeekday] || [])" 
              :key="teamIdx"
              class="team-card p-4 border rounded-lg bg-gray-50/50"
              :class="{ 'border-warning': team.members.length > 4 }"
            >
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <input 
                    v-model="team.teamName" 
                    class="form-input form-input-sm font-bold text-primary" 
                    style="max-width: 140px;"
                  />
                  <span class="badge" :class="team.members.length > 4 ? 'badge-warning' : 'badge-primary'">
                    共 {{ team.members.length }} 人
                  </span>
                  <span v-if="team.members.length > 4" class="text-xs text-warning font-bold">
                    ⚠️ 超額 {{ team.members.length - 4 }} 人，自動啟動備用輪替機制（每次 4 人，多出志工下次遞補）
                  </span>
                </div>

                <div class="flex items-center gap-1">
                  <button 
                    type="button" 
                    class="btn btn-xs btn-outline" 
                    :disabled="teamIdx === 0" 
                    @click="moveTeam(activeRule.weekdayTeams[activeWeekday], teamIdx, -1)"
                    title="上移組別"
                  >
                    ↑
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-xs btn-outline" 
                    :disabled="teamIdx === activeRule.weekdayTeams[activeWeekday].length - 1" 
                    @click="moveTeam(activeRule.weekdayTeams[activeWeekday], teamIdx, 1)"
                    title="下移組別"
                  >
                    ↓
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-xs btn-danger btn-outline ml-2" 
                    @click="removeTeam(activeRule.weekdayTeams[activeWeekday], teamIdx)"
                  >
                    ✕ 刪除組
                  </button>
                </div>
              </div>

              <!-- 組員膠囊列表 -->
              <div class="members-chip-container flex flex-wrap gap-2 mb-3">
                <div 
                  v-for="(member, mIdx) in team.members" 
                  :key="mIdx"
                  class="member-chip"
                  :class="{ 'chip-overflow': mIdx >= 4 }"
                >
                  <span class="chip-index">{{ mIdx + 1 }}.</span>
                  <span class="chip-text">{{ member }}</span>
                  <span v-if="mIdx >= 4" class="chip-badge">備用輪替</span>
                  <button 
                    type="button" 
                    class="chip-delete-btn" 
                    @click="team.members.splice(mIdx, 1)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <!-- 新增組員輸入列 -->
              <div class="add-member-row flex items-center gap-2 flex-wrap">
                <select 
                  v-model="quickSelectedTeamMember[teamIdx]" 
                  class="form-select form-select-sm" 
                  style="max-width: 220px;"
                  @change="onSelectMemberToTeam(team, quickSelectedTeamMember[teamIdx], () => quickSelectedTeamMember[teamIdx] = '')"
                >
                  <option value="">-- 從女眾名冊選擇加入 --</option>
                  <option v-for="m in femaleMembers" :key="m.id" :value="m.name">
                    {{ m.name }}
                  </option>
                </select>

                <input 
                  v-model="newTeamMemberName[teamIdx]" 
                  type="text" 
                  class="form-input form-input-sm" 
                  placeholder="輸入姓名按 Enter..." 
                  style="max-width: 160px;"
                  @keyup.enter="onAddMemberToTeam(team, newTeamMemberName[teamIdx], () => newTeamMemberName[teamIdx] = '')"
                />

                <button 
                  type="button" 
                  class="btn btn-sm btn-outline" 
                  :disabled="!newTeamMemberName[teamIdx]" 
                  @click="onAddMemberToTeam(team, newTeamMemberName[teamIdx], () => newTeamMemberName[teamIdx] = '')"
                >
                  ＋ 加入
                </button>
              </div>
            </div>

            <!-- 新增組別按鈕 -->
            <div class="pt-2">
              <button type="button" class="btn btn-outline btn-block" @click="addNewTeam(activeWeekday)">
                ➕ 在{{ weekdays.find(w => w.key === activeWeekday)?.label }}新增一組
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 新增排班規則 Modal (前瞻擴充未來和氣與班次) -->
    <div v-if="showCreateModal" class="modal-backdrop" @click="showCreateModal = false">
      <div class="modal-content" style="max-width: 540px;" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title font-bold text-base">➕ 新增自訂排班規則</h3>
          <button class="modal-close" @click="showCreateModal = false">×</button>
        </div>
        <div class="modal-body flex flex-col gap-3">
          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">規則名稱：</label>
            <input v-model="newRuleForm.ruleName" class="form-input form-input-sm" placeholder="例：宜蘭園區和氣一女眾值班規則" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">所屬道場：</label>
              <select v-model="newRuleForm.location" class="form-select form-select-sm">
                <option value="宜蘭園區">宜蘭園區</option>
                <option value="東港聯絡處">東港聯絡處</option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">所屬和氣：</label>
              <select v-model="newRuleForm.heqiGroup" class="form-select form-select-sm">
                <option value="和氣一">和氣一</option>
                <option value="和氣二">和氣二</option>
                <option value="和氣三">和氣三</option>
                <option value="和氣四">和氣四</option>
                <option value="全區通用">全區通用</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">班次時段代碼：</label>
              <select v-model="newRuleForm.shiftId" class="form-select form-select-sm">
                <option value="YL_F">YL_F (宜蘭園區 女眾班)</option>
                <option value="YL_M1">YL_M1 (宜蘭園區 男眾一班)</option>
                <option value="YL_M2">YL_M2 (宜蘭園區 男眾二班)</option>
                <option value="DG_F">DG_F (東港聯絡處 女眾班)</option>
                <option value="DG_M">DG_M (東港聯絡處 男眾班)</option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">眾別：</label>
              <select v-model="newRuleForm.genderType" class="form-select form-select-sm">
                <option value="女">女眾</option>
                <option value="男">男眾</option>
              </select>
            </div>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">排班輪替模式：</label>
            <select v-model="newRuleForm.ruleType" class="form-select form-select-sm">
              <option value="weekday_group_rotation">星期 × 整組循環輪替 (適用和氣組隊值週)</option>
              <option value="weekday_weekend_sequential">平日/假日雙軌循序輪替 (適用固定名單每日輪班)</option>
            </select>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-end gap-2">
          <button class="btn btn-outline btn-sm" @click="showCreateModal = false">
            取消
          </button>
          <button class="btn btn-primary btn-sm" :disabled="!newRuleForm.ruleName" @click="handleCreateRuleSubmit">
            確認新增
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  useDutyRulesStore, 
  DEFAULT_HEQI2_CAMPUS_FEMALE_RULE, 
  DEFAULT_DONGGANG_MALE_RULE, 
  DEFAULT_WEEK_ROTATION 
} from '@/stores/dutyRules';
import { useMembersStore } from '@/stores/members';
import { useToast } from '@/composables/useToast';

const dutyRulesStore = useDutyRulesStore();
const membersStore = useMembersStore();
const toast = useToast();

const showRotationCard = ref(true);
const savingRotation = ref(false);
const savingRule = ref(false);
const showCreateModal = ref(false);

// 志工名冊
const maleMembers = ref([]);
const femaleMembers = ref([]);

// 和氣週輪值設定
const rotationForm = ref({ ...DEFAULT_WEEK_ROTATION });

// 篩選器
const filterLocation = ref('');
const filterGender = ref('');
const filterHeqi = ref('');

// 當前選取之規則 ID
const activeRuleId = ref('rule_heqi2_campus_female');

// 星期定義
const weekdays = [
  { key: '1', label: '週一' },
  { key: '2', label: '週二' },
  { key: '3', label: '週三' },
  { key: '4', label: '週四' },
  { key: '5', label: '週五' },
  { key: '6', label: '週六' },
  { key: '0', label: '週日' }
];
const activeWeekday = ref('1');

// 輸入狀態綁定
const quickSelectedWeekdayMember = ref('');
const quickSelectedWeekendMember = ref('');
const newWeekdayMemberText = ref('');
const newWeekendMemberText = ref('');
const quickSelectedTeamMember = ref({});
const newTeamMemberName = ref({});

// 新增規則表單
const newRuleForm = ref({
  ruleName: '',
  location: '宜蘭園區',
  heqiGroup: '和氣一',
  shiftId: 'YL_F',
  genderType: '女',
  ruleType: 'weekday_group_rotation'
});

// 過濾後的規則清單
const filteredRules = computed(() => {
  return (dutyRulesStore.rules || []).filter(r => {
    if (filterLocation.value && r.location !== filterLocation.value) return false;
    if (filterGender.value && r.genderType !== filterGender.value) return false;
    if (filterHeqi.value && r.heqiGroup !== filterHeqi.value) return false;
    return true;
  });
});

// 當前選中的規則
const activeRule = computed(() => {
  return dutyRulesStore.rules.find(r => r.id === activeRuleId.value) || dutyRulesStore.rules[0] || null;
});

function selectRule(ruleId) {
  activeRuleId.value = ruleId;
}

function isCoreRule(id) {
  return id === 'rule_heqi2_campus_female' || id === 'rule_donggang_male';
}

// ─── 平日/假日循序清單操作 ───
function moveSequentialMember(list, idx, dir) {
  if (!list) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= list.length) return;
  const tmp = list[idx];
  list[idx] = list[targetIdx];
  list[targetIdx] = tmp;
}

function removeSequentialMember(list, idx) {
  if (list && idx >= 0 && idx < list.length) {
    list.splice(idx, 1);
  }
}

function onSelectMemberToList(list, name, clearFn) {
  if (!name || !list) return;
  if (!list.includes(name)) {
    list.push(name);
  }
  if (clearFn) clearFn();
}

function onAddMemberToList(list, name, clearFn) {
  const clean = (name || '').trim();
  if (!clean || !list) return;
  list.push(clean);
  if (clearFn) clearFn();
}

// ─── 星期×組別操作 ───
function moveTeam(teamList, idx, dir) {
  if (!teamList) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= teamList.length) return;
  const tmp = teamList[idx];
  teamList[idx] = teamList[targetIdx];
  teamList[targetIdx] = tmp;
}

function removeTeam(teamList, idx) {
  if (confirm(`確定要刪除第 ${idx + 1} 組嗎？`)) {
    teamList.splice(idx, 1);
  }
}

function addNewTeam(weekday) {
  if (!activeRule.value) return;
  if (!activeRule.value.weekdayTeams) activeRule.value.weekdayTeams = {};
  if (!activeRule.value.weekdayTeams[weekday]) activeRule.value.weekdayTeams[weekday] = [];
  
  const num = activeRule.value.weekdayTeams[weekday].length + 1;
  const numChinese = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][num - 1] || String(num);
  activeRule.value.weekdayTeams[weekday].push({
    teamName: `第${numChinese}組`,
    members: []
  });
}

function onSelectMemberToTeam(team, name, clearFn) {
  if (!name || !team) return;
  if (!team.members.includes(name)) {
    team.members.push(name);
  }
  if (clearFn) clearFn();
}

function onAddMemberToTeam(team, name, clearFn) {
  const clean = (name || '').trim();
  if (!clean || !team) return;
  team.members.push(clean);
  if (clearFn) clearFn();
}

// ─── 儲存與重置 ───
async function handleSaveWeekRotation() {
  savingRotation.value = true;
  try {
    await dutyRulesStore.saveWeekRotation(rotationForm.value);
    toast.success('和氣週輪值設定儲存成功！');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    savingRotation.value = false;
  }
}

async function handleSaveActiveRule() {
  if (!activeRule.value) return;
  savingRule.value = true;
  try {
    await dutyRulesStore.saveRule(activeRule.value);
    toast.success(`「${activeRule.value.ruleName || '排班規則'}」已成功儲存！`);
  } catch (err) {
    toast.error('儲存規則失敗：' + err.message);
  } finally {
    savingRule.value = false;
  }
}

function handleResetActiveRule() {
  if (!activeRule.value) return;
  if (!confirm(`確定要還原「${activeRule.value.ruleName}」為系統標準名單嗎？尚未儲存之修改將被重設。`)) return;

  if (activeRule.value.id === 'rule_heqi2_campus_female') {
    Object.assign(activeRule.value, JSON.parse(JSON.stringify(DEFAULT_HEQI2_CAMPUS_FEMALE_RULE)));
    toast.info('已還原為和氣二標準名冊，請記得點擊儲存！');
  } else if (activeRule.value.id === 'rule_donggang_male') {
    Object.assign(activeRule.value, JSON.parse(JSON.stringify(DEFAULT_DONGGANG_MALE_RULE)));
    toast.info('已還原為東港男眾標準名冊，請記得點擊儲存！');
  } else {
    toast.info('此規則無內建標準範本');
  }
}

async function handleDeleteActiveRule() {
  if (!activeRule.value) return;
  if (!confirm(`確定要刪除規則「${activeRule.value.ruleName}」嗎？此動作無法復原。`)) return;

  try {
    await dutyRulesStore.deleteRule(activeRule.value.id);
    activeRuleId.value = dutyRulesStore.rules[0]?.id || 'rule_heqi2_campus_female';
    toast.success('規則已刪除！');
  } catch (err) {
    toast.error('刪除失敗：' + err.message);
  }
}

function openCreateRuleModal() {
  newRuleForm.value = {
    ruleName: '',
    location: '宜蘭園區',
    heqiGroup: '和氣一',
    shiftId: 'YL_F',
    genderType: '女',
    ruleType: 'weekday_group_rotation'
  };
  showCreateModal.value = true;
}

async function handleCreateRuleSubmit() {
  const shiftLabels = {
    'YL_F': '女眾班',
    'YL_M1': '男眾一班',
    'YL_M2': '男眾二班',
    'DG_F': '女眾班',
    'DG_M': '男眾班'
  };
  const newRule = {
    id: `rule_${Date.now()}`,
    ruleName: newRuleForm.value.ruleName,
    location: newRuleForm.value.location,
    heqiGroup: newRuleForm.value.heqiGroup,
    shiftId: newRuleForm.value.shiftId,
    shiftLabel: shiftLabels[newRuleForm.value.shiftId] || '值班',
    genderType: newRuleForm.value.genderType,
    ruleType: newRuleForm.value.ruleType,
    weekdayTeams: newRuleForm.value.ruleType === 'weekday_group_rotation' ? { '1': [{ teamName: '第一組', members: [] }] } : null,
    weekdayMembers: newRuleForm.value.ruleType === 'weekday_weekend_sequential' ? [] : null,
    weekendMembers: newRuleForm.value.ruleType === 'weekday_weekend_sequential' ? [] : null,
    rotationPointers: {},
    enabled: true
  };

  await dutyRulesStore.saveRule(newRule);
  showCreateModal.value = false;
  activeRuleId.value = newRule.id;
  toast.success('排班規則新增成功！');
}

// 未來 8 週輪值預覽
const upcomingWeeksPreview = computed(() => {
  const result = [];
  const baseDate = new Date();
  const day = baseDate.getDay();
  const diff = (day - 1 + 7) % 7;
  const monday = new Date(baseDate.getTime() - diff * 86400000);

  for (let i = 0; i < 8; i++) {
    const wStart = new Date(monday.getTime() + i * 7 * 86400000);
    const wEnd = new Date(wStart.getTime() + 6 * 86400000);
    const startStr = wStart.toISOString().substring(5, 10);
    const endStr = wEnd.toISOString().substring(5, 10);
    const dateStrFull = wStart.toISOString().substring(0, 10);
    const heqi = dutyRulesStore.getHeqiForDate(dateStrFull, rotationForm.value);

    result.push({
      startDate: dateStrFull,
      dateRange: `${startStr} ~ ${endStr}`,
      heqi
    });
  }
  return result;
});

onMounted(async () => {
  const [rot, males, females] = await Promise.all([
    dutyRulesStore.fetchWeekRotation('宜蘭園區'),
    membersStore.fetchMembers({ gender: '男' }),
    membersStore.fetchMembers({ gender: '女' }),
    dutyRulesStore.fetchRules()
  ]);

  if (rot) {
    rotationForm.value = { ...DEFAULT_WEEK_ROTATION, ...rot };
  }

  maleMembers.value = males;
  femaleMembers.value = females;

  if (dutyRulesStore.rules.length > 0) {
    activeRuleId.value = dutyRulesStore.rules[0].id;
  }
});
</script>

<style scoped>
.admin-duty-rules {
  max-width: 1240px;
  margin: 0 auto;
}

.preview-week-box {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.4rem;
  text-align: center;
  transition: all 0.2s;
}
.box-highlight {
  background: #fdf2f8;
  border-color: #f472b6;
}
.heqi-tag {
  font-size: 0.8rem;
  margin-top: 0.2rem;
}

/* 規則 Tab 導航列 */
.rule-tabs-row {
  scrollbar-width: thin;
}
.rule-tab-btn {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.9rem;
  background: #ffffff;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--gray-700);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.rule-tab-btn:hover {
  background: var(--gray-100);
  border-color: var(--primary-400);
}
.rule-tab-btn-active {
  background: var(--primary-50) !important;
  color: var(--primary-700) !important;
  border-color: var(--primary-500) !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* 平日/假日時序人員膠囊 */
.member-order-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #ffffff;
  border: 1px solid var(--gray-300);
  border-radius: 9999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.85rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.chip-weekend {
  border-color: #93c5fd;
  background: #f0f7ff;
}
.chip-idx {
  font-size: 0.75rem;
  color: var(--gray-400);
}
.chip-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  margin-left: 0.25rem;
}
.btn-chip-arrow {
  background: none;
  border: none;
  font-size: 0.75rem;
  color: var(--gray-500);
  cursor: pointer;
  padding: 0 0.15rem;
  line-height: 1;
}
.btn-chip-arrow:hover:not(:disabled) {
  color: var(--primary-600);
  font-weight: bold;
}
.btn-chip-del {
  background: none;
  border: none;
  color: var(--gray-400);
  font-size: 0.95rem;
  cursor: pointer;
  margin-left: 0.2rem;
  line-height: 1;
}
.btn-chip-del:hover {
  color: var(--danger);
}

/* 星期 Tab */
.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--gray-200);
  background: #ffffff;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  white-space: nowrap;
}
.tab-btn-active {
  background: var(--primary-500);
  color: #ffffff;
  border-color: var(--primary-500);
}

/* 星期×組別組員標籤 */
.member-chip {
  display: inline-flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--gray-300);
  border-radius: 9999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.85rem;
}
.chip-overflow {
  border-color: var(--warning);
  background: #fffbeb;
}
.chip-index {
  color: var(--gray-400);
  font-size: 0.72rem;
  margin-right: 0.25rem;
}
.chip-text {
  font-weight: 600;
}
.chip-badge {
  font-size: 0.65rem;
  background: var(--warning);
  color: #78350f;
  padding: 0.05rem 0.3rem;
  border-radius: 9999px;
  margin-left: 0.35rem;
  font-weight: 700;
}
.chip-delete-btn {
  background: none;
  border: none;
  color: var(--gray-400);
  margin-left: 0.4rem;
  cursor: pointer;
  font-size: 0.95rem;
}
.chip-delete-btn:hover {
  color: var(--danger);
}

.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; max-height: 70vh; overflow-y: auto; }
.modal-footer { padding: 1rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }
.btn-block { width: 100%; }
</style>
