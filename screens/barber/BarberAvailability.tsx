
import React, { useState, useEffect } from 'react';
import { db } from '../../store/database';
import { BarberProfile, WorkingDay, BreakTime } from '../../types';
import { translations, Language } from '../../translations';
// Added Badge to the imports
import { Card, Button, Toast, Badge } from '../../components/UI';
import { Clock, Check, X, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const BarberAvailability: React.FC<{ barberId: string, lang: Language }> = ({ barberId, lang }) => {
  const t = translations[lang];
  const [barber, setBarber] = useState<BarberProfile | null>(null);
  const [isNewWeek, setIsNewWeek] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const [slotInterval, setSlotInterval] = useState<number>(45);
  const [workingHours, setWorkingHours] = useState<WorkingDay[]>([
    { day: 'Monday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
    { day: 'Tuesday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
    { day: 'Wednesday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
    { day: 'Thursday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
    { day: 'Friday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
    { day: 'Saturday', enabled: false, startTime: '10:00', endTime: '14:00', breaks: [] },
    { day: 'Sunday', enabled: false, startTime: '10:00', endTime: '14:00', breaks: [] },
  ]);

  const dayTranslations: Record<string, string> = {
    'Monday': lang === 'hr' ? 'Ponedjeljak' : 'Monday',
    'Tuesday': lang === 'hr' ? 'Utorak' : 'Tuesday',
    'Wednesday': lang === 'hr' ? 'Srijeda' : 'Wednesday',
    'Thursday': lang === 'hr' ? 'Četvrtak' : 'Thursday',
    'Friday': lang === 'hr' ? 'Petak' : 'Friday',
    'Saturday': lang === 'hr' ? 'Subota' : 'Saturday',
    'Sunday': lang === 'hr' ? 'Nedjelja' : 'Sunday',
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const barbers = await db.getBarbers();
        const b = barbers.find(x => x.id === barberId);
        if (b) {
          setBarber(b);
          setSlotInterval(b.slotInterval || 45);
          if (b.workingHours && b.workingHours.length > 0) {
            setWorkingHours(b.workingHours);
          }
          const currentWeek = getWeekNumber(new Date());
          if (b.lastUpdatedWeek !== currentWeek) {
            setIsNewWeek(true);
          }
        }
      } catch (err) {
        console.error("Load availability error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [barberId]);

  const handleSave = async () => {
    if (!barber) return;
    setSaveLoading(true);
    const currentWeek = getWeekNumber(new Date());
    const result = await db.saveBarbers({ 
      ...barber, 
      workingHours, 
      slotInterval,
      lastUpdatedWeek: currentWeek 
    });
    
    if (result.success) {
      setIsNewWeek(false);
      setToast({ msg: 'Raspored uspješno spremljen.', type: 'success' });
    } else {
      setToast({ msg: 'Greška pri spremanju u bazu.', type: 'error' });
    }
    setSaveLoading(false);
  };

  const toggleDay = (idx: number) => {
    const next = [...workingHours];
    next[idx].enabled = !next[idx].enabled;
    setWorkingHours(next);
  };

  const updateTime = (idx: number, field: 'startTime' | 'endTime', val: string) => {
    const next = [...workingHours];
    next[idx][field] = val;
    setWorkingHours(next);
  };

  const addBreak = (idx: number) => {
    const next = [...workingHours];
    if (!next[idx].breaks) next[idx].breaks = [];
    next[idx].breaks.push({ startTime: '12:00', endTime: '13:00' });
    setWorkingHours(next);
  };

  const removeBreak = (dIdx: number, bIdx: number) => {
    const next = [...workingHours];
    next[dIdx].breaks.splice(bIdx, 1);
    setWorkingHours(next);
  };

  const updateBreakTime = (dIdx: number, bIdx: number, field: 'startTime' | 'endTime', val: string) => {
    const next = [...workingHours];
    next[dIdx].breaks[bIdx][field] = val;
    setWorkingHours(next);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Učitavanje...</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up pb-32 overflow-x-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 border border-white/10 mx-1">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">{t.schedule}</h2>
          <Badge variant="gold">Aktivno</Badge>
        </div>
        
        <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Novi termin svakih</span>
            <span className="text-xs font-black text-white italic">{slotInterval} minuta</span>
          </div>
          <select 
            value={slotInterval} 
            onChange={(e) => setSlotInterval(Number(e.target.value))}
            className="bg-zinc-900 border border-[#D4AF37]/30 rounded-xl px-4 py-2.5 text-[11px] font-black text-[#D4AF37] outline-none shadow-xl"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      </div>

      {isNewWeek && (
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center gap-4 mx-1 animate-pulse">
          <AlertCircle className="text-amber-500 shrink-0" size={24} />
          <p className="text-[9px] font-black text-white uppercase tracking-widest leading-relaxed">
            Novi tjedan je počeo! Molimo potvrdite svoj raspored kako bi ostali vidljivi klijentima u mreži.
          </p>
        </div>
      )}

      <div className="space-y-4 px-1">
        {workingHours.map((wh, idx) => (
          <Card key={wh.day} className={`p-6 border-white/5 transition-all ${wh.enabled ? 'bg-zinc-950 shadow-2xl scale-[1.01]' : 'bg-black opacity-30'}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <button 
                  onClick={() => toggleDay(idx)} 
                  className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all ${wh.enabled ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20' : 'bg-zinc-900 text-zinc-700 border border-white/5'}`}
                >
                  {wh.enabled ? <Check size={20} strokeWidth={3} /> : <X size={20} strokeWidth={3} />}
                </button>
                <div className="flex flex-col">
                  <span className="font-black text-sm uppercase italic tracking-tighter text-white truncate">
                    {dayTranslations[wh.day]}
                  </span>
                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">
                    {wh.enabled ? 'Radni dan' : 'Neradni dan'}
                  </span>
                </div>
              </div>

              {wh.enabled && (
                <div className="flex items-center gap-2 shrink-0 bg-white/5 p-1.5 rounded-2xl border border-white/5">
                  <input 
                    type="time" 
                    value={wh.startTime} 
                    onChange={e => updateTime(idx, 'startTime', e.target.value)} 
                    className="bg-transparent px-2 py-2 text-[11px] font-black text-[#D4AF37] outline-none" 
                  />
                  <div className="w-2 h-[1px] bg-zinc-800"></div>
                  <input 
                    type="time" 
                    value={wh.endTime} 
                    onChange={e => updateTime(idx, 'endTime', e.target.value)} 
                    className="bg-transparent px-2 py-2 text-[11px] font-black text-[#D4AF37] outline-none" 
                  />
                </div>
              )}
            </div>

            {wh.enabled && (
               <div className="mt-6 pt-6 border-t border-white/5 space-y-5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-zinc-600" />
                      <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Dnevne pauze</span>
                    </div>
                    <button onClick={() => addBreak(idx)} className="text-[9px] font-black text-[#D4AF37] uppercase tracking-widest flex items-center gap-1.5 bg-[#D4AF37]/10 px-4 py-2 rounded-xl border border-[#D4AF37]/20 active:scale-95 transition-all">
                      <Plus size={14} /> Dodaj
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {wh.breaks?.map((b, bIdx) => (
                      <div key={bIdx} className="flex gap-4 items-center animate-lux-fade bg-black/40 p-3.5 rounded-2xl border border-white/5">
                        <div className="flex-1 flex gap-3 items-center">
                           <input 
                             type="time" 
                             value={b.startTime} 
                             onChange={e => updateBreakTime(idx, bIdx, 'startTime', e.target.value)}
                             className="bg-zinc-900 border border-white/5 p-2.5 rounded-xl text-[10px] font-black text-zinc-400 w-full outline-none focus:border-[#D4AF37]/30" 
                           />
                           <div className="w-4 h-px bg-zinc-800 shrink-0"></div>
                           <input 
                             type="time" 
                             value={b.endTime} 
                             onChange={e => updateBreakTime(idx, bIdx, 'endTime', e.target.value)}
                             className="bg-zinc-900 border border-white/5 p-2.5 rounded-xl text-[10px] font-black text-zinc-400 w-full outline-none focus:border-[#D4AF37]/30" 
                           />
                        </div>
                        <button onClick={() => removeBreak(idx, bIdx)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl active:scale-90 transition-all border border-red-500/10">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!wh.breaks || wh.breaks.length === 0) && (
                      <p className="text-center text-[8px] font-black text-zinc-800 uppercase tracking-[0.3em] py-3 italic">Nema definiranih pauza</p>
                    )}
                  </div>
               </div>
            )}
          </Card>
        ))}
      </div>

      <div className="px-1 pt-6 pb-12">
        <Button onClick={handleSave} loading={saveLoading} className="w-full h-20 text-xs font-black shadow-[0_25px_60px_rgba(212,175,55,0.2)]">
          Spremi i potvrdi raspored
        </Button>
      </div>
    </div>
  );
};

export default BarberAvailability;
