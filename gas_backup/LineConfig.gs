/**
 * LineConfig.gs
 * 慈濟活動管理系統 — LINE Bot API 設定與 Script Properties
 */

/**
 * 取得 LINE Bot 設定
 */
function getLineConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    CHANNEL_ACCESS_TOKEN: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    CHANNEL_SECRET: props.getProperty('LINE_CHANNEL_SECRET') || '',
    API_PUSH_URL: 'https://api.line.me/v2/bot/message/push',
    API_REPLY_URL: 'https://api.line.me/v2/bot/message/reply'
  };
}

/**
 * 設定 LINE Channel Access Token 與 Secret (可在 GAS 編輯器執行一次)
 */
function setLineChannelConfig(accessToken, channelSecret) {
  PropertiesService.getScriptProperties().setProperties({
    'LINE_CHANNEL_ACCESS_TOKEN': accessToken,
    'LINE_CHANNEL_SECRET': channelSecret
  });
  Logger.log('✅ LINE Channel 設定儲存成功！');
}

/**
 * 方便在 Apps Script 編輯器直接選取執行的設定函式
 */
function initLineProperties() {
  const token = 'FFypZYhjwBZLjNj3wpwgcroNHrsMg0RdF2ZaJ3aTAgZcv7yx2YmVLa3aDPqKev/8oi1bUdQsAF6Nfn3MxMRa0Fp+x5N7NRChsTQSOVu6MNUmx8Y3zOuH+QWh2Ioah4O6rSNhsshHJ66PzEJzZZSD1QdB04t89/1O/w1cDnyilFU=';
  const secret = '【請填寫您的 Channel Secret】';
  
  setLineChannelConfig(token, secret);
}
