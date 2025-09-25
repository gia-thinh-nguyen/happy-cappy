import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { message, politenessMode = 'casual' } = await request.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a Thai translation assistant. When given English text:
1. First translate the ENTIRE sentence/phrase to Thai from a male speaker's perspective using ${politenessMode === 'casual' ? 'casual/informal language (ไม่เป็นทางการ) suitable for friends and peers. Use relaxed tone, minimal particles like จ้ะ, นะ, and informal pronouns like กู/มึง when appropriate for very casual contexts, or กัน/เรา for friendly contexts' : 'polite/formal language (เป็นทางการ) suitable for older people, strangers, or formal situations. Always use polite particles like ครับ/คะ, formal pronouns like ผม/ดิฉัน, and respectful language'}
2. Then provide a word-by-word breakdown of the THAI TRANSLATION (not the English), so users can understand what each Thai word/phrase means
3. Use Vietnamese diacritical marks to represent Thai tones accurately
4. Return response in this exact JSON format (RESPOND ONLY WITH VALID JSON, NO OTHER TEXT):

{
  "fullTranslation": "complete Thai translation of the entire sentence",
  "fullPronunciation": "complete pronunciation of the entire Thai sentence",
  "breakdown": [
    {"pronunciation": "Vietnamese pronunciation", "meaning": "English meaning"},
    {"pronunciation": "Vietnamese pronunciation", "meaning": "English meaning"}
  ]
}

Examples for ${politenessMode} mode:
${politenessMode === 'casual' ? `
Input: "Hello"
Output: {
  "fullTranslation": "สวัสดี",
  "fullPronunciation": "sà-wàt-dii",
  "breakdown": [
    {"pronunciation": "sà-wàt-dii", "meaning": "hello (casual)"}
  ]
}

Input: "How are you?"
Output: {
  "fullTranslation": "เป็นยังไงบ้าง",
  "fullPronunciation": "pen yang-ngai bâang",
  "breakdown": [
    {"pronunciation": "pen yang-ngai", "meaning": "how are you (casual)"},
    {"pronunciation": "bâang", "meaning": "particle for asking"}
  ]
}` : `
Input: "Hello"
Output: {
  "fullTranslation": "สวัสดีครับ",
  "fullPronunciation": "sà-wàt-dii khráp",
  "breakdown": [
    {"pronunciation": "sà-wàt-dii", "meaning": "hello"},
    {"pronunciation": "khráp", "meaning": "male politeness particle"}
  ]
}

Input: "How are you?"
Output: {
  "fullTranslation": "คุณเป็นอย่างไรบ้างครับ",
  "fullPronunciation": "khun pen yàng-rai bâang khráp",
  "breakdown": [
    {"pronunciation": "khun", "meaning": "you (polite)"},
    {"pronunciation": "pen yàng-rai", "meaning": "how are you"},
    {"pronunciation": "bâang", "meaning": "particle for asking"},
    {"pronunciation": "khráp", "meaning": "male politeness particle"}
  ]
}`}

Important: 
1. Always use masculine language patterns and first-person pronouns appropriate for ${politenessMode} context.
2. ${politenessMode === 'casual' ? 'Use casual particles, informal pronouns, and relaxed speech patterns suitable for friends/peers.' : 'Use polite particles like "ครับ" (khrap), formal pronouns like "ผม" (phom), and respectful language for elders/strangers.'}
3. CRITICAL: Respond ONLY with valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Just the raw JSON object.`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content;
    
    console.log('Raw GPT response:', responseText);
    
    try {
      // Try to parse as JSON
      const jsonResponse = JSON.parse(responseText);
      
      // Validate the response structure
      if (!jsonResponse.fullTranslation || !jsonResponse.fullPronunciation) {
        console.error('Bot API - Invalid response structure:', jsonResponse);
        throw new Error('Invalid response structure');
      }
      
      // Check if fullTranslation contains Thai characters
      const hasThaiChars = /[\u0E00-\u0E7F]/.test(jsonResponse.fullTranslation);
      if (!hasThaiChars) {
        console.error('Bot API - fullTranslation does not contain Thai characters:', jsonResponse.fullTranslation);
        throw new Error('Invalid fullTranslation - no Thai characters');
      }
      
      console.log('Bot API - Valid response:', {
        fullTranslation: jsonResponse.fullTranslation,
        fullPronunciation: jsonResponse.fullPronunciation,
        breakdownCount: jsonResponse.breakdown?.length || 0
      });
      
      return Response.json(jsonResponse);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Response text that failed to parse:', responseText);
      
      // Try to extract JSON from markdown code blocks or other formatting
      let cleanedResponse = responseText;
      
      // Remove markdown code blocks
      if (responseText.includes('```')) {
        const matches = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (matches && matches[1]) {
          cleanedResponse = matches[1];
          try {
            const jsonResponse = JSON.parse(cleanedResponse);
            return Response.json(jsonResponse);
          } catch (secondParseError) {
            console.error('Second parse attempt failed:', secondParseError);
          }
        }
      }
      
      // If all parsing fails, return structured response with actual content
      return Response.json({
        fullTranslation: "Could not parse response - check console for details",
        fullPronunciation: "Error in translation",
        breakdown: [],
        rawResponse: responseText
      });
    }

  } catch (error) {
    console.error('Error:', error);
    
    let errorMessage = 'Failed to get response from ChatGPT';
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Check for specific OpenAI errors
    if (error.status === 401) {
      errorMessage = 'Invalid API key';
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded, please try again later';
    } else if (error.status === 400) {
      errorMessage = 'Invalid request to OpenAI API';
    }
    
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}