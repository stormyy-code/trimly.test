
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../store/mockDatabase';
import { StorageService } from '../../services/StorageService';
import { BarberProfile, WorkMode } from '../../types';
import { BARBER_INVITE_CODE } from '../../constants';
import { translations, Language } from '../../translations';
import { Button, Input, Card } from '../../components/UI';
import { Camera, Plus, Trash2, Home, Building2, MapPin, Info, Loader2, Image as ImageIcon, Copy, CheckCircle2 } from 'lucide-react';

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadExisting = async () => {
      const barbers = await db.getBarbersSync();
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
    const profile: Partial<BarberProfile> = {
      userId,
      fullName,
      profilePicture: pic,
      neighborhood,
      address,
      bio,
      gallery,
      workMode,
      approved: true, // Auto-approval in demo mode, update as needed
      createdAt: new Date().toISOString()
    };
    const success = await db.saveBarbers(profile);
    setIsLoading(false);
    if (success) onComplete();
  };

  return (
    <div className="space-y-10 pb-32 animate-slide-up overflow-x-hidden bg-black min-h-screen">
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
              {gallery.length < 3 && [...Array(3 - gallery.length)].map((_, i) => (
                <div key={i} className="aspect-square bg-zinc-950 border border-dashed border-white/5 rounded-2xl flex items-center justify-center opacity-10">
                   <ImageIcon size={20} />
                </div>
              ))}
           </div>
        </section>

        <section className="space-y-4">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-4">Način rada</label>
          <div className="grid grid-cols-3 gap-2">
            {['classic', 'mobile', 'both'].map((mode) => (
              <button key={mode} onClick={() => setWorkMode(mode as WorkMode)} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${workMode === mode ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-xl' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
                <span className="text-[8px] font-black uppercase tracking-tighter">{mode}</span>
              </button>
            ))}
          </div>
        </section>

        <Button className="w-full h-18 text-xs font-black shadow-2xl" onClick={handleSave} loading={isLoading}>Spremi promjene</Button>
      </div>
    </div>
  );
};

export default BarberProfileForm;
