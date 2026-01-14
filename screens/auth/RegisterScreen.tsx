
import React, { useState } from 'react';
import { supabase } from '../../store/supabase';
import { db } from '../../store/mockDatabase';
import { User, UserRole } from '../../types';
import { BARBER_INVITE_CODE } from '../../constants';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { ArrowLeft, User as UserIcon, Scissors, ShieldCheck, Mail, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface RegisterScreenProps {
  onLogin: (user: User) => void;
  onToggle: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  dbStatus: 'connected' | 'error' | 'checking';
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onLogin, onToggle, lang, setLang, dbStatus }) => {
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const t = translations[lang];

  const createProfileRecord = async (userId: string, userEmail: string, userRole: UserRole) => {
    const { error: profileError } = await supabase.from('profiles').insert([{ 
      id: userId, 
      email: userEmail, 
      role: userRole 
    }]);

    if (profileError) throw profileError;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (role === 'barber' && inviteCode !== BARBER_INVITE_CODE) {
      setError(lang === 'hr' ? 'Pogrešan brijački kod' : 'Wrong barber code');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user) {
        if (data.session) {
          await createProfileRecord(data.user.id, email, role);
          const fullUser = { id: data.user.id, email, role } as User;
          db.setActiveUser(fullUser);
          onLogin(fullUser);
        } else {
          setStep('verify');
        }
      }
    } catch (err: any) {
      setError(err.message || "Greška pri registraciji");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      });

      if (verifyError) throw verifyError;
      if (!data.user) throw new Error("Verifikacija nije uspjela");

      await createProfileRecord(data.user.id, email, role);

      const fullUser = { id: data.user.id, email, role } as User;
      db.setActiveUser(fullUser);
      onLogin(fullUser);

    } catch (err: any) {
      setError(err.message || "Greška pri verifikaciji");
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="flex flex-col min-h-screen px-8 pt-12 pb-12 bg-[#0A0A0A] text-white animate-lux-fade items-center w-full justify-center">
        <div className="w-full max-w-xs text-center space-y-10">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/20 flex items-center justify-center mx-auto relative shadow-2xl">
              <Mail size={32} className="text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">{t.verifyEmail}</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
              Kod je poslan na: <span className="text-[#D4AF37] lowercase block mt-1">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-8">
            <input 
              type="text" 
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0 0 0 0 0 0"
              className="w-full bg-zinc-950 border border-white/5 rounded-3xl px-6 py-7 text-center text-4xl font-black tracking-[0.4em] text-[#D4AF37] focus:border-[#D4AF37]/50 outline-none transition-all placeholder:text-zinc-900 shadow-2xl"
            />
            <Button type="submit" loading={loading} className="w-full h-20 shadow-2xl">
              {t.verifyCode}
            </Button>
            <button onClick={() => setStep('form')} className="text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-zinc-400 transition-colors">Vrati se nazad</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-8 pt-12 pb-12 bg-[#0A0A0A] text-white overflow-y-auto animate-lux-fade items-center w-full justify-center">
       <div className="absolute top-12 flex bg-white/5 border border-white/10 rounded-full p-1 ios-shadow">
        <button onClick={() => setLang('hr')} className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${lang === 'hr' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>HR</button>
        <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${lang === 'en' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>EN</button>
      </div>

      <div className="w-full max-w-xs mt-12 pb-12">
        <div className="flex flex-col items-center mb-12">
           <h1 className="text-4xl font-black tracking-tighter italic uppercase text-white leading-none">{t.createAccount}</h1>
           <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.4em] mt-3">{t.joinNetwork}</p>
        </div>

        <div className="flex bg-zinc-950 p-2 rounded-[2rem] border border-white/5 mb-10 shadow-2xl">
           <button onClick={() => setRole('customer')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${role === 'customer' ? 'bg-[#D4AF37] text-black shadow-xl' : 'text-zinc-700'}`}>
             <UserIcon size={14} /> {t.client}
           </button>
           <button onClick={() => setRole('barber')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${role === 'barber' ? 'bg-[#D4AF37] text-black shadow-xl' : 'text-zinc-700'}`}>
             <Scissors size={14} /> {t.barber}
           </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
           {error && <div className="bg-red-500/10 text-red-500 p-5 rounded-2xl text-[9px] font-black uppercase border border-red-500/20 tracking-widest text-center shadow-2xl">{error}</div>}

           <Input label={t.email} placeholder="name@email.com" value={email} onChange={setEmail} required />
           <Input label={t.password} type="password" placeholder="••••••••" value={password} onChange={setPassword} required />
           
           {role === 'barber' && (
             <Input label={t.barberCode} placeholder="••••••••" value={inviteCode} onChange={setInviteCode} required />
           )}

           <Button type="submit" loading={loading} className="w-full h-20 text-xs font-black uppercase tracking-[0.2em] mt-6 shadow-[0_25px_60px_rgba(212,175,55,0.2)]">
             {t.signup}
           </Button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-8">
          <p className="text-zinc-500 text-xs font-medium">
            {t.haveAccount} 
            <button onClick={onToggle} className="text-[#D4AF37] font-black uppercase tracking-wider text-[10px] ml-1">{t.login}</button>
          </p>
          <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/5 border border-white/5 shadow-2xl">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">{t.secureAccess}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
