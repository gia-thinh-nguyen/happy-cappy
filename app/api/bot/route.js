import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { message } = await request.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a Thai translation assistant. When given English text:
1. Translate it to Thai from a male speaker's perspective (use masculine language patterns, pronouns, and politeness levels)
2. Provide pronunciation using Vietnamese diacritical marks to represent Thai tones accurately (use proper Vietnamese accent marks: á, à, ả, ã, ạ, ă, â, ê, ề, ế, ể, ễ, ệ, ô, ồ, ố, ổ, ỗ, ộ, ơ, ờ, ớ, ở, ỡ, ợ, ư, ừ, ứ, ử, ữ, ự, etc.)
3. Give word-by-word breakdown
4. Return response in this exact JSON format (RESPOND ONLY WITH VALID JSON, NO OTHER TEXT):

{
  "original": "original English text",
  "breakdown": [
    {"word": "English word", "pronunciation": "Vietnamese", "meaning": "meaning"},
    {"word": "English word", "pronunciation": "Vietnamese", "meaning": "meaning"}
  ]
}

Examples:
Input: "Hello"
Output: {
  "original": "Hello",
  "breakdown": [
    {"word": "Hello", "pronunciation": "sà-wàt-dii", "meaning": "hello"}
  ]
}

Input: "Hello, how are you?"
Output: {
  "original": "Hello, how are you?",
  "breakdown": [
    {"word": "Hello", "pronunciation": "sà-wàt-dii", "meaning": "hello"},
    {"word": "how", "pronunciation": "yàng-rai", "meaning": "how/what way"},
    {"word": "are", "pronunciation": "pen", "meaning": "to be"},
    {"word": "you", "pronunciation": "khun", "meaning": "you (polite)"},
    {"word": "(male polite)", "pronunciation": "khráp", "meaning": "male politeness particle"}
  ]
}

Important: 
1. Always use masculine language patterns, including "ครับ" (khrap) for politeness, and masculine first-person pronouns like "ผม" (phom) for "I".
2. CRITICAL: Respond ONLY with valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Just the raw JSON object.`
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
        original: message,
        pronunciation: "Could not parse response - check console for details",
        meaning: `Raw response: ${responseText.substring(0, 200)}...`,
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