
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../store/mockDatabase';
import { StorageService } from '../../services/StorageService';
import { Service } from '../../types';
import { translations, Language } from '../../translations';
import { Button, Input, Card } from '../../components/UI';
import { Plus, Trash2, Camera, Loader2 } from 'lucide-react';

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  useEffect(() => {
    if (barberId) {
      const allServices = db.getServicesSync();
      setServices(allServices.filter(s => s.barberId === barberId));
    }
  }, [barberId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await StorageService.uploadPhoto(file, 'services');
    if (url) setImageUrl(url);
    setIsUploading(false);
  };

  const handleAdd = async () => {
    if (!name || !price || !barberId) return;

    const newService: Service = {
      id: Math.random().toString(36).substr(2, 9),
      barberId,
      name,
      price: parseFloat(price),
      duration: duration || '30 min',
      description,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400'
    };

    const allServices = db.getServicesSync();
    const updated = [...allServices, newService];
    await db.saveServices(updated);
    setServices(updated.filter(s => s.barberId === barberId));
    
    setName('');
    setPrice('');
    setDuration('');
    setDescription('');
    setImageUrl('');
    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    const all = db.getServicesSync();
    const filtered = all.filter(s => s.id !== id);
    await db.saveServices(filtered);
    setServices(filtered.filter(s => s.barberId === barberId));
  };

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">{t.services}</h2>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isAdding ? 'bg-red-500 text-white rotate-45' : 'bg-white text-black shadow-xl'}`}>
          <Plus size={28} />
        </button>
      </div>

      {isAdding && (
        <Card className="p-8 space-y-6 border-white/10 animate-lux-fade">
          <div className="flex flex-col items-center gap-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video bg-zinc-900 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden relative"
            >
              {imageUrl ? (
                <img src={imageUrl} className="w-full h-full object-cover" />
              ) : isUploading ? (
                <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
              ) : (
                <>
                  <Camera size={32} className="text-zinc-700" />
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Dodaj sliku usluge</span>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>

          <Input label="Naziv usluge" value={name} onChange={setName} placeholder="npr. Skin Fade" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cijena (€)" type="number" value={price} onChange={setPrice} placeholder="25" />
            <Input label="Trajanje" value={duration} onChange={setDuration} placeholder="45 min" />
          </div>
          <Button className="w-full mt-4 h-16" onClick={handleAdd} variant="primary">Spremi uslugu</Button>
        </Card>
      )}

      <div className="space-y-4">
        {services.map(service => (
          <Card key={service.id} className="p-4 flex gap-4 items-center group bg-zinc-950/50 border-white/5">
            <img src={service.imageUrl} className="w-20 h-20 rounded-2xl object-cover grayscale brightness-75 group-hover:grayscale-0 transition-all" alt="" />
            <div className="flex-1">
              <h3 className="text-lg font-black text-white italic uppercase">{service.name}</h3>
              <p className="text-[#D4AF37] font-black text-sm">{service.price}€</p>
            </div>
            <button onClick={() => handleDelete(service.id)} className="p-3 text-red-500/40 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BarberServices;
