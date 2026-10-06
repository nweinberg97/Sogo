import { forwardRef, type CSSProperties, type ReactNode } from 'react';

// A 1080×1920 social asset (Instagram Story, TikTok, Snapchat). Rendered at full resolution and scaled
// for preview, then exported to PNG. Built from the same tokens as the product so it reads as Sogo.

export type CardTheme = 'blue' | 'sun' | 'ink' | 'brand';

export interface CardContent {
  headline: string; // I DID IT.
  kicker: string; // 50 KM COMPLETE
  bigValue?: string; // 47.8
  bigUnit?: string; // / 50 KM
  progress?: number; // 0..1
  ticks?: number[]; // 0..1 milestone positions
  stat?: string; // 2.2 KM TO GO
  ticket?: { value: string; label: string };
  quote?: string;
  footer: string; // tagline or call to action
  brandName?: string; // concept campaign
  brandColors?: { bg: string; fg: string; accent: string };
  person?: string;
}

const THEMES: Record<Exclude<CardTheme, 'brand'>, { bg: string; fg: string; accent: string; ball: string; track: string }> = {
  blue: { bg: '#2340FF', fg: '#FFFFFF', accent: '#FFD23F', ball: '#FFD23F', track: 'rgba(255,255,255,0.22)' },
  sun: { bg: '#FFD23F', fg: '#111216', accent: '#2340FF', ball: '#2340FF', track: 'rgba(17,18,22,0.14)' },
  ink: { bg: '#111216', fg: '#FFFFFF', accent: '#FFD23F', ball: '#2340FF', track: 'rgba(255,255,255,0.18)' },
};

export const ShareCard = forwardRef<HTMLDivElement, { content: CardContent; theme: CardTheme; hideMoney?: boolean }>(function ShareCard(
  { content, theme, hideMoney },
  ref,
) {
  const t =
    theme === 'brand' && content.brandColors
      ? { bg: content.brandColors.bg, fg: content.brandColors.fg, accent: content.brandColors.accent, ball: content.brandColors.accent, track: 'rgba(255,255,255,0.2)' }
      : THEMES[theme === 'brand' ? 'blue' : theme];
  const style = {
    ['--sc-bg' as string]: t.bg,
    ['--sc-fg' as string]: t.fg,
    ['--sc-accent' as string]: t.accent,
    ['--sc-ball' as string]: t.ball,
    ['--sc-track' as string]: t.track,
  } as CSSProperties;
  const hl = content.headline.length;
  const headSize = hl <= 9 ? 210 : hl <= 14 ? 176 : hl <= 20 ? 140 : 118;

  return (
    <div ref={ref} className="sc" style={style} aria-label={`${content.headline} ${content.kicker}`}>
      <span className="sc__ball" aria-hidden />
      <div className="sc__top">
        <span className="sc__mark">
          sogo<span className="sc__dot" />
        </span>
        {content.brandName && <span className="sc__brand">{content.brandName}</span>}
      </div>
      <div className="sc__body">
        {content.person && <span className="sc__person">{content.person}</span>}
        <h2 className="sc__headline" style={{ fontSize: headSize }}>
          {content.headline}
        </h2>
        <p className="sc__kicker">{content.kicker}</p>
        {content.bigValue && (
          <div className="sc__score">
            <span className="sc__big">{content.bigValue}</span>
            {content.bigUnit && <span className="sc__unit">{content.bigUnit}</span>}
          </div>
        )}
        {content.progress !== undefined && (
          <div className="sc__track">
            <span className="sc__fill" style={{ width: `${Math.min(1, content.progress) * 100}%` }} />
            {content.ticks?.map((x) => (
              <span key={x} className={`sc__tick ${x <= content.progress! ? 'is-on' : ''}`} style={{ left: `${x * 100}%` }} />
            ))}
          </div>
        )}
        {content.stat && <p className="sc__stat">{content.stat}</p>}
        {content.quote && <p className="sc__quote">“{content.quote}”</p>}
      </div>
      <div className="sc__bottom">
        {content.ticket && !hideMoney && <Ticket {...content.ticket} />}
        <p className="sc__footer">{content.footer}</p>
      </div>
    </div>
  );
});

function Ticket({ value, label }: { value: string; label: string }): ReactNode {
  return (
    <div className="sc__ticket">
      <span className="sc__ticket-value">{value}</span>
      <span className="sc__ticket-label">{label}</span>
    </div>
  );
}
