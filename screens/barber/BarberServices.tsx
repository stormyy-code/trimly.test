
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../store/database';
import { StorageService } from '../../services/StorageService';
import { Service } from '../../types';
import { translations, Language } from '../../translations';
import { Button, Input, Card, Toast } from '../../components/UI';
import { Plus, Trash2, Camera, Loader2, X } from 'lucide-react';

interface BarberServicesProps {
  barberId: string;
  lang: Language;
}

const BarberServices: React.FC<BarberServicesProps> = ({ barberId, lang }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  const fetchServices = async () => {
    if (barberId) {
      const all = await db.getServices(barberId);
      setServices(all);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [barberId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const url = await StorageService.uploadPhoto(file, 'services');
    if (url) {
      setImageUrl(url);
      setToast({ msg: 'Slika učitana.', type: 'success' });
    } else {
      setToast({ msg: 'Greška pri uploadu slike. Provjerite storage.', type: 'error' });
    }
    setIsUploading(false);
  };

  const handleAdd = async () => {
    if (!name || !price || !barberId) {
      setToast({ msg: 'Molimo unesite naziv i cijenu.', type: 'error' });
      return;
    }

    setLoading(true);
    // Use actual DB ID if available, otherwise fallback
    const newService: Service = {
      id: crypto.randomUUID(), // Standard UUID
      barberId,
      name,
      price: parseFloat(price),
      duration: duration || '45 min',
      description: description || '',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400'
    };

    const success = await db.addService(newService);
    if (success) {
      setToast({ msg: t.done, type: 'success' });
      await fetchServices();
      setName('');
      setPrice('');
      setDuration('');
      setDescription('');
      setImageUrl('');
      setIsAdding(false);
    } else {
      setToast({ msg: 'Greška pri spremanju usluge u bazu.', type: 'error' });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Obrisati uslugu?')) return;
    const success = await db.deleteService(id);
    if (success) {
      setToast({ msg: 'Usluga obrisana.', type: 'success' });
      fetchServices();
    }
  };

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">{t.services}</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Upravljanje ponudom</p>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isAdding ? 'bg-red-500 text-white rotate-45' : 'bg-white text-black shadow-xl'}`}>
          {isAdding ? <X size={28} /> : <Plus size={28} />}
        </button>
      </div>

      {isAdding && (
        <Card className="p-8 space-y-6 border-white/10 animate-lux-fade">
          <div className="flex flex-col items-center gap-4">
            <div 
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className="w-full aspect-video bg-zinc-950 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden relative group"
            >
              {imageUrl ? (
                <>
                  <img src={imageUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <Camera size={32} className="text-white" />
                  </div>
                </>
              ) : isUploading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em]">Network Uploading...</span>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-white/5 rounded-2xl"><Camera size={32} className="text-zinc-600" /></div>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Dodaj sliku usluge</span>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>

          <div className="space-y-4">
            <Input label="Naziv usluge" value={name} onChange={setName} placeholder="npr. Skin Fade" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cijena (€)" type="number" value={price} onChange={setPrice} placeholder="25" />
              <Input label="Trajanje" value={duration} onChange={setDuration} placeholder="45 min" />
            </div>
          </div>
          
          <Button className="w-full mt-4 h-18 text-xs shadow-2xl" onClick={handleAdd} loading={loading}>
            Spremi uslugu
          </Button>
        </Card>
      )}

      <div className="space-y-4">
        {services.length === 0 ? (
          <div className="py-24 text-center opacity-10 flex flex-col items-center gap-4">
             <Plus size={48} />
             <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">{t.noData}</p>
          </div>
        ) : services.map(service => (
          <Card key={service.id} className="p-5 flex gap-6 items-center group bg-zinc-950/40 border-white/5 relative overflow-hidden">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shrink-0">
               <img src={service.imageUrl} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 transition-all duration-500" alt="" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter truncate">{service.name}</h3>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[#D4AF37] font-black text-sm">{service.price}€</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
                <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">{service.duration}</span>
              </div>
            </div>
            <button onClick={() => handleDelete(service.id)} className="w-12 h-12 bg-red-500/10 text-red-500/40 hover:text-red-500 hover:bg-red-500/20 rounded-2xl flex items-center justify-center transition-all active:scale-90">
              <Trash2 size={18} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default BarberServices;
