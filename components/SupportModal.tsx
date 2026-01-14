import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { translations, Language } from '../translations';
import { Card } from './UI';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, lang }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: userMsg }] }],
        config: {
          systemInstruction: `You are the Trimly Concierge, a high-end AI assistant for the Zagreb Barber Network. 
          The user is in Zagreb, Croatia. Help them with:
          - How to use the app (explore, book, profile).
          - Neighborhood info (Donji Grad, Trešnjevka, etc.).
          - Booking etiquette (arrive 5 mins early).
          Keep responses concise, professional, and slightly edgy/premium. If asked about technical errors, tell them to refresh.
          Language: ${lang === 'hr' ? 'Croatian' : 'English'}.`,
        },
      });

      const aiText = response.text || (lang === 'hr' ? 'Oprostite, došlo je do greške.' : 'Sorry, something went wrong.');
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Error connecting to network.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center px-4 pb-10 animate-lux-fade">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose}></div>
      <Card className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[3rem] p-6 h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black">
                <Sparkles size={20} />
             </div>
             <div>
                <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">Trimly Concierge</h3>
                <span className="text-[7px] font-black text-[#D4AF37] uppercase tracking-widest">AI Support Network</span>
             </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-zinc-500">
            <X size={20} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 space-y-6 pb-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
               <MessageSquare size={48} className="text-zinc-800" />
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">How can I assist you today?</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-6 py-4 rounded-[2rem] text-xs font-medium leading-relaxed ${
                m.role === 'user' ? 'bg-[#D4AF37] text-black rounded-tr-none' : 'bg-zinc-900 text-zinc-300 rounded-tl-none'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 px-6 py-4 rounded-[2rem] rounded-tl-none">
                <Loader2 className="animate-spin text-[#D4AF37]" size={16} />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 px-2">
          <div className="relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t.search}
              className="w-full bg-zinc-950 border border-white/5 rounded-[2rem] pl-6 pr-16 py-5 text-white text-xs outline-none focus:border-[#D4AF37]/40"
            />
            <button 
              onClick={handleSend}
              className="absolute right-2 top-2 bottom-2 w-12 bg-[#D4AF37] rounded-full flex items-center justify-center text-black active:scale-90 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SupportModal;