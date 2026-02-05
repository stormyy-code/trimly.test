
import React, { useState, useEffect } from 'react';
import { supabase } from '../../store/supabase';
import { db } from '../../store/database';
import { User, UserRole } from '../../types';
import { BARBER_INVITE_CODE, ADMIN_INVITE_CODE } from '../../constants';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Mail, ArrowLeft, Lock, ShieldCheck, AlertCircle, RefreshCw, Send, Loader2, KeyRound, CheckCircle2, X, AlertTriangle } from 'lucide-react';

interface RegisterScreenProps {
  onLogin: (user: any) => Promise<User | null>;
  onToggle: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  dbStatus: 'connected' | 'error' | 'checking';
  forceUserEmail?: string;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onLogin, onToggle, lang, setLang, dbStatus, forceUserEmail }) => {
  const [email, setEmail] = useState(() => localStorage.getItem('trimly_pending_email') || forceUserEmail || '');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState<UserRole>(() => (localStorage.getItem('trimly_pending_role') as UserRole) || 'customer');
  const [otpCode, setOtpCode] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(() => {
    return localStorage.getItem('trimly_awaiting_verification') === 'true';
  });
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const t = translations[lang];

  useEffect(() => {
    if (forceUserEmail) setEmail(forceUserEmail);
  }, [forceUserEmail]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let finalRole = role;
    if (inviteCode === ADMIN_INVITE_CODE) finalRole = 'admin';
    else if (role === 'barber' && inviteCode !== BARBER_INVITE_CODE) {
      setError(lang === 'hr' ? 'Pogrešan barber kôd.' : 'Invalid barber code.');
      setLoading(false);
      return;
    }

    try {
      localStorage.setItem('trimly_awaiting_verification', 'true');
      localStorage.setItem('trimly_pending_email', email.trim());
      localStorage.setItem('trimly_pending_role', finalRole);

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

      if (authError) {
        localStorage.removeItem('trimly_awaiting_verification');
        throw authError;
      }

      setIsVerifying(true);
      setToast({ 
        msg: lang === 'hr' ? 'Kôd je poslan! Provjerite email.' : 'Code sent! Check your email.', 
        type: 'success' 
      });
    } catch (err: any) {
      localStorage.removeItem('trimly_awaiting_verification');
      setError(err.message || "Greška pri registraciji.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    const pendingEmail = localStorage.getItem('trimly_pending_email') || email;
    
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
      });

      if (resendError) throw resendError;
      setToast({ msg: lang === 'hr' ? 'Novi kôd je poslan.' : 'New code sent.', type: 'success' });
    } catch (err: any) {
      setError(err.message || 'Greška pri ponovnom slanju.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setError(lang === 'hr' ? 'Unesite 6 znamenki.' : 'Enter 6 digits.');
      return;
    }
    setLoading(true);
    setError('');

    const pendingEmail = localStorage.getItem('trimly_pending_email') || email;
    const pendingRole = localStorage.getItem('trimly_pending_role') || role;

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otpCode.trim(),
        type: 'signup'
      });

      if (verifyError) throw verifyError;

      if (data.user) {
        localStorage.removeItem('trimly_awaiting_verification');
        localStorage.removeItem('trimly_pending_email');
        localStorage.removeItem('trimly_pending_role');
        
        await db.updateProfileRole(data.user.id, pendingRole);
        await onLogin(data.user);
      }
    } catch (err: any) {
      setError(err.message || (lang === 'hr' ? "Kôd nije ispravan." : "Invalid code."));
    } finally {
      setLoading(false);
    }
  };

  const cancelVerification = async () => {
    // Ako otkažemo, moramo se odjaviti jer je Supabase možda već kreirao session
    await supabase.auth.signOut();
    setIsVerifying(false);
    localStorage.removeItem('trimly_awaiting_verification');
  };

  if (isVerifying) {
    const displayEmail = localStorage.getItem('trimly_pending_email') || email;
    return (
      <div className="flex flex-col min-h-screen px-8 bg-[#050505] text-white items-center justify-center animate-lux-fade">
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="w-full max-w-sm space-y-12 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-zinc-900 border border-[#D4AF37]/30 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
             <KeyRound size={40} className="text-[#D4AF37]" />
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">VERIFIKACIJA</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
              Unesite kôd poslan na:<br/>
              <span className="text-[#D4AF37] lowercase tracking-normal font-bold">{displayEmail}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="w-full space-y-8">
            {error && (
              <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[8px] font-black uppercase">
                {error}
              </div>
            )}
            
            <input 
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-black border border-white/10 rounded-2xl py-6 text-center text-4xl font-black tracking-[0.4em] text-[#D4AF37] outline-none focus:border-[#D4AF37]/50"
              autoFocus
            />

            <Button type="submit" loading={loading} className="h-20 shadow-2xl">
              POTVRDI KÔD
            </Button>

            <div className="flex flex-col gap-4">
               <button type="button" onClick={handleResendOtp} disabled={resending} className="text-[#D4AF37] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                 {resending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} PONOVNO POŠALJI
               </button>
               <button type="button" onClick={cancelVerification} className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                 ODUSTANI
               </button>
            </div>
          </form>
          
          <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
             <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest leading-relaxed">
               NAPOMENA: U Supabase postavkama (Authentication -> Settings) prekidač "Confirm Email" MORA biti uključen.
             </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-12 bg-[#050505] text-white items-center justify-center overflow-y-auto">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="w-full max-w-xs space-y-10 py-10">
        <div className="text-center space-y-2">
           <h1 className="text-4xl font-black tracking-tighter italic uppercase leading-none">Trimly</h1>
           <p className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.4em]">{t.createAccount}</p>
        </div>

        <div className="flex bg-zinc-950 p-1.5 rounded-[2rem] border border-white/5 shadow-2xl">
           <button type="button" onClick={() => setRole('customer')} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all ${role === 'customer' ? 'bg-[#D4AF37] text-black' : 'text-zinc-700'}`}>KLIJENT</button>
           <button type="button" onClick={() => setRole('barber')} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl transition-all ${role === 'barber' ? 'bg-[#D4AF37] text-black' : 'text-zinc-700'}`}>BARBER</button>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
           {error && (
             <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-[8px] font-black border border-red-500/20 text-center uppercase animate-lux-fade">
               {error}
             </div>
           )}
           <div className="space-y-4">
             <Input label="Email" placeholder="ime@email.com" value={email} onChange={setEmail} required type="email" />
             <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
             {(role === 'barber' || inviteCode.length > 0) && (
               <Input label="Pozivni Kôd" placeholder="KOD..." value={inviteCode} onChange={setInviteCode} />
             )}
           </div>
           <Button type="submit" loading={loading} className="h-20 shadow-2xl">
             PRIDRUŽI SE
           </Button>
        </form>

        <div className="pt-4 flex flex-col items-center gap-6">
          <button onClick={onToggle} className="w-full text-zinc-500 text-[9px] font-black uppercase tracking-widest text-center">
            {t.haveAccount} <span className="text-[#D4AF37]">PRIJAVA</span>
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5">
            <ShieldCheck size={12} className="text-[#D4AF37]" />
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">{t.secureAccess}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
