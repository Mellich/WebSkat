// The analysis sampling worker: runs createRunner on messages from the analysis screen.
import { createRunner } from './runner';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

const runner = createRunner({
  post: (response: WorkerResponse) => { self.postMessage(response); },
  schedule: (step) => { setTimeout(step, 0); },
  seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
});

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => { runner.handle(event.data); });
