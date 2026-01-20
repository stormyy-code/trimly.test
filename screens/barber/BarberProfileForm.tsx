
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/database';
import { StorageService } from '../../services/StorageService';
import { BarberProfile, WorkMode } from '../../types';
import { BARBER_INVITE_CODE } from '../../constants';
import { translations, Language } from '../../translations';
import { Button, Input, Card, Toast, Badge } from '../../components/UI';
import { Camera, Plus, Trash2, Loader2, Image as ImageIcon, Copy, CheckCircle2, FileText, Sparkles, Scissors, AlertTriangle, Images, MapPin, LogOut, ShieldCheck } from 'lucide-react';
import LegalModal from '../../components/LegalModal';
import SupportModal from '../../components/SupportModal';
import { supabase } from '../../store/supabase';

interface BarberProfileFormProps {
  userId: string;
  onComplete: () => void;
  lang: Language;
  onLogout?: () => void;
}

const BarberProfileForm: React.FC<BarberProfileFormProps> = ({ userId, onComplete, lang, onLogout }) => {
  const t = translations[lang];
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAlreadyApproved, setIsAlreadyApproved] = useState(false);
  
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadExisting = async () => {
      try {
        const barbers = await db.getBarbers();
        const existing = barbers.find(b => b.userId === userId);
        if (existing) {
          setIsAlreadyApproved(existing.approved);
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
      } catch (e) {
        console.error("Load existing profile error:", e);
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
      setToastMsg({ msg: 'Profilna slika učitana.', type: 'success' });
    } else {
      setToastMsg({ msg: error || 'Greška.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gallery.length >= 5) {
      setToastMsg({ msg: 'Maksimalno 5 slika.', type: 'error' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const { url, error } = await StorageService.uploadPhoto(file, 'gallery');
    if (url) {
      setGallery(prev => [...prev, url]);
      setToastMsg({ msg: 'Slika dodana.', type: 'success' });
    } else {
      setToastMsg({ msg: error || 'Greška.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGallery(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!fullName || !neighborhood) {
      setToastMsg({ msg: 'Ime i kvart su obavezni.', type: 'error' });
      return;
    }
    
    setIsLoading(true);
    setSaveError(null);
    try {
      // Role update radimo samo ako već nismo odobreni
      if (!isAlreadyApproved) {
        const roleResult = await db.updateProfileRole(userId, 'barber');
        if (!roleResult.success) throw new Error(roleResult.error);
      }

      const barbers = await db.getBarbers();
      const existing = barbers.find(b => b.userId === userId);
      
      const profile: Partial<BarberProfile> = {
        userId,
        fullName,
        phoneNumber: phoneNumber || '',
        profilePicture: pic || 'https://i.ibb.co/C5fL3Pz/trimly-logo.png',
        neighborhood,
        address: address || '',
        zipCode: zipCode || '',
        city: city || 'Zagreb',
        bio: bio || '',
        gallery: gallery,
        workMode,
        // CRITICAL: Zadržavamo odobren status ako ga već imamo!
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
        // Ako je ovo bio prvi unos (setup), idemo na onComplete
        if (!isAlreadyApproved) {
          setTimeout(onComplete, 1200);
        } else {
          // Ako je samo update, samo refreshamo lokalne podatke
          await db.getBarbers();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error("Save Error:", err);
      setSaveError(err.message);
      setToastMsg({ msg: 'Spremanje nije uspjelo.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const success = await db.deleteAccount(userId);
      if (success) {
        await supabase.auth.signOut();
        onLogout?.();
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
    <div className="space-y-10 pb-32 animate-slide-up overflow-x-hidden bg-black min-h-screen">
      {toastMsg && <Toast message={toastMsg.msg} type={toastMsg.type} onClose={() => setToastMsg(null)} />}
      
      <header className="px-6 pt-12 text-center space-y-4">
         <div className="relative inline-block">
            <div className="w-16 h-16 bg-[#D4AF37] rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
               <Scissors size={32} className="text-black" />
            </div>
            {isAlreadyApproved && (
              <div className="absolute -top-2 -right-2 bg-emerald-500 p-1.5 rounded-full border-4 border-black shadow-xl">
                 <ShieldCheck size={14} className="text-black" />
              </div>
            )}
         </div>
         <div className="space-y-1">
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
              {isAlreadyApproved ? 'Postavke Profila' : 'Postavljanje Profila'}
            </h1>
            <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">
              {isAlreadyApproved ? 'Vaša licenca je aktivna' : 'Koračić do aktivacije'}
            </p>
         </div>
         {isAlreadyApproved && (
           <Badge variant="gold" className="px-6 py-2.5">Mrežni Partner</Badge>
         )}
      </header>

      <div className="px-6 space-y-10">
        <div className="premium-blur bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center space-y-6">
          <div className="relative w-28 h-28 mx-auto">
            <div className={`w-full h-full rounded-[2.25rem] overflow-hidden border-4 border-white/5 shadow-2xl relative bg-zinc-900 ${isUploading ? 'opacity-50' : ''}`}>
               {pic ? <img src={pic} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-800"><ImageIcon size={40} /></div>}
               {isUploading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37]" /></div>}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-11 h-11 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black border-4 border-black active:scale-90 transition-all"><Camera size={20} /></button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white italic uppercase tracking-tighter">Profilna Slika</h2>
            <div onClick={handleCopyCode} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 cursor-pointer">
              <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Mrežni Kôd: {BARBER_INVITE_CODE}</span>
              {copied ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-700" />}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {saveError && (
            <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-2 animate-lux-fade">
               <div className="flex items-center gap-3 text-red-500 font-black uppercase text-[9px] tracking-widest">
                 <AlertTriangle size={14} /> GREŠKA PRILIKOM SPREMANJA
               </div>
               <p className="text-zinc-400 text-[10px] italic leading-tight">Moguće je da polisa baze brani izmjene. Provjerite internet vezu.</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 ml-4">
                <Scissors size={14} className="text-[#D4AF37]" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Osnovni podaci</span>
              </div>
              <Input label="Puno Ime *" value={fullName} onChange={setFullName} />
              <Input label="Kvart / Dio grada *" value={neighborhood} onChange={setNeighborhood} />
              <Input label="Mobitel (opcionalno)" value={phoneNumber} onChange={setPhoneNumber} />
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3 ml-4">
                <MapPin size={14} className="text-[#D4AF37]" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Točna Lokacija Salona</span>
              </div>
              <Input label="Ulica i kućni broj" value={address} onChange={setAddress} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Grad" value={city} onChange={setCity} />
                <Input label="Poštanski broj" value={zipCode} onChange={setZipCode} />
              </div>
            </div>
          </div>
          
          <div className="space-y-3 px-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-5">Kratki opis (Bio)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-[#0F0F0F] border border-white/5 rounded-[1.5rem] p-6 text-white text-sm min-h-[120px] outline-none focus:border-[#D4AF37]/50 transition-all shadow-inner" placeholder="Ispričajte klijentima nešto o sebi..." />
          </div>

          <section className="space-y-4 px-1">
             <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                   <Images size={14} className="text-zinc-600" />
                   <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Galerija radova (do 5 slika)</span>
                </div>
                {gallery.length < 5 && (
                  <button onClick={() => galleryInputRef.current?.click()} className="text-[#D4AF37] text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-[#D4AF37]/5 px-4 py-2 rounded-xl border border-[#D4AF37]/10 active:scale-95 transition-all"><Plus size={14} /> Dodaj</button>
                )}
                <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleGalleryUpload} />
             </div>
             
             {gallery.length > 0 ? (
               <div className="grid grid-cols-3 gap-3">
                  {gallery.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 shadow-xl group">
                       <img src={img} className="w-full h-full object-cover" />
                       <button onClick={() => handleRemoveGalleryImage(i)} className="absolute top-1.5 right-1.5 bg-red-500/80 p-2 rounded-lg text-white shadow-2xl backdrop-blur-md transition-all active:scale-90"><Trash2 size={12} /></button>
                    </div>
                  ))}
               </div>
             ) : (
               <div className="py-8 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-white/5">
                 <p className="text-[8px] font-black text-zinc-700 uppercase tracking-widest italic">Nema fotografija</p>
               </div>
             )}
          </section>

          <Button className="w-full h-20 text-xs font-black shadow-2xl mt-8" onClick={handleSave} loading={isLoading}>
            {isAlreadyApproved ? 'Spremi Promjene' : 'Spremi i pošalji na odobrenje'}
          </Button>

          <section className="space-y-6 pt-10 pb-10">
            <div className="flex items-center gap-3 ml-4">
               <Sparkles size={14} className="text-[#D4AF37]" />
               <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">System & Network</p>
            </div>
            <Card className="p-6 bg-zinc-950 border-white/5 space-y-4">
              <button onClick={() => setIsSupportOpen(true)} className="w-full py-4 border border-[#D4AF37]/10 bg-[#D4AF37]/5 rounded-2xl text-[9px] font-black text-[#D4AF37] uppercase tracking-widest flex items-center justify-center gap-3"><Sparkles size={14} /> Tehnička Podrška</button>
              <button onClick={() => setIsLegalOpen(true)} className="w-full py-4 border border-white/5 rounded-2xl text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-3"><FileText size={14} /> Pravne informacije</button>
            </Card>
          </section>

          <section className="space-y-6 pt-2 pb-20">
            <div className="flex items-center gap-3 ml-4">
               <Trash2 size={14} className="text-red-500" />
               <p className="text-[10px] font-black text-red-500/60 uppercase tracking-widest">{t.dangerZone}</p>
            </div>
            <Card className="p-6 bg-red-500/5 border-red-500/10 space-y-4">
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-3"
              >
                <Trash2 size={14} /> {t.deleteAccount}
              </button>
              {onLogout && (
                <button 
                  onClick={onLogout}
                  className="w-full py-4 border border-zinc-800 rounded-2xl text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-3"
                >
                  <LogOut size={14} /> Odjavi se iz sustava
                </button>
              )}
            </Card>
          </section>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center px-6 animate-lux-fade">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !deleteLoading && setShowDeleteConfirm(false)}></div>
          <Card className="relative w-full max-w-sm bg-zinc-950 border border-red-500/30 rounded-[3rem] p-10 space-y-8 flex flex-col items-center text-center shadow-[0_50px_100px_rgba(0,0,0,1)]">
            <AlertTriangle size={48} className="text-red-500" />
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t.confirmDeleteAccount}</h3>
              <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest leading-loose">Vaš barber profil, usluge i galerija bit će trajno uklonjeni iz Trimly mreže.</p>
            </div>
            <div className="flex flex-col w-full gap-3">
              <Button variant="danger" className="h-16 w-full" onClick={handleDeleteAccount} loading={deleteLoading}>Da, obriši profil</Button>
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
};

export default BarberProfileForm;
