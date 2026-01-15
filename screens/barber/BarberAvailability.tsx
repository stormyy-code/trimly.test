
import React, { useState, useEffect } from 'react';
import { db } from '../../store/database';
import { BarberProfile, WorkingDay, BreakTime } from '../../types';
import { translations, Language } from '../../translations';
import { Card, Button, Badge, Toast } from '../../components/UI';
import { Clock, Calendar, Check, X, Plus, Trash2, Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { BARBER_INVITE_CODE } from '../../constants';

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const barbers = await db.getBarbers();
      const b = barbers.find(x => x.id === barberId);
      if (b) {
        setBarber(b);
        setSlotInterval(b.slotInterval || 45);
        const currentWeek = getWeekNumber(new Date());
        if (b.lastUpdatedWeek !== currentWeek) {
          setIsNewWeek(true);
        } else if (b.workingHours) {
          setWorkingHours(b.workingHours);
        }
      }
      setLoading(false);
    };
    load();
  }, [barberId]);

  const handleSave = async () => {
    if (!barber) return;
    setLoading(true);
    const currentWeek = getWeekNumber(new Date());
    const result = await db.saveBarbers({ 
      ...barber, 
      workingHours, 
      slotInterval,
      lastUpdatedWeek: currentWeek 
    });
    
    if (result.success) {
      setIsNewWeek(false);
      setToast({ msg: 'Raspored spremljen.', type: 'success' });
    } else {
      setToast({ msg: 'Greška pri spremanju.', type: 'error' });
    }
    setLoading(false);
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

  return (
    <div className="space-y-8 animate-slide-up pb-32">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 text-center space-y-4">
        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">{t.schedule}</h2>
      </div>

      {isNewWeek && (
        <div className="p-6 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-3xl flex items-center gap-4 mx-1">
          <AlertCircle className="text-[#D4AF37]" size={24} />
          <p className="text-[10px] font-black text-white uppercase tracking-widest leading-relaxed">
            Novi tjedan je počeo! Potvrdite raspored kako biste bili vidljivi klijentima.
          </p>
        </div>
      )}

      <div className="space-y-4 px-1">
        {workingHours.map((wh, idx) => (
          <Card key={wh.day} className={`p-6 border-white/5 ${wh.enabled ? 'bg-zinc-900/40' : 'bg-black opacity-40'}`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <button onClick={() => toggleDay(idx)} className={`w-10 h-10 rounded-xl flex items-center justify-center ${wh.enabled ? 'bg-[#D4AF37] text-black' : 'bg-zinc-800 text-zinc-600'}`}>
                  {wh.enabled ? <Check size={18} /> : <X size={18} />}
                </button>
                <span className="font-black text-sm uppercase italic">{wh.day}</span>
              </div>
              {wh.enabled && (
                <div className="flex gap-2">
                  <input type="time" value={wh.startTime} onChange={e => updateTime(idx, 'startTime', e.target.value)} className="bg-zinc-950 p-2 rounded-lg text-[10px] font-black text-[#D4AF37] border border-white/5" />
                  <input type="time" value={wh.endTime} onChange={e => updateTime(idx, 'endTime', e.target.value)} className="bg-zinc-950 p-2 rounded-lg text-[10px] font-black text-[#D4AF37] border border-white/5" />
                </div>
              )}
            </div>
            {wh.enabled && (
               <div className="pt-4 border-t border-white/5 space-y-3">
                  <button onClick={() => addBreak(idx)} className="text-[8px] font-black text-[#D4AF37] uppercase tracking-widest">+ Dodaj pauzu</button>
                  {wh.breaks?.map((b, bIdx) => (
                    <div key={bIdx} className="flex gap-2 items-center">
                      <input type="time" value={b.startTime} className="bg-zinc-950 p-1 rounded-lg text-[9px]" />
                      <input type="time" value={b.endTime} className="bg-zinc-950 p-1 rounded-lg text-[9px]" />
                      <button onClick={() => removeBreak(idx, bIdx)} className="text-red-500/50"><Trash2 size={12} /></button>
                    </div>
                  ))}
               </div>
            )}
          </Card>
        ))}
      </div>

      <Button onClick={handleSave} loading={loading} className="w-full h-18 text-xs font-black shadow-2xl">Spremi raspored</Button>
    </div>
  );
};

export default BarberAvailability;
