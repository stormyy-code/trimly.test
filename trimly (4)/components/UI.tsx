
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
    primary: 'bg-[#D4AF37] text-black active:scale-95 shadow-[0_15px_40px_rgba(212,175,55,0.2)] hover:brightness-110',
    secondary: 'bg-zinc-800 text-white border border-white/10 hover:bg-zinc-700 active:scale-95',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 active:scale-95',
    ghost: 'bg-transparent text-[#D4AF37] active:scale-95',
  };

  return (
    <button
      type={type}
      onClick={() => !disabled && !loading && onClick?.()}
      disabled={disabled || loading}
      className={`px-6 py-4 rounded-[1.25rem] font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-30 flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-zinc-900/40 premium-blur rounded-[2.5rem] p-6 border border-white/10 transition-all ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
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
  <div className={`flex flex-col gap-2 w-full items-center ${className}`}>
    {label && <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block text-center w-full">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-zinc-900/60 border border-white/5 rounded-2xl px-6 py-4 text-white text-center focus:border-[#D4AF37]/40 outline-none transition-all placeholder:text-zinc-800 text-xs font-bold block"
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
    <div className="fixed top-12 left-6 right-6 z-[300] animate-lux-fade">
      <div className={`p-4 rounded-2xl flex items-center justify-between border premium-blur ios-shadow ${
        type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
      }`}>
        <div className="flex items-center gap-3">
          {type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
          <span className="text-[10px] font-black text-white uppercase tracking-widest">{message}</span>
        </div>
        <button onClick={onClose} className="text-zinc-600"><X size={14} /></button>
      </div>
    </div>
  );
};

// Fix: Add className prop to Badge component to support custom styling from parent components
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'error' | 'neutral' | 'gold'; className?: string }> = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    error: 'bg-red-500/10 text-red-400 border border-red-500/20',
    neutral: 'bg-zinc-800 text-zinc-500 border border-white/5',
    gold: 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20',
  };
  return (
    <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center justify-center text-center ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};
