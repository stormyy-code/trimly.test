
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
      className={`w-full px-4 sm:px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] sm:text-[11px] transition-all duration-300 disabled:opacity-30 flex items-center justify-center gap-2 sm:gap-3 outline-none flex-shrink-0 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-zinc-900/50 premium-blur rounded-[2.2rem] sm:rounded-[2.8rem] p-5 sm:p-7 border border-white/[0.08] transition-all duration-300 overflow-hidden ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
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
  <div className={`flex flex-col gap-2.5 w-full min-w-0 ${className}`}>
    {label && <label className="text-[9px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block ml-4 sm:ml-5 truncate">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-[#0F0F0F] border border-white/[0.05] rounded-[1.25rem] px-5 sm:px-7 py-4 sm:py-5 text-white focus:border-[#D4AF37]/50 focus:bg-black outline-none transition-all duration-300 placeholder:text-zinc-800 text-[12px] sm:text-[13px] font-bold block shadow-inner min-w-0"
    />
  </div>
);

export const Toast: React.FC<{
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="w-full max-w-sm pointer-events-auto animate-slide-up origin-top">
      <div className={`p-4 pl-5 rounded-[2rem] flex items-center justify-between border shadow-2xl premium-blur ${
        type === 'success' 
          ? 'bg-emerald-500/10 border-emerald-500/30' 
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            {type === 'success' ? <CheckCircle2 size={20} className="text-emerald-400" /> : <AlertCircle size={20} className="text-red-400" />}
          </div>
          <p className="text-[10px] font-black text-white uppercase tracking-widest leading-tight truncate">
            {message}
          </p>
        </div>
        <button 
          onClick={onClose} 
          className="w-10 h-10 flex items-center justify-center text-white/20 active:scale-90 transition-all shrink-0"
        >
          <X size={18} />
        </button>
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
    <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-3 sm:px-4 py-1.5 sm:py-2 rounded-full inline-flex items-center justify-center text-center whitespace-nowrap ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};
