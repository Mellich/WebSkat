// The starting cards of every player, the Skat and (after a pickup) the discarded cards.

import { ROLES, sortHand } from '../../engine';
import type { AnalysisInput } from '../../table';
import { CardChips } from '../components/CardChip';
import { useT } from '../i18n';
import { roleKey } from './roleKey';
import styles from './DealOverview.module.css';

export function DealOverview({ input }: { readonly input: AnalysisInput }) {
  const t = useT();
  return (
    <section className={styles.deal} data-testid="analysis-deal">
      <h2>{t('analysis.deal')}</h2>
      <ul className={styles.rows}>
        {ROLES.map((role) => (
          <li key={role} className={styles.row}>
            <span className={styles.role}>{t(roleKey(role))}</span>
            <span className={styles.name}>
              {input.names[role]}
              {input.declarer === role ? <span className={styles.mark} title={t('analysis.declarer')}> *</span> : null}
            </span>
            <CardChips cards={sortHand(input.hands[role], input.declaration)} />
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <span className={styles.role}>{t('analysis.skat')}</span>
        <CardChips cards={input.skat} />
      </div>
      {input.pickedUpSkat ? (
        <div className={styles.row}>
          <span className={styles.role}>{t('analysis.discarded')}</span>
          <CardChips cards={input.discarded} />
        </div>
      ) : null}
    </section>
  );
}
