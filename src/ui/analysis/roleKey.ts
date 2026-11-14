// Translation key of a seat role (forehand, middlehand, hindhand). Exhaustive by type.

import { assertNever, type Role } from '../../engine';
import type { TranslationKey } from '../i18n/en';

export function roleKey(role: Role): TranslationKey {
  switch (role) {
    case 'forehand':
      return 'role.forehand';
    case 'middlehand':
      return 'role.middlehand';
    case 'hindhand':
      return 'role.hindhand';
    default:
      return assertNever(role);
  }
}
