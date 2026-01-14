
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { db } from '../../store/mockDatabase';
import { StorageService } from '../../services/StorageService';
import { User } from '../../types';
import { Card, Badge, Button, Toast } from '../../components/UI';
import { Language } from '../../translations';
import { User as UserIcon, LogOut, Settings, Camera, Loader2 } from 'lucide-react';
import { supabase } from '../../store/supabase';

interface CustomerProfileProps {
  user: User;
  lang: Language;
  onLogout: () => void;
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ user, lang, onLogout }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const bookings = db.getBookingsSync().filter(b => b.customerId === user.id);
  const completedCuts = bookings.filter(b => b.status === 'completed').length;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
      if (data?.avatar_url) setProfilePic(data.avatar_url);
    };
    fetchProfile();
  }, [user.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const url = await StorageService.uploadPhoto(file, 'avatars');
      if (url) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: url })
          .eq('id', user.id);
          
        if (updateError) throw updateError;
        setProfilePic(url);
      } else {
        throw new Error(lang === 'hr' ? 'Greška pri uploadu. Provjeri Supabase Storage Bucket.' : 'Upload failed. Check Supabase Storage Bucket.');
      }
    } catch (err: any) {
      setErrorToast(err.message || 'Greška kod spremanja slike.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };
  
  const favoriteBarber = useMemo(() => {
    if (bookings.length === 0) return null;
    const counts: Record<string, number> = {};
    bookings.forEach(b => {
      counts[b.barberId] = (counts[b.barberId] || 0) + 1;
    });
    const topBarberId = Object.keys(counts).reduce((a, b) => (counts[a] || 0) > (counts[b] || 0) ? a : b);
    return db.getBarbersSync().find(b => b.id === topBarberId);
  }, [bookings]);

  return (
    <div className="space-y-8 animate-lux-fade pb-32">
      {errorToast && <Toast message={errorToast} type="error" onClose={() => setErrorToast(null)} />}
      
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="relative mb-6">
          <div className="w-28 h-28 bg-zinc-900 rounded-[3rem] border border-white/10 flex items-center justify-center text-zinc-600 shadow-2xl relative z-10 overflow-hidden">
             {profilePic ? (
               <img src={profilePic} className="w-full h-full object-cover grayscale" alt="Profile" />
             ) : (
               <UserIcon size={44} className="text-zinc-700" />
             )}
             {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30"><Loader2 className="animate-spin text-[#D4AF37]" /></div>}
          </div>
          <button 
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center text-black shadow-xl active:scale-90 z-40 border-4 border-black disabled:opacity-50"
          >
            <Camera size={18} />
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
        </div>
        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{user.email.split('@')[0]}</h2>
        <Badge variant="gold" className="mt-3">Premium Member</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 px-1">
        <Card className="p-6 bg-zinc-950 border-white/5 flex flex-col items-center text-center gap-2">
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Ukupno šišanja</p>
          <p className="text-3xl font-black text-white italic tracking-tighter">{completedCuts}</p>
        </Card>
        <Card className="p-6 bg-emerald-500/5 border-emerald-500/10 flex flex-col items-center text-center gap-2">
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Loyalty Bodovi</p>
          <p className="text-3xl font-black text-emerald-400 italic tracking-tighter">{completedCuts * 15}</p>
        </Card>
      </div>

      <div className="pt-6">
        <Button variant="danger" className="w-full h-18 text-[11px] font-black tracking-widest" onClick={onLogout}>
          {lang === 'hr' ? 'ODJAVI SE' : 'LOGOUT'}
        </Button>
      </div>
    </div>
  );
};

export default CustomerProfile;
