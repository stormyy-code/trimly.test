
import React, { useState } from 'react';
import { supabase } from '../../store/supabase';
import { Button, Input, Card } from '../../components/UI';
import { translations, Language } from '../../translations';
import { Lock, ShieldCheck } from 'lucide-react';
import Logo from '../../components/Logo';

interface ChangePasswordScreenProps {
  lang: Language;
  onComplete: () => void;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ lang, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError(lang === 'hr' ? 'Lozinka mora imati barem 6 znakova.' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError(lang === 'hr' ? 'Lozinke se ne podudaraju.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#050505] text-white animate-lux-fade items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-10">
        <div className="flex flex-col items-center text-center space-y-4">
           <div className="w-20 h-20 bg-[#D4AF37] rounded-[2rem] flex items-center justify-center text-black shadow-2xl">
             <Lock size={32} />
           </div>
           <h1 className="text-3xl font-black tracking-tighter italic uppercase">{t.changePassword}</h1>
           <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
             Postavite novu sigurnu lozinku za pristup mreži.
           </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl text-[8px] font-black border text-center uppercase bg-red-500/10 border-red-500/20 text-red-500">
              {error}
            </div>
          )}
          
          <Input 
            label={t.newPassword} 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={setPassword} 
            required 
          />
          
          <Input 
            label={lang === 'hr' ? 'Potvrdi lozinku' : 'Confirm Password'} 
            type="password" 
            placeholder="••••••••" 
            value={confirmPassword} 
            onChange={setConfirmPassword} 
            required 
          />

          <Button type="submit" loading={loading} className="h-20 shadow-2xl">
            {t.confirm}
          </Button>
        </form>

        <div className="flex items-center justify-center gap-3 opacity-30">
           <ShieldCheck size={14} className="text-[#D4AF37]" />
           <span className="text-[8px] font-black uppercase tracking-widest">Trimly Security Auth</span>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordScreen;
