exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const isJson = (event.headers['content-type'] || event.headers['Content-Type'] || '').includes('application/json');
    if (!isJson) {
      return { statusCode: 400, body: 'Invalid content type' };
    }

    const { text, voice = 'alloy', format = 'mp3' } = JSON.parse(event.body || '{}');
    if (!text || !text.trim()) {
      return { statusCode: 400, body: 'Missing text' };
    }

    console.log('OpenAI TTS Request:', { voice, format, textLength: text.length });

    const response = await client.audio.speech.create({
      model: 'tts-1',  // 正しいモデル名
      voice,
      input: text,
      response_format: format  // 正しいパラメータ名
    });

    console.log('OpenAI TTS Response received');

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const mimeType = format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/ogg' : 'audio/mpeg';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, mimeType })
    };
  } catch (err) {
    console.error('Speech error:', err);
    return { statusCode: 500, body: 'Speech synthesis failed' };
  }
};

