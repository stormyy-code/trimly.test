
import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

export const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}> = ({ children, onClick, type = 'button', variant = 'primary', className = '', disabled = false, loading = false }) => {
  const variants = {
    primary: 'bg-[#D4AF37] text-black active:scale-[0.97] shadow-[0_20px_50px_rgba(212,175,55,0.25)] hover:brightness-110 border-none ring-1 ring-white/10',
    secondary: 'bg-zinc-800 text-white border border-white/10 hover:bg-zinc-700 active:scale-[0.97]',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 active:scale-[0.97]',
    ghost: 'bg-transparent text-[#D4AF37] active:scale-[0.97] border-none',
  };

  return (
    <button
      type={type}
      onClick={() => !disabled && !loading && onClick?.()}
      disabled={disabled || loading}
      className={`w-full px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] transition-all duration-300 disabled:opacity-30 flex items-center justify-center gap-3 outline-none ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-zinc-900/50 premium-blur rounded-[2.8rem] p-7 border border-white/[0.08] transition-all duration-300 ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
  >
    {children}
  </div>
);

export const Input: React.FC<{
  label?: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}> = ({ label, type = 'text', value, onChange, placeholder, className = '', required = false }) => (
  <div className={`flex flex-col gap-3 w-full ${className}`}>
    {label && <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] block ml-5">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-[#0F0F0F] border border-white/[0.05] rounded-[1.25rem] px-7 py-5 text-white focus:border-[#D4AF37]/50 focus:bg-black outline-none transition-all duration-300 placeholder:text-zinc-800 text-[13px] font-bold block shadow-inner"
    />
  </div>
);

export const Toast: React.FC<{
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-14 left-6 right-6 z-[300] animate-lux-fade">
      <div className={`p-5 rounded-2xl flex items-center justify-between border premium-blur ios-shadow ${
        type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
      }`}>
        <div className="flex items-center gap-4">
          {type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-red-500" />}
          <span className="text-[11px] font-black text-white uppercase tracking-widest leading-none">{message}</span>
        </div>
        <button onClick={onClose} className="text-zinc-600 active:scale-90 transition-all"><X size={16} /></button>
      </div>
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'error' | 'neutral' | 'gold'; className?: string }> = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border border-red-500/20',
    neutral: 'bg-zinc-800 text-zinc-500 border border-white/5',
    gold: 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full inline-flex items-center justify-center text-center ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};
