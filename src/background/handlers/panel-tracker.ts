export async function addOpenPanel(windowId: number): Promise<void> {
  const data = await chrome.storage.session.get("open_panels");
  const panels: number[] = (data.open_panels as number[]) ?? [];
  if (!panels.includes(windowId)) {
    panels.push(windowId);
    await chrome.storage.session.set({ open_panels: panels });
  }
}

export async function removeOpenPanel(windowId: number): Promise<void> {
  const data = await chrome.storage.session.get("open_panels");
  const panels: number[] = (data.open_panels as number[]) ?? [];
  const filtered = panels.filter((id) => id !== windowId);
  await chrome.storage.session.set({ open_panels: filtered });
}
