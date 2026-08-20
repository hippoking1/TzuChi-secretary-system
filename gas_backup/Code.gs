/**
 * Code.gs
 * 慈濟活動報名系統 — 核心入口與 Web App 路由處理器
 */

/**
 * Web App 入口 — 處理 GET 請求
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'index';
  const params = e ? e.parameter : {};

  // 前後台頁面路由對照
  const pageMap = {
    // 前台頁面
    'index':              'pages/Index',
    'events':             'pages/Events',
    'event':              'pages/EventDetail',
    'register':           'pages/Register',
    'my':                 'pages/MyRegistrations',
    'duty-search':         'pages/DutySearch',
    // 後台管理頁面
    'login':              'pages/Login',
    'admin':              'pages/AdminDashboard',
    'admin-events':       'pages/AdminEvents',
    'admin-event-form':   'pages/AdminEventForm',
    'admin-regs':         'pages/AdminRegistrations',
    'admin-members':      'pages/AdminMembers',
    'admin-orgs':         'pages/AdminOrgs',
    'admin-export':       'pages/AdminExport',
    'admin-checkin':      'pages/AdminCheckIn',
    'admin-meetings':     'pages/AdminMeetings',
    'admin-meeting-form': 'pages/AdminMeetingForm',
    'admin-duty':         'pages/AdminDutySchedule',
    'admin-duty-form':    'pages/AdminDutyForm',
    'admin-line':         'pages/AdminLineBinding'
  };

  const templatePath = pageMap[page] || 'pages/Index';

  try {
    const template = HtmlService.createTemplateFromFile(templatePath);
    template.params = JSON.stringify(params);
    template.baseUrl = ScriptApp.getService().getUrl();
    template.include = include;

    return template.evaluate()
      .setTitle('慈濟活動管理系統')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>頁面載入失敗: ' + err.toString() + '</h3>');
  }
}

/**
 * Web App 入口 — 處理 POST 請求 (LINE Webhook)
 */
function doPost(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      var postData = JSON.parse(e.postData.contents);
      if (postData && postData.events) {
        handleLineWebhook(postData);
      }
    }
  } catch (err) {
    // 捕捉所有例外，確保不中斷 LINE Webhook 的 HTTP 200 回應
    Logger.log('doPost error: ' + err.toString());
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 引入 HTML 樣式或腳本片段
 * 用法: <?!= include('css/Styles') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 取得當前 Web App 正確的對外公開 URL
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}
