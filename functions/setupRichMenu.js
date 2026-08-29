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

  const defaultImgPath = path.join(__dirname, 'assets', 'richmenu.png');
  const imgPath = process.argv[3] || defaultImgPath;

  if (!fs.existsSync(imgPath)) {
    console.error(`❌ 找不到 Rich Menu 圖片: ${imgPath}`);
    process.exit(1);
  }

  console.log('1. 建立 Rich Menu 架構...');
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

  const createRes = await client.createRichMenu(richMenuObject);
  const richMenuId = createRes.richMenuId;
  console.log(`✓ Rich Menu 建立成功，ID: ${richMenuId}`);

  console.log(`2. 上傳 Rich Menu 圖片 (${imgPath})...`);
  const imgBuffer = fs.readFileSync(imgPath);

  // 直接透過 LINE API 規範上傳圖片
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'image/png'
    },
    body: imgBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`上傳圖片失敗 (${uploadRes.status}): ${errText}`);
  }
  console.log('✓ 圖片上傳完成');

  console.log('3. 將此 Rich Menu 設為全體使用者預設選單...');
  await client.setDefaultRichMenu(richMenuId);
  console.log(`🎉 設定完成！Rich Menu (${richMenuId}) 已成功設為預設選單。`);
  console.log('所有志工現在開啟 LINE 聊天室，底部都會常駐顯示功能按鈕！');
}

main().catch(err => {
  console.error('執行失敗:', err);
});

