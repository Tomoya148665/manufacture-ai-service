export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeBlob(blob, mimeType = 'audio/webm') {
  const audio = await blobToBase64(blob);
  // ローカル開発環境ではExpressサーバー、本番環境ではNetlify Functions
  const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3002/api/transcribe'
    : '/.netlify/functions/transcribe';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio, mimeType })
  });
  if (!res.ok) throw new Error('Transcription request failed');
  const data = await res.json();
  return data.text || '';
}

export async function synthesizeSpeech(text, voice = 'alloy', format = 'mp3') {
  console.log('🌐 OpenAI TTSリクエスト開始');
  console.log('📤 テキスト:', text);
  console.log('🎤 音声:', voice);
  console.log('🎵 フォーマット:', format);

  // ローカル開発環境ではExpressサーバー、本番環境ではNetlify Functions
  const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3002/api/speak'
    : '/.netlify/functions/speak';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, format })
  });

  console.log('🌐 レスポンスステータス:', res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ OpenAI TTSエラー:', errorText);
    throw new Error(`Speech synthesis request failed: ${errorText}`);
  }

  const data = await res.json();
  console.log('✅ OpenAI TTSレスポンス受信');

  const { audio, mimeType } = data;
  const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' });

  console.log('🎵 音声Blob作成完了:', blob.size, 'bytes');
  return blob;
}

export function playAudioBlob(blob) {
  console.log('🎵 音声再生開始');
  console.log('🎵 Blobサイズ:', blob.size, 'bytes');
  console.log('🎵 Blobタイプ:', blob.type);

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  audio.onloadedmetadata = () => {
    console.log('🎵 音声メタデータ読み込み完了');
    console.log('🎵 再生時間:', audio.duration, '秒');
  };

  audio.onplay = () => {
    console.log('▶️ 音声再生中...');
  };

  audio.onended = () => {
    console.log('⏹️ 音声再生終了');
    URL.revokeObjectURL(url);
  };

  audio.onerror = (e) => {
    console.error('❌ 音声再生エラー:', e);
  };

  audio.play().catch(e => {
    console.error('❌ 音声再生開始エラー:', e);
  });

  return audio;
}

