
import React, { useState } from 'react';
import { Clock, LogOut, RefreshCcw, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../../components/UI';
import { Language, translations } from '../../translations';

interface BarberWaitingRoomProps {
  lang: Language;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}

const BarberWaitingRoom: React.FC<BarberWaitingRoomProps> = ({ lang, onLogout, onRefresh }) => {
  const t = translations[lang];
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    // Čekamo malo da se UI osvježi ako je došlo do promjene
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center space-y-12 animate-lux-fade">
      <div className="relative">
        <div className="absolute inset-0 bg-[#D4AF37]/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
        <div className="w-28 h-28 bg-zinc-900 rounded-[3rem] border border-[#D4AF37]/30 flex items-center justify-center relative z-10 shadow-2xl">
          <Clock className="text-[#D4AF37] animate-pulse" size={48} />
        </div>
      </div>

      <div className="space-y-4 max-w-xs">
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-tight">
          {lang === 'hr' ? 'PROVJERA U TIJEKU' : 'VERIFICATION IN PROGRESS'}
        </h2>
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.25em] leading-relaxed">
          {lang === 'hr' 
            ? 'Vaš profil je uspješno poslan. Čim Admin odobri vašu licencu za rad u mreži, moći ćete pristupiti alatima.' 
            : 'Your profile has been submitted. Once the Admin approves your network license, you will gain access to all tools.'}
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-4">
        <Button 
          onClick={handleRefresh} 
          variant="primary" 
          disabled={isRefreshing}
          loading={isRefreshing}
          className="w-full h-18 text-[10px] flex items-center justify-center gap-3"
        >
          {!isRefreshing && <RefreshCcw size={16} />} {lang === 'hr' ? 'Provjeri status' : 'Check Status'}
        </Button>
        <button 
          onClick={onLogout} 
          className="w-full py-5 text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] flex items-center justify-center gap-3 active:scale-95 transition-all hover:text-red-500"
        >
          <LogOut size={16} /> {t.logout}
        </button>
      </div>

      <div className="pt-8 flex items-center gap-3 opacity-20">
         <ShieldCheck size={14} className="text-[#D4AF37]" />
         <span className="text-[8px] font-black uppercase tracking-widest">Trimly Zagreb Network Security</span>
      </div>
    </div>
  );
};

export default BarberWaitingRoom;
