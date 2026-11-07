import type { CardId } from '../../engine';
import { cardShort, cardName } from '../game/labels';
import { useT } from '../i18n';
import { cls } from '../classNames';
import styles from './CardChip.module.css';

export function CardChip({ card }: { readonly card: CardId }) {
  const t = useT();
  const short = cardShort(card, t);
  return <span role="img" aria-label={cardName(card, t)} title={cardName(card, t)} className={cls(styles.chip, short.red ? styles.red : styles.black)}>
    {short.suit}{short.rank}
  </span>;
}

export function CardChips({ cards }: { readonly cards: readonly CardId[] }) {
  return <span className={styles.chips}>{cards.map((card) => <CardChip key={card} card={card} />)}</span>;
}
