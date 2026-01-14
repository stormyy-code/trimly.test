
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { StorageService } from '../../services/StorageService';
import { BarberProfile, WorkMode } from '../../types';
import { BARBER_INVITE_CODE } from '../../constants';
import { translations, Language } from '../../translations';
import { Button, Input, Card, Toast } from '../../components/UI';
import { Camera, Plus, Trash2, Home, Building2, MapPin, Info, Loader2, Image as ImageIcon, Copy, CheckCircle2, Lock, FileText, Sparkles, AlertTriangle } from 'lucide-react';
import LegalModal from '../../components/LegalModal';
import SupportModal from '../../components/SupportModal';

interface BarberProfileFormProps {
  userId: string;
  onComplete: () => void;
  lang: Language;
}

const BarberProfileForm: React.FC<BarberProfileFormProps> = ({ userId, onComplete, lang }) => {
  const t = translations[lang];
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('classic');
  const [pic, setPic] = useState('https://images.unsplash.com/photo-1599351431247-f10b21ce53e2?w=400');
  const [gallery, setGallery] = useState<string[]>([]);

  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadExisting = async () => {
      const barbers = await db.getBarbers();
      const existing = barbers.find(b => b.userId === userId);
      if (existing) {
        setFullName(existing.fullName);
        setNeighborhood(existing.neighborhood);
        setAddress(existing.address);
        setBio(existing.bio);
        setWorkMode(existing.workMode);
        setPic(existing.profilePicture);
        setGallery(existing.gallery || []);
      }
    };
    loadExisting();
  }, [userId]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(BARBER_INVITE_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      setToastMsg({ msg: err.message, type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setPassLoading(true);
    try {
      await db.deleteAccount(userId);
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      setToastMsg({ msg: 'Error deleting account.', type: 'error' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const url = await StorageService.uploadPhoto(file, 'profiles');
    if (url) setPic(url);
    setIsUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const url = await StorageService.uploadPhoto(files[0], 'gallery');
    if (url) setGallery(prev => [...prev, url]);
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!fullName || !neighborhood) return;
    setIsLoading(true);
    const barbers = await db.getBarbers();
    const existing = barbers.find(b => b.userId === userId);
    const profile: Partial<BarberProfile> = {
      userId,
      fullName,
      profilePicture: pic,
      neighborhood,
      address,
      bio,
      gallery,
      workMode,
      approved: existing ? existing.approved : false,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };
    const success = await db.saveBarbers(profile);
    setIsLoading(false);
    if (success) onComplete();
  };

  return (
    <div className="space-y-10 pb-32 animate-slide-up overflow-x-hidden bg-black min-h-screen">
      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
      <div className="premium-blur bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center space-y-6">
        <div className="relative w-28 h-28 mx-auto group">
          <div className={`w-full h-full rounded-[2.25rem] overflow-hidden border-4 border-white/5 shadow-2xl relative ${isUploading ? 'opacity-50' : ''}`}>
             <img src={pic} className="w-full h-full object-cover grayscale" alt="Avatar" />
             {isUploading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" /></div>}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black shadow-xl active:scale-90"
          >
            <Camera size={20} />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Postavke Profila</h2>
          <div 
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Kôd za kolege:</span>
            <span className="text-[8px] font-black text-[#D4AF37] tracking-widest">{BARBER_INVITE_CODE}</span>
            {copied ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-700" />}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-6">
        <Input label="Puno Ime" value={fullName} onChange={setFullName} placeholder="npr. Marko Markić" />
        <Input label="Kvart" value={neighborhood} onChange={setNeighborhood} placeholder="npr. Trešnjevka" />
        <Input label="Adresa" value={address} onChange={setAddress} placeholder="npr. Ilica 10" />
        
        <div className="space-y-2">
          <label className="text-[9px] font-black text-zinc-600 ml-4 uppercase tracking-[0.2em]">O vama (Bio)</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-zinc-900/60 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-[#D4AF37]/40 outline-none transition-all text-xs font-bold min-h-[100px]" />
        </div>

        <section className="space-y-4">
           <div className="flex justify-between items-center px-4">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Galerija radova</label>
              <button onClick={() => galleryInputRef.current?.click()} className="text-[#D4AF37] text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                 <Plus size={14} /> Dodaj sliku
              </button>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleGalleryUpload} />
           </div>
           
           <div className="grid grid-cols-3 gap-3">
              {gallery.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 group">
                   <img src={img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                   <button onClick={() => setGallery(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={12} className="text-white" />
                   </button>
                </div>
              ))}
           </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 ml-4">
             <Lock size={12} className="text-[#D4AF37]" />
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sigurnost i Postavke</p>
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

        <section className="space-y-4 pt-4">
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

        <Button className="w-full h-18 text-xs font-black shadow-2xl" onClick={handleSave} loading={isLoading}>Spremi profil</Button>
      </div>

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} lang={lang} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} lang={lang} />
    </div>
  );
};

export default BarberProfileForm;
