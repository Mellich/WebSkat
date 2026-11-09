// English strings. Keys are flat; `{name}` placeholders are filled by t(). The German dictionary
// is typed against this one, so a missing key is a compile error. The keys live in parts/.

import { enApp } from './parts/enApp';
import { enGame } from './parts/enGame';
import { enLog } from './parts/enLog';
import { enPanels } from './parts/enPanels';

export const en = { ...enApp, ...enGame, ...enPanels, ...enLog } as const;

export type TranslationKey = keyof typeof en;
export type Dict = Record<TranslationKey, string>;
