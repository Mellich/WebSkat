import { Suspense, lazy } from 'react';
import { Toasts } from './ui/components/Toast';
import { useRoute } from './ui/router';
import { Home } from './ui/screens/Home';
import { TableScreen } from './ui/screens/TableScreen';

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
        return <TableScreen tableKey={route.key} />;
      case 'dev-gallery':
        return DevGallery === null ? <Home /> : <DevGallery />;
      case 'dev-local':
        return DevLocal === null ? <Home /> : <DevLocal seed={route.seed} players={route.players} />;
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
      <Toasts />
    </>
  );
}

