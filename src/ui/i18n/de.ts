// German strings (docs/ui.md §9). Typed against the English dictionary, split into parts/.

import { deApp } from './parts/deApp';
import { deGame } from './parts/deGame';
import { dePanels } from './parts/dePanels';
import type { Dict } from './en';

export const de: Dict = { ...deApp, ...deGame, ...dePanels };
