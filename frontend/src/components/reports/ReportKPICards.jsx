import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function ReportKPICards({ cards = [], columns = 4, style = {} }) {
  const getColorTokens = (color = 'sky') => {
    switch (color) {
      case 'emerald':
        return {
          border: 'hsl(142, 75%, 35%)',
          bgIcon: 'rgba(34, 197, 94, 0.12)',
          textVal: 'hsl(142, 75%, 32%)',
          iconColor: 'hsl(142, 75%, 35%)',
          badgeBg: 'rgba(34, 197, 94, 0.1)',
          badgeText: 'hsl(142, 75%, 32%)',
        };
      case 'amber':
        return {
          border: 'hsl(35, 85%, 45%)',
          bgIcon: 'rgba(245, 158, 11, 0.12)',
          textVal: 'hsl(35, 85%, 40%)',
          iconColor: 'hsl(35, 85%, 45%)',
          badgeBg: 'rgba(245, 158, 11, 0.1)',
          badgeText: 'hsl(35, 85%, 40%)',
        };
      case 'rose':
        return {
          border: 'hsl(0, 75%, 48%)',
          bgIcon: 'rgba(239, 68, 68, 0.12)',
          textVal: 'hsl(0, 75%, 48%)',
          iconColor: 'hsl(0, 75%, 48%)',
          badgeBg: 'rgba(239, 68, 68, 0.1)',
          badgeText: 'hsl(0, 75%, 48%)',
        };
      case 'indigo':
      case 'violet':
        return {
          border: 'hsl(263, 75%, 50%)',
          bgIcon: 'rgba(147, 51, 234, 0.12)',
          textVal: 'hsl(263, 75%, 45%)',
          iconColor: 'hsl(263, 75%, 50%)',
          badgeBg: 'rgba(147, 51, 234, 0.1)',
          badgeText: 'hsl(263, 75%, 45%)',
        };
      case 'sky':
      default:
        return {
          border: 'hsl(190, 85%, 35%)',
          bgIcon: 'rgba(6, 182, 212, 0.12)',
          textVal: 'hsl(190, 85%, 32%)',
          iconColor: 'hsl(190, 85%, 35%)',
          badgeBg: 'rgba(6, 182, 212, 0.1)',
          badgeText: 'hsl(190, 85%, 32%)',
        };
    }
  };

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${columns >= 5 ? '200px' : '230px'}, 1fr))`,
        gap: '16px',
        ...style
      }}
    >
      {cards.map((card, idx) => {
        const tokens = getColorTokens(card.color);
        return (
          <div
            key={idx}
            className="glass-panel"
            style={{
              padding: '18px 20px',
              borderLeft: `4px solid ${tokens.border}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '115px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div>
                <span 
                  style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.6px', 
                    color: 'hsl(var(--text-muted))' 
                  }}
                >
                  {card.label}
                </span>
                <div 
                  style={{ 
                    fontSize: '1.45rem', 
                    fontWeight: 800, 
                    color: tokens.textVal, 
                    marginTop: '4px',
                    letterSpacing: '-0.5px'
                  }}
                >
                  {card.value}
                </div>
              </div>
              
              {card.icon && (
                <div 
                  style={{ 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '10px', 
                    background: tokens.bgIcon, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: tokens.iconColor,
                    flexShrink: 0
                  }}
                >
                  {card.icon}
                </div>
              )}
            </div>

            {(card.subtitle || card.trend || card.badge) && (
              <div 
                style={{ 
                  marginTop: '12px', 
                  paddingTop: '10px', 
                  borderTop: '1px solid rgba(0, 0, 0, 0.04)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  color: 'hsl(var(--text-secondary))'
                }}
              >
                {card.subtitle && <span>{card.subtitle}</span>}
                {card.badge && (
                  <span 
                    style={{ 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontWeight: 700, 
                      fontSize: '0.68rem', 
                      background: tokens.badgeBg, 
                      color: tokens.badgeText 
                    }}
                  >
                    {card.badge}
                  </span>
                )}
                {card.trend && (
                  <span 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      fontWeight: 700,
                      color: card.trendType === 'positive' ? 'hsl(142, 75%, 35%)' :
                             card.trendType === 'negative' ? 'hsl(0, 75%, 48%)' : 'hsl(var(--text-muted))'
                    }}
                  >
                    {card.trendType === 'positive' && <TrendingUp size={12} />}
                    {card.trendType === 'negative' && <TrendingDown size={12} />}
                    {card.trendType === 'neutral' && <Minus size={12} />}
                    {card.trend}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
