// The Kontra / Re step between the declaration and the first card (skat-rules §14).

import type { GameAction, Legal } from '../../engine';
import { useT } from '../i18n';

export interface DoublingPanelProps {
  readonly legal: Legal;
  readonly isMine: boolean;
  readonly waitingFor: string;
  readonly send: (action: GameAction) => void;
}

export function DoublingPanel({ legal, isMine, waitingFor, send }: DoublingPanelProps) {
  const t = useT();
  if (!isMine) {
    return <p>{t('status.waitingFor', { name: waitingFor })}</p>;
  }
  const kontra = legal.canKontra === true;
  return (
    <div className="doubling-actions">
      <p>{kontra ? t('doubling.askKontra') : t('doubling.askRe')}</p>
      {kontra ? (
        <button type="button" data-testid="kontra" onClick={() => { send({ type: 'kontra' }); }}>{t('doubling.kontra')}</button>
      ) : null}
      {legal.canRe === true ? (
        <button type="button" data-testid="re" onClick={() => { send({ type: 're' }); }}>{t('doubling.re')}</button>
      ) : null}
      {legal.canNoDouble === true ? (
        <button type="button" data-testid="no-double" onClick={() => { send({ type: 'no-double' }); }}>
          {kontra ? t('doubling.noKontra') : t('doubling.noRe')}
        </button>
      ) : null}
    </div>
  );
}
