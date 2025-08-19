
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Loader, Send, X } from './icons';

interface Message {
  text: string;
  sender: 'user' | 'bot';
}

interface ChatbotProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSend: (prompt: string) => Promise<string>;
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
}

export const Chatbot: React.FC<ChatbotProps> = ({ isOpen, setIsOpen, onSend, apiKey, setApiKey }) => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: "Hello! How can I help you design your process map today? Try 'Create a simple user login flow'." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const botResponseText = await onSend(input);
      const botMessage: Message = { text: botResponseText, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = { 
        text: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'bot' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
    }
  };

  const ApiKeyForm = () => (
    <div className="flex-1 p-4 flex flex-col justify-center items-center">
        <h4 className="text-md font-semibold text-center mb-4 text-gray-300">Gemini API Key Required</h4>
        <p className="text-xs text-center text-gray-400 mb-4">
            To use the AI Assistant, please enter your Google Gemini API key. It will be stored locally in your browser.
        </p>
        <input
            type="password"
            value={tempApiKey}
            onChange={(e) => setTempApiKey(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSaveApiKey()}
            placeholder="Enter your API key..."
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 mb-2 text-sm"
        />
        <button
            onClick={handleSaveApiKey}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
        >
            Save Key
        </button>
         <button
            onClick={() => setApiKey(null)}
            className="text-xs text-gray-500 hover:text-gray-300 mt-4"
        >
            Clear Key
        </button>
    </div>
  );

  const ChatInterface = () => (
      <>
        <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex flex-col space-y-4">
            {messages.map((msg, index) => (
                <div key={index} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                {msg.sender === 'bot' && <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0"><Bot size={20}/></div>}
                <div className={`max-w-xs px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                    <p className="text-sm">{msg.text}</p>
                </div>
                </div>
            ))}
            {isLoading && 
                <div className="flex items-end gap-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0"><Bot size={20}/></div>
                <div className="max-w-xs px-4 py-2 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none">
                    <Loader className="animate-spin" />
                </div>
                </div>
            }
            <div ref={messagesEndRef} />
            </div>
        </div>
        <div className="p-4 border-t border-gray-700">
            <div className="flex items-center bg-gray-900 rounded-lg">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Describe your process..."
                className="flex-1 bg-transparent text-white px-4 py-2 outline-none"
                disabled={isLoading}
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 text-indigo-400 disabled:text-gray-500 hover:text-indigo-300">
                <Send />
            </button>
            </div>
        </div>
      </>
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-500 transition-transform transform hover:scale-110"
        aria-label="Open chatbot"
      >
        <Bot size={28} />
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 right-6 w-96 h-[32rem] bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-bold text-indigo-400">AI Assistant</h3>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
      </header>
      {apiKey ? <ChatInterface /> : <ApiKeyForm />}
    </div>
  );
};
