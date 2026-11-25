// Run against a local Odak server and a dedicated Chrome debugging profile.
import assert from 'node:assert/strict';

const origin = process.env.ODAK_URL || 'http://127.0.0.1:8765/';
const debug = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9237';

async function browserTab() {
  const response = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' });
  assert(response.ok, 'Could not create a Chrome tab');
  const { id, webSocketDebuggerUrl } = await response.json();
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const commands = new Map();
  const events = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const { resolve, reject } = commands.get(message.id);
      commands.delete(message.id);
      if (message.error) reject(Error(message.error.message));
      else resolve(message.result);
    } else if (events.has(message.method)) {
      events.get(message.method)(message.params);
      events.delete(message.method);
    }
  };

  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      commands.set(++sequence, { resolve, reject });
      socket.send(JSON.stringify({ id: sequence, method, params }));
    });
  }

  async function evaluate(expression) {
    const { result, exceptionDetails } = await call('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true
    });
    if (exceptionDetails) throw Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }

  async function navigate() {
    const loaded = new Promise(resolve => events.set('Page.loadEventFired', resolve));
    const result = await call('Page.navigate', { url: origin });
    assert(!result.errorText, result.errorText);
    await loaded;
  }

  await call('Page.enable');
  await call('Network.enable');
  return { call, evaluate, navigate, close: async () => {
    socket.close();
    await fetch(`${debug}/json/close/${id}`);
  } };
}

const main = await browserTab();
try {
  const { evaluate: run, call, navigate } = main;
  await navigate();
  assert.equal(await run(`document.querySelector('.status-link').textContent`), 'v3.1');
  await run(`closeInfoPopup(); if (activeDialog) closeDialog(activeDialog); createNewDocument()`);

  const first = await run(`currentDocumentId`);
  await call('Input.insertText', { text: 'Fresh last edit' });
  await run(`createNewDocument()`);
  assert.match(await run(`documents[${JSON.stringify(first)}].content`), /Fresh last edit/);

  await call('Input.insertText', { text: 'Expected export' });
  assert.equal(await run(`(async () => {
    const save = downloadFile;
    let file;
    downloadFile = (body, filename) => { file = { body, filename }; };
    try { downloadCurrentDocument(); return file.body; }
    finally { downloadFile = save; }
  })()`), 'Expected export');

  await run(`saveDocumentTitle(currentDocumentId, 'Manual name')`);
  await call('Input.insertText', { text: ' with more text' });
  await run(`flushDraft()`);
  assert.equal(await run(`documents[currentDocumentId].title`), 'Manual name');

  await run(`createNewDocument()`);
  await call('Input.insertText', { text: 'alpha beta' });
  await run(`(() => {
    flushDraft();
    const text = editor.querySelector('div').firstChild;
    getSelection().setBaseAndExtent(text, 0, text, 5);
  })()`);
  await call('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r'
  });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await run(`flushDraft()`);
  assert.equal(await run(`documents[currentDocumentId].content.includes('alpha')`), false);
  assert.match(await run(`documents[currentDocumentId].content`), /beta/);

  await run(`createNewDocument()`);
  await call('Input.insertText', { text: 'start ' });
  await call('Input.insertText', { text: '**bold**' });
  assert.equal(await run(`editor.querySelector('strong')?.textContent`), 'bold');

  const roundTrip = input => run(`convertToMarkdown(convertMarkdownToHtml(${JSON.stringify(input)}))`);
  assert.match(await roundTrip('- First\n## Middle\n- Last'), /First[\s\S]+Middle[\s\S]+Last/);
  assert.equal(await roundTrip('first\n\nsecond'), 'first\n\nsecond');
  assert.equal(await roundTrip('4. item\n5. item'), '4. item\n5. item');
  assert.equal(await roundTrip('> line 1\n> line 2'), '> line 1\n> line 2');
  assert.equal(await roundTrip('[link](https://example.org/?a=1&b=2)'), '[link](https://example.org/?a=1&b=2)');
  assert.equal(await roundTrip('```js\n- literal\n```'), '```js\n- literal\n```');

  await run(`document.querySelector('#list-btn').focus(); document.querySelector('#list-btn').click()`);
  assert.equal(await run(`document.activeElement.id`), 'documents-search');
  assert.equal(await run(`editor.inert`), true);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await run(`document.activeElement.id`), 'list-btn');

  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 1, mobile: true });
  await run(`loadDocument(EXAMPLE_DOCUMENT_ID); toggleToolbarAndStatusbar('show')`);
  assert.equal(await run(`(() => {
    const toolbar = document.querySelector('#toolbar');
    const image = editor.querySelector('.imglib-wrapper').getBoundingClientRect();
    return toolbar.scrollWidth <= toolbar.clientWidth && image.left >= 0 && image.right <= innerWidth;
  })()`), true);
  await call('Emulation.clearDeviceMetricsOverride');

  const backup = await run(`(async () => {
    const save = downloadFile;
    let file;
    downloadFile = (body, filename) => { file = { body, filename }; };
    try { downloadAllDocuments(); return file.body; }
    finally { downloadFile = save; }
  })()`);
  const count = JSON.parse(backup).writings.length;
  await run(`restoreBackup({ target: { files: [new File([${JSON.stringify(backup)}], 'backup.json')] } })`);
  assert.equal(await run(`Object.keys(documents).length`), count * 2);

  await run(`handleFileUpload({ target: { files: [new File(['<b>literal</b>'], 'plain.TXT')] } })`);
  assert.equal(await run(`(async () => {
    for (let n = 0; n < 30 && documents[currentDocumentId].title !== 'plain'; n++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return editor.innerText;
  })()`), '<b>literal</b>');
  assert.equal(await run(`editor.querySelector('b') === null`), true);

  const withImage = await run(`(() => {
    const id = newDocumentId();
    documents[id] = { id, title: 'Image writing', content: documents[EXAMPLE_DOCUMENT_ID].content,
      created: new Date().toISOString(), updated: new Date().toISOString() };
    loadDocument(id);
    editor.dispatchEvent(new Event('odak-change'));
    flushDraft();
    loadDocument(id);
    editor.querySelector('.imglib-delete').click();
    flushDraft();
    return documents[id].content;
  })()`);
  assert.doesNotMatch(withImage, /<img/);

  // Edits made by separate tabs should both reach browser storage.
  const second = await browserTab();
  try {
    await second.navigate();
    await second.evaluate(`closeInfoPopup(); createNewDocument()`);
    const secondId = await second.evaluate(`currentDocumentId`);
    await second.call('Input.insertText', { text: 'from second tab' });
    await second.evaluate('flushDraft()');
    await run(`createNewDocument()`);
    await call('Input.insertText', { text: 'from first tab' });
    await run('flushDraft()');
    assert.match(await run(`readLibrary()[${JSON.stringify(secondId)}].content`), /from second tab/);
    const firstId = JSON.stringify(await run(`currentDocumentId`));
    await second.evaluate(`saveDocumentsToStorage(); loadDocument(${firstId}); editor.focus()`);
    await second.call('Input.insertText', { text: 'another version ' });
    await second.evaluate('flushDraft()');
    await run('editor.focus()');
    await call('Input.insertText', { text: 'my version ' });
    await run('flushDraft()');
    assert(await run(`Object.values(readLibrary()).some(doc => doc.title.endsWith(' (other tab)') &&
      doc.content.includes('another version'))`));
  } finally {
    await second.close();
  }

  assert.equal(await run(`(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('test', 'QuotaExceededError'); };
    try { saveCurrentDocument(); return document.querySelector('#save-status').textContent; }
    finally { Storage.prototype.setItem = setItem; }
  })()`), 'Not saved · download a copy');

  await run(`(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  })()`);
  await evaluateOffline();
  console.log('Passed: drafts, export, titles, editing, Markdown, dialogs, mobile layout, backups, two tabs, quota errors, offline cache');

  async function evaluateOffline() {
    await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await navigate();
    assert.equal(await run(`document.querySelector('.status-link').textContent`), 'v3.1');
    assert.equal(await run(`Boolean(navigator.serviceWorker.controller)`), true);
    assert.equal(await run(`(async () => (await fetch('./assets/webfonts/fa-solid-900.woff2?v=3.0-20260626-V')).ok)()`), true);
    assert.match(await run(`editor.innerText`), /from first tab/);
  }
} finally {
  await main.close();
}
