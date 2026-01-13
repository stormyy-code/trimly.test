
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-full h-full" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="premiumGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="35%" stopColor="#FFF5C2" />
          <stop offset="65%" stopColor="#B8860B" />
          <stop offset="100%" stopColor="#967900" />
        </linearGradient>
        
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22262E" />
          <stop offset="100%" stopColor="#020202" />
        </linearGradient>

        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <clipPath id="poleClipPath">
          <rect x="32" y="18" width="36" height="64" rx="8" />
        </clipPath>
      </defs>

      {/* Main Squircle Background */}
      <rect x="0" y="0" width="100" height="100" rx="28" fill="url(#bgGradient)" />
      
      {/* Gold Inner Circle Ring */}
      <circle cx="50" cy="50" r="43" stroke="url(#premiumGold)" strokeWidth="0.8" opacity="0.4" />
      <circle cx="50" cy="50" r="40" stroke="url(#premiumGold)" strokeWidth="2" opacity="0.15" />

      {/* Wider Barber Pole Background */}
      <rect x="32" y="18" width="36" height="64" rx="8" fill="white" />
      
      {/* Diagonal Stripes */}
      <g clipPath="url(#poleClipPath)">
        <path d="M5 5 L95 45 M5 25 L95 65 M5 45 L95 85 M5 65 L95 105 M5 -15 L95 25" stroke="#000" strokeWidth="14" />
        <path d="M5 15 L95 55 M5 35 L95 75 M5 55 L95 95 M5 75 L95 115 M5 -5 L95 35" stroke="url(#premiumGold)" strokeWidth="8" />
      </g>
      
      {/* Extra Wide Pole Caps */}
      <rect x="28" y="14" width="44" height="10" rx="5" fill="url(#premiumGold)" />
      <rect x="28" y="76" width="44" height="10" rx="5" fill="url(#premiumGold)" />
      
      {/* Pole Ends (Spheres) */}
      <circle cx="50" cy="9" r="7" fill="url(#premiumGold)" />
      <circle cx="50" cy="91" r="7" fill="url(#premiumGold)" />

      {/* Prominent Gold Scissors */}
      <g stroke="url(#premiumGold)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" filter="url(#goldGlow)">
        {/* Scissor Left */}
        <path d="M20 86 C20 70 26 64 45 52 L82 14" />
        <circle cx="16" cy="88" r="10" strokeWidth="6" />
        
        {/* Scissor Right */}
        <path d="M80 86 C80 70 74 64 55 52 L18 14" />
        <circle cx="84" cy="88" r="10" strokeWidth="6" />
        
        {/* Center Pivot Pin */}
        <circle cx="50" cy="49" r="3" fill="white" stroke="none" />
      </g>
    </svg>
  );
};

export default Logo;
