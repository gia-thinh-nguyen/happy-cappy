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

    // Debug logging
    console.log('TTS API - Received text:', text);
    console.log('TTS API - Text type:', typeof text);
    console.log('TTS API - Text length:', text.length);
    
    // Check if text contains Thai characters
    const hasThaiChars = /[\u0E00-\u0E7F]/.test(text);
    console.log('TTS API - Contains Thai characters:', hasThaiChars);
    
    // If no Thai characters, this might be pronunciation text being sent by mistake
    if (!hasThaiChars) {
      console.warn('TTS API - WARNING: Text does not contain Thai characters, might be pronunciation text');
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // Higher quality model
      voice: "onyx", // Male voice - deep and clear
      input: text,
      speed: 0.85, // Slightly slower for better pronunciation
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