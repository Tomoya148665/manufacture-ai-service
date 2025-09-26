import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export async function generateAIResponse(userMessage, sensorContext, conversationHistory = []) {
  try {
    const systemPrompt = `あなたは製造業向けのセンサー監視システムのAIアシスタントです。
    センサーの状態を監視し、異常を検知した際には適切なアドバイスを提供します。

    【最重要】現在のセンサー状況（必ずこの状態を基準に回答してください）：
    ${sensorContext}

    重要な指示：
    1. 回答は2-3文程度で簡潔にまとめてください
    2. 技術的な内容は箇条書きで整理してください
    3. マークダウンの**や*などの装飾記号は使わないでください
    4. 適切な位置で改行を入れて読みやすくしてください
    5. 専門用語は必要最小限にしてください
    6. 過去の会話でセンサー状態の言及があっても、必ず上記の「現在のセンサー状況」を正として回答してください`;

    // 会話履歴を含むメッセージ配列を構築
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // 直近10件の会話履歴を含める
      { role: 'user', content: userMessage },
      // 現在のセンサー状態を再度強調するメッセージを追加
      { role: 'system', content: `念のため確認：現在のセンサー状態は以下の通りです。過去の状態ではなく、この状態を基に回答してください。\n${sensorContext}` }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 200 // 返答の長さを制限
    });

    // 返答の後処理
    let response = completion.choices[0].message.content;

    // マークダウンの装飾記号を除去
    response = response.replace(/\*\*/g, ''); // **を削除
    response = response.replace(/\*/g, '');   // *を削除
    response = response.replace(/#{1,6}\s/g, ''); // 見出し記号を削除

    // 箇条書きの処理（・に統一）
    response = response.replace(/^[-*]\s/gm, '・');
    response = response.replace(/^\d+\.\s/gm, '・');

    // 改行の最適化（句点で改行を入れる）
    response = response.replace(/。(?![\n」])/g, '。\n');

    // 余分な空白行を削除
    response = response.replace(/\n{3,}/g, '\n\n');
    response = response.trim();

    return response;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return 'AIシステムに一時的な問題が発生しています。しばらくお待ちください。';
  }
}

export async function loadSensorStates(csvPath) {
  try {
    const response = await fetch(csvPath);
    const text = await response.text();

    const rows = text.split('\n').filter(row => row.trim());
    const headers = rows[0].split(',');

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index]?.trim();
      });
      data.push(obj);
    }

    return data;
  } catch (error) {
    console.error('CSV Load Error:', error);
    return [];
  }
}

export function getSensorContext(sensors, sensorStates) {
  const contexts = [];

  Object.entries(sensors).forEach(([key, status]) => {
    const sensorName = key === 's1' ? 'センサー1' : 'センサー2';

    const matchingState = sensorStates.find(
      state => state.sensor_name === sensorName && state.sensor_state === status
    );

    if (matchingState) {
      contexts.push(`${sensorName}: ${status} - ${matchingState.situation_description}`);
    } else {
      contexts.push(`${sensorName}: ${status}`);
    }
  });

  return contexts.join('\n');
}

// ログデータからレポートを生成
export async function generateLogReport(logs) {
  if (!logs || logs.length === 0) {
    return 'ログデータがありません。';
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OpenAI API key is not configured');
    return 'APIキーが設定されていません。';
  }

  // ログデータの分析用サマリーを作成
  const sensorLogs = logs.filter(log => log.type === 'sensor');
  const chatLogs = logs.filter(log => log.type === 'chat');

  const sensorChanges = sensorLogs.map(log => ({
    timestamp: new Date(log.timestamp).toLocaleString('ja-JP'),
    sensor: log.sensorKey,
    change: `${log.previousState} → ${log.newState}`
  }));

  const conversations = chatLogs.map(log => ({
    timestamp: new Date(log.timestamp).toLocaleString('ja-JP'),
    role: log.role,
    message: log.message.substring(0, 100) + (log.message.length > 100 ? '...' : ''),
    sensorState: log.sensorState
  }));

  const reportPrompt = `
以下のセンサーログとチャットログを分析し、簡潔な日本語のレポートを作成してください。

【レポート作成のガイドライン】
1. 概要（期間、ログ件数、主な活動）
2. センサー状態の分析（異常発生回数、パターン、頻度）
3. チャット分析（問い合わせ内容の傾向、AIの対応状況）
4. 注目すべき事象（異常パターン、頻繁な問い合わせなど）
5. 改善提案（もしあれば）

【センサー変更ログ】
${JSON.stringify(sensorChanges, null, 2)}

【チャット履歴サマリー】
${JSON.stringify(conversations, null, 2)}

【総ログ数】
- センサーログ: ${sensorLogs.length}件
- チャットログ: ${chatLogs.length}件
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '工場のセンサー監視システムのログ分析専門家として、簡潔で実用的なレポートを作成してください。'
        },
        {
          role: 'user',
          content: reportPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('レポート生成エラー:', error);
    return 'レポートの生成中にエラーが発生しました。';
  }
}