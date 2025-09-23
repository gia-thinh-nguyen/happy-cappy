'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  translation?: {
    original: string;
    breakdown?: Array<{
      word: string;
      pronunciation: string;
      meaning: string;
    }>;
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Translation failed: ${response.status} ${response.statusText}${errorData.error ? ` - ${errorData.error}` : ''}`);
      }

      const translation = await response.json();
      
      // Validate that we got a proper translation response
      if (!translation || typeof translation !== 'object') {
        throw new Error('Invalid translation response format');
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Translation complete',
        translation,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Translation error:', error);
      
      let errorMessage = 'Sorry, I encountered an error while translating. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Translation failed:')) {
          errorMessage = `Translation service error: ${error.message.replace('Translation failed: ', '')}`;
        } else if (error.message.includes('Invalid translation response')) {
          errorMessage = 'Received an invalid response from the translation service. Please try again.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: errorMessage,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto lg:max-w-4xl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center shadow-sm">
        <Image src="/cappy.png" alt="Cappy" width={50} height={32} className="w-auto" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">🇹🇭</div>
            <p className="text-lg font-medium mb-2">Thai Translator</p>
            <p className="text-sm">Send me English text and I'll give you Vietnamese pronunciation!</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] lg:max-w-[70%] ${
              message.type === 'user' 
                ? 'bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2'
                : 'bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm'
            }`}>
              {message.type === 'user' ? (
                <p className="text-sm">{message.content}</p>
              ) : (
                <>
                  {message.translation ? (
                    <div className="space-y-1">
                      {/* Alternating pronunciation and breakdown */}
                      {message.translation.breakdown && message.translation.breakdown.length > 0 && (
                        message.translation.breakdown.map((item, index) => (
                          <div key={index}>
                            {/* Pronunciation line */}
                            <div className="text-center p-2 bg-blue-50 rounded-lg mb-1">
                              <div className="text-base font-medium text-blue-800 leading-relaxed break-words">
                                {item.pronunciation}
                              </div>
                            </div>
                            {/* Breakdown line */}
                            <div className="text-center p-2 bg-gray-50 rounded-lg mb-2">
                              <div className="text-sm text-gray-700 leading-relaxed break-words">
                                <span className="font-medium text-gray-800">{item.word}</span> - {item.meaning}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800">{message.content}</p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type English text to translate..."
              className="w-full resize-none border border-gray-300 rounded-2xl px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 min-h-[40px] text-sm"
              rows={1}
              style={{
                height: 'auto',
                minHeight: '40px',
                maxHeight: '120px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full p-2 transition-colors duration-200 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
