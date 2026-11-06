import { Suspense, lazy } from 'react';

// Only development builds define the gallery; in production the import is removed entirely.
const DevGallery = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('./ui/dev/Gallery');
      return { default: module.Gallery };
    })
  : null;

export function App() {
  if (DevGallery !== null && window.location.hash === '#/dev/gallery') {
    return (
      <Suspense fallback={null}>
        <DevGallery />
      </Suspense>
    );
  }
  return (
    <main>
      <h1>WebSkat</h1>
      <p>The app shell is not built yet.</p>
    </main>
  );
}
