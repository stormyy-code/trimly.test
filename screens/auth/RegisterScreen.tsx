
import React, { useState, useEffect } from 'react';
import { supabase } from '../../store/supabase';
import { db } from '../../store/database';
import { User, UserRole } from '../../types';
import { BARBER_INVITE_CODE, ADMIN_INVITE_CODE } from '../../constants';
import { Button, Input, Toast } from '../../components/UI';
import { translations, Language } from '../../translations';
import { User as UserIcon, Scissors, Info, Loader2, AlertTriangle, ShieldCheck, Crown } from 'lucide-react';

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

  const t = translations[lang];

  useEffect(() => {
    if (forceUserEmail) setEmail(forceUserEmail);
  }, [forceUserEmail]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let finalRole = role;

    // ADMIN RECOVERY LOGIC: Ako je unesen admin kôd, postani admin bez obzira na odabir
    if (inviteCode === ADMIN_INVITE_CODE) {
      finalRole = 'admin';
    } else if (role === 'barber' && inviteCode !== BARBER_INVITE_CODE) {
      setError(lang === 'hr' ? 'Pogrešan barber kôd.' : 'Invalid barber code.');
      setLoading(false);
      return;
    }

    try {
      if (forceUserEmail) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          // 1. Pokušaj spremanja u Profiles (RLS siguran način)
          try {
            await supabase.from('profiles').upsert({ 
              id: currentUser.id, 
              email: currentUser.email, 
              role: finalRole,
              full_name: currentUser.email?.split('@')[0]
            }, { onConflict: 'id' });
          } catch (e) {
            console.warn("Database sync skipped, using metadata path.");
          }

          // 2. Auth Metadata (Ovo je ključno za trajno spremanje uloge u sam račun)
          const { error: metaError } = await supabase.auth.updateUser({
            data: { role: finalRole }
          });

          if (metaError) throw metaError;
          onLogin(currentUser);
          return;
        }
      }

      // 3. Nova registracija (za nove korisnike)
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { role: finalRole }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError(lang === 'hr' ? 'Račun već postoji. Prijavite se (Login).' : 'Account exists. Please Login.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        if (data.session) {
          await supabase.from('profiles').upsert({ 
            id: data.user.id, 
            email: email.trim(), 
            role: finalRole,
            full_name: email.split('@')[0]
          });
          onLogin(data.user);
        } else {
          setError(lang === 'hr' ? 'Potvrda e-maila je poslana.' : 'Email confirmation sent.');
        }
      }
    } catch (err: any) {
      console.error("Critical Register Error:", err);
      setError(err.message || "Greška pri autorizaciji.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-8 pt-12 pb-12 bg-[#0A0A0A] text-white overflow-y-auto items-center w-full justify-center">
       <div className="absolute top-12 flex bg-white/5 border border-white/10 rounded-full p-1 backdrop-blur-xl">
        <button onClick={() => setLang('hr')} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${lang === 'hr' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>HR</button>
        <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded-full text-[8px] font-black transition-all ${lang === 'en' ? 'bg-[#D4AF37] text-black' : 'text-zinc-500'}`}>EN</button>
      </div>

      <div className="w-full max-w-xs mt-12 pb-12">
        <div className="flex flex-col items-center mb-12">
           <h1 className="text-4xl font-black tracking-tighter italic uppercase text-white leading-none text-center">
             {forceUserEmail ? 'Dovršite Profil' : t.createAccount}
           </h1>
           <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.4em] mt-3 text-center">
             {forceUserEmail ? 'Odaberite ili potvrdite ulogu' : t.joinNetwork}
           </p>
        </div>

        <div className="flex bg-zinc-950 p-2 rounded-[2rem] border border-white/5 mb-8 shadow-2xl">
           <button onClick={() => setRole('customer')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${role === 'customer' ? 'bg-[#D4AF37] text-black shadow-xl' : 'text-zinc-700'}`}>
             <UserIcon size={14} /> {t.client}
           </button>
           <button onClick={() => setRole('barber')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 ${role === 'barber' ? 'bg-[#D4AF37] text-black shadow-xl' : 'text-zinc-700'}`}>
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
              <Input 
                label={lang === 'hr' ? 'Pozivni kôd (opcionalno)' : 'Invite Code (optional)'} 
                placeholder="KOD..." 
                value={inviteCode} 
                onChange={setInviteCode} 
              />
              <div className="flex items-center gap-3 px-5 py-3 bg-zinc-900 border border-white/5 rounded-2xl">
                 <Info size={14} className="text-zinc-500 shrink-0" />
                 <p className="text-[7px] font-black uppercase tracking-widest text-zinc-600 leading-tight">
                   {lang === 'hr' 
                     ? 'Barberi i Admini moraju unijeti kôd za aktivaciju uloge.' 
                     : 'Barbers and Admins must enter a code to activate their role.'}
                 </p>
              </div>
           </div>

           <Button type="submit" loading={loading} className="w-full h-20 text-xs font-black mt-2 shadow-2xl">
             {forceUserEmail ? 'POTVRDI I UĐI' : t.signup}
           </Button>
        </form>

        <div className="mt-12 flex flex-col items-center gap-8">
          <p className="text-zinc-500 text-xs font-medium">
            {t.haveAccount} 
            <button onClick={onToggle} className="text-[#D4AF37] font-black uppercase tracking-wider text-[10px] ml-1">{t.login}</button>
          </p>
          <div className="flex items-center gap-2 opacity-20">
            <ShieldCheck size={12} />
            <span className="text-[7px] font-black uppercase tracking-widest">Trimly Zagreb Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
