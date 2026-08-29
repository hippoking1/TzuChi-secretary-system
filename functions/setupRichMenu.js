/**
 * LINE Bot Rich Menu (圖文選單) 設定輔助腳本
 *
 * 選單設計 (2500 x 843 px, 3 等分)：
 * ┌──────────────┬──────────────┬──────────────┐
 * │  🔗 綁定身分  │  📋 值班查詢  │  🔄 調班換班  │
 * └──────────────┴──────────────┴──────────────┘
 *
 * 執行方式（在 functions 目錄下）：
 *   node setupRichMenu.js <LINE_CHANNEL_ACCESS_TOKEN> [IMAGE_PATH]
 */

const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

async function main() {
  const token = process.argv[2] || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('請提供 LINE_CHANNEL_ACCESS_TOKEN：node setupRichMenu.js <TOKEN>');
    process.exit(1);
  }

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: token
  });
  const blobClient = new line.messagingApi.MessagingApiBlobClient({
    channelAccessToken: token
  });

  const richMenuObject = {
    size: {
      width: 2500,
      height: 843
    },
    selected: true,
    name: '慈濟小祕書主選單',
    chatBarText: '🌸 開啟功能選單',
    areas: [
      {
        bounds: {
          x: 0,
          y: 0,
          width: 833,
          height: 843
        },
        action: {
          type: 'message',
          label: '綁定身分',
          text: '綁定'
        }
      },
      {
        bounds: {
          x: 833,
          y: 0,
          width: 834,
          height: 843
        },
        action: {
          type: 'message',
          label: '值班查詢',
          text: '值班查詢'
        }
      },
      {
        bounds: {
          x: 1667,
          y: 0,
          width: 833,
          height: 843
        },
        action: {
          type: 'message',
          label: '調班換班',
          text: '調班'
        }
      }
    ]
  };

  console.log('1. 建立 Rich Menu 架構...');
  const createRes = await client.createRichMenu(richMenuObject);
  const richMenuId = createRes.richMenuId;
  console.log(`✓ Rich Menu 建立成功，ID: ${richMenuId}`);

  // 若有提供圖片路徑
  const imgPath = process.argv[3];
  if (imgPath && fs.existsSync(imgPath)) {
    console.log(`2. 上傳 Rich Menu 圖片 (${imgPath})...`);
    const imgBuffer = fs.readFileSync(imgPath);
    await blobClient.setRichMenuImage(richMenuId, imgBuffer);
    console.log('✓ 圖片上傳完成');
  } else {
    console.log('ℹ️ 未提供圖片路徑或圖片不存在，建立完成後可至 LINE Official Account Manager 後台或透過 API 上傳 2500x843 圖片。');
  }

  console.log('3. 將此 Rich Menu 設為全體使用者預設選單...');
  await client.setDefaultRichMenu(richMenuId);
  console.log('🎉 設定完成！所有使用者現在打開 LINE Bot 聊天室皆可看到底部選單按鈕。');
}

main().catch(err => {
  console.error('執行失敗:', err);
});
