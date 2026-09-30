<template>
  <div class="admin-duty-form">
    <!-- 頂部浮動固定控制與篩選面板 -->
    <div class="sticky-control-panel">
      <!-- 頂部導航與標題 -->
      <div class="flex items-center justify-between mb-3 flex-wrap gap-4 bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
        <div>
          <h1 class="text-2xl font-bold m-0 flex items-center gap-2">📝 編輯月度值班表</h1>
          <p class="text-sm text-muted m-0 mt-1">
            已排班進度：<strong class="text-primary">{{ assignedTotalCount }} / {{ matrixList.length }} 席</strong>
            <span v-if="conflictList.length > 0" class="text-danger font-bold ml-2">
              ⚠️ 發現 {{ conflictList.length }} 處跨場地/時段排班衝突！
            </span>
          </p>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <router-link to="/admin/duty-rules" class="btn btn-outline" title="設定組別名冊與週輪值">
            ⚙️ 規則設定
          </router-link>
          <button 
            class="btn btn-accent" 
            @click="openAutoScheduleModal"
          >
            🤖 依規則自動排班
          </button>
          <button 
            type="button"
            class="btn btn-outline text-danger border-danger hover:bg-red-50"
            :disabled="loading || clearing"
            @click="showClearModal = true"
            title="一鍵刪除整月或指定週次排班"
          >
            🗑️ 刪除排班
          </button>
          <button 
            type="button"
            class="btn btn-outline"
            @click="showExportModal = true"
            title="匯出指定區間或全月排班名單 (Excel / PDF)"
          >
            📤 匯出名冊
          </button>
          <router-link to="/admin/duty-schedule" class="btn btn-outline">
            ← 返回值班月曆
          </router-link>
          <button 
            class="btn btn-primary" 
            :class="{ 'btn-danger': conflictList.length > 0 }"
            :disabled="saving || clearing" 
            @click="handleSave"
          >
            {{ saving ? '儲存中...' : (conflictList.length > 0 ? '⚠️ 存在衝突請先修正' : '💾 儲存本月排班表') }}
          </button>
        </div>
      </div>

      <!-- 衝突警告 Banner -->
      <div v-if="conflictList.length > 0" class="card conflict-banner mb-3 p-3">
        <div class="flex items-start gap-3">
          <span class="text-2xl">⚠️</span>
          <div class="flex-1">
            <h4 class="font-bold text-danger mb-1 text-sm">檢測到重複排班衝突（不可同一人在同日排在不同場地）：</h4>
            <ul class="text-xs text-gray-700 pl-4 list-disc space-y-0.5">
              <li v-for="(c, idx) in conflictList" :key="idx">
                <strong>{{ c.dateStr }}</strong>：志工「<strong class="text-primary">{{ c.memberName }}</strong>」已在【<strong>{{ c.otherLocation }}</strong> - {{ c.otherShiftLabel }}】排班，不可重複排入當前場地！
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 1. 場地與月份選擇控制卡片 -->
      <div class="card mb-0 p-4 bg-white shadow-sm">
        <div class="duty-control-row">
          <div class="form-group mb-0">
            <label class="form-label font-bold">1. 選擇場地：</label>
            <select v-model="selectedLocation" class="form-select" @change="initMatrix">
              <option value="宜蘭園區">宜蘭園區</option>
              <option value="東港聯絡處">東港聯絡處</option>
            </select>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold">2. 選擇月份：</label>
            <input v-model="selectedMonth" type="month" class="form-input" @change="initMatrix" />
          </div>

          <div class="form-group mb-0">
            <button class="btn btn-secondary btn-block" :disabled="loading" @click="initMatrix">
              {{ loading ? '載入中...' : '🔄 重新整理 / 載入排班表' }}
            </button>
          </div>
        </div>

        <!-- 快速過濾列 -->
        <div class="flex items-center justify-between border-t mt-4 pt-3 flex-wrap gap-3">
          <div class="flex items-center gap-2 flex-wrap flex-1">
            <span class="text-xs font-bold text-gray-700 whitespace-nowrap">🔍 快速過濾志工：</span>
            <select v-model="filterOrgId" class="form-select form-select-sm" style="max-width: 280px;">
              <option value="">-- 全部組織架構 (不限) --</option>
              <option v-for="opt in formattedOrgOptions" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>

            <input 
              v-model="searchKeyword" 
              type="text" 
              class="form-input form-input-sm" 
              placeholder="搜尋姓名/電話/法號..." 
              style="max-width: 180px;"
            />
            <button v-if="filterOrgId || searchKeyword" class="btn btn-xs btn-outline" @click="clearFilters">
              重設篩選
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card text-center p-8">
      <p class="text-muted text-lg">載入排班表與志工資料中...</p>
    </div>

    <!-- 每日值班名單填寫 (按週次分組組織) -->
    <div v-else class="weeks-container flex flex-col gap-6">
      <div v-for="week in groupedWeeks" :key="week.weekNum" class="week-section">
        <!-- 週次標題橫條 (含快速刪除本週排班按鈕) -->
        <div class="week-header-bar flex items-center justify-between px-4 py-2.5 rounded-lg mb-3 bg-white border border-gray-200 shadow-sm">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-gray-800 text-sm md:text-base">
              🗓️ 第 {{ week.weekNum }} 週 ({{ week.range }})
            </span>
            <span v-if="selectedLocation === '宜蘭園區'" class="badge badge-primary text-xs">
              {{ week.heqi }}值週
            </span>
            <span class="text-xs text-muted">
              已排 {{ week.assignedCount }} / {{ week.totalCount }} 席
            </span>
          </div>

          <button 
            type="button" 
            class="btn btn-xs btn-outline text-danger border-danger hover:bg-red-50 flex items-center gap-1"
            :disabled="clearing || week.assignedCount === 0"
            @click="handleDeleteWeek(week)"
            :title="week.assignedCount === 0 ? '本週尚無排班' : '一鍵刪除此週排班'"
          >
            🗑️ 刪除此週排班
          </button>
        </div>

        <!-- 該週內的每日值班卡片清單 -->
        <div class="days-container flex flex-col gap-4">
          <div 
            v-for="day in week.days" 
            :key="day.dateStr" 
            class="card day-block-card"
            :class="{ 'weekend-highlight': day.isWeekend, 'has-conflict': dayHasConflict(day.dateStr) }"
          >
            <!-- 日期標題欄 -->
            <div class="day-block-header flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-primary font-bold text-lg">🗓️ {{ day.dateStr }}</span>
                <span class="badge" :class="day.isWeekend ? 'badge-warning' : 'badge-gray'">
                  {{ day.dayOfWeek }}
                </span>
                <span v-if="dayHasConflict(day.dateStr)" class="badge badge-danger">
                  ⚠️ 此日期有衝突
                </span>
              </div>
              <span class="text-xs text-muted">
                已排定 {{ day.slots.filter(s => !!s.memberName).length }} / {{ day.slots.length }} 席
              </span>
            </div>

            <!-- 班次分區網格 -->
            <div class="grid grid-cols-2 gap-4 mt-4">
              <div 
                v-for="shiftGroup in day.shiftGroups" 
                :key="shiftGroup.shiftId" 
                class="shift-group-box"
                :class="shiftGroup.genderType === '男' ? 'box-male' : 'box-female'"
              >
                <!-- 班次標題 -->
                <div class="shift-group-title flex items-center justify-between mb-3">
                  <span class="font-bold text-sm text-gray-800">
                    {{ shiftGroup.shiftLabel }} ({{ shiftGroup.timeRange }}) - {{ shiftGroup.genderType }}眾 ({{ shiftGroup.quota }}位)
                  </span>
                </div>

                <!-- 各個席位下拉選單 -->
                <div class="slots-list flex flex-col gap-2">
                  <div 
                    v-for="slot in shiftGroup.slots" 
                    :key="slot.id" 
                    class="slot-row flex items-center gap-2"
                    :class="{ 'slot-conflict': slotConflictInfo(slot) }"
                  >
                    <div class="flex-1">
                      <select 
                        v-model="slot.memberId" 
                        class="form-select form-select-sm"
                        :class="{ 'border-danger': slotConflictInfo(slot) }"
                        @change="onSlotMemberChange(slot)"
                      >
                        <option value="">-- 未指派 --</option>
                        <!-- 若已指派志工不在目前過濾條件中，固定列於首位 -->
                        <option 
                          v-if="slot.memberId && !isVolunteerInFilteredList(slot.memberId, slot.genderType)"
                          :value="slot.memberId"
                        >
                          ★ {{ slot.memberName }} {{ getMemberOrgPathText(slot.memberId) }}
                        </option>
                        <option 
                          v-for="m in getFilteredVolunteers(slot.genderType)" 
                          :key="m.id" 
                          :value="m.id"
                        >
                          {{ m.name }} {{ getMemberOrgPathText(m.id) }} [本月: {{ getMemberShiftCount(m.name) }}班]
                        </option>
                      </select>
                      <span v-if="slotConflictInfo(slot)" class="text-xs text-danger font-bold block mt-1">
                        ⚠️ {{ slotConflictInfo(slot) }}
                      </span>
                    </div>

                    <button 
                      v-if="slot.memberId || slot.memberName" 
                      class="btn btn-sm btn-outline btn-clear" 
                      @click="clearSlot(slot)" 
                      title="清空此席位"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 依規則自動排班彈出視窗 (Auto Schedule Modal) -->
    <div v-if="showAutoModal" class="modal-backdrop" @click="showAutoModal = false">
      <div class="modal-content" style="max-width: 820px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title flex items-center gap-2">
              🤖 依規則自動排班 — {{ autoStartDate && autoEndDate ? `${autoStartDate} ~ ${autoEndDate}` : selectedMonth }} ({{ selectedLocation }})
            </h3>
            <p class="text-xs text-muted mt-1">
              依據「{{ currentSelectedAutoRule?.ruleName || '所選排班規則' }}」{{ currentSelectedAutoRule?.ruleType === 'weekday_weekend_sequential' ? '（平假日雙軌循序輪替）' : '（星期 × 整組循環輪替）' }}自動產生排班建議，每班基本席次需求：{{ currentSelectedAutoRuleQuota }} 席
            </p>
          </div>
          <button class="modal-close" @click="showAutoModal = false">×</button>
        </div>

        <div class="modal-body flex flex-col gap-4">
          <!-- 選擇排班規則 (自適應當前道場各班次規則與需求席次) -->
          <div v-if="availableAutoRules.length > 0" class="card p-3 border bg-gray-50/70 shadow-xs">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label class="form-label font-bold text-xs m-0 flex items-center gap-1.5 text-primary">
                <span>📋 選擇套用排班規則：</span>
              </label>
              <span v-if="currentSelectedAutoRule" class="badge badge-primary text-xs font-bold">
                每班基本席次需求：{{ currentSelectedAutoRuleQuota }} 席
              </span>
            </div>
            <select v-model="selectedAutoRuleId" class="form-select form-select-sm" @change="onAutoRuleChange">
              <option v-for="r in availableAutoRules" :key="r.id" :value="r.id">
                {{ r.ruleName }} ({{ r.shiftLabel }} / {{ r.genderType }}眾 / {{ r.ruleType === 'weekday_weekend_sequential' ? '平假日雙軌' : '星期整組' }} - 每班 {{ getRuleQuota(r) }} 席)
              </option>
            </select>
          </div>

          <!-- A. 宜蘭園區和氣組隊值週規則：週次速覽與快速區間切換 -->
          <div v-if="currentSelectedAutoRule?.ruleType === 'weekday_group_rotation' && selectedLocation === '宜蘭園區'" class="card p-3 bg-gray-50 border">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h4 class="text-xs font-bold text-gray-700 m-0">🗓️ 本月週次負責和氣（點擊標籤可直接填入排班區間）：</h4>
              <div class="flex items-center gap-1">
                <button type="button" class="btn btn-xs btn-outline" @click="resetToFullMonth">
                  整月
                </button>
                <button 
                  v-if="firstHeqi2Week" 
                  type="button" 
                  class="btn btn-xs btn-primary btn-outline"
                  @click="setQuickRange(firstHeqi2Week.fullStartDate, firstHeqi2Week.fullEndDate)"
                >
                  僅和氣二週 ({{ firstHeqi2Week.range }})
                </button>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button 
                v-for="w in currentMonthWeekInfo" 
                :key="w.range" 
                type="button"
                class="badge text-xs py-1 px-2.5 cursor-pointer border transition-all"
                :class="w.isHeqi2 ? 'badge-primary font-bold shadow-sm' : 'badge-gray hover:bg-gray-200'"
                @click="setQuickRange(w.fullStartDate, w.fullEndDate)"
                title="點擊設定排班區間為此週"
              >
                {{ w.range }}：{{ w.heqi }} {{ w.isHeqi2 ? '★(和氣二值週)' : '' }}
              </button>
            </div>
          </div>

          <!-- B. 平假日雙軌循序輪替規則 (如東港聯絡處男眾) -->
          <div v-else-if="currentSelectedAutoRule?.ruleType === 'weekday_weekend_sequential'" class="card p-3 bg-blue-50/40 border border-blue-200">
            <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h4 class="text-xs font-bold text-primary m-0">🌊 {{ currentSelectedAutoRule.ruleName }}（平日/假日雙軌循環輪替）：</h4>
              <div class="flex items-center gap-1">
                <button type="button" class="btn btn-xs btn-outline" @click="resetToFullMonth">
                  重設整月 ({{ selectedMonth }})
                </button>
              </div>
            </div>
            <p class="text-xs text-muted m-0">
              平日（週一至週五）與假日（週六至週日）分別依序排入席位。若遇宜蘭園區排班衝突，以園區為優先，東港自動順延由下一位志工接替！
            </p>
          </div>

          <!-- C. 非園區星期整組輪替規則 (如東港聯絡處女眾或未來其他道場) -->
          <div v-else class="card p-3 bg-emerald-50/40 border border-emerald-200">
            <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h4 class="text-xs font-bold text-emerald-800 m-0">🌸 {{ currentSelectedAutoRule?.ruleName || '星期整組排班規則' }}（整月常態輪值）：</h4>
              <div class="flex items-center gap-1">
                <button type="button" class="btn btn-xs btn-outline" @click="resetToFullMonth">
                  重設整月 ({{ selectedMonth }})
                </button>
              </div>
            </div>
            <p class="text-xs text-muted m-0">
              依週一至週日各組別名冊常態循序輪替（每班需求 {{ currentSelectedAutoRuleQuota }} 席，多出志工下次自動備用輪替遞補）。
            </p>
          </div>

          <!-- 自訂排班日期區間控制 -->
          <div class="card p-3 border bg-blue-50/20">
            <label class="form-label font-bold text-sm mb-2 flex items-center justify-between">
              <span>📅 自訂自動排班日期區間：</span>
              <span class="text-xs font-normal text-muted">
                （將僅針對此區間內之日期執行規則排班）
              </span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span class="text-xs text-muted block mb-1">開始日期 (Start Date)：</span>
                <input 
                  v-model="autoStartDate" 
                  type="date" 
                  class="form-input form-input-sm" 
                  @change="runAutoPreview" 
                />
              </div>
              <div>
                <span class="text-xs text-muted block mb-1">結束日期 (End Date)：</span>
                <input 
                  v-model="autoEndDate" 
                  type="date" 
                  class="form-input form-input-sm" 
                  @change="runAutoPreview" 
                />
              </div>
            </div>
          </div>

          <!-- 自訂輪值起始設定 (依規則自訂起始組別或起始志工) -->
          <div class="card p-3 border bg-amber-50/30 border-amber-200 shadow-xs">
            <!-- 模式 1：星期整組循序輪替規則 (例如宜蘭女眾、東港女眾) -->
            <div v-if="currentSelectedAutoRule?.ruleType === 'weekday_group_rotation'">
              <div class="flex items-center justify-between mb-2 flex-wrap gap-1">
                <label class="form-label font-bold text-xs text-amber-900 m-0 flex items-center gap-1.5">
                  <span>🎯 自訂本次排班起始組別：</span>
                </label>
                <span class="text-xs text-muted">
                  （指定排班區間第 1 週開始輪值的組別，往後依週次循序遞增輪替）
                </span>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <select 
                  v-model="customStartTeamIndex" 
                  class="form-select form-select-sm font-bold text-gray-800" 
                  style="max-width: 320px;"
                  @change="runAutoPreview"
                >
                  <option value="">⚙️ 系統預設（依標準週次自動推算）</option>
                  <option 
                    v-for="t in availableStartTeams" 
                    :key="t.index" 
                    :value="t.index"
                  >
                    {{ t.label }}
                  </option>
                </select>
                <span v-if="customStartTeamIndex !== ''" class="badge badge-primary text-xs py-1 px-2.5 font-bold">
                  ✓ 本次將自【{{ availableStartTeams.find(t => t.index === Number(customStartTeamIndex))?.label || `第 ${Number(customStartTeamIndex) + 1} 組` }}】開始輪值
                </span>
              </div>
            </div>

            <!-- 模式 2：平日/假日雙軌循序循環輪替規則 (例如東港男眾) -->
            <div v-else-if="currentSelectedAutoRule?.ruleType === 'weekday_weekend_sequential'">
              <div class="flex items-center justify-between mb-2 flex-wrap gap-1">
                <label class="form-label font-bold text-xs text-blue-900 m-0 flex items-center gap-1.5">
                  <span>🎯 自訂本次排班起始輪值人員：</span>
                </label>
                <span class="text-xs text-muted">
                  （可分別指定平日與假日自哪一位志工開始循序輪替）
                </span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span class="text-xs font-bold text-gray-700 block mb-1">🏢 平日輪值起始志工：</span>
                  <select 
                    v-model="customStartWeekdayMember" 
                    class="form-select form-select-sm font-bold"
                    @change="runAutoPreview"
                  >
                    <option value="">
                      ⚙️ 接續上次指標（目前為：{{ currentWeekdayPointerMember || '第一位' }}）
                    </option>
                    <option 
                      v-for="(name, idx) in availableWeekdayMembers" 
                      :key="idx" 
                      :value="name"
                    >
                      {{ idx + 1 }}. {{ name }}
                    </option>
                  </select>
                </div>

                <div>
                  <span class="text-xs font-bold text-gray-700 block mb-1">🏖️ 假日輪值起始志工：</span>
                  <select 
                    v-model="customStartWeekendMember" 
                    class="form-select form-select-sm font-bold"
                    @change="runAutoPreview"
                  >
                    <option value="">
                      ⚙️ 接續上次指標（目前為：{{ currentWeekendPointerMember || '第一位' }}）
                    </option>
                    <option 
                      v-for="(name, idx) in availableWeekendMembers" 
                      :key="idx" 
                      :value="name"
                    >
                      {{ idx + 1 }}. {{ name }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 排班選項控制 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 園區和氣值週模式選擇 -->
            <div v-if="currentSelectedAutoRule?.ruleType === 'weekday_group_rotation' && selectedLocation === '宜蘭園區'" class="card p-3 border">
              <label class="form-label font-bold text-sm mb-2">1. 選擇排班模式：</label>
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="autoScheduleMode" 
                    type="radio" 
                    value="heqi_only" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>僅排和氣二負責週次</strong>
                    <small class="text-muted block text-xs">（符合四個和氣每週輪替規範）</small>
                  </span>
                </label>

                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="autoScheduleMode" 
                    type="radio" 
                    value="force_heqi2" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>全月套用和氣二規則</strong>
                    <small class="text-muted block text-xs">（強制/測試模式：全月女眾班均由和氣二排入）</small>
                  </span>
                </label>
              </div>
            </div>

            <!-- 平假日雙軌輪替說明 -->
            <div v-else-if="currentSelectedAutoRule?.ruleType === 'weekday_weekend_sequential'" class="card p-3 border">
              <label class="form-label font-bold text-sm mb-2">1. 男眾平假日輪替方式：</label>
              <div class="text-xs text-gray-700 space-y-1.5">
                <div class="flex items-center gap-1.5 font-bold text-primary">
                  <span>🔄 平日/假日雙軌循序循環輪值</span>
                </div>
                <div class="text-muted leading-relaxed">
                  系統將於指定排班區間內，平日與假日名冊自動循序推進排班（各 1 席）。遇園區值班人員自動順延至下一位志工接替。
                </div>
              </div>
            </div>

            <!-- 常態星期整組輪值說明 -->
            <div v-else class="card p-3 border">
              <label class="form-label font-bold text-sm mb-2">1. 女眾整組輪替方式：</label>
              <div class="text-xs text-gray-700 space-y-1.5">
                <div class="flex items-center gap-1.5 font-bold text-emerald-700">
                  <span>📅 星期整組循序輪替（每班 {{ currentSelectedAutoRuleQuota }} 席）</span>
                </div>
                <div class="text-muted leading-relaxed">
                  系統將依指定排班區間內之星期，自動自該星期的組別名冊循序排入整組志工。組員超額時自動啟用備用輪替並推進指標。
                </div>
              </div>
            </div>

            <div class="card p-3 border">
              <label class="form-label font-bold text-sm mb-2">2. 既有排班處理方式：</label>
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="overwriteStrategy" 
                    type="radio" 
                    value="overwrite" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>⚡ 覆蓋全部席位</strong>
                    <small class="text-muted block text-xs">（清除目標時段現有名冊，依規則完整重填）</small>
                  </span>
                </label>

                <label class="flex items-center gap-2 text-sm cursor-pointer">
                  <input 
                    v-model="overwriteStrategy" 
                    type="radio" 
                    value="empty_only" 
                    @change="runAutoPreview"
                  />
                  <span>
                    <strong>📝 僅填入空白未指派席位</strong>
                    <small class="text-muted block text-xs">（保留目前已手動排好的志工人員）</small>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- 衝突檢測與備用人員提示 -->
          <div v-if="autoPreviewResult?.conflicts?.length > 0" class="card conflict-banner p-3">
            <h4 class="font-bold text-danger text-sm mb-1 flex items-center gap-1">
              <span>⚠️ 偵測到 {{ autoPreviewResult.conflicts.length }} 筆跨場地排班衝突：</span>
            </h4>
            <p class="text-xs text-danger mb-2">
              依排班衝突處理原則：<strong>以園區排班為優先</strong>{{ selectedLocation === '東港聯絡處' ? '，東港已自動為衝突日期順延由下一位志工接替！' : '，建議於套用後前往東港聯絡處調動志工！' }}
            </p>
            <ul class="text-xs text-gray-700 pl-4 list-disc space-y-1">
              <li v-for="(c, idx) in autoPreviewResult.conflicts" :key="idx">
                <strong>{{ c.dateStr }}</strong>：志工「<strong class="text-primary">{{ c.memberName }}</strong>」原已排在【{{ c.otherLocation }} - {{ c.otherShift }}】
                <span v-if="c.replaceName" class="text-emerald-700 font-bold ml-1">
                  ➔ 東港已自動改由「{{ c.replaceName }}」接替
                </span>
              </li>
            </ul>
          </div>

          <!-- 備用人員提示（組員超過基本席次需求） -->
          <div v-if="autoPreviewResult?.standbyList?.length > 0" class="card p-3 bg-amber-50 border border-amber-200">
            <h4 class="font-bold text-amber-800 text-xs mb-1 flex items-center gap-1">
              <span>🔄 備用輪替機制已生效（組員超過該班次基本需求席次，本次未排班之備用人員）：</span>
            </h4>
            <div class="flex items-center gap-2 flex-wrap">
              <span 
                v-for="(st, idx) in autoPreviewResult.standbyList" 
                :key="idx" 
                class="badge badge-warning text-xs py-1 px-2"
              >
                {{ st.dateStr }} ({{ st.teamName }}) 備用：{{ st.standbys.join('、') }}
              </span>
            </div>
          </div>

          <!-- 預覽排班成果明細 -->
          <div class="preview-results-box border rounded-lg p-3 bg-white max-h-[320px] overflow-y-auto">
            <div class="flex items-center justify-between mb-2">
              <strong class="text-sm text-gray-800">
                📋 排班預覽明細（預計排定 {{ autoPreviewResult?.scheduledDetails?.length || 0 }} 天）：
              </strong>
              <span class="text-xs text-muted">
                {{ selectedLocation === '東港聯絡處' ? '平日/假日雙軌輪替' : (autoScheduleMode === 'heqi_only' ? '僅和氣二週次' : '全月模式') }} / {{ overwriteStrategy === 'overwrite' ? '覆蓋全部' : '僅填空白' }}
              </span>
            </div>

            <div class="space-y-2">
              <div 
                v-for="item in autoPreviewResult?.scheduledDetails" 
                :key="item.dateStr" 
                class="card p-2.5 flex items-center justify-between border text-xs"
                :class="item.heqi === '和氣二' || item.heqi === '假日組' ? 'bg-pink-50/30' : 'bg-gray-50/50'"
              >
                <div class="flex items-center gap-2">
                  <span class="font-bold text-primary text-sm">{{ item.dateStr }}</span>
                  <span class="badge badge-info">{{ item.dayOfWeek === '0' ? '週日' : '週' + ['日','一','二','三','四','五','六'][Number(item.dayOfWeek)] }}</span>
                  <span class="badge badge-gray">{{ item.heqi }}</span>
                  <strong class="text-gray-700 ml-1">{{ item.teamName }}</strong>
                  <span v-if="item.adjustedFrom" class="badge badge-warning text-[10px]" title="因園區排班衝突順延接替">
                    🔄 順延接替 {{ item.adjustedFrom }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5 flex-wrap">
                  <span 
                    v-for="(m, mIdx) in item.assignedMembers" 
                    :key="mIdx" 
                    class="badge badge-primary py-0.5 px-2"
                  >
                    {{ m }}
                  </span>
                  <span v-if="item.standbys?.length > 0" class="text-muted text-[11px]">
                    (備用: {{ item.standbys.join(',') }})
                  </span>
                </div>
              </div>

              <div v-if="!autoPreviewResult || autoPreviewResult.scheduledDetails.length === 0" class="text-center py-6 text-muted">
                本月在此條件下無符合排班的日期（請檢查和氣週輪值設定，或切換為全月套用模式）
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-between">
          <router-link to="/admin/duty-rules" class="btn btn-outline btn-sm">
            ⚙️ 調整組別名冊與週輪值規則
          </router-link>

          <div class="flex items-center gap-2">
            <button class="btn btn-outline btn-sm" :disabled="savingAutoSchedule" @click="showAutoModal = false">
              取消
            </button>
            <button 
              class="btn btn-primary btn-sm" 
              :disabled="savingAutoSchedule || !autoPreviewResult || autoPreviewResult.scheduledDetails.length === 0"
              @click="applyAutoSchedule"
            >
              {{ savingAutoSchedule ? '儲存資料庫中...' : '💾 確認套用並自動儲存至資料庫' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 一鍵刪除/清空排班彈出視窗 (Clear Schedule Modal) -->
    <div v-if="showClearModal" class="modal-backdrop" @click="showClearModal = false">
      <div class="modal-content" style="max-width: 620px;" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title flex items-center gap-2 text-danger">
              🗑️ 刪除 / 清空排班席位
            </h3>
            <p class="text-xs text-muted mt-1">
              場地：<strong>{{ selectedLocation }}</strong> ｜ 月份：<strong>{{ selectedMonth }}</strong>
            </p>
          </div>
          <button class="modal-close" @click="showClearModal = false">×</button>
        </div>

        <div class="modal-body flex flex-col gap-4">
          <!-- 區塊 1：整月排班刪除 -->
          <div class="card p-4 border border-red-200 bg-red-50/40">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-bold text-danger text-sm m-0 flex items-center gap-1.5">
                <span>🗓️ 整月排班一鍵刪除</span>
              </h4>
              <span class="badge badge-gray text-xs">
                目前全月已排：<strong class="text-primary">{{ assignedTotalCount }} / {{ matrixList.length }}</strong> 席
              </span>
            </div>
            <p class="text-xs text-gray-600 mb-3 leading-relaxed">
              將清空【{{ selectedMonth }}】當月所有日期的已排班名單，並直接同步至資料庫。
            </p>
            <button 
              type="button" 
              class="btn btn-danger btn-sm btn-block flex items-center justify-center gap-1.5"
              :disabled="clearing || assignedTotalCount === 0"
              @click="handleDeleteMonth"
            >
              {{ clearing ? '刪除處理中...' : `🗑️ 一鍵刪除【${selectedMonth}】整月所有排班` }}
            </button>
          </div>

          <!-- 區塊 2：依週次刪除排班 -->
          <div class="card p-4 border">
            <h4 class="font-bold text-gray-800 text-sm mb-2 flex items-center gap-1.5">
              <span>📅 依特定週次刪除排班</span>
            </h4>
            <p class="text-xs text-muted mb-3">
              可僅針對特定週次進行刪除與清空，其餘週次的排班將完整保留：
            </p>

            <div class="space-y-2">
              <div 
                v-for="w in currentMonthWeekInfo" 
                :key="w.weekNum"
                class="flex items-center justify-between p-2.5 border rounded-lg bg-gray-50/70 text-xs hover:bg-gray-100 transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="font-bold text-gray-800">第 {{ w.weekNum }} 週</span>
                  <span class="text-muted">({{ w.range }})</span>
                  <span v-if="selectedLocation === '宜蘭園區'" class="badge badge-primary py-0.5 px-2">
                    {{ w.heqi }}
                  </span>
                  <span class="text-gray-600 ml-1">
                    已排：<strong>{{ getWeekAssignedCount(w) }}</strong> / {{ getWeekTotalSlotsCount(w) }} 席
                  </span>
                </div>

                <button 
                  type="button" 
                  class="btn btn-xs btn-outline text-danger border-danger hover:bg-red-50"
                  :disabled="clearing || getWeekAssignedCount(w) === 0"
                  @click="handleDeleteWeek(w)"
                >
                  🗑️ 刪除此週
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-end">
          <button class="btn btn-outline btn-sm" :disabled="clearing" @click="showClearModal = false">
            關閉
          </button>
        </div>
      </div>
    </div>

    <!-- 匯出排班名冊 Modal (支援自訂區間 / 整月) -->
    <DutyExportModal 
      :show="showExportModal" 
      :default-location="selectedLocation" 
      :default-month="selectedMonth" 
      @close="showExportModal = false" 
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import DutyExportModal from '@/components/duty/DutyExportModal.vue';
import { useDutiesStore } from '@/stores/duties';
import { useDutyRulesStore, getRuleQuota } from '@/stores/dutyRules';
import { useMembersStore } from '@/stores/members';
import { useOrgsStore } from '@/stores/orgs';
import { useToast } from '@/composables/useToast';
import { batchWriteItems } from '@/firebase/db';

const showExportModal = ref(false);

const dutiesStore = useDutiesStore();
const dutyRulesStore = useDutyRulesStore();
const membersStore = useMembersStore();
const orgsStore = useOrgsStore();
const toast = useToast();

const selectedLocation = ref('宜蘭園區');
const selectedMonth = ref(new Date().toISOString().substring(0, 7));
const filterOrgId = ref('');
const searchKeyword = ref('');
const loading = ref(false);
const saving = ref(false);
const clearing = ref(false);
const showClearModal = ref(false);

const matrixList = ref([]);
const otherLocationDuties = ref([]);
const allMembers = ref([]);
const maleMembers = ref([]);
const femaleMembers = ref([]);

function getDayOfWeek(dateStr) {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return days[new Date(dateStr).getDay()];
}

const assignedTotalCount = computed(() => {
  return matrixList.value.filter(s => !!s.memberName).length;
});

const formattedOrgOptions = computed(() => {
  const options = [];
  orgsStore.orgTree.forEach(heqi => {
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

function clearFilters() {
  filterOrgId.value = '';
  searchKeyword.value = '';
}

// 衝突檢測計算與 Map 快取 (O(1) 快速讀取)
const conflictList = computed(() => {
  const conflicts = [];
  const otherLocationName = selectedLocation.value === '宜蘭園區' ? '東港聯絡處' : '宜蘭園區';

  const otherMap = new Map();
  otherLocationDuties.value.forEach(d => {
    if (d.memberName && d.dutyDate) {
      if (!otherMap.has(d.dutyDate)) otherMap.set(d.dutyDate, new Map());
      otherMap.get(d.dutyDate).set(d.memberName, d);
    }
  });

  matrixList.value.forEach(slot => {
    if (slot.memberName && slot.dutyDate) {
      const dayMap = otherMap.get(slot.dutyDate);
      if (dayMap && dayMap.has(slot.memberName)) {
        const otherShift = dayMap.get(slot.memberName);
        conflicts.push({
          dateStr: slot.dutyDate,
          memberName: slot.memberName,
          slotId: slot.id,
          currentShiftLabel: slot.shiftLabel,
          otherLocation: otherLocationName,
          otherShiftLabel: otherShift.shiftLabel || '值班'
        });
      }
    }
  });

  return conflicts;
});

const conflictMap = computed(() => {
  const map = new Map();
  conflictList.value.forEach(c => {
    map.set(c.slotId, `已在【${c.otherLocation} - ${c.otherShiftLabel}】排班`);
  });
  return map;
});

const conflictDateSet = computed(() => {
  return new Set(conflictList.value.map(c => c.dateStr));
});

function dayHasConflict(dateStr) {
  return conflictDateSet.value.has(dateStr);
}

function slotConflictInfo(slot) {
  return conflictMap.value.get(slot.id) || '';
}

// 志工所屬組織路徑文字快取 Map，杜絕在各席位 option 渲染時重複遞迴搜尋 (30,000x 加速)
const memberOrgPathMap = computed(() => {
  const map = new Map();
  const members = allMembers.value;
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (m.id && m.orgId) {
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

// 志工當月排班次數快取 Map，杜絕數萬次重複 filter(matrixList)
const memberShiftCountMap = computed(() => {
  const counts = new Map();
  const list = matrixList.value;
  for (let i = 0; i < list.length; i++) {
    const name = list[i].memberName;
    if (name) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return counts;
});

function getMemberShiftCount(memberName) {
  if (!memberName) return 0;
  return memberShiftCountMap.value.get(memberName) || 0;
}

// 依據篩選條件計算男女志工清單 (computed 快取)
function filterVolunteersByCriteria(baseList) {
  const allowedOrgIds = filterOrgId.value ? orgsStore.getDescendantOrgIds(filterOrgId.value) : null;
  const kw = searchKeyword.value ? searchKeyword.value.toLowerCase().trim() : null;

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

const filteredMaleVolunteers = computed(() => filterVolunteersByCriteria(maleMembers.value));
const filteredFemaleVolunteers = computed(() => filterVolunteersByCriteria(femaleMembers.value));

const filteredMaleVolunteerIds = computed(() => new Set(filteredMaleVolunteers.value.map(m => m.id)));
const filteredFemaleVolunteerIds = computed(() => new Set(filteredFemaleVolunteers.value.map(m => m.id)));

function getFilteredVolunteers(gender) {
  return gender === '男' ? filteredMaleVolunteers.value : filteredFemaleVolunteers.value;
}

function isVolunteerInFilteredList(memberId, gender) {
  if (!memberId) return false;
  return gender === '男' ? filteredMaleVolunteerIds.value.has(memberId) : filteredFemaleVolunteerIds.value.has(memberId);
}

function onSlotMemberChange(slot) {
  const found = allMembers.value.find(m => m.id === slot.memberId);
  slot.memberName = found ? found.name : '';
}

function clearSlot(slot) {
  slot.memberId = '';
  slot.memberName = '';
}

const groupedDays = computed(() => {
  const daysMap = {};
  matrixList.value.forEach(slot => {
    if (!daysMap[slot.dutyDate]) {
      daysMap[slot.dutyDate] = {
        dateStr: slot.dutyDate,
        dayOfWeek: getDayOfWeek(slot.dutyDate),
        isWeekend: slot.isWeekend,
        slots: [],
        shiftGroupsMap: {}
      };
    }
    daysMap[slot.dutyDate].slots.push(slot);

    if (!daysMap[slot.dutyDate].shiftGroupsMap[slot.shiftId]) {
      daysMap[slot.dutyDate].shiftGroupsMap[slot.shiftId] = {
        shiftId: slot.shiftId,
        shiftLabel: slot.shiftLabel,
        timeRange: slot.timeRange || dutiesStore.getShiftTimeRange(selectedLocation.value, slot.shiftId, slot.shiftLabel),
        genderType: slot.genderType,
        quota: slot.quota || (slot.genderType === '男' ? (selectedLocation.value === '東港聯絡處' ? 1 : 2) : (selectedLocation.value === '東港聯絡處' ? 2 : 4)),
        slots: []
      };
    }
    daysMap[slot.dutyDate].shiftGroupsMap[slot.shiftId].slots.push(slot);
  });

  return Object.values(daysMap).map(d => ({
    ...d,
    shiftGroups: Object.values(d.shiftGroupsMap)
  }));
});

// 初始化排班矩陣：精確以標準 Slot ID (例如 宜蘭園區_2026-08-26_YL_M1_1) 進行 1-to-1 匹配
async function initMatrix() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    const otherLocationName = selectedLocation.value === '宜蘭園區' ? '東港聯絡處' : '宜蘭園區';

    const [template, existing, otherExisting] = await Promise.all([
      Promise.resolve(dutiesStore.generateMonthlyTemplate(selectedLocation.value, year, month)),
      dutiesStore.fetchDutySchedule(selectedLocation.value, year, month),
      dutiesStore.fetchDutySchedule(otherLocationName, year, month)
    ]);

    otherLocationDuties.value = otherExisting || [];

    // 以唯一 ID 建立對照表
    const existingMap = {};
    existing.forEach(item => {
      if (item.id) existingMap[item.id] = item;
    });

    const nameToMemberMap = {};
    allMembers.value.forEach(m => {
      if (m.name) nameToMemberMap[m.name] = m;
    });

    matrixList.value = template.map(t => {
      const existingItem = existingMap[t.id];

      if (existingItem) {
        let memberId = existingItem.memberId || '';
        const memberName = existingItem.memberName || '';
        
        if (memberName && nameToMemberMap[memberName]) {
          memberId = nameToMemberMap[memberName].id;
        } else if (!memberId && memberName) {
          memberId = memberName;
        }

        return {
          ...t,
          memberId,
          memberName,
          timeRange: t.timeRange || existingItem.timeRange || dutiesStore.getShiftTimeRange(selectedLocation.value, t.shiftId, t.shiftLabel)
        };
      }

      return t;
    });
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (conflictList.value.length > 0) {
    alert(`⚠️ 排班衝突未解決！\n共有 ${conflictList.value.length} 處跨場地重複排班衝突，請先修正衝突席位再進行儲存。`);
    return;
  }

  saving.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    await dutiesStore.saveMonthlyDuties(selectedLocation.value, year, month, matrixList.value);
    toast.success('全月排班表儲存成功（已同步更新至資料庫）！');
  } catch (err) {
    toast.error('儲存失敗：' + err.message);
  } finally {
    saving.value = false;
  }
}

// 自動排班相關狀態與邏輯
const showAutoModal = ref(false);
const autoScheduleMode = ref('heqi_only'); // 預設優先以和氣輪值週次為準
const overwriteStrategy = ref('overwrite'); // 'overwrite' | 'empty_only'
const autoStartDate = ref('');
const autoEndDate = ref('');
const autoPreviewResult = ref(null);

const currentMonthWeekInfo = computed(() => {
  if (!selectedMonth.value) return [];
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeekDays = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const heqi = dutyRulesStore.getHeqiForDate(dateStr);

    currentWeekDays.push({ dateStr, dayOfWeek, heqi });

    if (dayOfWeek === 0 || day === daysInMonth) {
      const first = currentWeekDays[0].dateStr.substring(5);
      const last = currentWeekDays[currentWeekDays.length - 1].dateStr.substring(5);
      weeks.push({
        weekNum: weeks.length + 1,
        range: `${first} ~ ${last}`,
        fullStartDate: currentWeekDays[0].dateStr,
        fullEndDate: currentWeekDays[currentWeekDays.length - 1].dateStr,
        heqi: currentWeekDays[0].heqi,
        isHeqi2: currentWeekDays[0].heqi === '和氣二',
        daysCount: currentWeekDays.length,
        dateStrings: currentWeekDays.map(d => d.dateStr)
      });
      currentWeekDays = [];
    }
  }
  return weeks;
});

const groupedWeeks = computed(() => {
  if (!currentMonthWeekInfo.value.length || !groupedDays.value.length) return [];
  const dayMap = new Map();
  groupedDays.value.forEach(d => dayMap.set(d.dateStr, d));

  return currentMonthWeekInfo.value.map(w => {
    const days = (w.dateStrings || []).map(ds => dayMap.get(ds)).filter(Boolean);
    let assignedCount = 0;
    let totalCount = 0;
    days.forEach(d => {
      (d.slots || []).forEach(s => {
        totalCount++;
        if (s.memberName) assignedCount++;
      });
    });

    return {
      ...w,
      days,
      assignedCount,
      totalCount
    };
  });
});

function getWeekAssignedCount(week) {
  return week?.assignedCount ?? 0;
}

function getWeekTotalSlotsCount(week) {
  return week?.totalCount ?? 0;
}

async function handleDeleteMonth() {
  const assigned = assignedTotalCount.value;
  if (!confirm(`⚠️ 確定要一鍵刪除【${selectedLocation.value}】在【${selectedMonth.value}】整月的排班嗎？\n\n目前共有 ${assigned} 席已排定志工，執行後將清空全月所有席位並直接自資料庫刪除！`)) {
    return;
  }
  clearing.value = true;
  try {
    const slotsToDelete = matrixList.value.filter(s => !!s.id);
    if (slotsToDelete.length > 0) {
      await batchWriteItems('dutyShifts', slotsToDelete, 'delete');
    }
    matrixList.value.forEach(s => {
      s.memberId = '';
      s.memberName = '';
      s.status = '未指派';
    });
    await initMatrix();
    showClearModal.value = false;
    toast.success(`🎉 已成功刪除【${selectedMonth.value}】整月排班！共清空 ${assigned} 席位。`);
  } catch (err) {
    toast.error('刪除整月排班失敗：' + err.message);
  } finally {
    clearing.value = false;
  }
}

async function handleDeleteWeek(week) {
  if (!week) return;
  const assigned = getWeekAssignedCount(week);
  if (!confirm(`⚠️ 確定要一鍵刪除【第 ${week.weekNum} 週 (${week.range})】的排班嗎？\n\n目前該週共有 ${assigned} 席已排定志工，執行後將清空該週所有席位並直接自資料庫刪除！`)) {
    return;
  }
  clearing.value = true;
  try {
    const dateSet = new Set(week.dateStrings || (week.days ? week.days.map(d => d.dateStr) : []));
    const slotsToDelete = matrixList.value.filter(s => dateSet.has(s.dutyDate) && !!s.id);
    
    if (slotsToDelete.length > 0) {
      await batchWriteItems('dutyShifts', slotsToDelete, 'delete');
    }

    matrixList.value.forEach(s => {
      if (dateSet.has(s.dutyDate)) {
        s.memberId = '';
        s.memberName = '';
        s.status = '未指派';
      }
    });

    await initMatrix();
    showClearModal.value = false;
    toast.success(`🎉 已成功刪除第 ${week.weekNum} 週 (${week.range}) 排班！共清空 ${assigned} 席位。`);
  } catch (err) {
    toast.error(`刪除第 ${week.weekNum} 週排班失敗：` + err.message);
  } finally {
    clearing.value = false;
  }
}

const firstHeqi2Week = computed(() => {
  return currentMonthWeekInfo.value.find(w => w.isHeqi2) || null;
});

function setQuickRange(start, end) {
  autoStartDate.value = start;
  autoEndDate.value = end;
  runAutoPreview();
}

function resetToFullMonth() {
  if (!selectedMonth.value) return;
  const [year, month] = selectedMonth.value.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  autoStartDate.value = `${year}-${String(month).padStart(2, '0')}-01`;
  autoEndDate.value = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  runAutoPreview();
}

const availableAutoRules = computed(() => {
  return (dutyRulesStore.rules || []).filter(r => r.location === selectedLocation.value && r.enabled !== false);
});

const selectedAutoRuleId = ref('');
const customStartTeamIndex = ref('');
const customStartWeekdayMember = ref('');
const customStartWeekendMember = ref('');

const currentSelectedAutoRule = computed(() => {
  return availableAutoRules.value.find(r => r.id === selectedAutoRuleId.value) || availableAutoRules.value[0] || null;
});

const currentSelectedAutoRuleQuota = computed(() => {
  if (!currentSelectedAutoRule.value) return 1;
  return getRuleQuota(currentSelectedAutoRule.value);
});

// 動態推算當前星期整組輪替規則所擁有的組別選項清單
const availableStartTeams = computed(() => {
  if (!currentSelectedAutoRule.value?.weekdayTeams) return [];
  const teamsObj = currentSelectedAutoRule.value.weekdayTeams;
  let maxCount = 0;
  const sampleNames = [];

  for (const day in teamsObj) {
    const dayTeams = teamsObj[day];
    if (Array.isArray(dayTeams)) {
      if (dayTeams.length > maxCount) {
        maxCount = dayTeams.length;
      }
      dayTeams.forEach((t, idx) => {
        if (!sampleNames[idx] && t.teamName) {
          sampleNames[idx] = t.teamName;
        }
      });
    }
  }

  const count = Math.max(maxCount, 5);
  const chineseNums = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  const list = [];
  for (let i = 0; i < count; i++) {
    const defaultName = i < chineseNums.length ? `第${chineseNums[i]}組` : `第 ${i + 1} 組`;
    const name = sampleNames[i] || defaultName;
    list.push({
      index: i,
      label: `${name} (第 ${i + 1} 組)`
    });
  }
  return list;
});

const availableWeekdayMembers = computed(() => {
  return currentSelectedAutoRule.value?.weekdayMembers || [];
});

const availableWeekendMembers = computed(() => {
  return currentSelectedAutoRule.value?.weekendMembers || [];
});

const currentWeekdayPointerMember = computed(() => {
  const members = availableWeekdayMembers.value;
  if (!members.length) return '';
  const ptr = currentSelectedAutoRule.value?.rotationPointers?.weekday || 0;
  return members[ptr % members.length] || '';
});

const currentWeekendPointerMember = computed(() => {
  const members = availableWeekendMembers.value;
  if (!members.length) return '';
  const ptr = currentSelectedAutoRule.value?.rotationPointers?.weekend || 0;
  return members[ptr % members.length] || '';
});

// 監聽道場切換，自動匹配當前道場適用的排班規則
watch(selectedLocation, (newLoc) => {
  const validRule = (dutyRulesStore.rules || []).find(r => r.location === newLoc && r.enabled !== false);
  selectedAutoRuleId.value = validRule ? validRule.id : '';
  customStartTeamIndex.value = '';
  customStartWeekdayMember.value = '';
  customStartWeekendMember.value = '';
});

function onAutoRuleChange() {
  customStartTeamIndex.value = '';
  customStartWeekdayMember.value = '';
  customStartWeekendMember.value = '';
  runAutoPreview();
}

function openAutoScheduleModal() {
  showAutoModal.value = true;
  if (!selectedAutoRuleId.value || !availableAutoRules.value.some(r => r.id === selectedAutoRuleId.value)) {
    selectedAutoRuleId.value = availableAutoRules.value[0]?.id || '';
  }
  customStartTeamIndex.value = '';
  customStartWeekdayMember.value = '';
  customStartWeekendMember.value = '';

  if (selectedLocation.value === '東港聯絡處') {
    if (selectedMonth.value) {
      const [year, month] = selectedMonth.value.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      autoStartDate.value = `${year}-${String(month).padStart(2, '0')}-01`;
      autoEndDate.value = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    }
  } else {
    // 宜蘭園區：若該月有和氣二值週，預設帶入和氣二值週區間，否則帶入全月
    if (firstHeqi2Week.value) {
      autoStartDate.value = firstHeqi2Week.value.fullStartDate;
      autoEndDate.value = firstHeqi2Week.value.fullEndDate;
    } else {
      if (selectedMonth.value) {
        const [year, month] = selectedMonth.value.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        autoStartDate.value = `${year}-${String(month).padStart(2, '0')}-01`;
        autoEndDate.value = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      }
    }
  }
  runAutoPreview();
}

function runAutoPreview() {
  if (!selectedMonth.value) return;
  try {
    const [year, month] = selectedMonth.value.split('-').map(Number);
    autoPreviewResult.value = dutyRulesStore.generateAutoSchedule({
      location: selectedLocation.value,
      year,
      month,
      startDate: autoStartDate.value || null,
      endDate: autoEndDate.value || null,
      currentMatrix: matrixList.value,
      otherLocationDuties: otherLocationDuties.value,
      allMembers: allMembers.value,
      ruleId: selectedAutoRuleId.value || null,
      mode: autoScheduleMode.value,
      overwriteStrategy: overwriteStrategy.value,
      customStartTeamIndex: customStartTeamIndex.value !== '' ? Number(customStartTeamIndex.value) : null,
      startWeekdayMember: customStartWeekdayMember.value || null,
      startWeekendMember: customStartWeekendMember.value || null
    });
  } catch (err) {
    console.error('runAutoPreview error:', err);
    toast.error('自動排班預覽計算失敗：' + err.message);
  }
}

const savingAutoSchedule = ref(false);

async function applyAutoSchedule() {
  if (!autoPreviewResult.value) return;
  savingAutoSchedule.value = true;
  try {
    const slots = autoPreviewResult.value.allGeneratedSlots || [];
    const pointers = autoPreviewResult.value.updatedRotationPointers || null;
    const ruleId = autoPreviewResult.value.ruleId || null;

    // 直接批次儲存至 Firestore 資料庫
    await dutyRulesStore.saveAutoScheduleToDb(slots, pointers, ruleId);

    // 同步更新當前月畫面矩陣並重新自資料庫載入
    await initMatrix();

    showAutoModal.value = false;
    toast.success(`🎉 自動排班已成功套用並儲存至資料庫！共排定 ${autoPreviewResult.value.scheduledDetails.length} 天、${slots.length} 席位 (${autoStartDate.value} ~ ${autoEndDate.value})！`);
  } catch (err) {
    toast.error('儲存排班至資料庫失敗：' + err.message);
  } finally {
    savingAutoSchedule.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  const [males, females] = await Promise.all([
    membersStore.fetchMembers({ gender: '男' }),
    membersStore.fetchMembers({ gender: '女' }),
    orgsStore.fetchOrgs(),
    dutyRulesStore.fetchRules(),
    dutyRulesStore.fetchWeekRotation('宜蘭園區')
  ]);
  maleMembers.value = males;
  femaleMembers.value = females;
  allMembers.value = [...males, ...females];
  await initMatrix();
});
</script>

<style scoped>
.sticky-control-panel {
  position: sticky;
  top: 60px; /* 緊貼在 AppHeader 下方 */
  z-index: 100;
  background-color: var(--gray-50); /* 實心背景，徹底遮擋下方捲動內容，解決透光疊字問題 */
  padding-top: 0.5rem;
  padding-bottom: 0.75rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
@media (max-width: 992px) {
  .sticky-control-panel {
    top: 50px;
    padding-top: 0.35rem;
    padding-bottom: 0.5rem;
  }
}

.week-section {
  scroll-margin-top: 260px;
}
.week-header-bar {
  background: #ffffff;
  border-left: 4px solid var(--primary-500);
}

.duty-control-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  align-items: flex-end;
}
@media (max-width: 768px) {
  .duty-control-row {
    grid-template-columns: 1fr;
  }
}

.btn-block { width: 100%; }
.form-select-sm, .form-input-sm {
  min-height: 38px;
  padding: 0.35rem 0.65rem;
  font-size: 0.88rem;
}
.day-block-card {
  border: 1px solid var(--gray-200);
  background: #ffffff;
}
.weekend-highlight {
  border-left: 5px solid var(--warning);
}
.has-conflict {
  border: 2px solid var(--danger) !important;
  background: #fef2f2;
}
.conflict-banner {
  background: #fff1f2;
  border-top: 1px solid #fecdd3;
  border-bottom: 1px solid #fecdd3;
  border-left: 5px solid var(--danger);
}
.day-block-header {
  border-bottom: 1px solid var(--gray-200);
  padding-bottom: 0.75rem;
}
.shift-group-box {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 1rem;
}
.box-female { border-top: 3px solid var(--accent-500); }
.box-male { border-top: 3px solid var(--primary-500); }
.border-danger {
  border-color: var(--danger) !important;
  background-color: #fff1f2 !important;
}
.btn-clear {
  padding: 0.25rem 0.5rem;
  min-height: 36px;
  font-size: 0.85rem;
}
.btn-xs { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
.ml-2 { margin-left: 0.5rem; }
.whitespace-nowrap { white-space: nowrap; }

.modal-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 9990;
}
.modal-content { background: #ffffff; border-radius: var(--radius-lg); width: 92%; }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
.modal-body { padding: 1.25rem 1.5rem; max-height: 70vh; overflow-y: auto; }
.modal-footer { padding: 1rem 1.5rem; background: var(--gray-50); border-top: 1px solid var(--gray-200); }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500); }
</style>
