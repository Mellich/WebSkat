import { Suspense, lazy } from 'react';
import { Toasts } from './ui/components/Toast';
import { VersionBadge } from './ui/components/VersionBadge';
import { useRoute } from './ui/router';
import { Home } from './ui/screens/Home';
import { TableScreen } from './ui/screens/TableScreen';

// The changelog screen bundles CHANGELOG.md; it is loaded only when its route opens.
const ChangelogScreen = lazy(async () => {
  const module = await import('./ui/screens/ChangelogScreen');
  return { default: module.ChangelogScreen };
});

// Development-only screens. The conditions are constants in production builds, so the lazy
// imports are removed from the bundle.
const DevGallery = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('./ui/dev/Gallery');
      return { default: module.Gallery };
    })
  : null;

const DevLocal = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('./ui/dev/DevLocal');
      return { default: module.DevLocal };
    })
  : null;

export function App() {
  const route = useRoute();
  const screen = (() => {
    switch (route.kind) {
      case 'table':
        return <TableScreen tableKey={route.key} invite={route.invite} />;
      case 'dev-gallery':
        return DevGallery === null ? <Home /> : <DevGallery />;
      case 'dev-local':
        return DevLocal === null ? <Home /> : <DevLocal seed={route.seed} players={route.players} bots={route.bots} />;
      case 'changelog':
        return <ChangelogScreen />;
      case 'home':
        return <Home />;
      default: {
        const unused: never = route;
        return unused;
      }
    }
  })();
  return (
    <>
      <Suspense fallback={null}>{screen}</Suspense>
      {route.kind === 'changelog' ? null : <VersionBadge />}
      <Toasts />
    </>
  );
}

