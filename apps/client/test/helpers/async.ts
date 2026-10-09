/** Drain four microtask hops so animation and playback promise chains can settle. */
export async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
