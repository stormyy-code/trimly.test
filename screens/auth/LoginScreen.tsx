
import React, { useState } from 'react';
import { supabase } from '../../store/supabase';
import { User } from '../../types';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ShieldCheck, ArrowLeft, Mail, AlertTriangle } from 'lucide-react';
import Logo from '../../components/Logo';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface LoginScreenProps {
  onLogin: (user: SupabaseUser) => Promise<User | null>;
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
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const t = translations[lang];

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      
      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          setError(lang === 'hr' 
            ? 'Email nije potvrđen! Provjerite kôd u mailu.' 
            : 'Email not confirmed! Check your email code.');
          setLoading(false);
          return;
        }
        throw authError;
      }

      if (data.user) {
        await onLogin(data.user);
      }
    } catch (err: any) {
      setError(err.message || t.invalidError);
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (resetError) throw resetError;

      setToast({ 
        msg: lang === 'hr' ? 'Zahtjev poslan! Provjerite mail.' : 'Request sent! Check your email.', 
        type: 'success' 
      });
      
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setError(err.message || "Greška pri slanju.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'forgot') {
    return (
      <div className="h-full w-full flex flex-col bg-[#050505] text-white animate-lux-fade overflow-y-auto pb-safe">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="w-full flex justify-between items-center py-6 px-6 pt-safe">
          <button onClick={() => setMode('login')} className="p-3 bg-zinc-900/40 rounded-xl text-zinc-400">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto space-y-8 py-4 px-6">
          <div className="flex flex-col items-center text-center space-y-4">
             <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-[2rem] flex items-center justify-center text-[#D4AF37]">
               <Mail size={32} />
             </div>
             <h1 className="text-3xl font-black tracking-tighter italic uppercase">{t.resetPassword}</h1>
          </div>

          <form onSubmit={handleResetPassword} className="w-full space-y-6">
            {error && <div className="p-4 rounded-xl text-red-500 bg-red-500/10 border border-red-500/20 text-center uppercase text-[9px]">{error}</div>}
            <Input label={t.email} placeholder="name@email.com" type="email" value={email} onChange={setEmail} required />
            <Button type="submit" loading={loading}>{t.sendResetLink}</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#050505] text-white animate-lux-fade overflow-y-auto pb-safe">
      <div className="w-full flex justify-center py-6 pt-safe">
        <div className="flex bg-zinc-900/40 border border-white/5 rounded-full p-1 backdrop-blur-xl">
          <button onClick={() => setLang('hr')} className={`px-4 py-1.5 rounded-full text-[8px] font-black ${lang === 'hr' ? 'bg-[#D4AF37] text-black' : 'text-zinc-600'}`}>HR</button>
          <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[8px] font-black ${lang === 'en' ? 'bg-[#D4AF37] text-black' : 'text-zinc-600'}`}>EN</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto space-y-8 py-4 px-6">
        <div className="flex flex-col items-center animate-slide-up mt-4">
          <div className="w-24 h-24 bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-2xl p-4 mb-6">
             <Logo />
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic uppercase">Trimly</h1>
          <p className="text-[#D4AF37] text-[8px] font-black uppercase tracking-[0.4em] opacity-80 mt-2">{t.network}</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full animate-slide-up">
          {error && <div className="p-4 rounded-xl text-red-500 bg-red-500/10 border border-red-500/20 text-center uppercase text-[8px]">{error}</div>}
          <Input label={t.email} placeholder="name@email.com" value={email} onChange={setEmail} required />
          <div className="space-y-2">
            <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
            <button type="button" onClick={() => setMode('forgot')} className="text-[9px] font-black text-[#D4AF37] uppercase tracking-widest ml-5">{t.forgotPassword}</button>
          </div>
          <Button type="submit" loading={loading}>{t.login}</Button>
        </form>

        <div className="pb-10 flex flex-col items-center gap-6">
          <p className="text-zinc-500 text-xs">{t.noAccount} <button onClick={onToggle} className="text-[#D4AF37] font-black uppercase tracking-widest">{t.signup}</button></p>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5">
            <ShieldCheck size={12} className="text-[#D4AF37]" />
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">{t.secureAccess}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
