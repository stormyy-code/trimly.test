
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/database';
import { Card, Button, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, ShieldCheck, CalendarDays, Zap, CheckCircle2, LogOut, Users, Scissors, DollarSign } from 'lucide-react';
import { APP_CONFIG } from '../../constants';
import { supabase } from '../../store/supabase';

interface AdminDashboardProps {
  lang: Language;
  onLogout?: () => void;
}

type Period = 'daily' | 'monthly' | 'yearly';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, onLogout }) => {
  const [refresh, setRefresh] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const t = translations[lang];

  useEffect(() => {
    const handleSync = () => setRefresh(prev => prev + 1);
    window.addEventListener('app-sync-complete', handleSync);
    const interval = setInterval(() => db.getBookings(), 30000);
    return () => {
      window.removeEventListener('app-sync-complete', handleSync);
      clearInterval(interval);
    };
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthStr = todayStr.substring(0, 7);

  const data = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.status === 'completed');
    const rawBarbers = db.getBarbersSync();
    const rawUsers = db.getUsersSync();

    const gross = rawBookings.reduce((sum, b) => sum + b.price, 0);
    const revenue = gross * APP_CONFIG.ADMIN_COMMISSION;

    const stats = {
      daily: rawBookings.filter(b => b.date === todayStr).length,
      monthly: rawBookings.filter(b => b.date.startsWith(monthStr)).length,
      totalBarbers: rawBarbers.length,
      pendingBarbers: rawBarbers.filter(b => !b.approved).length
    };

    return { totalGross: gross, adminRevenue: revenue, networkStats: stats, barbers: rawBarbers };
  }, [refresh, todayStr, monthStr]);

  const VelocityScale = ({ label, value, max }: { label: string, value: number, max: number }) => (
    <div className="flex-1 flex flex-col items-center gap-3">
      <div className="text-center space-y-1 w-full">
        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.2em] block w-full">{label}</span>
        <span className="text-sm font-black text-white block leading-none w-full">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5 px-0.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`h-full flex-1 transition-all duration-1000 ${i < (value / (max/8 || 1)) ? 'bg-[#D4AF37]' : 'bg-white/5'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up pb-32">
      <div className="premium-blur bg-zinc-900/40 rounded-[3rem] p-10 border border-white/10 ios-shadow flex flex-col items-center gap-6">
        <div className="w-16 h-16 bg-[#D4AF37] rounded-[2rem] flex items-center justify-center text-black shadow-[0_20px_50px_rgba(212,175,55,0.3)]">
          <BarChart3 size={32} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Network Command</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em]">System Live • Zagreb Central</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-1">
        <Card className="p-8 bg-zinc-950 border-white/5 space-y-4">
          <div className="flex items-center gap-3">
             <DollarSign size={14} className="text-zinc-600" />
             <p className="text-[9px] uppercase font-black tracking-widest text-zinc-500">Gross Vol.</p>
          </div>
          <p className="text-3xl font-black text-white italic tracking-tighter leading-none">{data.totalGross}€</p>
        </Card>
        <Card className="p-8 bg-emerald-500/10 border-emerald-500/20 space-y-4 shadow-[0_20px_40px_rgba(16,185,129,0.1)]">
          <div className="flex items-center gap-3">
             <TrendingUp size={14} className="text-emerald-500" />
             <p className="text-[9px] uppercase font-black tracking-widest text-emerald-500">Comm (10%)</p>
          </div>
          <p className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none">{data.adminRevenue.toFixed(2)}€</p>
        </Card>
      </div>

      <section className="space-y-4 px-1">
        <div className="flex items-center gap-3 px-4">
           <Zap size={14} className="text-[#D4AF37]" />
           <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Network Throughput</h3>
        </div>
        <Card className="p-8 bg-black border border-white/5">
          <div className="flex gap-10 justify-around items-center">
            <VelocityScale label="Today" value={data.networkStats.daily} max={20} />
            <VelocityScale label="Month" value={data.networkStats.monthly} max={200} />
            <VelocityScale label="Active Barbers" value={data.networkStats.totalBarbers} max={50} />
          </div>
        </Card>
      </section>

      {data.networkStats.pendingBarbers > 0 && (
        <div className="mx-1 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-between animate-pulse">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-black">
                 <Users size={20} />
              </div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                {data.networkStats.pendingBarbers} Zahtjeva na čekanju
              </p>
           </div>
           <Badge variant="warning">Action Needed</Badge>
        </div>
      )}

      <div className="px-1 pt-4 space-y-4">
        <Button 
          variant="danger" 
          className="w-full h-18 text-[11px] font-black tracking-widest border-red-500/20" 
          onClick={onLogout}
        >
          <LogOut size={16} className="mr-3" /> ODJAVI SE IZ SUSTAVA
        </Button>
      </div>
    </div>
  );
};

export default AdminDashboard;
