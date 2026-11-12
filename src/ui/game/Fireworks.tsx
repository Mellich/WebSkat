// Small fireworks: a few CSS bursts behind the podium. Decorative only, off for reduced motion.

import styles from './Fireworks.module.css';

const BURSTS = [
  { left: '18%', top: '22%', delay: '0s', hue: 42 },
  { left: '78%', top: '18%', delay: '0.7s', hue: 12 },
  { left: '48%', top: '10%', delay: '1.4s', hue: 190 },
  { left: '30%', top: '40%', delay: '2.1s', hue: 120 },
  { left: '66%', top: '38%', delay: '2.8s', hue: 300 },
] as const;
const SPARKS = 12;

export function Fireworks() {
  return (
    <div className={styles.field} aria-hidden="true" data-testid="fireworks">
      {BURSTS.map((b) => (
        <span key={b.left} className={styles.burst} style={{ left: b.left, top: b.top, animationDelay: b.delay }}>
          {Array.from({ length: SPARKS }, (_, i) => (
            <i
              key={i}
              className={styles.spark}
              style={{
                transform: `rotate(${String((360 / SPARKS) * i)}deg)`,
                color: `hsl(${String(b.hue)} 95% 62%)`,
                animationDelay: b.delay,
              }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
