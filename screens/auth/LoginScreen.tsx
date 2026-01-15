
import React, { useState } from 'react';
import { supabase } from '../../store/supabase';
import { User } from '../../types';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ShieldCheck, ArrowLeft, Mail, AlertTriangle, Info, Settings, Copy, Check } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);

  const t = translations[lang];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            ? 'Email nije potvrđen! Ugasite "Confirm email" u Supabase Dashboardu (Sign In / Providers) za lakši rad.' 
            : 'Email not confirmed! Disable "Confirm email" in Supabase Dashboard to skip this check.');
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
    
    // Ovo je URL na koji Supabase mora vratiti korisnika
    const redirectUrl = window.location.origin;
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        if (resetError.status === 429 || resetError.message.includes('rate limit')) {
          const msg = lang === 'hr' 
            ? 'Dosegnut limit. Isključite "Confirm email" ili postavite SMTP u Supabaseu.' 
            : 'Rate limit hit. Disable "Confirm email" or set up SMTP in Supabase.';
          setError(msg);
          setToast({ msg, type: 'error' });
          return;
        }
        throw resetError;
      }

      setToast({ 
        msg: lang === 'hr' ? 'Zahtjev poslan! Provjerite mail.' : 'Request sent! Check your email.', 
        type: 'success' 
      });
      
      setTimeout(() => setMode('login'), 3000);
    } catch (err: any) {
      setError(err.message || "Greška pri slanju.");
      setToast({ msg: err.message, type: 'error' });
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
             <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
               Upišite email da bi dobili link za resetiranje lozinke.
             </p>
          </div>

          <form onSubmit={handleResetPassword} className="w-full space-y-6">
            {error && (
              <div className="p-4 rounded-xl text-[9px] font-black border text-center uppercase bg-red-500/10 border-red-500/20 text-red-500 flex items-center justify-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <Input label={t.email} placeholder="name@email.com" type="email" value={email} onChange={setEmail} required />
            <Button type="submit" loading={loading} className="h-16 shadow-2xl">{t.sendResetLink}</Button>
            
            <div className="p-6 bg-zinc-900/50 rounded-3xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#D4AF37]">
                  <Settings size={14} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Podešavanje Supabase-a</span>
                </div>
              </div>
              
              <p className="text-[8px] text-zinc-500 leading-relaxed uppercase font-bold">
                Da bi link iz maila radio, u Supabase <span className="text-white">"URL Configuration"</span> kopirajte ovo:
              </p>

              <div 
                onClick={() => copyToClipboard(window.location.origin)}
                className="bg-black border border-white/10 rounded-xl p-3 flex items-center justify-between cursor-pointer active:scale-95 transition-all group"
              >
                <code className="text-[10px] text-emerald-400 lowercase truncate max-w-[200px]">{window.location.origin}</code>
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-700 group-hover:text-white transition-colors" />}
              </div>

              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-[7px] text-amber-500 leading-tight uppercase font-black italic">
                  Link u mailu trenutno ne radi jer Supabase misli da je vaša stranica na drugoj adresi. Popravite to u "Site URL" postavkama.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#050505] text-white animate-lux-fade overflow-y-auto pb-safe">
      <div className="w-full flex justify-center py-6 pt-safe">
        <div className="flex bg-zinc-900/40 border border-white/5 rounded-full p-1 backdrop-blur-xl">
          <button onClick={() => setLang('hr')} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${lang === 'hr' ? 'bg-[#D4AF37] text-black' : 'text-zinc-600'}`}>HR</button>
          <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${lang === 'en' ? 'bg-[#D4AF37] text-black' : 'text-zinc-600'}`}>EN</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto space-y-8 py-4 px-6">
        <div className="flex flex-col items-center animate-slide-up mt-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#D4AF37]/10 blur-3xl rounded-full scale-110"></div>
            <div className="w-24 h-24 bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-2xl p-4">
               <Logo />
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic uppercase leading-none">Trimly</h1>
          <p className="text-[#D4AF37] text-[8px] font-black uppercase tracking-[0.4em] opacity-80 mt-2">{t.network}</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full animate-slide-up">
          {error && <div className="p-4 rounded-xl text-[8px] font-black border text-center tracking-widest uppercase bg-red-500/10 border-red-500/20 text-red-500">{error}</div>}
          <div className="space-y-4">
            <Input label={t.email} placeholder="name@email.com" value={email} onChange={setEmail} required />
            <div className="space-y-2">
              <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
              <button 
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[9px] font-black text-[#D4AF37] uppercase tracking-widest ml-5"
              >
                {t.forgotPassword}
              </button>
            </div>
          </div>
          <Button type="submit" loading={loading} className="h-16">{t.login}</Button>
        </form>

        <div className="flex flex-col items-center gap-6 w-full animate-slide-up pb-10">
          <p className="text-zinc-500 text-xs font-medium">
            {t.noAccount} <button onClick={onToggle} className="text-[#D4AF37] font-black uppercase tracking-widest ml-1">{t.signup}</button>
          </p>
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
