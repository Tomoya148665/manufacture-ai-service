const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const dotenv = require('dotenv');

// .env.localファイルを読み込む
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3002;

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

// ミドルウェア
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// TTS (Text-to-Speech) エンドポイント
app.post('/api/speak', async (req, res) => {
  try {
    const { text, voice = 'alloy', format = 'mp3' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    console.log('🎤 TTS Request:', { voice, format, textLength: text.length });

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
      response_format: format
    });

    console.log('✅ TTS Response received');

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const mimeType = format === 'wav' ? 'audio/wav' :
                     format === 'opus' ? 'audio/ogg' : 'audio/mpeg';

    res.json({ audio: base64, mimeType });
  } catch (error) {
    console.error('❌ TTS Error:', error);
    res.status(500).json({ error: 'Speech synthesis failed', details: error.message });
  }
});

// STT (Speech-to-Text) エンドポイント
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio, mimeType = 'audio/webm' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Missing audio' });
    }

    console.log('🎤 STT Request:', { mimeType });

    const buffer = Buffer.from(audio, 'base64');
    const file = new File([buffer], 'audio.webm', { type: mimeType });

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file,
      language: 'ja'
    });

    console.log('✅ STT Response:', response.text);
    res.json({ text: response.text });
  } catch (error) {
    console.error('❌ STT Error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OpenAI API Server running at:`);
  console.log(`   Local:    http://localhost:${PORT}`);

  // ネットワークインターフェースを取得
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();

  Object.keys(networkInterfaces).forEach(key => {
    networkInterfaces[key].forEach(details => {
      if (details.family === 'IPv4' && !details.internal) {
        console.log(`   Network:  http://${details.address}:${PORT}`);
      }
    });
  });

  console.log('\n📱 スマホからアクセスする場合は、Network URLを使用してください');
});