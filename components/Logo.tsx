
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
        {/* Premium Zlatni Gradijent */}
        <linearGradient id="premiumGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#F5E3A0" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>
        
        {/* Duboki Crni Gradijent za pozadinu */}
        <linearGradient id="darkBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A1A1A" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>

        {/* Efekt sjaja za zlato */}
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Glavna Squircle Pozadina (inspirirana slikom) */}
      <rect x="0" y="0" width="100" height="100" rx="32" fill="url(#darkBg)" />
      
      {/* Suptilni unutarnji rub */}
      <rect x="2" y="2" width="96" height="96" rx="30" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />

      {/* Moderna Scissor Ikona */}
      <g filter="url(#goldGlow)">
        {/* Prsteni za prste (Gornji dio škara u ovom dizajnu) */}
        <circle cx="34" cy="40" r="10" stroke="url(#premiumGold)" strokeWidth="6" />
        <circle cx="66" cy="40" r="10" stroke="url(#premiumGold)" strokeWidth="6" />
        
        {/* Oštrice (X oblik) */}
        <path 
          d="M34 46 L66 76" 
          stroke="url(#premiumGold)" 
          strokeWidth="7" 
          strokeLinecap="round" 
        />
        <path 
          d="M66 46 L34 76" 
          stroke="url(#premiumGold)" 
          strokeWidth="7" 
          strokeLinecap="round" 
        />
        
        {/* Središnji spojni vijak */}
        <circle cx="50" cy="61" r="2.5" fill="#0A0A0A" />
        <circle cx="50" cy="61" r="1.2" fill="url(#premiumGold)" />
      </g>
      
      {/* Dodatni sjaj u kutovima za dubinu */}
      <circle cx="20" cy="20" r="15" fill="white" fillOpacity="0.02" />
    </svg>
  );
};

export default Logo;
