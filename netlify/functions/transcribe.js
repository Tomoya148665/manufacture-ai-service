exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { default: OpenAI } = await import('openai');
    const { toFile } = await import('openai/uploads');

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const isJson = (event.headers['content-type'] || event.headers['Content-Type'] || '').includes('application/json');
    if (!isJson) {
      return { statusCode: 400, body: 'Invalid content type' };
    }

    const { audio, mimeType } = JSON.parse(event.body || '{}');
    if (!audio) {
      return { statusCode: 400, body: 'Missing audio' };
    }

    const buffer = Buffer.from(audio, 'base64');
    const file = await toFile(buffer, 'audio.webm', { type: mimeType || 'audio/webm' });

    const result = await client.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file
    });

    const text = result.text || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    console.error('Transcribe error:', err);
    return { statusCode: 500, body: 'Transcription failed' };
  }
};

