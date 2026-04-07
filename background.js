// background.js

// ── Register context menu ───────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-forage',
    title: 'Save to Forage',
    contexts: ['image']
  });
});

// ── Handle right-click save ─────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'save-to-forage') return;

  // Store the URLs so the popup can read them
  chrome.storage.local.set({
    pendingImageUrl: info.srcUrl,
    pendingPageUrl: tab.url
  }, () => {
    // Open the popup programmatically
    chrome.action.openPopup();
  });
});