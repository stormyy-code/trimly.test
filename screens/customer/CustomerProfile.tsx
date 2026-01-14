
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/database';
import { StorageService } from '../../services/StorageService';
import { User } from '../../types';
import { Card, Button, Toast, Input } from '../../components/UI';
import { translations, Language } from '../../translations';
import { User as UserIcon, Camera, Loader2, Edit3, Lock, ShieldCheck, FileText, Sparkles, Trash2, AlertTriangle, Scissors } from 'lucide-react';
import { supabase } from '../../store/supabase';
import LegalModal from '../../components/LegalModal';
import SupportModal from '../../components/SupportModal';

interface CustomerProfileProps {
  user: User;
  lang: Language;
  onLogout: () => void;
  onRoleUpdate?: () => void;
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ user, lang, onLogout, onRoleUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [tempName, setTempName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];
  
  const bookings = db.getBookingsSync().filter(b => b.customerId === user.id);
  const completedCuts = bookings.filter(b => b.status === 'completed').length;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).maybeSingle();
      if (data && data.avatar_url) setProfilePic(data.avatar_url);
      if (data && data.full_name) {
        setFullName(data.full_name);
        setTempName(data.full_name);
      }
    };
    fetchProfile();
  }, [user.id]);

  const handleUpdateName = async () => {
    if (!tempName.trim()) return;
    const success = await db.updateProfileDetails(user.id, { full_name: tempName });
    if (success) {
      setFullName(tempName);
      setToastMsg({ msg: t.done, type: 'success' });
      setIsEditingName(false);
      if (onRoleUpdate) onRoleUpdate();
    } else {
      setToastMsg({ msg: 'Greška pri spremanju.', type: 'error' });
    }
  };

  const handleChangePassword = async () => {
    if (newPass.length < 6) {
      setToastMsg({ msg: 'Lozinka mora imati barem 6 znakova.', type: 'error' });
      return;
    }
    setPassLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setToastMsg({ msg: t.passwordUpdated, type: 'success' });
      setNewPass('');
      setIsChangingPass(false);
    } catch (err: any) {
      setToastMsg({ msg: err.message || 'Greška', type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setPassLoading(true);
    try {
      await db.deleteAccount(user.id);
      await supabase.auth.signOut();
      onLogout();
    } catch (e) {
      setToastMsg({ msg: 'Greška pri brisanju.', type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await StorageService.uploadPhoto(file, 'avatars');
      if (url) {
        await db.updateProfileDetails(user.id, { avatar_url: url });
        setProfilePic(url);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-lux-fade pb-32 overflow-x-hidden">
      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
      
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="relative mb-6">
          <div className="w-32 h-32 bg-zinc-900 rounded-[3.5rem] border border-white/10 flex items-center justify-center text-zinc-600 shadow-2xl relative z-10 overflow-hidden">
             {profilePic ? (
               <img src={profilePic} className="w-full h-full object-cover grayscale" alt="Profile" />
             ) : (
               <UserIcon size={48} className="text-zinc-800" />
             )}
             {isUploading && (
               <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                 <Loader2 className="animate-spin text-[#D4AF37]" />
               </div>
             )}
          </div>
          <button 
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-11 h-11 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black shadow-xl active:scale-90 z-40 border-4 border-black disabled:opacity-50"
          >
            <Camera size={20} />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
        </div>

        <div className="flex flex-col items-center gap-2">
          {isEditingName ? (
            <div className="flex flex-col items-center gap-4 animate-slide-up w-full max-w-[280px]">
              <input 
                value={tempName} 
                onChange={(e) => setTempName(e.target.value)}
                className="bg-zinc-900 border border-[#D4AF37]/50 rounded-2xl px-6 py-4 text-white text-sm outline-none w-full font-black uppercase italic text-center"
                autoFocus
                placeholder="Puno ime..."
              />
              <div className="flex gap-2 w-full">
                <button onClick={() => setIsEditingName(false)} className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest italic">{t.cancel}</button>
                <button onClick={handleUpdateName} className="flex-[2] bg-[#D4AF37] text-black py-3 rounded-xl font-black text-[9px] uppercase tracking-widest italic">{t.save}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsEditingName(true)}>
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                  {fullName || user.email.split('@')[0]}
                </h2>
                <Edit3 size={16} className="text-zinc-700 group-hover:text-[#D4AF37] transition-all" />
              </div>
              <p className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.3em] mt-2 italic">{user.email}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-1">
        <Card className="p-8 bg-zinc-950 border-white/5 flex flex-col items-center text-center gap-4 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Scissors size={48} className="text-white" />
          </div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Ukupno šišanja u mreži</p>
          <p className="text-5xl font-black text-white italic tracking-tighter leading-none">{completedCuts}</p>
        </Card>
      </div>

      <section className="space-y-4 px-1">
        <div className="flex items-center gap-3 ml-4">
           <ShieldCheck size={12} className="text-[#D4AF37]" />
           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">System & Network</p>
        </div>
        <Card className="p-6 bg-zinc-950 border-white/5 space-y-4">
          <button 
            onClick={() => setIsSupportOpen(true)}
            className="w-full py-4 border border-[#D4AF37]/20 bg-[#D4AF37]/5 rounded-2xl text-[9px] font-black text-[#D4AF37] uppercase tracking-widest hover:bg-[#D4AF37]/10 transition-all flex items-center justify-center gap-3"
          >
            <Sparkles size={14} /> {t.support}
          </button>

          {!isChangingPass ? (
            <button 
              onClick={() => setIsChangingPass(true)}
              className="w-full py-4 border border-white/5 rounded-2xl text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:border-[#D4AF37]/30 transition-all flex items-center justify-center gap-3"
            >
              <Lock size={14} /> Promijeni lozinku
            </button>
          ) : (
            <div className="space-y-4 animate-slide-up">
              <Input 
                label={t.newPassword} 
                type="password" 
                value={newPass} 
                onChange={setNewPass} 
                placeholder="Unesite novu lozinku..."
              />
              <div className="flex gap-2">
                <Button variant="secondary" className="h-12 text-[8px] rounded-xl" onClick={() => setIsChangingPass(false)}>{t.cancel}</Button>
                <Button variant="primary" loading={passLoading} className="h-12 text-[8px] rounded-xl" onClick={handleChangePassword}>{t.confirm}</Button>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => setIsLegalOpen(true)}
            className="w-full py-4 border border-white/5 rounded-2xl text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:border-[#D4AF37]/30 transition-all flex items-center justify-center gap-3"
          >
            <FileText size={14} /> {t.legal}
          </button>
        </Card>
      </section>

      <section className="space-y-4 px-1 pt-4">
        <div className="flex items-center gap-3 ml-4">
           <AlertTriangle size={12} className="text-red-500" />
           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.dangerZone}</p>
        </div>
        <Card className="p-6 bg-red-500/5 border-red-500/10 space-y-4">
           {isDeleting ? (
             <div className="space-y-4 animate-lux-fade">
               <p className="text-[10px] text-red-500 font-black uppercase text-center">{t.confirmDeleteAccount}</p>
               <div className="flex gap-2">
                  <button onClick={() => setIsDeleting(false)} className="flex-1 py-4 bg-zinc-900 rounded-xl text-[9px] font-black uppercase tracking-widest">{t.cancel}</button>
                  <button onClick={handleDeleteAccount} className="flex-1 py-4 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl">{t.delete}</button>
               </div>
             </div>
           ) : (
             <button 
                onClick={() => setIsDeleting(true)}
                className="w-full py-4 border border-red-500/20 rounded-2xl text-[9px] font-black text-red-500/60 uppercase tracking-widest hover:text-red-500 transition-all flex items-center justify-center gap-3"
              >
                <Trash2 size={14} /> {t.deleteAccount}
              </button>
           )}
        </Card>
      </section>

      <div className="pt-6">
        <Button variant="danger" className="w-full h-20 text-[11px] font-black tracking-widest" onClick={onLogout}>
          {lang === 'hr' ? 'ODJAVI SE IZ MREŽE' : 'LOGOUT NETWORK'}
        </Button>
      </div>

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} lang={lang} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} lang={lang} />
    </div>
  );
}

export default CustomerProfile;
