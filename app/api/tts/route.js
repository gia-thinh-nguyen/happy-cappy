import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return Response.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx", // Male voice - deep and clear
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('TTS Error:', error);
    return Response.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}