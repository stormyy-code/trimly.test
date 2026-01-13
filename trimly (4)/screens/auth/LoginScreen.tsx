
import React, { useState } from 'react';
import { supabase } from '../../store/supabase';
import { db } from '../../store/mockDatabase';
import { User } from '../../types';
import { Button, Input } from '../../components/UI';
import { translations, Language } from '../../translations';
import { LogIn, ShieldCheck, Wifi, WifiOff, ShieldAlert, ExternalLink } from 'lucide-react';
import Logo from '../../components/Logo';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onToggle: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  dbStatus: 'connected' | 'error' | 'checking';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onToggle, lang, setLang, dbStatus }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRlsWarning, setShowRlsWarning] = useState(false);

  const t = translations[lang];

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setShowRlsWarning(false);
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Pokušaj dohvatiti profil - ako RLS nije postavljen, ovo će baciti grešku 42501
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        if (profileError?.code === '42501') {
          setError(lang === 'hr' ? "RLS blokira čitanje profila." : "RLS blocks profile reading.");
          setShowRlsWarning(true);
        } else {
          setError(lang === 'hr' ? "Profil nije pronađen." : "Profile not found.");
        }
        return;
      }

      const fullUser = { id: data.user.id, email: data.user.email, role: profile.role } as any;
      db.setActiveUser(fullUser);
      onLogin(fullUser);
      
    } catch (err: any) {
      setError(err.message || t.invalidError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-8 pt-12 pb-12 bg-[#0A0A0A] text-white animate-lux-fade overflow-x-hidden w-full items-center justify-center relative">
      <div className="absolute top-12 flex bg-white/5 border border-white/10 rounded-full p-1 ios-shadow">
        <button onClick={() => setLang('hr')} className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${lang === 'hr' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>HR</button>
        <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${lang === 'en' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>EN</button>
      </div>

      <div className="w-full max-w-xs flex flex-col items-center mt-12">
        <div className="flex flex-col items-center mb-12">
          <div className="w-24 h-24 bg-[#111] border border-white/10 rounded-[2.5rem] flex items-center justify-center mb-6 relative z-10 shadow-2xl overflow-hidden p-3">
             <Logo className="w-full h-full" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-2 italic text-center">TRIMLY</h1>
          <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] text-center">{t.network}</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5 w-full">
          {error && <div className="p-4 rounded-2xl text-[9px] font-black border text-center tracking-widest uppercase bg-red-500/10 border-red-500/20 text-red-500">{error}</div>}
          
          {showRlsWarning && (
            <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-2xl p-6 space-y-4 mb-2 animate-lux-fade">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <ShieldAlert size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Postavi SELECT policu</span>
              </div>
              <p className="text-[9px] text-zinc-400 font-bold leading-relaxed lowercase italic">
                U Supabaseu dodajte policu za <span className="text-white font-black uppercase">SELECT</span> command. Kod mora biti: <code className="bg-black px-1 rounded text-[#D4AF37]">auth.uid() = id</code>
              </p>
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 text-[8px] font-black text-white uppercase tracking-widest pt-2 border-t border-white/5"
              >
                Supabase Dashboard <ExternalLink size={10} />
              </a>
            </div>
          )}

          <Input label={t.email} placeholder="name@email.com" value={email} onChange={setEmail} required />
          <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
          <Button type="submit" loading={loading} className="h-16 text-xs font-black uppercase tracking-[0.2em]"><LogIn size={18} /> {t.login}</Button>
        </form>

        <div className="mt-10 flex flex-col items-center gap-3">
          <p className="text-zinc-500 text-xs font-medium mb-2">{t.noAccount} <button onClick={onToggle} className="text-[#D4AF37] font-black uppercase tracking-wider text-[10px] ml-1">{t.signup}</button></p>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/5 shadow-2xl">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{t.secureAccess}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
