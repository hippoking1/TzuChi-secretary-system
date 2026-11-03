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
        <button class="btn btn-outline border-blue-600 text-blue-800 hover:bg-blue-50" @click="showLocationModal = true">
          🏛️ 管理道場據點
        </button>
        <button class="btn btn-outline border-teal-600 text-teal-800 hover:bg-teal-50" @click="showHospitalModal = true">
          🏥 預排醫院志工
        </button>
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
            <select v-model="filterLocation" class="form-select form-select-sm" style="width: 140px;">
              <option value="">全部道場</option>
              <option v-for="loc in locationsStore.locationNames" :key="loc" :value="loc">
                {{ loc }}
              </option>
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
        <!-- 1. 規則標題與操作按鈕工具列 (Header & Action Toolbar) -->
        <div class="flex items-center justify-between mb-4 pb-3 border-b flex-wrap gap-3">
          <div class="flex items-center gap-2.5 flex-wrap">
            <span class="text-xl leading-none">
              {{ activeRule.location === '宜蘭園區' ? '🌸' : '⚓' }}
            </span>
            <h3 class="text-base font-bold text-gray-800 m-0">
              {{ activeRule.ruleName }}
            </h3>
            <span class="badge badge-sm" :class="activeRule.genderType === '女' ? 'badge-danger' : 'badge-info'">
              {{ activeRule.genderType }}眾班
            </span>
            <span class="badge badge-sm badge-light border text-gray-700">
              {{ activeRule.ruleType === 'weekday_weekend_sequential' ? '🏢🏖️ 平假日雙軌循序輪替' : '📅 星期 × 整組循環輪替' }}
            </span>
            <span class="badge badge-sm badge-gray text-gray-600">
              📍 {{ activeRule.location }}
            </span>
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
              class="btn btn-primary btn-sm font-bold shadow-xs px-3" 
              :disabled="savingRule" 
              @click="handleSaveActiveRule"
            >
              {{ savingRule ? '儲存中...' : '💾 儲存此規則' }}
            </button>
          </div>
        </div>

        <!-- 2. 規則基本參數對齊設定網格面板 (Settings Grid) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-3.5 mb-4 bg-gray-50/90 rounded-lg border border-gray-200">
          <!-- 1. 規則名稱 -->
          <div class="form-group mb-0 flex flex-col justify-between">
            <label class="form-label font-bold text-xs text-gray-700 mb-1 flex items-center gap-1">
              <span>📝 規則名稱：</span>
            </label>
            <input 
              v-model="activeRule.ruleName" 
              class="form-input form-input-sm w-full font-bold text-gray-800 bg-white" 
              placeholder="輸入規則名稱..."
            />
          </div>

          <!-- 2. 所屬和氣 -->
          <div class="form-group mb-0 flex flex-col justify-between">
            <label class="form-label font-bold text-xs text-gray-700 mb-1 flex items-center gap-1">
              <span>🌸 所屬和氣組別：</span>
            </label>
            <select v-model="activeRule.heqiGroup" class="form-select form-select-sm w-full font-bold bg-white">
              <option value="和氣一">和氣一</option>
              <option value="和氣二">和氣二</option>
              <option value="和氣三">和氣三</option>
              <option value="和氣四">和氣四</option>
              <option value="全區通用">全區通用</option>
            </select>
          </div>

          <!-- 3. 所屬道場與班次時段 -->
          <div class="form-group mb-0 flex flex-col justify-between">
            <label class="form-label font-bold text-xs text-gray-700 mb-1 flex items-center gap-1">
              <span>📍 道場與班次時段：</span>
            </label>
            <div class="form-input form-input-sm w-full bg-white text-gray-800 flex items-center justify-between font-medium">
              <span class="font-bold text-xs">{{ activeRule.location }}</span>
              <span class="badge badge-sm badge-light border text-gray-600 font-mono">
                {{ activeRule.shiftLabel }} ({{ activeRule.shiftId }})
              </span>
            </div>
          </div>

          <!-- 4. 每班需求人數 / 輪值模式 -->
          <div class="form-group mb-0 flex flex-col justify-between">
            <label class="form-label font-bold text-xs text-gray-700 mb-1 flex items-center gap-1">
              <span>👥 席次需求 / 輪值模式：</span>
            </label>
            <div v-if="activeRule.ruleType === 'weekday_group_rotation'" class="form-input form-input-sm w-full bg-blue-50/50 border-blue-200 text-primary font-bold flex items-center justify-between text-xs">
              <span>整組全員輪值</span>
              <span class="text-xs text-muted font-normal">(依組別人數排班)</span>
            </div>
            <div v-else class="flex items-center gap-2">
              <input 
                v-model.number="activeRule.quota" 
                type="number" 
                min="1" 
                max="10" 
                class="form-input form-input-sm w-24 font-bold text-primary text-center bg-white" 
              />
              <span class="text-xs text-muted font-bold">人 / 班</span>
            </div>
          </div>
        </div>

        <!-- 志工候選清單組織與關鍵字過濾列 (支援所屬組織和氣/互愛/協力篩選，避免同名同姓混淆) -->
        <div class="card p-3 mb-4 bg-sky-50/70 border border-sky-200 rounded-lg">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-2 flex-wrap flex-1">
              <span class="text-xs font-bold text-gray-800 flex items-center gap-1 whitespace-nowrap">
                <span>🏢 建立名冊之組織篩選：</span>
              </span>
              <select v-model="filterMemberOrgId" class="form-select form-select-sm" style="max-width: 280px;">
                <option value="">-- 全部組織架構 (不限) --</option>
                <option v-for="opt in formattedOrgOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>

              <input 
                v-model="memberSearchKeyword" 
                type="text" 
                class="form-input form-input-sm" 
                placeholder="搜尋姓名/法號/電話..." 
                style="max-width: 170px;"
              />
              <button 
                v-if="filterMemberOrgId || memberSearchKeyword" 
                type="button" 
                class="btn btn-xs btn-outline" 
                @click="clearMemberFilters"
              >
                重設篩選
              </button>
              <button 
                v-if="activeRule.heqiGroup && activeRule.heqiGroup !== '全區通用' && matchingHeqiOrg && filterMemberOrgId !== matchingHeqiOrg.id"
                type="button"
                class="btn btn-xs btn-outline border-sky-300 text-sky-800 hover:bg-sky-100"
                @click="filterMemberOrgId = matchingHeqiOrg.id"
                title="快速切換至目前規則設定之和氣"
              >
                🌸 快速切換至【{{ activeRule.heqiGroup }}】
              </button>
            </div>

            <div class="text-xs text-gray-600 flex items-center gap-2">
              <span>
                候選志工：<strong class="text-primary">{{ filteredRuleMembers.length }}</strong> 位 ({{ activeRule.genderType === '男' ? '男眾' : '女眾' }})
              </span>
              <span class="text-muted text-[11px]">
                (選單顯示所屬組織，避免同名同姓混淆)
              </span>
            </div>
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
                  :title="getMemberTooltipByName(member)"
                >
                  <span class="chip-idx">{{ idx + 1 }}.</span>
                  <span class="chip-name font-bold">{{ member }}</span>
                  <span v-if="getMemberOrgBadgeByName(member)" class="text-[10px] text-gray-500 font-normal ml-0.5">
                    {{ getMemberOrgBadgeByName(member) }}
                  </span>
                  <span 
                    v-if="getMemberConstraintBadgeText(member)" 
                    class="constraint-mini-badge cursor-pointer"
                    :class="getMemberConstraintBadgeClass(member)"
                    title="點擊修改個人排班彈性限制"
                    @click="openConstraintModal(member)"
                  >
                    {{ getMemberConstraintBadgeText(member) }}
                  </span>
                  <div class="chip-actions">
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      @click="openConstraintModal(member)"
                      title="設定個人排班彈性規則 (如排週一、勿排二四六等)"
                    >
                      ⚙️
                    </button>
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      @click="transferSequentialMember(activeRule.weekdayMembers, activeRule.weekendMembers, idx, '假日')"
                      title="移至假日輪值名冊"
                    >
                      ⇄
                    </button>
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
                  class="form-select form-select-sm flex-1 min-w-[200px]"
                  @change="onSelectMemberToList(activeRule.weekdayMembers, quickSelectedWeekdayMember, () => quickSelectedWeekdayMember = '')"
                >
                  <option value="">-- 從{{ activeRule.genderType === '女' ? '女' : '男' }}眾名冊選擇加入 (共 {{ filteredRuleMembers.length }} 人) --</option>
                  <option v-for="m in filteredRuleMembers" :key="m.id" :value="m.name">
                    {{ m.name }} {{ getMemberOrgPathText(m.id) }}
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
                  :title="getMemberTooltipByName(member)"
                >
                  <span class="chip-idx">{{ idx + 1 }}.</span>
                  <span class="chip-name font-bold">{{ member }}</span>
                  <span v-if="getMemberOrgBadgeByName(member)" class="text-[10px] text-gray-500 font-normal ml-0.5">
                    {{ getMemberOrgBadgeByName(member) }}
                  </span>
                  <span 
                    v-if="getMemberConstraintBadgeText(member)" 
                    class="constraint-mini-badge cursor-pointer"
                    :class="getMemberConstraintBadgeClass(member)"
                    title="點擊修改個人排班彈性限制"
                    @click="openConstraintModal(member)"
                  >
                    {{ getMemberConstraintBadgeText(member) }}
                  </span>
                  <div class="chip-actions">
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      @click="openConstraintModal(member)"
                      title="設定個人排班彈性規則 (如排六日、排日為主等)"
                    >
                      ⚙️
                    </button>
                    <button 
                      type="button" 
                      class="btn-chip-arrow" 
                      @click="transferSequentialMember(activeRule.weekendMembers, activeRule.weekdayMembers, idx, '平日')"
                      title="移至平日輪值名冊"
                    >
                      ⇄
                    </button>
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
                  class="form-select form-select-sm flex-1 min-w-[200px]"
                  @change="onSelectMemberToList(activeRule.weekendMembers, quickSelectedWeekendMember, () => quickSelectedWeekendMember = '')"
                >
                  <option value="">-- 從{{ activeRule.genderType === '女' ? '女' : '男' }}眾名冊選擇加入 (共 {{ filteredRuleMembers.length }} 人) --</option>
                  <option v-for="m in filteredRuleMembers" :key="m.id" :value="m.name">
                    {{ m.name }} {{ getMemberOrgPathText(m.id) }}
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
            >
              <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <input 
                    v-model="team.teamName" 
                    class="form-input form-input-sm font-bold text-primary" 
                    style="max-width: 140px;"
                  />
                  <span class="badge badge-primary">
                    共 {{ team.members.length }} 人（整組全員輪值）
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

              <!-- 組員膠囊列表 (整組全員值班，不限上限) -->
              <div class="members-chip-container flex flex-wrap gap-2 mb-3">
                <div 
                  v-for="(member, mIdx) in team.members" 
                  :key="mIdx"
                  class="member-chip"
                  :title="getMemberTooltipByName(member)"
                >
                  <span class="chip-index">{{ mIdx + 1 }}.</span>
                  <span class="chip-text">{{ member }}</span>
                  <span v-if="getMemberOrgBadgeByName(member)" class="text-[10px] text-gray-500 font-normal ml-0.5">
                    {{ getMemberOrgBadgeByName(member) }}
                  </span>
                  <span 
                    v-if="getMemberConstraintBadgeText(member)" 
                    class="constraint-mini-badge cursor-pointer ml-1"
                    :class="getMemberConstraintBadgeClass(member)"
                    title="點擊修改個人排班彈性限制"
                    @click="openConstraintModal(member)"
                  >
                    {{ getMemberConstraintBadgeText(member) }}
                  </span>
                  <button 
                    type="button" 
                    class="btn-chip-arrow ml-1" 
                    title="設定個人排班彈性限制"
                    @click="openConstraintModal(member)"
                  >
                    ⚙️
                  </button>
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
                  style="max-width: 260px;"
                  @change="onSelectMemberToTeam(team, quickSelectedTeamMember[teamIdx], () => quickSelectedTeamMember[teamIdx] = '')"
                >
                  <option value="">-- 從{{ activeRule.genderType === '男' ? '男' : '女' }}眾名冊選擇加入 (共 {{ filteredRuleMembers.length }} 人) --</option>
                  <option v-for="m in filteredRuleMembers" :key="m.id" :value="m.name">
                    {{ m.name }} {{ getMemberOrgPathText(m.id) }}
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

        <!-- ─── 個人排班彈性限制設定區 (適用所有規則：僅排星期 / 勿排星期 / 優先星期 / 臨時請假) ─── -->
        <div class="card p-4 mt-6 border border-indigo-200 bg-indigo-50/30 rounded-lg">
          <div class="flex items-center justify-between flex-wrap gap-3 mb-3 border-b border-indigo-100 pb-3">
            <div>
              <h3 class="font-bold text-sm text-indigo-950 m-0 flex items-center gap-1.5">
                <span>⚡ 個人排班彈性限制設定（特定星期可排 / 勿排 / 優先星期 / 臨時請假）</span>
                <span class="badge badge-primary text-xs">共 {{ activeConstraintEntries.length }} 位設定</span>
              </h3>
              <p class="text-xs text-muted m-0 mt-1">
                設定個別志工之出勤彈性（例：排日為主、排六日、勿排二四六、排週一等）。自動排班時將智慧提前預拉或由下一位代班並於可排日優先補班；點擊上方名冊人員旁的「⚙️」亦可直接設定。
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-if="activeRule.id === 'rule_donggang_male'"
                type="button"
                class="btn btn-xs btn-outline border-indigo-300 text-indigo-800 hover:bg-indigo-100"
                @click="handleApplyDefaultDonggangConstraints"
                title="載入預設彈性規則（莊漢僑排日為主、李自強/薛登霖排六日、李長和勿排二四六、吳世明勿排一二四六、李世清/林子民排週一）"
              >
                🔄 載入預設範例限制
              </button>
              <button
                type="button"
                class="btn btn-xs btn-primary flex items-center gap-1"
                @click="openConstraintModal('')"
              >
                <span>➕ 新增 / 設定志工彈性限制</span>
              </button>
            </div>
          </div>

          <div v-if="activeConstraintEntries.length === 0" class="text-xs text-muted py-4 text-center bg-white rounded border border-dashed">
            目前尚未設定個人排班彈性限制，可點擊上方名冊人員旁的「⚙️」或點擊「➕ 新增 / 設定志工彈性限制」進行設定。
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <div
              v-for="entry in activeConstraintEntries"
              :key="entry.memberName"
              class="p-2.5 bg-white border rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-indigo-300 transition-colors"
            >
              <div class="flex flex-col gap-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <strong class="text-sm text-gray-900">{{ entry.memberName }}</strong>
                  <span class="constraint-mini-badge" :class="getMemberConstraintBadgeClass(entry.memberName)">
                    {{ entry.badgeText }}
                  </span>
                  <span v-if="entry.constraint.skipBehavior === 'exempt'" class="badge badge-gray text-[10px] py-0 px-1.5">
                    免補班
                  </span>
                </div>
                <div v-if="entry.constraint.dateRanges?.length > 0" class="text-[11px] text-amber-800">
                  📅 請假免排：{{ entry.constraint.dateRanges.map(r => `${r.startDate}~${r.endDate}${r.reason ? '(' + r.reason + ')' : ''}`).join('、') }}
                </div>
                <div v-else-if="entry.constraint.note && entry.constraint.note !== entry.badgeText" class="text-[11px] text-muted truncate">
                  備註：{{ entry.constraint.note }}
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="btn btn-xs btn-outline py-0.5 px-2"
                  title="編輯此志工限制"
                  @click="openConstraintModal(entry.memberName)"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-outline text-danger py-0.5 px-2"
                  title="移除此志工限制"
                  @click="removeMemberConstraint(entry.memberName)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 設定志工個人排班彈性限制 Modal -->
    <div v-if="showConstraintModal" class="modal-backdrop" @click="showConstraintModal = false">
      <div class="modal-content" style="max-width: 580px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title font-bold text-base flex items-center gap-1.5">
              <span>⚡ 設定個人排班彈性限制</span>
              <span v-if="constraintForm.memberName" class="badge badge-primary text-xs">{{ constraintForm.memberName }}</span>
            </h3>
            <p class="text-xs text-muted mt-0.5">
              設定後請記得點擊規則頁面的「💾 儲存此規則」以永久保存至資料庫
            </p>
          </div>
          <button class="modal-close" @click="showConstraintModal = false">×</button>
        </div>

        <div class="modal-body flex flex-col gap-4">
          <!-- 1. 選擇志工姓名 -->
          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">1. 選擇或輸入志工姓名：</label>
            <div class="flex items-center gap-2 flex-wrap">
              <select
                v-model="constraintForm.memberName"
                class="form-select form-select-sm flex-1 min-w-[200px]"
                @change="onConstraintMemberSelect(constraintForm.memberName)"
              >
                <option value="">-- 從當前規則名冊選擇志工 --</option>
                <option v-for="name in currentRuleAllRosterNames" :key="name" :value="name">
                  {{ name }} {{ getMemberConstraintBadgeText(name) ? `(${getMemberConstraintBadgeText(name)})` : '' }}
                </option>
              </select>
              <input
                v-model="constraintForm.memberName"
                type="text"
                class="form-input form-input-sm"
                style="width: 160px;"
                placeholder="或直接輸入姓名..."
              />
            </div>
          </div>

          <!-- 2. 快速常用範本一鍵套用 -->
          <div class="p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-lg">
            <span class="text-xs font-bold text-indigo-950 block mb-1.5">💡 快速套用常見彈性狀況：</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button type="button" class="btn btn-xs btn-outline bg-white" @click="applyConstraintPreset('preferred', [0], '排日為主')">
                ⭐ 排日為主
              </button>
              <button type="button" class="btn btn-xs btn-outline bg-white" @click="applyConstraintPreset('allowed', [6, 0], '排六日')">
                📌 排六日
              </button>
              <button type="button" class="btn btn-xs btn-outline bg-white" @click="applyConstraintPreset('allowed', [1], '排週一')">
                📌 排週一
              </button>
              <button type="button" class="btn btn-xs btn-outline bg-white" @click="applyConstraintPreset('excluded', [2, 4, 6], '勿排二四六')">
                🚫 勿排二四六
              </button>
              <button type="button" class="btn btn-xs btn-outline bg-white" @click="applyConstraintPreset('excluded', [1, 2, 4, 6], '勿排一二四六')">
                🚫 勿排一二四六
              </button>
              <button type="button" class="btn btn-xs btn-outline bg-white text-gray-600" @click="applyConstraintPreset('none', [], '')">
                ↺ 清除星期限制
              </button>
            </div>
          </div>

          <!-- 3. 星期限制模式與勾選 -->
          <div class="p-3 border rounded-lg bg-gray-50/60">
            <label class="form-label font-bold text-xs mb-2 block">2. 星期出勤規則模式：</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <label class="mode-radio-card" :class="{ 'mode-radio-active': constraintForm.mode === 'none' }">
                <input v-model="constraintForm.mode" type="radio" value="none" class="hidden" />
                <span class="font-bold text-xs">✅ 不限星期</span>
                <small class="text-[10px] text-muted block">依常規順序輪班</small>
              </label>

              <label class="mode-radio-card" :class="{ 'mode-radio-active': constraintForm.mode === 'allowed' }">
                <input v-model="constraintForm.mode" type="radio" value="allowed" class="hidden" />
                <span class="font-bold text-xs text-blue-700">📌 僅排星期</span>
                <small class="text-[10px] text-muted block">只排勾選的星期</small>
              </label>

              <label class="mode-radio-card" :class="{ 'mode-radio-active': constraintForm.mode === 'excluded' }">
                <input v-model="constraintForm.mode" type="radio" value="excluded" class="hidden" />
                <span class="font-bold text-xs text-red-700">🚫 勿排星期</span>
                <small class="text-[10px] text-muted block">避開勾選的星期</small>
              </label>

              <label class="mode-radio-card" :class="{ 'mode-radio-active': constraintForm.mode === 'preferred' }">
                <input v-model="constraintForm.mode" type="radio" value="preferred" class="hidden" />
                <span class="font-bold text-xs text-amber-800">⭐ 優先星期</span>
                <small class="text-[10px] text-muted block">以勾選星期為主</small>
              </label>
            </div>

            <div v-if="constraintForm.mode !== 'none'" class="mt-2">
              <span class="text-xs font-bold text-gray-700 block mb-1.5">
                請點選目標星期（{{ constraintForm.mode === 'allowed' ? '僅排以下勾選之星期' : (constraintForm.mode === 'excluded' ? '勿排以下勾選之星期' : '優先排於以下勾選之星期') }}）：
              </span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button
                  v-for="d in weekdays"
                  :key="d.key"
                  type="button"
                  class="day-toggle-btn"
                  :class="{
                    'day-toggle-allowed': constraintForm.mode === 'allowed' && constraintForm.days.includes(Number(d.key)),
                    'day-toggle-excluded': constraintForm.mode === 'excluded' && constraintForm.days.includes(Number(d.key)),
                    'day-toggle-preferred': constraintForm.mode === 'preferred' && constraintForm.days.includes(Number(d.key))
                  }"
                  @click="toggleConstraintDay(Number(d.key))"
                >
                  {{ d.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- 4. 遇限制時之補班方式 -->
          <div class="p-3 border rounded-lg bg-white">
            <label class="form-label font-bold text-xs mb-1.5 block">3. 遇不可排日之調班/補班方式：</label>
            <div class="flex flex-col gap-1.5 text-xs">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="constraintForm.skipBehavior" type="radio" value="defer_payback" />
                <span>
                  <strong>🔄 順延優先補班（預設推薦）</strong>
                  <span class="text-muted ml-1">— 當日由下一位代班，本人保留於下一個可排日優先補班，確保總班次公平</span>
                </span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="constraintForm.skipBehavior" type="radio" value="exempt" />
                <span>
                  <strong>⏭️ 直接跳過免補班</strong>
                  <span class="text-muted ml-1">— 適用長期請假或特殊減免，跳過當次輪值且不累積待補班</span>
                </span>
              </label>
            </div>
          </div>

          <!-- 5. 特定日期區間不排班 (臨時請假/出國) -->
          <div class="p-3 border rounded-lg bg-amber-50/30 border-amber-200">
            <div class="flex items-center justify-between mb-2">
              <label class="form-label font-bold text-xs text-amber-950 m-0">4. 特定日期區間不排班（選填，如臨時請假/出國）：</label>
              <button type="button" class="btn btn-xs btn-outline" @click="addConstraintDateRange">
                ➕ 新增請假區間
              </button>
            </div>
            <div v-if="constraintForm.dateRanges.length === 0" class="text-xs text-muted">
              無特定請假區間（僅套用上方常態星期規則）
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(rng, rIdx) in constraintForm.dateRanges"
                :key="rIdx"
                class="flex items-center gap-1.5 flex-wrap bg-white p-2 rounded border text-xs"
              >
                <input v-model="rng.startDate" type="date" class="form-input form-input-sm" style="width: 135px;" />
                <span>至</span>
                <input v-model="rng.endDate" type="date" class="form-input form-input-sm" style="width: 135px;" />
                <input v-model="rng.reason" type="text" class="form-input form-input-sm flex-1 min-w-[110px]" placeholder="原因 (如: 請假)" />
                <button type="button" class="btn btn-xs btn-outline text-danger" @click="constraintForm.dateRanges.splice(rIdx, 1)">
                  ×
                </button>
              </div>
            </div>
          </div>

          <!-- 6. 備註說明 -->
          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">5. 規則備註說明（選填）：</label>
            <input v-model="constraintForm.note" type="text" class="form-input form-input-sm" placeholder="例：排日為主、勿排二四六..." />
          </div>
        </div>

        <div class="modal-footer flex items-center justify-between">
          <button
            v-if="constraintForm.memberName && hasExistingConstraint(constraintForm.memberName)"
            type="button"
            class="btn btn-outline btn-danger btn-sm"
            @click="removeMemberConstraint(constraintForm.memberName); showConstraintModal = false"
          >
            🗑️ 移除此人限制
          </button>
          <span v-else></span>

          <div class="flex items-center gap-2">
            <button type="button" class="btn btn-outline btn-sm" @click="showConstraintModal = false">
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!constraintForm.memberName.trim()"
              @click="handleSaveConstraintModal"
            >
              ✓ 套用此人彈性設定
            </button>
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
              <select v-model="newRuleForm.location" class="form-select form-select-sm" @change="onNewRuleLocationChange">
                <option v-for="loc in locationsStore.locationNames" :key="loc" :value="loc">
                  {{ loc }}
                </option>
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
              <select v-model="newRuleForm.shiftId" class="form-select form-select-sm" @change="onNewRuleShiftChange">
                <option 
                  v-for="s in currentNewRuleAvailableShifts" 
                  :key="s.shiftId" 
                  :value="s.shiftId"
                >
                  {{ s.shiftId }} ({{ s.label }} - {{ s.timeRange }})
                </option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label font-bold text-xs">眾別：</label>
              <select v-model="newRuleForm.genderType" class="form-select form-select-sm" @change="onNewRuleShiftChange">
                <option value="女">女眾</option>
                <option value="男">男眾</option>
              </select>
            </div>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">每班基本需求人數 (席次)：</label>
            <div class="flex items-center gap-2">
              <input 
                v-model.number="newRuleForm.quota" 
                type="number" 
                min="1" 
                max="10" 
                class="form-input form-input-sm font-bold text-primary" 
                style="width: 80px;" 
              />
              <span class="text-xs text-muted">
                {{ newRuleForm.ruleType === 'weekday_group_rotation' ? '（星期整組輪替依各組實際人數全額排班，不限人數上限）' : '人 / 班（系統已依班次自適應帶入建議值）' }}
              </span>
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

    <!-- 預排醫院志工及日期 Modal -->
    <HospitalVolunteerModal
      :show="showHospitalModal"
      @close="showHospitalModal = false"
    />

    <!-- 道場據點管理 Modal -->
    <LocationManageModal
      :show="showLocationModal"
      @close="showLocationModal = false"
      @updated="onLocationUpdated"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import HospitalVolunteerModal from '@/components/duty/HospitalVolunteerModal.vue';
import LocationManageModal from '@/components/duty/LocationManageModal.vue';
import { useLocationsStore } from '@/stores/locations';
import { 
  useDutyRulesStore, 
  DEFAULT_HEQI2_CAMPUS_FEMALE_RULE, 
  DEFAULT_DONGGANG_MALE_RULE, 
  DEFAULT_DONGGANG_MALE_MEMBER_CONSTRAINTS,
  DEFAULT_WEEK_ROTATION,
  getRuleQuota,
  normalizeMemberConstraint,
  formatMemberConstraintBadge,
  getMemberConstraint
} from '@/stores/dutyRules';
import { getStandardShiftQuota } from '@/stores/duties';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';

const dutyRulesStore = useDutyRulesStore();
const locationsStore = useLocationsStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const showRotationCard = ref(true);
const savingRotation = ref(false);
const savingRule = ref(false);
const showCreateModal = ref(false);
const showHospitalModal = ref(false);
const showLocationModal = ref(false);

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
  quota: 4,
  ruleType: 'weekday_group_rotation'
});

// 當前選取道場可用的班次清單
const currentNewRuleAvailableShifts = computed(() => {
  const shifts = locationsStore.getShiftsForLocation(newRuleForm.value.location);
  return shifts || [];
});

function onNewRuleLocationChange() {
  const shifts = currentNewRuleAvailableShifts.value;
  if (shifts && shifts.length > 0) {
    newRuleForm.value.shiftId = shifts[0].shiftId;
    newRuleForm.value.genderType = shifts[0].gender || '女';
    newRuleForm.value.quota = shifts[0].quota || 2;
  }
}

function onLocationUpdated() {
  locationsStore.fetchLocations();
}

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

// 當前規則自適應需求席次（由規則設定或道場班次配置決定）
const activeRuleQuota = computed(() => {
  if (!activeRule.value) return 4;
  if (typeof activeRule.value.quota === 'number' && activeRule.value.quota > 0) {
    return activeRule.value.quota;
  }
  return getRuleQuota(activeRule.value);
});

// 監聽 activeRule 切換，確保 quota 數值正確同步
watch(activeRule, (newRule) => {
  if (newRule && typeof newRule.quota !== 'number') {
    newRule.quota = getRuleQuota(newRule);
  }
}, { immediate: true });

function selectRule(ruleId) {
  activeRuleId.value = ruleId;
}

function isCoreRule(id) {
  return id === 'rule_heqi2_campus_female' || id === 'rule_donggang_male';
}

// ─── 志工名冊組織過濾與同名同姓識別 ───
const filterMemberOrgId = ref('');
const memberSearchKeyword = ref('');

function clearMemberFilters() {
  filterMemberOrgId.value = '';
  memberSearchKeyword.value = '';
}

const formattedOrgOptions = computed(() => {
  const options = [];
  (orgsStore.orgTree || []).forEach(heqi => {
    options.push({ id: heqi.id, label: `🌸 ${heqi.name} (全體)` });
    (heqi.children || []).forEach(huai => {
      options.push({ id: huai.id, label: `　├ ${huai.name} (全體)` });
      (huai.children || []).forEach(xieli => {
        options.push({ id: xieli.id, label: `　│　└ ${xieli.name}` });
      });
    });
  });
  return options;
});

const memberOrgPathMap = computed(() => {
  const map = new Map();
  const males = Array.isArray(maleMembers.value) ? maleMembers.value : [];
  const females = Array.isArray(femaleMembers.value) ? femaleMembers.value : [];
  const all = [...males, ...females];
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    if (m && m.id && m.orgId) {
      const p = orgsStore.getOrgPath(m.orgId);
      if (p) map.set(m.id, `(${p})`);
    }
  }
  return map;
});

function getMemberOrgPathText(memberId) {
  if (!memberId) return '';
  return memberOrgPathMap.value.get(memberId) || '';
}

const memberByNameMap = computed(() => {
  const map = new Map();
  const males = Array.isArray(maleMembers.value) ? maleMembers.value : [];
  const females = Array.isArray(femaleMembers.value) ? femaleMembers.value : [];
  const all = [...males, ...females];
  all.forEach(m => {
    if (!m) return;
    const name = (m.name || '').trim();
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(m);
  });
  return map;
});

function getMemberOrgBadgeByName(name) {
  if (!name) return '';
  const list = memberByNameMap.value.get(name.trim());
  if (!list || list.length === 0) return '';
  const target = (activeRule.value?.heqiGroup && activeRule.value.heqiGroup !== '全區通用')
    ? list.find(m => {
        const p = orgsStore.getOrgPath(m.orgId);
        return p && p.includes(activeRule.value.heqiGroup);
      }) || list[0]
    : list[0];
  if (target && target.orgId) {
    const p = orgsStore.getOrgPath(target.orgId);
    if (p) {
      const parts = p.split('/').map(s => s.trim());
      return `(${parts[0]})`;
    }
  }
  return '';
}

function getMemberTooltipByName(name) {
  if (!name) return '';
  const list = memberByNameMap.value.get(name.trim());
  if (!list || list.length === 0) return name;
  const target = (activeRule.value?.heqiGroup && activeRule.value.heqiGroup !== '全區通用')
    ? list.find(m => {
        const p = orgsStore.getOrgPath(m.orgId);
        return p && p.includes(activeRule.value.heqiGroup);
      }) || list[0]
    : list[0];
  if (target && target.orgId) {
    const p = orgsStore.getOrgPath(target.orgId);
    return p ? `${name} (${p})` : name;
  }
  return name;
}

const matchingHeqiOrg = computed(() => {
  if (!activeRule.value?.heqiGroup || activeRule.value.heqiGroup === '全區通用') return null;
  return (orgsStore.orgTree || []).find(h => h.name === activeRule.value.heqiGroup) || null;
});

// 切換規則時，若該規則有特定和氣，智慧預設為該和氣組織篩選
watch(activeRule, (newRule) => {
  if (newRule && newRule.heqiGroup && newRule.heqiGroup !== '全區通用') {
    const match = (orgsStore.orgTree || []).find(h => h.name === newRule.heqiGroup);
    if (match) {
      filterMemberOrgId.value = match.id;
    }
  }
}, { immediate: true });

function filterCandidateVolunteers(baseList) {
  const allowedOrgIds = filterMemberOrgId.value ? orgsStore.getDescendantOrgIds(filterMemberOrgId.value) : null;
  const kw = memberSearchKeyword.value ? memberSearchKeyword.value.toLowerCase().trim() : null;

  return baseList.filter(m => {
    if (allowedOrgIds && !allowedOrgIds.includes(m.orgId)) return false;
    if (kw) {
      const matchName = (m.name || '').toLowerCase().includes(kw);
      const matchPhone = (m.phone || '').includes(kw);
      const matchCode = (m.volunteerCode || '').includes(kw);
      const matchDharma = (m.dharmaName || '').toLowerCase().includes(kw);
      if (!matchName && !matchPhone && !matchCode && !matchDharma) return false;
    }
    return true;
  });
}

const filteredRuleMembers = computed(() => {
  const isMale = (activeRule.value?.genderType === '男');
  return filterCandidateVolunteers(isMale ? maleMembers.value : femaleMembers.value);
});

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

function transferSequentialMember(fromList, toList, idx, targetTrackLabel = '另一名冊') {
  if (!fromList || !toList || idx < 0 || idx >= fromList.length) return;
  const memberName = fromList[idx];
  fromList.splice(idx, 1);
  if (!toList.includes(memberName)) {
    toList.push(memberName);
  }
  toast.info(`已將「${memberName}」移至${targetTrackLabel}輪值名冊（請記得點擊儲存規則）`);
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

// ─── 個人排班彈性限制管理 ───
const showConstraintModal = ref(false);
const constraintForm = ref({
  memberName: '',
  mode: 'none', // 'none' | 'allowed' | 'excluded' | 'preferred'
  days: [],
  skipBehavior: 'defer_payback',
  dateRanges: [],
  note: ''
});

const currentRuleAllRosterNames = computed(() => {
  if (!activeRule.value) return [];
  const names = new Set();
  if (Array.isArray(activeRule.value.weekdayMembers)) {
    activeRule.value.weekdayMembers.forEach(n => { if (n) names.add(n.trim()); });
  }
  if (Array.isArray(activeRule.value.weekendMembers)) {
    activeRule.value.weekendMembers.forEach(n => { if (n) names.add(n.trim()); });
  }
  if (activeRule.value.weekdayTeams && typeof activeRule.value.weekdayTeams === 'object') {
    Object.values(activeRule.value.weekdayTeams).forEach(teams => {
      if (Array.isArray(teams)) {
        teams.forEach(t => {
          (t.members || []).forEach(n => { if (n) names.add(n.trim()); });
        });
      }
    });
  }
  if (activeRule.value.memberConstraints && typeof activeRule.value.memberConstraints === 'object') {
    Object.keys(activeRule.value.memberConstraints).forEach(n => { if (n) names.add(n.trim()); });
  }
  return Array.from(names);
});

const activeConstraintEntries = computed(() => {
  if (!activeRule.value?.memberConstraints || typeof activeRule.value.memberConstraints !== 'object') {
    return [];
  }
  const entries = [];
  for (const [memberName, raw] of Object.entries(activeRule.value.memberConstraints)) {
    const normalized = normalizeMemberConstraint(raw);
    if (normalized) {
      entries.push({
        memberName,
        constraint: normalized,
        badgeText: formatMemberConstraintBadge(normalized)
      });
    }
  }
  return entries;
});

function getMemberConstraintBadgeText(name) {
  if (!name || !activeRule.value) return '';
  const c = getMemberConstraint(activeRule.value, name);
  return c ? formatMemberConstraintBadge(c) : '';
}

function getMemberConstraintBadgeClass(name) {
  if (!name || !activeRule.value) return '';
  const c = getMemberConstraint(activeRule.value, name);
  if (!c) return '';
  if (c.excludedDays.length > 0) return 'badge-constraint-excluded';
  if (c.allowedDays.length > 0) return 'badge-constraint-allowed';
  if (c.preferredDays.length > 0) return 'badge-constraint-preferred';
  return 'badge-constraint-leave';
}

function hasExistingConstraint(name) {
  if (!name || !activeRule.value?.memberConstraints) return false;
  return !!normalizeMemberConstraint(activeRule.value.memberConstraints[name.trim()]);
}

function loadConstraintIntoForm(name) {
  const clean = (name || '').trim();
  const c = clean && activeRule.value ? getMemberConstraint(activeRule.value, clean) : null;
  if (c) {
    constraintForm.value = {
      memberName: clean,
      mode: c.mode || 'none',
      days: [...(c.days || [])],
      skipBehavior: c.skipBehavior || 'defer_payback',
      dateRanges: JSON.parse(JSON.stringify(c.dateRanges || [])),
      note: c.note || ''
    };
  } else {
    constraintForm.value = {
      memberName: clean,
      mode: 'none',
      days: [],
      skipBehavior: 'defer_payback',
      dateRanges: [],
      note: ''
    };
  }
}

function openConstraintModal(memberName = '') {
  loadConstraintIntoForm(memberName);
  showConstraintModal.value = true;
}

function onConstraintMemberSelect(memberName) {
  loadConstraintIntoForm(memberName);
}

function applyConstraintPreset(mode, days = [], note = '') {
  constraintForm.value.mode = mode;
  constraintForm.value.days = [...days];
  constraintForm.value.note = note;
}

function toggleConstraintDay(dayNum) {
  const idx = constraintForm.value.days.indexOf(dayNum);
  if (idx >= 0) {
    constraintForm.value.days.splice(idx, 1);
  } else {
    constraintForm.value.days.push(dayNum);
  }
}

function addConstraintDateRange() {
  const today = new Date().toISOString().substring(0, 10);
  constraintForm.value.dateRanges.push({
    startDate: today,
    endDate: today,
    reason: '請假'
  });
}

function handleSaveConstraintModal() {
  if (!activeRule.value) return;
  const cleanName = (constraintForm.value.memberName || '').trim();
  if (!cleanName) return;

  if (!activeRule.value.memberConstraints) {
    activeRule.value.memberConstraints = {};
  }

  const normalized = normalizeMemberConstraint({
    mode: constraintForm.value.mode,
    days: constraintForm.value.days,
    skipBehavior: constraintForm.value.skipBehavior,
    dateRanges: constraintForm.value.dateRanges,
    note: constraintForm.value.note
  });

  if (normalized) {
    activeRule.value.memberConstraints[cleanName] = normalized;
    toast.success(`已設定「${cleanName}」的彈性規則：${formatMemberConstraintBadge(normalized)}（請記得點擊儲存此規則）`);
  } else {
    delete activeRule.value.memberConstraints[cleanName];
    toast.info(`已清除「${cleanName}」的個人排班限制`);
  }
  showConstraintModal.value = false;
}

function removeMemberConstraint(memberName) {
  if (!activeRule.value?.memberConstraints || !memberName) return;
  const clean = memberName.trim();
  delete activeRule.value.memberConstraints[clean];
  toast.info(`已移除「${clean}」的個人排班限制（請記得點擊儲存此規則）`);
}

function handleApplyDefaultDonggangConstraints() {
  if (!activeRule.value) return;
  if (!activeRule.value.memberConstraints) {
    activeRule.value.memberConstraints = {};
  }
  Object.assign(
    activeRule.value.memberConstraints,
    JSON.parse(JSON.stringify(DEFAULT_DONGGANG_MALE_MEMBER_CONSTRAINTS))
  );
  toast.success('已載入東港男眾預設彈性規則（共 7 位師兄設定），請點擊「💾 儲存此規則」保存！');
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
    activeRule.value.quota = Number(activeRule.value.quota) || activeRuleQuota.value;
    await dutyRulesStore.saveRule(activeRule.value);
    toast.success(`「${activeRule.value.ruleName || '排班規則'}」已成功儲存！`);
  } catch (err) {
    toast.error('儲存規則失敗：' + err.message);
  } finally {
    savingRule.value = false;
  }
}

function onNewRuleShiftChange() {
  newRuleForm.value.quota = getStandardShiftQuota(
    newRuleForm.value.location,
    newRuleForm.value.shiftId,
    newRuleForm.value.genderType
  );
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
    quota: 4,
    ruleType: 'weekday_group_rotation'
  };
  showCreateModal.value = true;
}

async function handleCreateRuleSubmit() {
  const shiftLabels = {
    'YL_F': '女眾班',
    'YL_M': '男眾班(早晚班)',
    'YL_M1': '男眾一班',
    'YL_M2': '男眾二班',
    'DG_F': '女眾班',
    'DG_M': '男眾班'
  };
  const determinedQuota = Number(newRuleForm.value.quota) || getStandardShiftQuota(
    newRuleForm.value.location, 
    newRuleForm.value.shiftId, 
    newRuleForm.value.genderType
  );
  const newRule = {
    id: `rule_${Date.now()}`,
    ruleName: newRuleForm.value.ruleName,
    location: newRuleForm.value.location,
    heqiGroup: newRuleForm.value.heqiGroup,
    shiftId: newRuleForm.value.shiftId,
    shiftLabel: shiftLabels[newRuleForm.value.shiftId] || '值班',
    genderType: newRuleForm.value.genderType,
    quota: determinedQuota,
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
  const [locs, rot, males, females] = await Promise.all([
    locationsStore.fetchLocations(),
    dutyRulesStore.fetchWeekRotation('宜蘭園區'),
    membersStore.fetchMembers({ gender: '男' }),
    membersStore.fetchMembers({ gender: '女' }),
    dutyRulesStore.fetchRules(),
    orgsStore.fetchOrgs()
  ]);

  if (rot) {
    rotationForm.value = { ...DEFAULT_WEEK_ROTATION, ...rot };
  }

  maleMembers.value = Array.isArray(males) ? males : [];
  femaleMembers.value = Array.isArray(females) ? females : [];

  if (dutyRulesStore.rules && dutyRulesStore.rules.length > 0) {
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

/* 個人彈性限制徽章與星期按鈕樣式 */
.constraint-mini-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.08rem 0.42rem;
  border-radius: 9999px;
  line-height: 1.3;
  white-space: nowrap;
}
.badge-constraint-allowed {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}
.badge-constraint-excluded {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}
.badge-constraint-preferred {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}
.badge-constraint-leave {
  background: #f3e8ff;
  color: #6b21a8;
  border: 1px solid #d8b4fe;
}

.mode-radio-card {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.6rem;
  background: #ffffff;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}
.mode-radio-card:hover {
  border-color: var(--primary-400);
}
.mode-radio-active {
  border-color: var(--primary-600);
  background: var(--primary-50);
  box-shadow: 0 0 0 1px var(--primary-500);
}

.day-toggle-btn {
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--gray-300);
  background: #ffffff;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--gray-700);
  cursor: pointer;
  transition: all 0.15s;
}
.day-toggle-allowed {
  background: #2563eb;
  color: #ffffff;
  border-color: #1d4ed8;
}
.day-toggle-excluded {
  background: #dc2626;
  color: #ffffff;
  border-color: #b91c1c;
}
.day-toggle-preferred {
  background: #d97706;
  color: #ffffff;
  border-color: #b45309;
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
