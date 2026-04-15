interface SessionLocks {
  [sessionId: string]: number;
}

async function getLocks(): Promise<SessionLocks> {
  const data = await chrome.storage.session.get("session_locks");
  return (data.session_locks as SessionLocks) ?? {};
}

async function getOpenPanels(): Promise<number[]> {
  const data = await chrome.storage.session.get("open_panels");
  return (data.open_panels as number[]) ?? [];
}

export async function acquireLock(
  sessionId: string,
  windowId: number,
): Promise<{ success: boolean; ownerWindowId?: number }> {
  const locks = await getLocks();
  const openPanels = await getOpenPanels();

  const owner = locks[sessionId];
  const ownerPanelOpen = owner !== undefined && openPanels.includes(owner);

  if (owner === undefined || !ownerPanelOpen || owner === windowId) {
    locks[sessionId] = windowId;
    await chrome.storage.session.set({ session_locks: locks });
    return { success: true };
  }

  return { success: false, ownerWindowId: owner };
}

export async function releaseLock(sessionId: string): Promise<void> {
  const locks = await getLocks();
  delete locks[sessionId];
  await chrome.storage.session.set({ session_locks: locks });
}

export async function releaseLocksForWindow(windowId: number): Promise<void> {
  const locks = await getLocks();
  let changed = false;
  for (const [sessionId, owner] of Object.entries(locks)) {
    if (owner === windowId) {
      delete locks[sessionId];
      changed = true;
    }
  }
  if (changed) {
    await chrome.storage.session.set({ session_locks: locks });
  }
}
