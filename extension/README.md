# Central Command — Chrome New Tab Extension

This Chrome extension replaces your new tab page with Central Command, giving you instant access to your tool deck every time you open a new tab.

## Loading as an Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `extension/` directory from your Central Command project
5. Open a new tab — you should see your Central Command tools

## How It Works

- The extension overrides Chrome's new tab page using `chrome_url_overrides`
- It first tries to load tools from `chrome.storage.local` (key: `central-command.tools.v2`)
- If no local tools are found, it falls back to loading the deployed embed view via an iframe

## Syncing Tools

Tools are stored in `localStorage` in the main app. To sync them to the extension's `chrome.storage.local`, you can:

1. Open the main Central Command app
2. Use the browser console to copy tools to chrome.storage:
   ```js
   const tools = localStorage.getItem('central-command.tools.v2');
   chrome.storage.local.set({ 'central-command.tools.v2': tools });
   ```

Or modify the `DEPLOYED_URL` constant in `newtab.js` to point to your deployed Central Command instance, and the iframe fallback will load your tools automatically.

## Configuration

Edit `newtab.js` and update the `DEPLOYED_URL` constant to match your deployment URL:

```js
const DEPLOYED_URL = "https://your-domain.com";
```

## Manifest

This extension uses **Manifest V3** and requests only the `storage` permission.
