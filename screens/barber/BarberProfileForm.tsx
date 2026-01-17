
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/database';
import { StorageService } from '../../services/StorageService';
import { BarberProfile, WorkMode } from '../../types';
import { BARBER_INVITE_CODE } from '../../constants';
import { translations, Language } from '../../translations';
import { Button, Input, Card, Toast } from '../../components/UI';
import { Camera, Plus, Trash2, Loader2, Image as ImageIcon, Copy, CheckCircle2, FileText, Sparkles, LogOut } from 'lucide-react';
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
      setToastMsg({ msg: 'Slika učitana.', type: 'success' });
    } else {
      setToastMsg({ msg: error || 'Greška.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gallery.length >= 5) {
      setToastMsg({ msg: 'Limit je 5 slika.', type: 'error' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const { url, error } = await StorageService.uploadPhoto(file, 'gallery');
    if (url) {
      setGallery(prev => [...prev, url]);
      setToastMsg({ msg: 'Slika dodana u galeriju. Obavezno pritisnite Spremi Profil na dnu!', type: 'success' });
    } else {
      setToastMsg({ msg: error || 'Greška.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!fullName || !neighborhood) {
      setToastMsg({ msg: 'Ime i kvart su obavezni.', type: 'error' });
      return;
    }
    
    setIsLoading(true);
    try {
      const barbers = await db.getBarbers();
      const existing = barbers.find(b => b.userId === userId);
      
      const profile: Partial<BarberProfile> = {
        userId,
        fullName,
        phoneNumber,
        profilePicture: pic || 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
        neighborhood,
        address,
        zipCode,
        city,
        bio,
        gallery: [...gallery],
        workMode,
        approved: existing ? existing.approved : false,
        featured: existing ? existing.featured : false,
        weeklyWinner: existing ? existing.weeklyWinner : false,
        workingHours: existing?.workingHours || [],
        slotInterval: existing?.slotInterval || 45,
        lastUpdatedWeek: existing?.lastUpdatedWeek || 0
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
      setToastMsg({ msg: 'Sistemska greška pri spremanju.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-32 animate-slide-up overflow-x-hidden bg-black min-h-screen">
      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
      <div className="premium-blur bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center space-y-6">
        <div className="relative w-28 h-28 mx-auto">
          <div className={`w-full h-full rounded-[2.25rem] overflow-hidden border-4 border-white/5 shadow-2xl relative bg-zinc-900 ${isUploading ? 'opacity-50' : ''}`}>
             {pic ? <img src={pic} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-800"><ImageIcon size={40} /></div>}
             {isUploading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" /></div>}
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-11 h-11 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black border-4 border-black"><Camera size={20} /></button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Postavke Profila</h2>
          <div onClick={handleCopyCode} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 cursor-pointer">
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Kôd: {BARBER_INVITE_CODE}</span>
            {copied ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-700" />}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-6">
        <Input label="Puno Ime" value={fullName} onChange={setFullName} />
        <Input label="Mobitel" value={phoneNumber} onChange={setPhoneNumber} />
        <Input label="Kvart" value={neighborhood} onChange={setNeighborhood} />
        <Input label="Adresa" value={address} onChange={setAddress} />
        <div className="grid grid-cols-2 gap-4">
           <Input label="Poštanski broj" value={zipCode} onChange={setZipCode} />
           <Input label="Grad" value={city} onChange={setCity} />
        </div>
        
        <div className="space-y-3 px-1">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-4">Biografija</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-6 text-white text-sm min-h-[100px] outline-none" />
        </div>

        <section className="space-y-4 px-1">
           <div className="flex justify-between items-center px-4">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Galerija ({gallery.length}/5)</span>
              <button onClick={() => galleryInputRef.current?.click()} className="text-[#D4AF37] text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/5 rounded-xl border border-[#D4AF37]/10"><Plus size={14} /> Dodaj</button>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleGalleryUpload} />
           </div>
           <div className="grid grid-cols-3 gap-3">
              {gallery.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5">
                   <img src={img} className="w-full h-full object-cover" />
                   <button onClick={() => setGallery(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 p-1.5 rounded-lg text-white shadow-xl"><Trash2 size={10} /></button>
                </div>
              ))}
           </div>
        </section>

        <section className="space-y-4 pt-4">
          <Card className="p-6 bg-zinc-950 border-white/5 space-y-4">
            <button onClick={() => setIsSupportOpen(true)} className="w-full py-4 border border-[#D4AF37]/10 bg-[#D4AF37]/5 rounded-2xl text-[9px] font-black text-[#D4AF37] uppercase tracking-widest flex items-center justify-center gap-3"><Sparkles size={14} /> Podrška</button>
            <button onClick={() => setIsLegalOpen(true)} className="w-full py-4 border border-white/5 rounded-2xl text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-3"><FileText size={14} /> Pravne info</button>
          </Card>
        </section>

        <Button className="w-full h-20 text-xs font-black shadow-2xl" onClick={handleSave} loading={isLoading}>
          Spremi profil
        </Button>
      </div>

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} lang={lang} />
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} lang={lang} />
    </div>
  );
};

export default BarberProfileForm;
