// One value per seat role (forehand, middlehand, hindhand), built without casts.

import type { Role } from '../../engine';

export function byRole<T>(value: (role: Role) => T): Record<Role, T> {
  return { forehand: value('forehand'), middlehand: value('middlehand'), hindhand: value('hindhand') };
}
