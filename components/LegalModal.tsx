import React from 'react';
import { X, Shield, FileText, ChevronRight, ExternalLink } from 'lucide-react';
import { translations, Language } from '../translations';
import { Card } from './UI';

interface ContentWrapperProps {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
}

// Explicitly define as React.FC to ensure the children prop is correctly handled in JSX
const ContentWrapper: React.FC<ContentWrapperProps> = ({ title, children, onBack }) => (
  <div className="flex flex-col h-full animate-lux-fade">
    <div className="flex items-center justify-between mb-8">
      <button onClick={onBack} className="text-[#D4AF37] text-[10px] font-black uppercase tracking-widest">Back</button>
      <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{title}</h3>
      <div className="w-8"></div>
    </div>
    <div className="flex-1 overflow-y-auto pr-2 space-y-6 text-zinc-400 text-xs leading-relaxed font-medium pb-10">
      {children}
    </div>
  </div>
);

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  const [view, setView] = React.useState<'menu' | 'terms' | 'privacy'>('menu');
  const externalPrivacyUrl = "https://sites.google.com/view/trimly-privacy-policy/po%C4%8Detna-stranica";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center px-4 pb-10 animate-lux-fade">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose}></div>
      <Card className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[3rem] p-8 h-[80vh] flex flex-col shadow-[0_50px_100px_rgba(0,0,0,1)]">
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-zinc-500 active:scale-90 transition-all">
          <X size={20} />
        </button>

        {view === 'menu' ? (
          <div className="flex flex-col gap-8 pt-4">
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{t.legal}</h2>
              <p className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">Trimly Zagreb Network Compliance</p>
            </div>
            
            <button onClick={() => setView('terms')} className="flex items-center justify-between p-6 bg-zinc-900/50 rounded-3xl border border-white/5 active:scale-95 transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-all">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-black text-white uppercase italic">{t.terms}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">User Agreement & Rules</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-800" />
            </button>

            <button onClick={() => setView('privacy')} className="flex items-center justify-between p-6 bg-zinc-900/50 rounded-3xl border border-white/5 active:scale-95 transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-all">
                  <Shield size={20} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-black text-white uppercase italic">{t.privacy}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Data Protection & GDPR</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-zinc-800" />
            </button>
            
            <div className="mt-10 p-6 bg-[#D4AF37]/5 rounded-3xl border border-[#D4AF37]/10 text-center">
               <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-loose">
                 By using Trimly, you agree to our electronic communications policy. All data is processed via secure Supabase clusters in the EU.
               </p>
            </div>
          </div>
        ) : view === 'terms' ? (
          // Fixed: Explicitly typed ContentWrapper as React.FC to ensure children prop is recognized
          <ContentWrapper title={t.terms} onBack={() => setView('menu')}>
            <p className="text-[#D4AF37] font-black uppercase tracking-widest text-[9px]">Last Updated: February 2024</p>
            <h4 className="text-white font-black italic uppercase">1. Booking Rules</h4>
            <p>All bookings made through Trimly are subject to barber approval. Users are expected to arrive at the shop at least 5 minutes before their scheduled time.</p>
            <h4 className="text-white font-black italic uppercase">2. Cancellations</h4>
            <p>Cancellations must be made at least 2 hours in advance. Repeated no-shows may result in permanent suspension from the Zagreb network.</p>
            <h4 className="text-white font-black italic uppercase">3. Payments</h4>
            <p>Trimly is a booking platform. Payments for services are handled directly between the customer and the barber at the physical shop location.</p>
          </ContentWrapper>
        ) : (
          // Fixed: Explicitly typed ContentWrapper as React.FC to ensure children prop is recognized
          <ContentWrapper title={t.privacy} onBack={() => setView('menu')}>
            <div className="space-y-8">
              <div className="p-6 bg-[#D4AF37]/10 rounded-3xl border border-[#D4AF37]/20 flex flex-col gap-4">
                <h4 className="text-white font-black italic uppercase text-sm">Official Privacy Policy</h4>
                <p className="text-[10px] leading-relaxed">Our full legal policy is hosted on our official web terminal. Please read it carefully regarding your data rights in the Republic of Croatia.</p>
                <a 
                  href={externalPrivacyUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-[#D4AF37] text-black rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <ExternalLink size={14} /> {t.readFullPolicy}
                </a>
              </div>

              <div className="space-y-6 opacity-60">
                <h4 className="text-white font-black italic uppercase">EU GDPR Compliance</h4>
                <p>We collect: Email Address, Full Name / Nickname, Password (encrypted), IP Addresses, GPS Coordinates, and Profile Pictures.</p>
                <h4 className="text-white font-black italic uppercase">Security</h4>
                <p>Your data is stored on encrypted PostgreSQL servers managed by Supabase. We do not sell data to third-party advertisers.</p>
              </div>
            </div>
          </ContentWrapper>
        )}
      </Card>
    </div>
  );
};

export default LegalModal;