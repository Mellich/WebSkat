// One line about the analyzed game: who played what (docs/plans/analysis/07). Pure.

import type { AnalysisInput } from '../../table';
import { declarationLabel } from '../game/labels';
import type { Translator } from '../i18n';

export function summaryText(input: AnalysisInput, t: Translator): string {
  const { declarer, declaration, bid } = input;
  if (input.kind === 'played' && declarer !== null && declaration !== null && bid !== null) {
    return t('analysis.summary', {
      name: input.names[declarer],
      game: declarationLabel(declaration, t),
      bid,
    });
  }
  return input.kind === 'ramsch' ? t('analysis.ramsch') : t('analysis.passedIn');
}
