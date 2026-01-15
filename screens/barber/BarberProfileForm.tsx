
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/database';
import { supabase } from '../../store/supabase';
import { StorageService } from '../../services/StorageService';
import { BarberProfile, WorkMode } from '../../types';
import { BARBER_INVITE_CODE } from '../../constants';
import { translations, Language } from '../../translations';
import { Button, Input, Card, Toast } from '../../components/UI';
import { Camera, Plus, Trash2, Home, Building2, MapPin, Info, Loader2, Image as ImageIcon, Copy, CheckCircle2, Lock, FileText, Sparkles, AlertTriangle, Navigation, X, ShieldCheck, Phone } from 'lucide-react';
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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('Zagreb');
  const [bio, setBio] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('classic');
  const [pic, setPic] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);

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
        setFullName(existing.fullName || '');
        setPhoneNumber(existing.phoneNumber || '');
        setNeighborhood(existing.neighborhood || '');
        setAddress(existing.address || '');
        setBio(existing.bio || '');
        setWorkMode(existing.workMode || 'classic');
        setPic(existing.profilePicture || '');
        setGallery(existing.gallery || []);
        if (existing.zipCode) setZipCode(existing.zipCode);
        if (existing.city) setCity(existing.city);
      }
    };
    loadExisting();
  }, [userId]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(BARBER_INVITE_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const { url, error } = await StorageService.uploadPhoto(file, 'profiles');
    if (url) {
      setPic(url);
      // Automatski sinkroniziraj s glavnim avatarom korisnika
      await db.updateProfileDetails(userId, { avatarUrl: url });
      setToastMsg({ msg: 'Profilna slika učitana i sinkronizirana.', type: 'success' });
    } else {
      setToastMsg({ msg: error || 'Upload nije uspio.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gallery.length >= 5) {
      setToastMsg({ msg: 'Limit je 5 slika u galeriji.', type: 'error' });
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const { url, error } = await StorageService.uploadPhoto(file, 'gallery');
    if (url) {
      setGallery(prev => [...prev, url]);
      setToastMsg({ msg: `Slika dodana (${gallery.length + 1}/5).`, type: 'success' });
    } else {
      setToastMsg({ msg: error || 'Greška pri uploadu.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!fullName || !neighborhood) {
      setToastMsg({ msg: 'Ime i kvart su obvezni.', type: 'error' });
      return;
    }
    
    setIsLoading(true);
    try {
      const barbers = await db.getBarbers();
      const existing = barbers.find(b => b.userId === userId);
      
      const profile: any = {
        userId,
        fullName,
        phoneNumber: phoneNumber || '',
        profilePicture: pic || 'https://images.unsplash.com/photo-1599351431247-f10b21ce53e2?w=400',
        neighborhood,
        address: address || '',
        zipCode: zipCode || '',
        city: city || 'Zagreb',
        bio: bio || '',
        gallery: gallery || [],
        workMode: workMode || 'classic',
        approved: existing ? existing.approved : false,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        workingHours: existing?.workingHours || [],
        slotInterval: existing?.slotInterval || 45
      };

      if (existing?.id) profile.id = existing.id;
      
      const result = await db.saveBarbers(profile);
      
      if (result.success) {
        setToastMsg({ msg: t.done, type: 'success' });
        setTimeout(onComplete, 1200);
      } else {
        setToastMsg({ msg: `Greška: ${result.error}`, type: 'error' });
      }
    } catch (err: any) {
      setToastMsg({ msg: 'Kritična greška pri spremanju.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-32 animate-slide-up overflow-x-hidden bg-black min-h-screen">
      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
      <div className="premium-blur bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center space-y-6">
        <div className="relative w-28 h-28 mx-auto group">
          <div className={`w-full h-full rounded-[2.25rem] overflow-hidden border-4 border-white/5 shadow-2xl relative bg-zinc-900 ${isUploading ? 'opacity-50' : ''}`}>
             {pic ? (
               <img src={pic} className="w-full h-full object-cover transition-all duration-700" alt="Avatar" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-zinc-800"><ImageIcon size={40} /></div>
             )}
             {isUploading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" /></div>}
          </div>
          <button 
            disabled={isUploading}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-11 h-11 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black shadow-xl active:scale-90 border-4 border-black disabled:opacity-50"
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
        <Input label="Broj Mobitela" value={phoneNumber} onChange={setPhoneNumber} placeholder="npr. 091 234 5678" />
        <Input label="Kvart" value={neighborhood} onChange={setNeighborhood} placeholder="npr. Trešnjevka" />
        <Input label="Ulica i kućni broj" value={address} onChange={setAddress} placeholder="npr. Ilica 10" />
        <div className="grid grid-cols-2 gap-4">
           <Input label="Poštanski broj" value={zipCode} onChange={setZipCode} placeholder="10000" />
           <Input label="Grad" value={city} onChange={setCity} placeholder="Zagreb" />
        </div>
        
        <div className="space-y-3">
          <label className="text-[9px] font-black text-zinc-600 ml-4 uppercase tracking-[0.2em]">O vama (Bio)</label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            placeholder="Kratki opis vašeg rada..."
            className="w-full bg-zinc-900/60 border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-[#D4AF37]/40 outline-none transition-all text-[13px] font-medium min-h-[120px] shadow-inner" 
          />
        </div>

        <section className="space-y-4">
           <div className="flex justify-between items-center px-4">
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Galerija radova</label>
                <span className="text-[7px] text-zinc-700 font-bold uppercase tracking-widest">Maksimalno 5 slika ({gallery.length}/5)</span>
              </div>
              <button 
                disabled={isUploading || gallery.length >= 5}
                onClick={() => !isUploading && galleryInputRef.current?.click()} 
                className="text-[#D4AF37] text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-3 py-2 bg-[#D4AF37]/5 rounded-xl border border-[#D4AF37]/10 disabled:opacity-30"
              >
                 {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Dodaj sliku
              </button>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleGalleryUpload} />
           </div>
           
           <div className="grid grid-cols-3 gap-3">
              {gallery.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 group">
                   <img src={img} className="w-full h-full object-cover transition-all duration-500" />
                   <button 
                    onClick={() => setGallery(prev => prev.filter((_, idx) => idx !== i))} 
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                   >
                     <Trash2 size={12} className="text-white" />
                   </button>
                </div>
              ))}
              {gallery.length === 0 && (
                <div className="col-span-3 py-10 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-zinc-800 gap-2">
                  <ImageIcon size={24} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Galerija je prazna</span>
                </div>
              )}
           </div>
        </section>

        <section className="space-y-4 pt-6">
          <div className="flex items-center gap-3 ml-4">
             <ShieldCheck size={12} className="text-emerald-500" />
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sigurnost i Postavke</p>
          </div>
          <Card className="p-6 bg-zinc-950 border-white/5 space-y-4">
            <button 
              onClick={() => setIsSupportOpen(true)}
              className="w-full py-4 border border-[#D4AF37]/20 bg-[#D4AF37]/5 rounded-2xl text-[9px] font-black text-[#D4AF37] uppercase tracking-widest hover:bg-[#D4AF37]/10 transition-all flex items-center justify-center gap-3"
            >
              <Sparkles size={14} /> {t.support}
            </button>
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="w-full py-4 border border-white/5 rounded-2xl text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:border-[#D4AF37]/30 transition-all flex items-center justify-center gap-3"
            >
              <FileText size={14} /> {t.legal}
            </button>
          </Card>
        </section>

        <Button className="w-full h-20 text-xs font-black shadow-[0_25px_60px_rgba(212,175,55,0.2)]" onClick={handleSave} loading={isLoading}>
          Spremi profil
        </Button>
      </div>

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} lang={lang} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} lang={lang} />
    </div>
  );
};

export default BarberProfileForm;
