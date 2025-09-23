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
      thai: string;
      pronunciation: string;
      meaning: string;
    }>;
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Map<string, string>>(new Map());
  const [audioLoading, setAudioLoading] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Pre-load audio when translation is received
  const preloadAudio = async (thaiText: string, audioId: string) => {
    try {
      // Check if already cached or currently loading
      if (audioCache.has(audioId) || audioLoading.has(audioId)) {
        return;
      }

      // Mark as loading
      setAudioLoading(prev => new Set(prev).add(audioId));

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: thaiText }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cache the audio URL
      setAudioCache(prev => new Map(prev).set(audioId, audioUrl));
      
      // Remove from loading set
      setAudioLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(audioId);
        return newSet;
      });
    } catch (error) {
      console.error('Audio preload error:', error);
      // Remove from loading set even on error
      setAudioLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(audioId);
        return newSet;
      });
    }
  };

  // Play cached audio instantly
  const playAudio = async (audioId: string) => {
    try {
      const cachedAudioUrl = audioCache.get(audioId);
      
      if (!cachedAudioUrl) {
        console.error('Audio not cached for', audioId);
        return;
      }

      setPlayingAudio(audioId);
      const audio = new Audio(cachedAudioUrl);
      
      audio.onended = () => {
        setPlayingAudio(null);
      };
      
      audio.onerror = () => {
        setPlayingAudio(null);
      };

      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setPlayingAudio(null);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup audio URLs when component unmounts
  useEffect(() => {
    return () => {
      audioCache.forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioCache]);

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

      // Pre-load audio immediately after adding the message
      if (translation.breakdown && translation.breakdown.length > 0) {
        const allThaiText = translation.breakdown.map((item: {word: string; thai: string; pronunciation: string; meaning: string}) => item.thai).join(' ');
        preloadAudio(allThaiText, assistantMessage.id);
      }
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
                    <div className="space-y-1 relative">
                      {/* Alternating pronunciation and breakdown */}
                      {message.translation.breakdown && message.translation.breakdown.length > 0 && (
                        <>
                          {message.translation.breakdown.map((item, index) => (
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
                          ))}
                          
                          {/* Play button - bottom right */}
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => playAudio(message.id)}
                              disabled={playingAudio === message.id || audioLoading.has(message.id)}
                              className="flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors duration-200 disabled:opacity-50"
                              title={audioLoading.has(message.id) ? "Loading audio..." : "Play Thai pronunciation"}
                            >
                              {audioLoading.has(message.id) ? (
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a7.646 7.646 0 100 15.292V12"/>
                                </svg>
                              ) : playingAudio === message.id ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.1;1" dur="0.6s" repeatCount="indefinite"/>
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </>
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
              className="w-full resize-none border border-gray-300 rounded-2xl px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 min-h-[40px] text-sm text-gray-900 placeholder-gray-500"
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
