
import React, { useState, useEffect } from 'react';
import { supabase } from '../../store/supabase';
import { db } from '../../store/database';
import { User, UserRole } from '../../types';
import { BARBER_INVITE_CODE, ADMIN_INVITE_CODE } from '../../constants';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ArrowLeft, KeyRound, RefreshCw, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';

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

      // Supabase uspješno kreirao usera, ali ako je email_confirmed_at null, idemo na OTP
      if (data.user && !data.user.email_confirmed_at) {
        localStorage.setItem('trimly_awaiting_verification', 'true');
        localStorage.setItem('trimly_pending_email', email.trim());
        localStorage.setItem('trimly_pending_role', finalRole);
        setIsVerifying(true);
        setToast({ 
          msg: lang === 'hr' ? 'Kôd je poslan na email!' : 'Verification code sent!', 
          type: 'success' 
        });
      } else if (data.user) {
        // Mail je automatski potvrđen (ako je Supabase config takav)
        await onLogin(data.user);
      }
    } catch (err: any) {
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
      setToast({ msg: lang === 'hr' ? 'Novi kôd poslan.' : 'New code sent.', type: 'success' });
    } catch (err: any) {
      setError(err.message || 'Greška pri slanju koda.');
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
      setError(err.message || (lang === 'hr' ? "Neispravan kôd." : "Invalid code."));
    } finally {
      setLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="flex flex-col min-h-screen px-8 bg-[#050505] text-white items-center justify-center animate-lux-fade">
        <div className="w-full max-w-sm space-y-12 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-zinc-900 border border-[#D4AF37]/30 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
             <KeyRound size={40} className="text-[#D4AF37]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">VERIFIKACIJA</h2>
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-relaxed">
              Unesite 6-znamenkasti kôd poslan na:<br/>
              <span className="text-[#D4AF37]">{localStorage.getItem('trimly_pending_email') || email}</span>
            </p>
          </div>
          
          <form onSubmit={handleVerifyOtp} className="w-full space-y-8">
            {error && <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[8px] font-black uppercase">{error}</div>}
            <input 
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-black border border-white/10 rounded-2xl py-6 text-center text-4xl font-black tracking-[0.4em] text-[#D4AF37] outline-none shadow-inner"
              autoFocus
            />
            <Button type="submit" loading={loading}>POTVRDI</Button>
            <div className="flex flex-col gap-4">
               <button type="button" onClick={handleResendOtp} disabled={resending} className="text-[#D4AF37] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                 {resending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} POŠALJI PONOVNO
               </button>
               <button type="button" onClick={() => {
                 supabase.auth.signOut();
                 setIsVerifying(false);
                 localStorage.removeItem('trimly_awaiting_verification');
                 onToggle();
               }} className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">NAZAD NA PRIJAVU</button>
            </div>
          </form>

          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl flex items-start gap-4 text-left">
             <AlertTriangle size={24} className="text-red-500 shrink-0" />
             <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest leading-relaxed">
               VAŽNO: Ako kôd ne stiže, provjerite "Confirm Email" u Supabase postavkama. Supabase šalje mailove putem vašeg SMTP-a ili svog defaulta.
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
        <h1 className="text-4xl font-black tracking-tighter italic uppercase text-center leading-none">Trimly</h1>
        <div className="flex bg-zinc-950 p-1.5 rounded-[2rem] border border-white/5 shadow-2xl">
           <button type="button" onClick={() => setRole('customer')} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl ${role === 'customer' ? 'bg-[#D4AF37] text-black' : 'text-zinc-700'}`}>KLIJENT</button>
           <button type="button" onClick={() => setRole('barber')} className={`flex-1 py-4 text-[8px] font-black uppercase tracking-widest rounded-2xl ${role === 'barber' ? 'bg-[#D4AF37] text-black' : 'text-zinc-700'}`}>BARBER</button>
        </div>
        <form onSubmit={handleRegister} className="space-y-6">
           {error && <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-[8px] font-black border border-red-500/20 text-center uppercase">{error}</div>}
           <div className="space-y-4">
             <Input label="Email" placeholder="ime@email.com" value={email} onChange={setEmail} required type="email" />
             <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
             {(role === 'barber' || inviteCode.length > 0) && <Input label="Invite Kôd" placeholder="KOD..." value={inviteCode} onChange={setInviteCode} />}
           </div>
           <Button type="submit" loading={loading}>KREIRAJ RAČUN</Button>
        </form>
        <div className="flex flex-col items-center gap-6">
          <button onClick={onToggle} className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">{t.haveAccount} <span className="text-[#D4AF37]">PRIJAVA</span></button>
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
