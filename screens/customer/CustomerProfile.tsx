
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/database';
import { StorageService } from '../../services/StorageService';
import { User } from '../../types';
import { Card, Button, Toast, Input } from '../../components/UI';
import { translations, Language } from '../../translations';
import { User as UserIcon, Camera, Loader2, Edit3, Lock, ShieldCheck, FileText, Sparkles, LogOut, Trash2, AlertTriangle } from 'lucide-react';
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
  const [profilePic, setProfilePic] = useState<string | null>(user.avatarUrl || null);
  const [fullName, setFullName] = useState(user.fullName || '');
  const [tempName, setTempName] = useState(user.fullName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => {
    setFullName(user.fullName || '');
    setTempName(user.fullName || '');
    setProfilePic(user.avatarUrl || null);
  }, [user]);

  const handleUpdateName = async () => {
    const trimmedName = tempName.trim();
    if (!trimmedName) return;

    setPassLoading(true);
    try {
      const result = await db.updateProfileDetails(user.id, { fullName: trimmedName });
      
      if (result.success) {
        setFullName(trimmedName);
        setToastMsg({ msg: t.done, type: 'success' });
        setIsEditingName(false);
      } else {
        setToastMsg({ msg: result.error || 'Greška pri spremanju.', type: 'error' });
      }
    } catch (e: any) {
      setToastMsg({ msg: 'Greška na mreži: ' + e.message, type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) return;
    
    setIsUploading(true);
    try {
      const result = await StorageService.uploadPhoto(file, 'profiles');
      
      if (result.error) {
        setToastMsg({ msg: `Greška: ${result.error}`, type: 'error' });
        return;
      }

      if (result.url) {
        const updateResult = await db.updateProfileDetails(user.id, { avatarUrl: result.url });
        if (updateResult.success) {
          setProfilePic(result.url);
          setToastMsg({ msg: 'Profilna slika spremljena.', type: 'success' });
          window.dispatchEvent(new Event('user-profile-updated'));
        } else {
          setToastMsg({ msg: 'Slika je učitana ali nije spremljena u bazu.', type: 'error' });
        }
      }
    } catch (err: any) {
      setToastMsg({ msg: 'Neočekivana greška pri uploadu.', type: 'error' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    setDeleteLoading(true);
    try {
      const success = await db.deleteAccount(user.id);
      if (success) {
        onLogout();
      } else {
        setToastMsg({ msg: 'Greška pri brisanju računa.', type: 'error' });
      }
    } catch (err) {
      setToastMsg({ msg: 'Došlo je do greške.', type: 'error' });
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-12 animate-lux-fade pb-32">
      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
      
      <div className="flex flex-col items-center pt-8 pb-4 gap-8">
        <div className="relative group">
          <div className="w-32 h-32 bg-zinc-900 rounded-[2.5rem] border border-white/10 flex items-center justify-center text-zinc-600 shadow-2xl relative z-10 overflow-hidden">
             {profilePic ? (
               <img src={profilePic} className="w-full h-full object-cover" alt="Profile" />
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
                <button onClick={handleUpdateName} className="flex-[2] bg-[#D4AF37] text-black py-3 rounded-xl font-black text-[9px] uppercase tracking-widest italic">
                  {passLoading ? <Loader2 className="animate-spin mx-auto" size={14} /> : t.save}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
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
           <Trash2 size={12} className="text-red-500" />
           <p className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">{t.dangerZone}</p>
        </div>
        <Card className="p-6 bg-red-500/5 border-red-500/10">
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-3"
          >
            <Trash2 size={14} /> {t.deleteAccount}
          </button>
        </Card>
      </section>

      <div className="pt-6 px-1">
        <Button 
          variant="danger" 
          className="w-full h-20 text-[11px] font-black tracking-widest shadow-2xl" 
          onClick={onLogout}
        >
          <LogOut size={16} className="mr-3" /> {lang === 'hr' ? 'ODJAVI SE IZ MREŽE' : 'LOGOUT NETWORK'}
        </Button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center px-6 animate-lux-fade">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !deleteLoading && setShowDeleteConfirm(false)}></div>
          <Card className="relative w-full max-w-sm bg-zinc-950 border border-red-500/30 rounded-[3rem] p-10 space-y-8 flex flex-col items-center text-center shadow-[0_50px_100px_rgba(0,0,0,1)]">
            <AlertTriangle size={48} className="text-red-500" />
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t.confirmDeleteAccount}</h3>
              <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest leading-loose">Svi vaši podaci i rezervacije bit će trajno izbrisani iz Zagrebačke mreže.</p>
            </div>
            <div className="flex flex-col w-full gap-3">
              <Button variant="danger" className="h-16 w-full" onClick={handleDeleteAccount} loading={deleteLoading}>Da, obriši račun</Button>
              <button 
                disabled={deleteLoading}
                className="h-16 w-full text-zinc-500 text-[10px] font-black uppercase tracking-widest" 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Odustani
              </button>
            </div>
          </Card>
        </div>
      )}

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} lang={lang} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} lang={lang} />
    </div>
  );
}

export default CustomerProfile;
