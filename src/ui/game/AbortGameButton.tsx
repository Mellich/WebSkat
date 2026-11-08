// Host-only button that aborts the running game (the next game is dealt). Confirms first.

import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../i18n';

export interface AbortGameButtonProps {
  readonly onAbort: () => void;
}

export function AbortGameButton({ onAbort }: AbortGameButtonProps) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="abort-game"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t('game.abort')}
      </button>
      {confirming ? (
        <ConfirmDialog
          message={t('game.abortConfirm')}
          onConfirm={() => {
            setConfirming(false);
            onAbort();
          }}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      ) : null}
    </>
  );
}
