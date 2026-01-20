
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../store/supabase';
import { db } from '../../store/database';
import { User, UserRole } from '../../types';
import { BARBER_INVITE_CODE, ADMIN_INVITE_CODE } from '../../constants';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { User as UserIcon, Scissors, Info, Loader2, AlertTriangle, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';

interface RegisterScreenProps {
  onLogin: (user: any) => void;
  onToggle: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  dbStatus: 'connected' | 'error' | 'checking';
  forceUserEmail?: string;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onLogin, onToggle, lang, setLang, dbStatus, forceUserEmail }) => {
  const [email, setEmail] = useState(forceUserEmail || '');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'register' | 'verify'>('register');
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const t = translations[lang];

  useEffect(() => {
    if (forceUserEmail) setEmail(forceUserEmail);
  }, [forceUserEmail]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let finalRole = role;

    if (inviteCode === ADMIN_INVITE_CODE) {
      finalRole = 'admin';
    } else if (role === 'barber' && inviteCode !== BARBER_INVITE_CODE) {
      setError(lang === 'hr' ? 'Pogrešan barber kôd.' : 'Invalid barber code.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { 
            role: finalRole,
            full_name: email.split('@')[0]
          }
        }
      });

      if (authError) throw authError;

      if (data.user) {
        if (data.session) {
          await db.updateProfileRole(data.user.id, finalRole);
          onLogin(data.user);
        } else {
          setView('verify');
        }
      }
    } catch (err: any) {
      setError(err.message || "Greška pri registraciji.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const token = otp.join('');
    if (token.length < 6) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'signup'
      });

      if (verifyError) throw verifyError;

      if (data.user) {
        await db.updateProfileRole(data.user.id, role);
        onLogin(data.user);
      }
    } catch (err: any) {
      setError(lang === 'hr' ? 'Neispravan kod.' : 'Invalid code.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.join('').length === 6) {
      handleVerifyOtp();
    }
  }, [otp]);

  if (view === 'verify') {
    return (
      <div className="flex flex-col min-h-screen px-6 bg-[#0A0A0A] text-white items-center justify-center animate-lux-fade overflow-x-hidden">
        <div className="w-full max-w-sm space-y-10 text-center flex flex-col items-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-[1.5rem] flex items-center justify-center mx-auto border border-[#D4AF37]/20">
               <ShieldCheck size={28} className="text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">{t.verifyCode}</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed px-4">
              {t.enterOtp} na <br/><span className="text-[#D4AF37] break-all">{email}</span>
            </p>
          </div>

          <div className="flex justify-center gap-2 w-full max-w-[320px]">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (otpRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(e.target.value, i)}
                onKeyDown={(e) => handleOtpKeyDown(e, i)}
                className="flex-1 aspect-[2/3] max-h-16 bg-[#0F0F0F] border border-white/10 rounded-xl text-center text-xl font-black text-[#D4AF37] outline-none focus:border-[#D4AF37] focus:bg-zinc-900 transition-all shadow-inner min-w-0"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <div className="space-y-6 w-full px-4">
            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[9px] font-black uppercase animate-shake">{error}</div>}
            
            <Button onClick={handleVerifyOtp} loading={loading} className="h-16 shadow-2xl text-[10px]">
              {t.confirm}
            </Button>
            
            <button 
              type="button" 
              onClick={() => setView('register')} 
              className="flex items-center justify-center gap-2 mx-auto text-zinc-600 text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              <ArrowLeft size={14} /> {t.back}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-12 bg-[#0A0A0A] text-white overflow-y-auto items-center w-full justify-center">
       <div className="absolute top-10 flex bg-white/5 border border-white/10 rounded-full p-1 backdrop-blur-xl">
        <button onClick={() => setLang('hr')} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${lang === 'hr' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>HR</button>
        <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${lang === 'en' ? 'bg-[#D4AF37] text-black' : 'text-zinc-600'}`}>EN</button>
      </div>

      <div className="w-full max-w-xs mt-12 pb-12">
        <div className="flex flex-col items-center mb-8 text-center px-2">
           <h1 className="text-3xl font-black tracking-tighter italic uppercase text-white leading-none">
             {forceUserEmail ? 'Dovršite Profil' : t.createAccount}
           </h1>
           <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em] mt-3">
             {forceUserEmail ? 'Odaberite ili potvrdite ulogu' : t.joinNetwork}
           </p>
        </div>

        <div className="flex bg-zinc-950 p-1.5 rounded-[2rem] border border-white/5 mb-8 shadow-2xl">
           <button onClick={() => setRole('customer')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-1.5 ${role === 'customer' ? 'bg-[#D4AF37] text-black' : 'text-zinc-700'}`}>
             <UserIcon size={14} /> {t.client}
           </button>
           <button onClick={() => setRole('barber')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-1.5 ${role === 'barber' ? 'bg-[#D4AF37] text-black' : 'text-zinc-700'}`}>
             <Scissors size={14} /> {t.barber}
           </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
           {error && (
             <div className="bg-red-500/10 text-red-500 p-5 rounded-2xl text-[9px] font-black uppercase border border-red-500/20 tracking-widest text-center shadow-2xl">
               {error}
             </div>
           )}

           {!forceUserEmail && (
             <>
               <Input label={t.email} placeholder="ime@email.com" value={email} onChange={setEmail} required />
               <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
             </>
           )}
           
           <div className="space-y-4">
              <Input label={lang === 'hr' ? 'Kôd (opcionalno)' : 'Code (optional)'} placeholder="KOD..." value={inviteCode} onChange={setInviteCode} />
              <div className="flex items-center gap-3 px-5 py-4 bg-zinc-900 border border-white/5 rounded-2xl">
                 <Info size={14} className="text-zinc-500 shrink-0" />
                 <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 leading-tight">
                   Barberi i Admini moraju unijeti kôd za aktivaciju.
                 </p>
              </div>
           </div>

           <Button type="submit" loading={loading} className="w-full h-18 text-xs font-black shadow-2xl">
             {forceUserEmail ? 'POTVRDI' : t.signup}
           </Button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-6">
          <p className="text-zinc-500 text-xs font-medium">
            {t.haveAccount} 
            <button onClick={onToggle} className="text-[#D4AF37] font-black uppercase tracking-wider text-[10px] ml-1">{t.login}</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
