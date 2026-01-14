import React, { useState } from 'react';
import { db } from '../../store/mockDatabase';
import { BarberProfile, WorkingDay, BreakTime } from '../../types';
import { translations, Language } from '../../translations';
import { Card, Button, Badge } from '../../components/UI';
import { Clock, Calendar, Check, X, Plus, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { BARBER_INVITE_CODE } from '../../constants';

interface BarberAvailabilityProps {
  barberId: string;
  lang: Language;
}

const BarberAvailability: React.FC<BarberAvailabilityProps> = ({ barberId, lang }) => {
  const t = translations[lang];
  const barber = db.getBarbersSync().find(b => b.id === barberId);
  const [copied, setCopied] = useState(false);
  
  const [slotInterval, setSlotInterval] = useState<number>(barber?.slotInterval || 45);
  const [workingHours, setWorkingHours] = useState<WorkingDay[]>(
    barber?.workingHours || [
      { day: 'Monday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
      { day: 'Tuesday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
      { day: 'Wednesday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
      { day: 'Thursday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
      { day: 'Friday', enabled: true, startTime: '09:00', endTime: '17:00', breaks: [] },
      { day: 'Saturday', enabled: false, startTime: '10:00', endTime: '14:00', breaks: [] },
      { day: 'Sunday', enabled: false, startTime: '10:00', endTime: '14:00', breaks: [] },
    ]
  );
  const [saved, setSaved] = useState(false);

  const toggleDay = (index: number) => {
    const next = [...workingHours];
    next[index].enabled = !next[index].enabled;
    setWorkingHours(next);
  };

  const updateTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const next = [...workingHours];
    next[index][field] = value;
    setWorkingHours(next);
  };

  const addBreak = (dayIdx: number) => {
    const next = [...workingHours];
    if (!next[dayIdx].breaks) next[dayIdx].breaks = [];
    next[dayIdx].breaks.push({ startTime: '12:00', endTime: '13:00' });
    setWorkingHours(next);
  };

  const removeBreak = (dayIdx: number, breakIdx: number) => {
    const next = [...workingHours];
    next[dayIdx].breaks.splice(breakIdx, 1);
    setWorkingHours(next);
  };

  const updateBreak = (dayIdx: number, breakIdx: number, field: keyof BreakTime, value: string) => {
    const next = [...workingHours];
    next[dayIdx].breaks[breakIdx][field] = value;
    setWorkingHours(next);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(BARBER_INVITE_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!barber) return;
    await db.saveBarbers({ ...barber, workingHours, slotInterval });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8 animate-slide-up pb-32 overflow-x-hidden">
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center mx-auto text-[#D4AF37] border border-[#D4AF37]/20">
          <Calendar size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">{t.schedule}</h2>
          <div 
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 cursor-pointer mt-4 active:scale-95 transition-all"
          >
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">{t.barberCode}:</span>
            <span className="text-[8px] font-black text-[#D4AF37] tracking-widest">{BARBER_INVITE_CODE}</span>
            {copied ? <CheckCircle2 size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-700" />}
          </div>
        </div>
      </div>

      <section className="space-y-4 px-1">
        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-4">{t.slotInterval}</label>
        <div className="grid grid-cols-4 gap-2">
          {[30, 45, 60, 90].map(val => (
            <button 
              key={val} 
              onClick={() => setSlotInterval(val)}
              className={`py-4 rounded-2xl border text-[10px] font-black transition-all ${slotInterval === val ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-zinc-900 text-zinc-500 border-white/5'}`}
            >
              {val} {t.minutes}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4 px-1">
        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-4">Radni dani i pauze</label>
        {workingHours.map((wh, idx) => (
          <Card 
            key={wh.day} 
            className={`p-6 transition-all border-white/5 ${wh.enabled ? 'bg-zinc-900/40 border-white/10 shadow-xl' : 'bg-black/80 border-white/[0.05]'}`}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleDay(idx)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${wh.enabled ? 'bg-[#D4AF37] text-black shadow-lg' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {wh.enabled ? <Check size={20} strokeWidth={3} /> : <X size={20} />}
                </button>
                <div className="flex flex-col">
                  <span className={`font-black text-sm uppercase tracking-tight italic ${wh.enabled ? 'text-white' : 'text-zinc-700'}`}>{wh.day}</span>
                  <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest">{wh.enabled ? 'Open' : 'Closed'}</span>
                </div>
              </div>
              {wh.enabled && (
                <div className="flex items-center gap-3">
                   <div className="bg-zinc-950 px-3 py-2 rounded-xl border border-white/5 flex flex-col items-center min-w-[70px]">
                      <span className="text-[6px] font-black text-zinc-600 uppercase mb-0.5">Start</span>
                      <input 
                        type="time" 
                        value={wh.startTime}
                        onChange={(e) => updateTime(idx, 'startTime', e.target.value)}
                        className="bg-transparent text-[11px] font-black text-[#D4AF37] outline-none text-center p-0 w-full"
                      />
                   </div>
                   <div className="bg-zinc-950 px-3 py-2 rounded-xl border border-white/5 flex flex-col items-center min-w-[70px]">
                      <span className="text-[6px] font-black text-zinc-600 uppercase mb-0.5">End</span>
                      <input 
                        type="time" 
                        value={wh.endTime}
                        onChange={(e) => updateTime(idx, 'endTime', e.target.value)}
                        className="bg-transparent text-[11px] font-black text-[#D4AF37] outline-none text-center p-0 w-full"
                      />
                   </div>
                </div>
              )}
            </div>

            {wh.enabled && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{t.breaks}</span>
                   <button onClick={() => addBreak(idx)} className="text-[#D4AF37] text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Plus size={14} /> {t.addBreak}
                   </button>
                </div>
                
                {wh.breaks?.map((brk, bIdx) => (
                  <div key={bIdx} className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[7px] text-zinc-600 uppercase font-black">{t.breakStart}</span>
                        <input 
                          type="time" 
                          value={brk.startTime}
                          onChange={(e) => updateBreak(idx, bIdx, 'startTime', e.target.value)}
                          className="bg-zinc-900 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none border border-white/5"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[7px] text-zinc-600 uppercase font-black">{t.breakEnd}</span>
                        <input 
                          type="time" 
                          value={brk.endTime}
                          onChange={(e) => updateBreak(idx, bIdx, 'endTime', e.target.value)}
                          className="bg-zinc-900 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none border border-white/5"
                        />
                      </div>
                    </div>
                    <button onClick={() => removeBreak(idx, bIdx)} className="text-red-500/50 hover:text-red-500 p-2">
                       <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="px-1 pt-6">
        <Button 
          onClick={handleSave} 
          className="w-full h-20 text-xs font-black uppercase tracking-widest shadow-2xl"
        >
          {saved ? <><CheckCircle2 size={18} className="mr-2" /> {t.done}</> : t.save}
        </Button>
      </div>
    </div>
  );
};

export default BarberAvailability;