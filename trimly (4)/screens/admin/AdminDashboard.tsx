
import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../../store/mockDatabase';
import { Card, Button, Badge } from '../../components/UI';
import { translations, Language } from '../../translations';
import { BarChart3, TrendingUp, Activity, ShieldCheck, CalendarDays, Trophy, Award, Scissors, Users, DollarSign, Wallet, Database, Loader2, Sparkles, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';
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
  const [dbHealth, setDbHealth] = useState<'good' | 'error'>('good');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('monthly');
  const t = translations[lang];

  useEffect(() => {
    const handleSync = () => setRefresh(prev => prev + 1);
    window.addEventListener('app-sync-complete', handleSync);
    return () => window.removeEventListener('app-sync-complete', handleSync);
  }, []);

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' });
  const todayStr = formatter.format(now);
  const monthStr = todayStr.substring(0, 7);
  const yearStr = todayStr.substring(0, 4);

  const data = useMemo(() => {
    const rawBookings = db.getBookingsSync().filter(b => b.status === 'completed');
    const rawBarbers = db.getBarbersSync();

    const getBarberStats = (barberId: string, period: Period) => {
      const filtered = rawBookings.filter(b => {
        if (b.barberId !== barberId) return false;
        if (period === 'daily') return b.date === todayStr;
        if (period === 'monthly') return b.date.startsWith(monthStr);
        if (period === 'yearly') return b.date.startsWith(yearStr);
        return true;
      });
      const gross = filtered.reduce((sum, b) => sum + b.price, 0);
      return { gross, adminCut: gross * APP_CONFIG.ADMIN_COMMISSION, barberNet: gross * APP_CONFIG.BARBER_SHARE, count: filtered.length };
    };

    const barberBreakdown = rawBarbers.map(barber => ({
      ...barber,
      stats: { daily: getBarberStats(barber.id, 'daily'), monthly: getBarberStats(barber.id, 'monthly'), yearly: getBarberStats(barber.id, 'yearly') }
    }));

    const gross = rawBookings.reduce((sum, b) => sum + b.price, 0);
    const revenue = gross * APP_CONFIG.ADMIN_COMMISSION;

    const stats = {
      daily: rawBookings.filter(b => b.date === todayStr).length,
      monthly: rawBookings.filter(b => b.date.startsWith(monthStr)).length,
      yearly: rawBookings.filter(b => b.date.startsWith(yearStr)).length,
    };

    const leaderboard = rawBarbers.map(barber => ({ ...barber, cutCount: rawBookings.filter(b => b.barberId === barber.id).length })).sort((a, b) => b.cutCount - a.cutCount);

    return { totalGross: gross, adminRevenue: revenue, networkStats: stats, leaderboard, barberBreakdown, barbers: rawBarbers };
  }, [refresh, todayStr, monthStr, yearStr]);

  const handleSeedDemoData = async () => {
    if (!confirm("Ovo će generirati testne podatke u vašu Supabase bazu. Nastaviti?")) return;
    setIsSeeding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const demoBarber = {
        userId: 'demo-barber-id-' + Math.random().toString(36).substr(2, 5),
        fullName: "Luka Master Fade",
        profilePicture: "https://images.unsplash.com/photo-1599351431247-f10b21ce53e2?w=400",
        neighborhood: "Donji Grad",
        address: "Ilica 15",
        bio: "Demo brijač za testiranje sistema.",
        workMode: "both",
        approved: true,
        createdAt: new Date().toISOString()
      };

      await db.saveBarbers(demoBarber as any);
      await Promise.all([db.getBarbers(), db.getBookings(), db.getServices()]);
      window.dispatchEvent(new Event('app-sync-complete'));
    } catch (e) {
      setDbHealth('error');
    } finally {
      setIsSeeding(false);
    }
  };

  const VelocityScale = ({ label, value, max }: { label: string, value: number, max: number }) => (
    <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
      <div className="text-center space-y-1 w-full">
        <span className="text-[7px] font-black text-zinc-400 uppercase tracking-[0.2em] block w-full">{label}</span>
        <span className="text-sm font-black text-white block leading-none w-full">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5 px-0.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`h-full flex-1 transition-all duration-1000 ${i < (value / (max/8 || 1)) ? 'bg-white' : 'bg-white/5'}`} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-slide-up pb-32">
      <div className="premium-blur bg-white/5 rounded-[2.5rem] p-8 border border-white/10 ios-shadow flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-black shadow-2xl">
          <BarChart3 size={28} />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter w-full text-center">{t.stats}</h2>
          <p className="text-[#D4AF37] text-[8px] font-black uppercase tracking-[0.4em] mt-2">Network Insights</p>
        </div>
      </div>

      <Card className="p-6 bg-zinc-950 border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-widest">Supabase Connected</p>
            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-1">Status: Operational</p>
          </div>
        </div>
        <Badge variant="success">Active</Badge>
      </Card>

      <div className="grid grid-cols-2 gap-5">
        <Card className="p-8 bg-zinc-950 border-white/5 flex flex-col items-center text-center gap-3">
          <p className="text-[9px] uppercase font-black tracking-widest text-zinc-500 w-full">Network Gross</p>
          <p className="text-3xl font-black text-white italic tracking-tighter leading-none w-full">{data.totalGross}€</p>
        </Card>
        <Card className="p-8 bg-emerald-600 text-white flex flex-col items-center text-center gap-3 shadow-[0_20px_40px_rgba(16,185,129,0.3)] border-transparent">
          <p className="text-[9px] uppercase font-black tracking-widest opacity-80 w-full text-center">Adm (10%)</p>
          <p className="text-3xl font-black italic tracking-tighter leading-none w-full text-center">{data.adminRevenue.toFixed(2)}€</p>
        </Card>
      </div>

      <section className="space-y-6">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center justify-center gap-3 w-full text-center">
          <CalendarDays size={16} className="text-white/20" /> Throughput
        </h3>
        <Card className="p-8 bg-black border border-white/10">
          <div className="flex gap-8 justify-center items-center w-full">
            <VelocityScale label="Daily Shifts" value={data.networkStats.daily} max={50} />
            <VelocityScale label="Monthly Cuts" value={data.networkStats.monthly} max={500} />
            <VelocityScale label="Yearly Cuts" value={data.networkStats.yearly} max={5000} />
          </div>
        </Card>
      </section>

      <div className="px-4 space-y-4">
        <Button onClick={handleSeedDemoData} variant="secondary" className="w-full h-14 bg-zinc-950 border-white/5 text-zinc-600 opacity-50 hover:opacity-100">
          {t.seedData}
        </Button>
        {onLogout && (
          <Button variant="danger" className="w-full h-14 text-[10px] font-black uppercase tracking-widest" onClick={onLogout}>
            <LogOut size={16} className="mr-2" /> {t.logout}
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
