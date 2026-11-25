/*
 * Odak.app is a clean, minimalist, and privacy-respecting writing app with live Markdown rendering—built to keep you in the flow. No accounts, no ads, no cloud, and no distractions. Everything is stored locally on your device.
 * v=3.1
 * Author: Araz Gray @arazgray
 * Email: contact@arazgray.com
 */

let currentDocumentId = null;
let isTyping = false;
let typingTimer = null;
let autosaveTimer = null;
let lastAudibleVolume = 0.5;
let activeDialog = null;
let dialogTrigger = null;
let soundEnabled = false;
let soundVolume = 0;
let currentTheme = 'light'; // Default theme
let documents = Object.create(null);
let storedDocuments = Object.create(null);
let draftDirty = false;
let libraryLocked = false;
let customBackground = null; 
let documentSearchQuery = '';
let documentSortMode = 'updated-desc';
const ASSET_VERSION = '3.1';

let fontFamily = 'Vazir'; 
let fontSize = 120; 
let editorWidth = 830; 
let systemFonts = []; 
let useCustomBg = false; 

const EXAMPLE_DOCUMENT_ID = 'odak_example_markdown_v3';
const EXAMPLE_MARKDOWN = `# Odak Markdown Example

This document shows the Markdown syntax currently supported by Odak 3.1.

## Text Formatting

Write **bold text**, *italic text*, __underlined text__, and \`inline code\`.

### Links

Visit [Odak.app](https://odak.app) or [email the author](mailto:contact@odak.app).

### Image

![Odak logo](./assets/images/odak.svg?v=3.1)
<!-- odak:image {"x":707,"y":279,"width":86,"height":86} -->
## Lists

- Focused writing
- Local-first storage
- Offline support
- RTL and LTR text

1. Open Odak
2. Start writing
3. Save locally
4. Export as Markdown

## Checkboxes

- [x] Try the editor
- [x] Import a Markdown file
- [ ] Write something worth keeping

## Quote

> Your thoughts deserve a focused space. Odak is it.

## Horizontal Rule

---

## Headings

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

## Multilingual

English text works naturally.

متن فارسی هم با جهت راست به چپ پشتیبانی می‌شود.`;

function versionedAsset(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${ASSET_VERSION}`;
}

// Add function to handle typing state
function handleTypingState() {
  isTyping = true;
  toggleToolbarAndStatusbar('hide');
  
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    toggleToolbarAndStatusbar('show');
  }, 2000); // Show UI elements after 2 seconds of no typing
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  const id = currentDocumentId;
  autosaveTimer = setTimeout(() => {
    if (id === currentDocumentId) flushDraft();
  }, 700);
}

function flushDraft() {
  clearTimeout(autosaveTimer);
  return !draftDirty || saveCurrentDocumentContent();
}

MarkdownEditor.init('editor', {
  placeholder: 'What’s on your mind?',
  autofocus: true
});

const editor = document.getElementById('editor');
const toolbar = document.getElementById('toolbar');
const statusBar = document.getElementById('status-bar');
const settingsPopup = document.getElementById('settings-popup');
const counter = document.getElementById('counter');
const listPopup = document.getElementById('list-popup');
const documentsListElement = document.getElementById('documents-list');
const fileInput = document.getElementById('file-input');

// Add input event listener for typing
function markDraftChanged(event) {
  if (event?.target.matches('input[type="checkbox"]')) syncCheckboxAttribute(event);
  draftDirty = true;
  labelCheckboxes();
  updateCounter();
  scheduleAutosave();
}

editor.addEventListener('input', event => {
  if (event.isComposing) return;
  if (event.target === editor) handleTypingState();
  markDraftChanged(event);
});
editor.addEventListener('odak-change', markDraftChanged);
editor.addEventListener('compositionend', markDraftChanged);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushDraft();
});
window.addEventListener('pagehide', flushDraft);

// Add mouse movement event listener to show UI elements
document.addEventListener('mousemove', () => {
  toggleToolbarAndStatusbar('show');
  
  // Reset the typing timer to keep UI visible
  if (isTyping) {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
    }, 2000);
  }
});

editor.addEventListener('keydown', handleKeyDown);

const soundFiles = {
  key: [
    './assets/sounds/type-machine/key-new-01.mp3',
    './assets/sounds/type-machine/key-new-02.mp3',
    './assets/sounds/type-machine/key-new-03.mp3',
    './assets/sounds/type-machine/key-new-04.mp3',
    './assets/sounds/type-machine/key-new-05.mp3'
  ],
  space: './assets/sounds/type-machine/space-new.mp3',
  backspace: './assets/sounds/type-machine/backspace.mp3',
  return: './assets/sounds/type-machine/return-new.mp3',
  scrollUp: './assets/sounds/type-machine/scrollUp.mp3',
  scrollDown: './assets/sounds/type-machine/scrollDown.mp3'
};
let audioContext = null;
let soundBuffers = {};
let soundsLoading = null;
let soundsUnavailable = false;
let mediaSounds = {};
let mediaSoundsReady = false;

function init() {
  // Register service worker for offline functionality
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(versionedAsset('./sw.js'))
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  }
  
  loadDocumentsFromStorage();  
  if (!libraryLocked) ensureExampleDocument();
  loadPreferences();  
  if (currentDocumentId && documents[currentDocumentId]) {
    loadDocument(currentDocumentId);
  } else {
    const latest = Object.values(documents).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))[0];
    if (latest) loadDocument(latest.id);
    else generateNewDocument();
  }  
  updateCounter();  
  applyTheme();  
  applyBackground();
  updateBackgroundSelection();  
  initBootstrapTooltips();
  updateFullscreenButtonVisibility();
  toggleToolbarAndStatusbar('show');
  
  // Check if this is the first visit
  const hasSeenInfo = getPreference('odak_has_seen_info');
  if (!hasSeenInfo) {
    showInfoPopup();
  }
}

function loadDocumentsFromStorage() {
  try {
    storedDocuments = readLibrary();
    documents = Object.assign(Object.create(null), structuredClone(storedDocuments));
    const lastDocumentId = getPreference('odak_current_document');
    currentDocumentId = documents[lastDocumentId] ? lastDocumentId : null;
  } catch (error) {
    libraryLocked = true;
    console.error('Unable to read Odak library:', error);
    showSaveStatus('Library unavailable', true);
  }
}

function readLibrary() {
  const raw = localStorage.getItem('odak_documents');
  if (raw === null) return Object.create(null);
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid library');
  for (const [id, doc] of Object.entries(value)) {
    if (!doc || doc.id !== id || typeof doc.content !== 'string' || typeof doc.title !== 'string') {
      throw Error('Invalid writing');
    }
  }
  return Object.assign(Object.create(null), value);
}

function getPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function setPreference(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

function ensureExampleDocument(force = false) {
  if (documents[EXAMPLE_DOCUMENT_ID]) {
    setPreference('odak_example_seeded', 'true');
    return;
  }
  if (!force && getPreference('odak_example_seeded') === 'true') return;

  const hadDocuments = Object.keys(documents).length > 0;
  const now = new Date().toISOString();
  documents[EXAMPLE_DOCUMENT_ID] = {
    id: EXAMPLE_DOCUMENT_ID,
    title: 'Odak Markdown Example',
    customTitle: true,
    content: convertMarkdownToHtml(EXAMPLE_MARKDOWN),
    created: now,
    updated: now
  };

  if (!force && (!hadDocuments || !currentDocumentId)) {
    currentDocumentId = EXAMPLE_DOCUMENT_ID;
  }

  if (saveDocumentsToStorage()) setPreference('odak_example_seeded', 'true');
}

function loadPreferences() {
  const lastVolume = Number(getPreference('odak_last_audible_volume'));
  if (lastVolume > 0 && lastVolume <= 1) lastAudibleVolume = lastVolume;
  const savedSoundVolume = getPreference('odak_sound_volume');
  if (savedSoundVolume !== null && Number.isFinite(Number(savedSoundVolume))) {
    soundVolume = Math.max(0, Math.min(1, Number(savedSoundVolume)));
    if (soundVolume > 0) lastAudibleVolume = soundVolume;
    document.getElementById('volume-slider').value = soundVolume * 100;
    document.getElementById('volume-value').textContent = Math.round(soundVolume * 100) + '%';
    soundEnabled = soundVolume > 0;
    updateSoundButton();
  } else {
    
    soundVolume = 0;
    document.getElementById('volume-slider').value = 0;
    document.getElementById('volume-value').textContent = '0%';
    updateSoundButton();
  }  
  const savedTheme = getPreference('odak_theme');
  if (savedTheme && ['light', 'dark', 'odak'].includes(savedTheme)) {
    currentTheme = savedTheme;
  } else {
    // Migrate from old theme system if needed
    const oldThemePref = getPreference('odak_dark_mode');
    if (oldThemePref !== null) {
      currentTheme = oldThemePref === 'true' ? 'dark' : 'light';
      setPreference('odak_theme', currentTheme);
    }
  }
  applyTheme();  
  const savedFontFamily = getPreference('odak_font_family');
  if (savedFontFamily !== null) {
    fontFamily = savedFontFamily;
  }  
  const savedFontSize = getPreference('odak_font_size');
  if (savedFontSize !== null) {
    fontSize = clampSetting(savedFontSize, 50, 200, 120);
  }
  document.getElementById('font-size-slider').value = fontSize;
  updateFontSizeLabel();  
  const savedEditorWidth = getPreference('odak_editor_width');
  if (savedEditorWidth !== null) {
    editorWidth = clampSetting(savedEditorWidth, 400, 1600, 830);
    document.getElementById('editor-width-input').value = editorWidth;
  }  
  try {
    const savedCustomBackground = getPreference('odak_custom_background');
    const savedUseCustomBg = getPreference('odak_use_custom_bg');
    
    if (savedCustomBackground && savedCustomBackground !== 'null') {
      customBackground = savedCustomBackground;
      
      
      const customBgElement = document.getElementById('custom-bg');
      customBgElement.style.backgroundImage = `url(${customBackground})`;
      customBgElement.classList.remove('hidden');
    }
    
    
    useCustomBg = savedUseCustomBg === 'true';
  } catch (error) {
    console.error('Error loading background settings:', error);
    useCustomBg = false;
    
    setPreference('odak_use_custom_bg', 'false');
  }  
  applySettings();
  editor.spellcheck = getPreference('odak_spellcheck') === 'true';
  document.getElementById('spellcheck-setting').checked = editor.spellcheck;
}

function clampSetting(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}


function handleKeyDown(e) {
  if (!soundEnabled || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Backspace') {
    playSound('backspace');
  } else if (e.key === 'Enter') {
    playSound('return');
  } else if (e.key === ' ') {
    playSound('space');
  } else if (e.key.length === 1) {
    playSound('key');
  }
}

function playSound(type) {
  if (!soundEnabled) return;

  if (shouldUseMediaSounds()) {
    playMediaSound(type);
    return;
  }

  playBufferedSound(type);
}

async function playBufferedSound(type) {
  await ensureSoundsReady();
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume().catch(() => {});
  }
  if (!audioContext || audioContext.state !== 'running') return;

  const buffers = soundBuffers[type];
  const soundBuffer = Array.isArray(buffers)
    ? buffers[Math.floor(Math.random() * buffers.length)]
    : buffers;
  if (!soundBuffer) return;

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  gain.gain.value = soundVolume / 3;
  source.buffer = soundBuffer;
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start(0);
}

function shouldUseMediaSounds() {
  return !isIOSDevice();
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function ensureMediaSoundsReady() {
  if (mediaSoundsReady) return;

  Object.entries(soundFiles).forEach(([type, files]) => {
    const sources = Array.isArray(files) ? files : [files];
    mediaSounds[type] = sources.map(path => {
      const audio = document.createElement('audio');
      audio.src = versionedAsset(path);
      audio.preload = 'auto';
      audio.volume = soundVolume / 3;
      audio.load();
      return audio;
    });
  });

  mediaSoundsReady = true;
}

function playMediaSound(type) {
  ensureMediaSoundsReady();

  const sounds = mediaSounds[type];
  if (!sounds || sounds.length === 0) return;

  const sound = sounds[Math.floor(Math.random() * sounds.length)];
  sound.volume = soundVolume / 3;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function ensureSoundsReady() {
  if (soundsUnavailable) return Promise.resolve();

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      soundsUnavailable = true;
      return Promise.resolve();
    }
    audioContext = new AudioContextClass();
  }

  const resumeAudio = audioContext.state === 'suspended'
    ? audioContext.resume().catch(() => {})
    : Promise.resolve();

  if (!soundsLoading) {
    soundsLoading = loadSoundBuffers().catch(error => {
      soundsLoading = null;
      console.error('Could not load typing sounds:', error);
    });
  }

  return Promise.all([resumeAudio, soundsLoading]);
}

function loadSoundBuffers() {
  const decodeSound = async (path) => {
    const response = await fetch(versionedAsset(path), { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Could not fetch sound: ${path}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return decodeAudioData(arrayBuffer);
  };

  const tasks = Object.entries(soundFiles).map(async ([type, files]) => {
    soundBuffers[type] = Array.isArray(files)
      ? await Promise.all(files.map(decodeSound))
      : await decodeSound(files);
  });

  return Promise.all(tasks);
}

function decodeAudioData(arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const decoded = audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      if (decoded && typeof decoded.then === 'function') {
        decoded.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function updateFullscreenButtonVisibility() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  document.body.classList.toggle('standalone-mode', isStandaloneDisplay());
  if (!fullscreenBtn) return;
  const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenBtn.classList.toggle('hidden', isStandaloneDisplay() ||
    !(document.fullscreenEnabled || document.webkitFullscreenEnabled));
  fullscreenBtn.setAttribute('aria-pressed', String(active));
  fullscreenBtn.innerHTML = `<i class="fas fa-${active ? 'compress' : 'expand'}"></i>`;
}


async function toggleFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      const root = document.documentElement;
      await (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
    }
  } catch {
    showSaveStatus('Fullscreen unavailable');
  }
  updateFullscreenButtonVisibility();
}

function setTheme(theme) {
  if (['light', 'dark', 'odak'].includes(theme)) {
    currentTheme = theme;
    setPreference('odak_theme', theme);
    applyTheme();
    updateActiveThemeButton();
  }
}

function updateActiveThemeButton() {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    if (btn.dataset.theme === currentTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === currentTheme));
  });
}

function applyTheme() {
  // Set the theme attribute on body
  document.body.setAttribute('data-theme', currentTheme);
  
  // Update theme stylesheet
  const themeLink = document.querySelector('link[href^="./assets/styles/theme-"]');
  if (themeLink) {
    themeLink.href = versionedAsset(`./assets/styles/theme-${currentTheme}.css`);
  }
  
  // Update UI elements
  updateActiveThemeButton();
}

function toggleSettings() {
  const fontSelect = document.getElementById('font-family-select');
  if (fontSelect && fontSelect.options.length === 0) {
    loadSystemFonts();
  }
  
  // Update the active state of theme buttons
  updateActiveThemeButton();
  
  // Update background selection
  updateBackgroundSelection();  
  
  // Toggle settings popup visibility
  toggleDialog(settingsPopup);
}

function loadSystemFonts() {
  const fontSelect = document.getElementById('font-family-select');  
  fontSelect.innerHTML = '';  
  const appFontOption = document.createElement('option');
  appFontOption.value = 'Vazir';
  appFontOption.textContent = 'Vazir (Default)';
  appFontOption.style.fontFamily = 'Vazir';  
  if (fontFamily === 'Vazir') {
    appFontOption.selected = true;
  }
  
  fontSelect.appendChild(appFontOption);  
  const separator = document.createElement('option');
  separator.disabled = true;
  separator.style.borderBottom = '1px solid #ccc';
  separator.textContent = '──────────────';
  fontSelect.appendChild(separator);  
  const defaultFonts = [
    'Arial', 'Brush Script MT', 'Courier New', 'cursive', 'fantasy', 'Garamond', 
    'Georgia', 'Helvetica', 'monospace', 'sans-serif', 'serif', 'system-ui',
    'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
  ];  
  defaultFonts.forEach(font => {
    const option = document.createElement('option');
    option.value = font;
    option.textContent = font;
    option.style.fontFamily = font;
    
    
    if (font === fontFamily) {
      option.selected = true;
    }
    
    fontSelect.appendChild(option);
  });  
  if (window.queryLocalFonts) {
    window.queryLocalFonts().then(fonts => {
      
      const uniqueFonts = new Set();
      
      fonts.forEach(font => {
        
        if (font.fullName.toLowerCase().includes('regular') || 
            font.fullName.toLowerCase().includes('normal')) {
          uniqueFonts.add(font.family);
        }
      });
      
      
      Array.from(uniqueFonts)
        .sort((a, b) => a.localeCompare(b))
        .forEach(font => {
          
          if (!defaultFonts.includes(font) && font !== 'Vazir') {
            const option = document.createElement('option');
            option.value = font;
            option.textContent = font;
            option.style.fontFamily = font;
            
            
            if (font === fontFamily) {
              option.selected = true;
            }
            
            fontSelect.appendChild(option);
          }
        });
    }).catch(err => {
      console.error('Error loading system fonts:', err);
    });
  }
}

function applySettings() {
  // Set base font family
  document.documentElement.style.setProperty('--editor-font-family', fontFamily);
  editor.style.fontFamily = `var(--editor-font-family), serif, 'Vazir'`;
  
  // Set base font size
  document.documentElement.style.setProperty('--base-font-size', fontSize + '%');
  editor.style.fontSize = 'var(--base-font-size)';
  
  // Calculate relative sizes
  const baseSize = fontSize / 100;
  document.documentElement.style.setProperty('--h1-font-size', `calc(1.802rem * ${baseSize})`);
  document.documentElement.style.setProperty('--h2-font-size', `calc(1.602rem * ${baseSize})`);
  document.documentElement.style.setProperty('--h3-font-size', `calc(1.266rem * ${baseSize})`);
  document.documentElement.style.setProperty('--div-font-size', `calc(1rem * ${baseSize})`);
  
  // Set editor width
  editor.style.maxWidth = editorWidth + 'px';
  
  // Apply background and theme
  applyBackground();
  updateBackgroundSelection();
}

function applyBackground() {
  if (useCustomBg && customBackground) {
    
    editor.style.backgroundImage = `url(${customBackground})`;
    editor.style.backgroundRepeat = 'no-repeat';
    editor.style.backgroundSize = 'cover';
    editor.style.backgroundPosition = 'center center';
  } else {
    
    editor.style.backgroundImage = '';
    editor.style.backgroundRepeat = '';
    editor.style.backgroundSize = '';
    editor.style.backgroundPosition = '';
    
    // Apply the current theme
    document.body.setAttribute('data-theme', currentTheme);
  }
}

function updateBackgroundSelection() {
  const defaultBg = document.getElementById('default-bg');
  const customBg = document.getElementById('custom-bg');
  
  if (!defaultBg || !customBg) return;  
  defaultBg.classList.remove('selected');
  customBg.classList.remove('selected');  
  if (useCustomBg && customBackground) {
    customBg.classList.add('selected');
  } else {
    defaultBg.classList.add('selected');
    
    useCustomBg = false;
  }  
  if (customBackground) {
    customBg.classList.remove('hidden');
    customBg.style.backgroundImage = `url(${customBackground})`;
    customBg.style.backgroundSize = 'cover';
    customBg.style.backgroundPosition = 'center center';
  } else {
    customBg.classList.add('hidden');
  }
  defaultBg.setAttribute('aria-pressed', String(!useCustomBg));
  customBg.setAttribute('aria-pressed', String(useCustomBg));
}

function handleBackgroundUpload(e) {
  const file = e.target.files[0];
  if (!file) return;  
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }  
  const reader = new FileReader();
  reader.onload = function(event) {
    
    const img = new Image();
    img.onload = function() {
      
      const canvas = document.createElement('canvas');
      
      
      const maxSize = 800;
      let width = img.width;
      let height = img.height;
      
      
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      
      
      canvas.width = width;
      canvas.height = height;
      
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      
      
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
      
      try {
        
        localStorage.setItem('odak_custom_background', compressedDataUrl);
        
        
        customBackground = compressedDataUrl;
        
        
        const customBgElement = document.getElementById('custom-bg');
        customBgElement.style.backgroundImage = `url(${customBackground})`;
        customBgElement.classList.remove('hidden');
        
        
        useCustomBg = true;
        localStorage.setItem('odak_use_custom_bg', 'true');
        
        
        updateBackgroundSelection();
        applyBackground();
      } catch (error) {
        
        if (error.name === 'QuotaExceededError') {
          alert('The image is too large to save. Please try a smaller image or clear some browser storage.');
        } else {
          alert('An error occurred: ' + error.message);
        }
        console.error('Error saving background image:', error);
      }
    };
    
    
    img.onerror = () => showSaveStatus('Could not open the background image');
    img.src = event.target.result;
  };  
  reader.onerror = () => showSaveStatus('Could not read the background image');
  reader.readAsDataURL(file);  
  e.target.value = '';
}

function toggleSound() {
  const soundBtn = document.getElementById('sound-btn');
  const volumePopup = document.getElementById('volume-popup');  
  const tooltip = window.bootstrap && bootstrap.Tooltip ? bootstrap.Tooltip.getInstance(soundBtn) : null;
  if (tooltip) {
    tooltip.hide();
  }

  if (volumePopup.classList.contains('hidden')) {
    if (shouldUseMediaSounds()) {
      ensureMediaSoundsReady();
    } else {
      ensureSoundsReady();
    }
    volumePopup.classList.remove('hidden');
    soundBtn.setAttribute('aria-expanded', 'true');
    document.getElementById('volume-slider').focus();
  } else {
    closeVolume(true);
  }
}

function closeVolume(restoreFocus = false) {
  const popup = document.getElementById('volume-popup');
  if (popup.classList.contains('hidden')) return;
  popup.classList.add('hidden');
  const button = document.getElementById('sound-btn');
  button.setAttribute('aria-expanded', 'false');
  if (restoreFocus) button.focus();
}

function updateSoundButton() {
  let iconClass = 'fa-volume-mute';
  
  if (soundVolume > 0) {
    soundEnabled = true;
    if (soundVolume < 0.1) {
      iconClass = 'fa-volume-off';
    } else if (soundVolume < 0.4) {
      iconClass = 'fa-volume-down';
    } else {
      iconClass = 'fa-volume-up';
    }
  } else {
    soundEnabled = false;
  }
  
  document.getElementById('sound-btn').innerHTML = `<i class="fas ${iconClass}"></i>`;
  document.getElementById('mute-btn').textContent = soundEnabled ? 'Mute' : 'Unmute';
}

function newDocumentId() {
  return `doc_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function createNewDocument() {
  if (flushDraft()) generateNewDocument();
}

function generateNewDocument() {
  const newId = newDocumentId();
  documents[newId] = {
    id: newId,
    title: 'Untitled Document',
    content: '',
    customTitle: false,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };  
  loadDocument(newId, { discard: true });
  saveDocumentsToStorage();
  editor.focus();
}

function saveCurrentDocumentContent() {
  const doc = documents[currentDocumentId];
  if (!doc) return false;
  snapshotDraft(doc);
  const saved = saveDocumentsToStorage();
  if (saved) draftDirty = false;
  return saved;
}

function snapshotDraft(doc) {
  const content = editor.innerHTML;
  if (doc.content === content) return;
  if (doc.customTitle === undefined) {
    const formerAutoTitle = sanitizeWriting(doc.content).textContent.trim().split('\n')[0]?.substring(0, 20) ||
      'Untitled Document';
    doc.customTitle = doc.title !== formerAutoTitle;
  }
  if (!doc.customTitle) {
    const firstLine = editor.innerText.replace(/[\u200B\u00A0]/g, ' ').split('\n')
      .map(line => line.trim()).find(Boolean);
    doc.title = firstLine ? Array.from(firstLine).slice(0, 48).join('') : 'Untitled Document';
  }
  doc.content = content;
  doc.updated = new Date().toISOString();
}

function saveCurrentDocument() {
  clearTimeout(autosaveTimer);
  if (saveCurrentDocumentContent()) showSaveStatus('Saved');
}

function saveDocumentTitle(id, newTitle) {
  if (!documents[id] || !flushDraft()) return;
  newTitle = newTitle.trim() || 'Untitled Document';
  documents[id].title = newTitle;
  documents[id].customTitle = true;
  documents[id].updated = new Date().toISOString();  
  saveDocumentsToStorage();
}

function showSaveStatus(message, error = false) {
  const status = document.getElementById('save-status');
  status.textContent = message;
  status.classList.toggle('save-error', error);
  status.title = error ? 'Your writing is still in this tab. Download a copy before closing it.' : '';
}

function saveDocumentsToStorage() {
  try {
    if (libraryLocked) throw Error('Library is unavailable');
    const latest = readLibrary();
    const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
    let conflict = false;
    for (const id of new Set([...Object.keys(storedDocuments), ...Object.keys(documents)])) {
      if (!changed(storedDocuments[id], documents[id])) continue;
      if (changed(storedDocuments[id], latest[id]) && latest[id] && changed(documents[id], latest[id])) {
        const copyId = newDocumentId();
        latest[copyId] = { ...latest[id], id: copyId, title: `${latest[id].title} (other tab)`, customTitle: true };
        conflict = true;
      }
      if (documents[id]) latest[id] = documents[id];
      else delete latest[id];
    }
    // Keep an open editor's snapshot until it is next edited or explicitly reopened.
    const current = documents[currentDocumentId];
    localStorage.setItem('odak_documents', JSON.stringify(latest));
    const currentChangedRemotely = current && !changed(storedDocuments[currentDocumentId], current) &&
      changed(current, latest[currentDocumentId]);
    const baseline = currentChangedRemotely ? storedDocuments[currentDocumentId] : latest[currentDocumentId];
    storedDocuments = Object.assign(Object.create(null), structuredClone(latest));
    documents = Object.assign(Object.create(null), latest);
    if (currentChangedRemotely) {
      documents[currentDocumentId] = current;
      if (baseline) storedDocuments[currentDocumentId] = structuredClone(baseline);
    }
    if (currentDocumentId) setPreference('odak_current_document', currentDocumentId);
    showSaveStatus(conflict ? 'Other tab’s version kept' : '');
    return true;
  } catch (error) {
    console.error('Unable to save documents:', error);
    showSaveStatus(libraryLocked ? 'Library unavailable · download a copy' : 'Not saved · download a copy', true);
    return false;
  }
}

function loadDocument(id, { discard = false } = {}) {
  if ((!discard && !flushDraft()) || !documents[id]) return false;
  clearTimeout(autosaveTimer);
  draftDirty = false;
  currentDocumentId = id;
  editor.replaceChildren(sanitizeWriting(documents[id].content));
  labelCheckboxes();
  updateCounter();
  setPreference('odak_current_document', currentDocumentId);

  if (typeof initDraggableImages === 'function') {
    initDraggableImages(editor);
  }
  return true;
}

function toggleDocumentsList() {
  
  flushDraft();
  updateDocumentsList();
  toggleDialog(listPopup);
}

function updateDocumentsList() {
  
  documentsListElement.innerHTML = '';  
  const query = documentSearchQuery.trim().toLowerCase();
  const sortedDocs = Object.values(documents)
    .filter(doc => {
      if (!query) return true;
      const markdown = convertToMarkdown(doc.content).toLowerCase();
      return (doc.title || '').toLowerCase().includes(query) || markdown.includes(query);
    })
    .sort((a, b) => {
      switch (documentSortMode) {
        case 'updated-asc':
          return new Date(a.updated) - new Date(b.updated);
        case 'created-desc':
          return new Date(b.created) - new Date(a.created);
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return new Date(b.updated) - new Date(a.updated);
      }
    });

  const listSummary = document.getElementById('documents-summary');
  if (listSummary) {
    const total = Object.keys(documents).length;
    listSummary.textContent = `${sortedDocs.length} of ${total} writing${total === 1 ? '' : 's'}`;
  }

  sortedDocs.forEach(doc => {
    const docItem = document.createElement('div');
    docItem.className = 'document-item';
    if (doc.id === currentDocumentId) {
      docItem.classList.add('active');
    }
    
    const docTitle = document.createElement('button');
    docTitle.className = 'document-title';
    docTitle.textContent = doc.title;
    docTitle.title = doc.title;
    docTitle.addEventListener('click', () => {
      if (loadDocument(doc.id)) {
        closeDialog(listPopup);
        editor.focus();
      }
    });
    
    const docDate = document.createElement('div');
    docDate.className = 'document-date';
    docDate.textContent = formatDate(doc.updated);
    
    const docActions = document.createElement('div');
    docActions.className = 'document-actions';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${doc.title}`);
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete “${doc.title}”? This cannot be undone.`)) {
        deleteDocument(doc.id);
      }
    });
    
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.title = 'Download';
    downloadBtn.setAttribute('aria-label', `Download ${doc.title}`);
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadDocument(doc.id);
    });

    const duplicateBtn = document.createElement('button');
    duplicateBtn.innerHTML = '<i class="fas fa-copy"></i>';
    duplicateBtn.title = 'Duplicate';
    duplicateBtn.setAttribute('aria-label', `Duplicate ${doc.title}`);
    duplicateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateDocument(doc.id);
    });

    const renameBtn = document.createElement('button');
    renameBtn.innerHTML = '<i class="fas fa-pen"></i>';
    renameBtn.title = 'Rename';
    renameBtn.setAttribute('aria-label', `Rename ${doc.title}`);
    renameBtn.addEventListener('click', () => {
      const title = prompt('Writing title', doc.title);
      if (title !== null) {
        saveDocumentTitle(doc.id, title);
        updateDocumentsList();
        document.getElementById('documents-search').focus();
      }
    });

    docActions.appendChild(downloadBtn);
    docActions.appendChild(duplicateBtn);
    docActions.appendChild(renameBtn);
    docActions.appendChild(deleteBtn);
    
    docItem.appendChild(docTitle);
    docItem.appendChild(docDate);
    docItem.appendChild(docActions);
    
    
    documentsListElement.appendChild(docItem);
  });  
  if (sortedDocs.length === 0) {
    documentsListElement.innerHTML = query ? '<div class="no-documents">No matching writings</div>' : '<div class="no-documents">No documents yet</div>';
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function deleteDocument(id) {
  if (id !== currentDocumentId && !flushDraft()) return;
  const previous = documents[id];
  delete documents[id];
  if (!saveDocumentsToStorage()) {
    documents[id] = previous;
    return;
  }
  if (id === currentDocumentId) {
    const next = Object.values(documents).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))[0];
    if (next) loadDocument(next.id, { discard: true });
    else generateNewDocument();
  }
  updateDocumentsList();
  document.getElementById('documents-search').focus();
}

function duplicateDocument(id) {
  if (!flushDraft() || !documents[id]) return;
  const source = documents[id];
  const newId = newDocumentId();
  const now = new Date().toISOString();
  documents[newId] = {
    id: newId,
    title: `${source.title || 'Untitled Document'} Copy`,
    customTitle: true,
    content: source.content,
    created: now,
    updated: now
  };
  loadDocument(newId);
  saveDocumentsToStorage();
  updateDocumentsList();
  document.getElementById('documents-search').focus();
}

function downloadCurrentDocument() {
  if (!currentDocumentId) return;
  downloadDocument(currentDocumentId);
}

function sanitizeFileName(name, fallback = 'untitled_document') {
  const cleanName = String(name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return cleanName || fallback;
}

function downloadDocument(id) {
  if (!documents[id]) return;
  if (id === currentDocumentId) flushDraft();
  const doc = documents[id];
  const markdownContent = convertToMarkdown(id === currentDocumentId ? editor.innerHTML : doc.content);
  downloadFile(markdownContent, `${sanitizeFileName(doc.title)}.md`, 'text/markdown;charset=utf-8');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
    a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadAllDocuments() {
  flushDraft();
  const writings = Object.values(documents).map(doc => ({
    ...doc, markdown: convertToMarkdown(doc.id === currentDocumentId ? editor.innerHTML : doc.content)
  }));
  downloadFile(JSON.stringify({ format: 'odak-backup', version: 1, writings }, null, 2),
    `odak-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
}

async function restoreBackup(event) {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  const status = document.getElementById('library-feedback');
  try {
    const backup = JSON.parse(await file.text());
    if (backup?.format !== 'odak-backup' || backup.version !== 1 || !Array.isArray(backup.writings) ||
        !backup.writings.every(doc => doc && typeof doc.title === 'string' && typeof doc.content === 'string')) {
      throw Error('Not a supported Odak backup.');
    }
    if (!flushDraft()) throw Error('Save or download your current draft before restoring.');
    const now = new Date().toISOString();
    const validDate = date => Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : now;
    const additions = backup.writings.map(doc => ({
      id: newDocumentId(), title: doc.title, content: cleanWritingHtml(doc.content),
      customTitle: doc.customTitle !== false, created: validDate(doc.created), updated: validDate(doc.updated)
    }));
    additions.forEach(doc => { documents[doc.id] = doc; });
    if (!saveDocumentsToStorage()) {
      additions.forEach(doc => { delete documents[doc.id]; });
      throw Error('Backup could not be saved. Your existing library was not replaced.');
    }
    updateDocumentsList();
    status.textContent = `Restored ${additions.length} writing${additions.length === 1 ? '' : 's'} as copies.`;
  } catch (error) {
    status.textContent = error instanceof SyntaxError ? 'Not a supported Odak backup.' : error.message;
  }
}

function convertToMarkdown(html) {
  const temp = sanitizeWriting(html);

  function processNode(node, context = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\u200B/g, '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Create new context for nested ordered lists
      if (tagName === 'ol') {
        context = { ...context, olCounter: Number(node.getAttribute('start') || 1) };
      }

      const childContent = Array.from(node.childNodes)
        .map(child => processNode(child, context))
        .join('');

      switch (tagName) {
        case 'h1': return `# ${childContent}`;
        case 'h2': return `## ${childContent}`;
        case 'h3': return `### ${childContent}`;
        case 'h4': return `#### ${childContent}`;
        case 'h5': return `##### ${childContent}`;
        case 'h6': return `###### ${childContent}`;
        case 'blockquote': return childContent.split('\n').map(line => `> ${line}`).join('\n');
        case 'strong':
        case 'b': return `**${childContent}**`;
        case 'em':
        case 'i': return `*${childContent}*`;
        case 'u': return `__${childContent}__`;
        case 'code': return `\`${childContent}\``;
        case 'a':
          const href = node.getAttribute('href') || '';
          return `[${childContent}](${href})`;
        case 'img':
          const alt = node.getAttribute('alt') || '';
          const src = node.getAttribute('src') || '';
          return `![${alt}](${src})`;
        case 'div':
          if (node.classList.contains('imglib-wrapper')) {
            const wrappedImage = node.querySelector('img');
            if (wrappedImage) {
              const alt = wrappedImage.getAttribute('alt') || '';
              const src = wrappedImage.getAttribute('src') || '';
              const layout = getImageLayoutMetadata(node);
              const metadata = layout ? `\n<!-- odak:image ${JSON.stringify(layout)} -->` : '';
              return `![${alt}](${src})${metadata}`;
            }
          }
          const checkbox = node.querySelector(':scope > input[type="checkbox"]');
          if (checkbox) {
            const textContent = Array.from(node.childNodes)
              .filter(child => child !== checkbox)
              .map(child => child.nodeType === Node.TEXT_NODE ? child.textContent : processNode(child, context))
              .join('')
              .trim();
            return `- [${checkbox.checked || checkbox.hasAttribute('checked') ? 'x' : ' '}] ${textContent}`;
          }
          return childContent;
        case 'hr': return `---` + "\n";
        case 'ul':
        case 'ol':
          return '\n' + childContent.trim() + '\n';
        case 'li':
          const parentList = node.parentElement?.tagName.toLowerCase();
          if (parentList === 'ol') {
            const number = context.olCounter ?? 1;
            context.olCounter = number + 1;
            return `${number}. ${childContent}\n`;
          } else {
            return `- ${childContent}\n`;
          }
        case 'input':
          return '';
        case 'br':
          return '\n';
        case 'pre': {
          const text = node.textContent;
          const fence = '`'.repeat(Math.max(3, ...(text.match(/`+/g) || []).map(run => run.length + 1)));
          return `${fence}${node.getAttribute('data-language') || ''}\n${text}\n${fence}\n`;
        }
        case 'p':
          return childContent + '\n';
        default:
          return childContent;
      }
    }
    return '';
  }

  let markdown = '';
  const children = Array.from(temp.childNodes);

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const result = processNode(node);
    if (node.nodeType === Node.ELEMENT_NODE && ['DIV', 'P'].includes(node.tagName) && !result.trim()) {
      if (markdown) markdown += '\n';
    } else if (result.trim()) {
      if (markdown && !markdown.endsWith('\n') && 
          node.nodeType === Node.ELEMENT_NODE &&
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'div', 'p'].includes(node.tagName.toLowerCase())) {
        markdown += '\n';
      }
      markdown += result;

      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName.toLowerCase() === 'hr') {
          markdown += '\n\n';
        } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'div', 'p'].includes(node.tagName.toLowerCase())) {
          markdown += '\n';
        }
      }
    }
  }

  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

function getImageLayoutMetadata(wrapper) {
  const x = parseFloat(wrapper.dataset.odakX || wrapper.style.left);
  const y = parseFloat(wrapper.dataset.odakY || wrapper.style.top);
  const width = parseFloat(wrapper.dataset.odakWidth || wrapper.style.width || wrapper.offsetWidth);
  const height = parseFloat(wrapper.dataset.odakHeight || wrapper.style.height || wrapper.offsetHeight);
  const layout = {};

  if (Number.isFinite(x)) layout.x = Math.round(x);
  if (Number.isFinite(y)) layout.y = Math.round(y);
  if (Number.isFinite(width)) layout.width = Math.round(width);
  if (Number.isFinite(height)) layout.height = Math.round(height);

  return Object.keys(layout).length ? layout : null;
}


function handleFileUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    if (!flushDraft()) return;
    const content = e.target.result.replace(/\r\n?/g, '\n');
    
    
    const newId = newDocumentId();
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    
    
    let htmlContent = '';
    if (/\.(md|markdown)$/i.test(file.name)) {
      htmlContent = convertMarkdownToHtml(content);
    } else {
      
      htmlContent = content.split('\n').map(line => `<div dir="auto">${escapeHtml(line) || '<br>'}</div>`).join('');
    }
    
    
    documents[newId] = {
      id: newId,
      title: fileName,
      customTitle: true,
      content: htmlContent,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    
    if (!saveDocumentsToStorage()) {
      delete documents[newId];
      return;
    }
    loadDocument(newId);
    editor.focus();
    updateCounter();
  };
  
  reader.onerror = () => showSaveStatus('Could not read the selected file');
  reader.readAsText(file);
}

const WRITING_TAGS = new Set('DIV P BR H1 H2 H3 H4 H5 H6 BLOCKQUOTE STRONG B EM I U CODE PRE A IMG HR UL OL LI INPUT SPAN'.split(' '));
const DISCARDED_TAGS = new Set('SCRIPT STYLE TEMPLATE IFRAME OBJECT SVG MATH FORM EMBED'.split(' '));

function sanitizeWriting(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  function clean(container) {
    for (const node of [...container.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (node.nodeType !== Node.ELEMENT_NODE || DISCARDED_TAGS.has(node.tagName) ||
          node.classList.contains('imglib-handle') || node.classList.contains('imglib-delete')) {
        node.remove();
        continue;
      }
      clean(node);
      const tag = node.tagName;
      if (!WRITING_TAGS.has(tag)) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      if (tag === 'INPUT' && node.getAttribute('type')?.toLowerCase() !== 'checkbox') {
        node.remove();
        continue;
      }
      const attributes = {};
      if (['auto', 'ltr', 'rtl'].includes(node.dir)) attributes.dir = node.dir;
      if (tag === 'A') attributes.href = sanitizeUrl(node.getAttribute('href'));
      if (tag === 'INPUT') {
        attributes.type = 'checkbox';
        if (node.hasAttribute('checked')) attributes.checked = '';
      }
      if (tag === 'OL' && /^-?\d+$/.test(node.getAttribute('start'))) attributes.start = node.getAttribute('start');
      if (tag === 'PRE' && /^[\w+-]+$/.test(node.getAttribute('data-language') || '')) {
        attributes['data-language'] = node.getAttribute('data-language');
      }
      const wrapper = tag === 'DIV' && node.classList.contains('imglib-wrapper');
      if (wrapper) {
        attributes.class = 'imglib-wrapper';
        attributes.contenteditable = 'false';
      }
      if (tag === 'IMG') {
        const src = sanitizeUrl(node.getAttribute('src'), true);
        if (src && src !== '#') attributes.src = src;
        attributes.alt = node.getAttribute('alt') || '';
        if (node.hasAttribute('data-draggable')) attributes['data-draggable'] = '';
        attributes.referrerpolicy = 'no-referrer';
      }
      if (wrapper || tag === 'IMG') {
        const fields = { x: 'left', y: 'top', width: 'width', height: 'height' };
        for (const [key, property] of Object.entries(fields)) {
          const value = Number.parseFloat(node.getAttribute(`data-odak-${key}`) || (wrapper ? node.style[property] : ''));
          if (Number.isFinite(value)) attributes[`data-odak-${key}`] = Math.round(value);
        }
      }
      for (const attr of [...node.attributes]) node.removeAttribute(attr.name);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    }
  }
  clean(template.content);
  return template.content;
}

function cleanWritingHtml(html) {
  const template = document.createElement('template');
  template.content.append(sanitizeWriting(html));
  return template.innerHTML;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url, allowDataImage = false) {
  const value = String(url || '').trim();
  if (!value) return '';

  if (allowDataImage && /^data:image\/(?:png|gif|jpe?g|webp|svg\+xml);base64,/i.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value, window.location.href);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return value;
    }
  } catch (error) {
    if (/^(?:\.{0,2}\/|#)/.test(value)) {
      return value;
    }
  }

  return '#';
}

function handleEditorLinkClick(e) {
  const link = e.target.closest('a[href]');
  if (!link || !editor.contains(link)) return;

  e.preventDefault();
  e.stopPropagation();

  if (e.button !== 0 || (e.detail !== 0 && !e.ctrlKey && !e.metaKey)) return;

  const href = sanitizeUrl(link.getAttribute('href') || '');
  if (!href || href === '#') return;

  window.open(href, '_blank', 'noopener,noreferrer');
}

function renderInlineMarkdown(markdown) {
  const tokens = [];
  const stash = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let escaped = markdown.replace(/\u0000/g, '\uFFFD')
    .replace(/`([^`]+)`/g, (match, code) => stash(`<code>${escapeHtml(code)}</code>`))
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, src) => {
      return stash(renderImageMarkdown(alt, src));
    })
    .replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text, href) => {
      return stash(`<a href="${escapeHtml(sanitizeUrl(href))}">${escapeHtml(text)}</a>`);
    });
  escaped = escapeHtml(escaped)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>');

  return escaped.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[index]);
}

function parseOdakImageMetadata(line) {
  const match = line.match(/^<!--\s*odak:image\s+({.*})\s*-->$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    const metadata = {};
    ['x', 'y', 'width', 'height'].forEach(key => {
      const value = Number(parsed[key]);
      if (Number.isFinite(value)) {
        metadata[key] = Math.round(value);
      }
    });
    return Object.keys(metadata).length ? metadata : null;
  } catch (error) {
    console.warn('Ignoring invalid Odak image metadata.', error);
    return null;
  }
}

function renderImageMarkdown(alt, src, metadata = null) {
  const attrs = [
    `src="${escapeHtml(sanitizeUrl(src, true))}"`,
    `alt="${escapeHtml(alt)}"`,
    'data-draggable'
  ];

  if (metadata) {
    if (Number.isFinite(metadata.x)) attrs.push(`data-odak-x="${metadata.x}"`);
    if (Number.isFinite(metadata.y)) attrs.push(`data-odak-y="${metadata.y}"`);
    if (Number.isFinite(metadata.width)) attrs.push(`data-odak-width="${metadata.width}"`);
    if (Number.isFinite(metadata.height)) attrs.push(`data-odak-height="${metadata.height}"`);
  }

  return `<img ${attrs.join(' ')}>`;
}

function convertMarkdownToHtml(markdown) {
  // Split the markdown into lines
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let listItems = [];
  let listStart = 1;

  function flushList() {
    if (!inList) return;
    const start = listType === 'ol' && listStart !== 1 ? ` start="${listStart}"` : '';
    html += `<${listType} dir="auto"${start}>${listItems.join('')}</${listType}>`;
    inList = false;
    listItems = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const ordered = line.match(/^(\d+)\.\s+(.+)$/);
    const unordered = /^-\s+(?!\[[ xX]\](?:\s|$))/.test(line);
    const nextList = ordered ? 'ol' : unordered ? 'ul' : '';
    if (inList && listType !== nextList) flushList();
    const fence = line.match(/^(`{3,}|~{3,})([\w+-]*)\s*$/);
    if (fence) {
      const closing = new RegExp(`^${fence[1][0]}{${fence[1].length},}$`);
      const end = lines.findIndex((part, index) => index > i && closing.test(part.trim()));
      if (end !== -1) {
        html += `<pre dir="auto" data-language="${fence[2]}">${escapeHtml(lines.slice(i + 1, end).join('\n'))}</pre>`;
        i = end;
        continue;
      }
    }
    
    // Skip empty lines
    if (!line) {
      html += '<div dir="auto"><br></div>';
      continue;
    }

    // Headers
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#{1,6}/)[0].length;
      const content = line.replace(/^#+\s*/, '');
      html += `<h${level} dir="auto">${renderInlineMarkdown(content)}</h${level}>`;
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const content = [line.replace(/^>\s?/, '')];
      while (lines[i + 1]?.trim().startsWith('>')) content.push(lines[++i].trim().replace(/^>\s?/, ''));
      html += `<blockquote dir="auto">${content.map(renderInlineMarkdown).join('<br>')}</blockquote>`;
      continue;
    }

    // Horizontal Rule
    if (line === '---') {
      html += '<hr>';
      continue;
    }

    if (parseOdakImageMetadata(line)) {
      continue;
    }

    const imageLineMatch = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imageLineMatch) {
      const metadata = parseOdakImageMetadata((lines[i + 1] || '').trim());
      html += `<div dir="auto">${renderImageMarkdown(imageLineMatch[1], imageLineMatch[2], metadata)}</div>`;
      if (metadata) {
        i += 1;
      }
      continue;
    }

    // Checkboxes
    const check = line.match(/^-\s\[([ xX])\](?:\s+(.*))?$/);
    if (check) {
      const checked = check[1].toLowerCase() === 'x';
      const content = check[2] || '\u200B';
      html += `<div dir="auto"><input type="checkbox" ${checked ? 'checked' : ''} dir="auto"> ${renderInlineMarkdown(content)}</div>`;
      continue;
    }
    
    // Ordered Lists
    if (ordered) {
      if (!inList) {
        inList = true;
        listType = 'ol';
        listStart = Number(ordered[1]);
      }
      listItems.push(`<li dir="auto">${renderInlineMarkdown(ordered[2])}</li>`);
      continue;
    }

    // Unordered Lists
    if (unordered) {
      if (!inList) {
        inList = true;
        listType = 'ul';
      }
      const content = line.replace(/^-\s*/, '');
      listItems.push(`<li dir="auto">${renderInlineMarkdown(content)}</li>`);
      continue;
    }

    // Process inline markdown
    let processedLine = renderInlineMarkdown(line);

    html += `<div dir="auto">${processedLine}</div>`;
  }

  // Close any open list
  flushList();

  return html;
}

function updateCounter() {
  const text = editor.innerText.replace(/[\u200B×]/g, '').trim();
  const wordCount = wordSegmenter
    ? [...wordSegmenter.segment(text)].filter(segment => segment.isWordLike).length
    : text.split(/\s+/).filter(Boolean).length;
  counter.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'}`;
}

const wordSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;

function labelCheckboxes() {
  for (const checkbox of editor.querySelectorAll('input[type="checkbox"]')) {
    checkbox.setAttribute('aria-label', checkbox.parentElement.textContent.replace(/\u200B/g, '').trim() || 'Checklist item');
  }
}

function handleShortcuts(e) {
  if (e.isComposing || e.altKey || e.defaultPrevented) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveCurrentDocument();
  }
}

function initBootstrapTooltips() {
  
  if (typeof bootstrap === 'undefined') {
    console.warn('Bootstrap library not loaded, skipping tooltip initialization');
    return;
  }
  
  try {
    
    const elementsWithTitle = document.querySelectorAll('[title]');
    elementsWithTitle.forEach(el => {
      if (el.id === 'sound-btn') {
        el.removeAttribute('title');
        return;
      }

      const title = el.getAttribute('title');
      if (title) {
        el.removeAttribute('title');
        el.setAttribute('data-bs-toggle', 'tooltip');
        el.setAttribute('data-bs-title', title);
      }
    });
    
    
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl, {
        trigger: 'hover'
      });
    });
  } catch (error) {
    console.error('Error initializing Bootstrap tooltips:', error);
  }
}

function updateFontSizeLabel() {
  const fontSizeLabel = document.getElementById('font-size-value');
  if (fontSize === 120) {
    fontSizeLabel.textContent = '120%';
  } else {
    fontSizeLabel.textContent = fontSize + '%';
  }
}

// Make popup draggable by header
function makePopupDraggable(popupId) {
  const popup = document.getElementById(popupId);
  if (!popup) return;
  const header = popup.querySelector('.popup-header');
  if (!header) return;
  let offsetX = 0, offsetY = 0, startX = 0, startY = 0, isDragging = false;

  header.addEventListener('mousedown', function(e) {
    if (e.button !== 0 || e.target.closest('button')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = popup.getBoundingClientRect();
    offsetX = startX - rect.left;
    offsetY = startY - rect.top;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;
    // Keep popup within viewport
    x = Math.max(0, Math.min(window.innerWidth - popup.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - popup.offsetHeight, y));
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    popup.style.transform = 'none';
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
    document.body.style.userSelect = '';
  });
}

function toggleToolbarAndStatusbar(mode = 'hide') {
  const hide = mode === 'hide' && !activeDialog && document.activeElement === editor &&
    matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)').matches;
  document.body.classList.toggle('focus-writing', hide);
  toolbar.inert = Boolean(activeDialog) || hide;
  statusBar.inert = Boolean(activeDialog);
}

function toggleInfo() {
  toggleDialog(document.getElementById('info-popup'));
}

function showInfoPopup() {
  openDialog(document.getElementById('info-popup'));
}

function closeInfoPopup() {
  closeDialog(document.getElementById('info-popup'));
}

function openDialog(dialog) {
  if (activeDialog) closeDialog(activeDialog, false);
  const focused = document.activeElement;
  dialogTrigger = focused === document.body ? editor : focused;
  closeVolume();
  activeDialog = dialog;
  dialog.classList.remove('hidden');
  ['top', 'left', 'transform'].forEach(key => { dialog.style[key] = ''; });
  for (const child of dialog.parentElement.children) child.inert = child !== dialog;
  toggleToolbarAndStatusbar('show');
  (dialog.querySelector('input[type="search"]') || dialog.querySelector('.close-popup')).focus();
}

function closeDialog(dialog, restoreFocus = true) {
  if (activeDialog !== dialog) return;
  if (dialog.id === 'info-popup') setPreference('odak_has_seen_info', 'true');
  activeDialog = null;
  dialog.classList.add('hidden');
  for (const child of dialog.parentElement.children) child.inert = false;
  if (restoreFocus) dialogTrigger?.focus();
  dialogTrigger = null;
}

function toggleDialog(dialog) {
  if (activeDialog === dialog) closeDialog(dialog);
  else openDialog(dialog);
}

function handleDialogKeys(event) {
  if (event.key === 'Escape') {
    if (activeDialog) closeDialog(activeDialog);
    else closeVolume(true);
  } else if (event.key === 'Tab' && activeDialog) {
    const focusable = [...activeDialog.querySelectorAll('button, input, select, a[href], summary')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    if (!focusable.length) return;
    const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
    if (document.activeElement === edge || !activeDialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? focusable.at(-1) : focusable[0]).focus();
    }
  } else if (event.key === 'Tab') {
    toggleToolbarAndStatusbar('show');
  }
}

function handleLetsGo() {
  closeInfoPopup();
  editor.focus();
}

function syncCheckboxAttribute(e) {
  if (e.target.matches('input[type="checkbox"]')) {
    if (e.target.checked) {
      e.target.setAttribute('checked', '');
    } else {
      e.target.removeAttribute('checked');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  editor.addEventListener('click', handleEditorLinkClick);
  editor.addEventListener('focusout', () => toggleToolbarAndStatusbar('show'));
  editor.addEventListener('change', event => {
    if (event.target.matches('input[type="checkbox"]')) markDraftChanged(event);
  });
  
  // Add event listener for keyboard shortcuts
  document.addEventListener('keydown', handleShortcuts);
  
  // Add event listeners for toolbar buttons
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.getElementById('list-btn').addEventListener('click', toggleDocumentsList);
  document.getElementById('sound-btn').addEventListener('click', toggleSound);
  document.getElementById('settings-btn').addEventListener('click', toggleSettings);
  document.getElementById('load-btn').addEventListener('click', () => fileInput.click());
  document.getElementById('download-btn').addEventListener('click', downloadCurrentDocument);
  
  // Add event listeners for status bar buttons
  document.getElementById('new-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    createNewDocument();
  });
  document.getElementById('save-btn').addEventListener('click', saveCurrentDocument);
  
  // Add event listeners for popup close buttons
  document.getElementById('close-list').addEventListener('click', () => closeDialog(listPopup));
  document.getElementById('close-settings').addEventListener('click', () => closeDialog(settingsPopup));
  
  // Add event listeners for file inputs
  fileInput.addEventListener('change', handleFileUpload);
  document.getElementById('bg-file-input').addEventListener('change', handleBackgroundUpload);
  document.getElementById('backup-file-input').addEventListener('change', restoreBackup);
  
  // Add event listeners for settings controls
  document.getElementById('font-family-select').addEventListener('change', (e) => {
    fontFamily = e.target.value;
    setPreference('odak_font_family', fontFamily);
    applySettings();
  });
  
  document.getElementById('font-size-slider').addEventListener('input', (e) => {
    fontSize = parseInt(e.target.value);
    setPreference('odak_font_size', fontSize);
    updateFontSizeLabel();
    applySettings();
  });
  
  document.getElementById('editor-width-input').addEventListener('change', (e) => {
    editorWidth = clampSetting(e.target.value, 400, 1600, 830);
    e.target.value = editorWidth;
    setPreference('odak_editor_width', editorWidth);
    applySettings();
  });
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
    });
  });
  
  document.getElementById('volume-slider').addEventListener('input', (e) => {
    soundVolume = parseInt(e.target.value) / 100;
    if (soundVolume > 0) {
      lastAudibleVolume = soundVolume;
      setPreference('odak_last_audible_volume', soundVolume);
    }
    document.getElementById('volume-value').textContent = e.target.value + '%';
    updateSoundButton();
    Object.values(mediaSounds).flat().forEach(sound => {
      sound.volume = soundVolume / 3;
    });
    setPreference('odak_sound_volume', soundVolume);
  });
  document.getElementById('mute-btn').addEventListener('click', () => {
    const slider = document.getElementById('volume-slider');
    slider.value = soundEnabled ? 0 : Math.round(lastAudibleVolume * 100);
    slider.dispatchEvent(new Event('input'));
  });
  document.getElementById('spellcheck-setting').addEventListener('change', event => {
    editor.spellcheck = event.target.checked;
    setPreference('odak_spellcheck', editor.spellcheck);
  });

  document.getElementById('close-volume').addEventListener('click', () => closeVolume(true));
  document.addEventListener('fullscreenchange', updateFullscreenButtonVisibility);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButtonVisibility);

  window.addEventListener('resize', () => {
    updateFullscreenButtonVisibility();
    toggleToolbarAndStatusbar('show');
  });

  const standaloneMedia = window.matchMedia('(display-mode: standalone)');
  if (standaloneMedia.addEventListener) {
    standaloneMedia.addEventListener('change', updateFullscreenButtonVisibility);
  } else if (standaloneMedia.addListener) {
    standaloneMedia.addListener(updateFullscreenButtonVisibility);
  }

  document.addEventListener('pointerdown', () => {
    if (!soundEnabled) return;
    if (shouldUseMediaSounds()) {
      ensureMediaSoundsReady();
    } else {
      ensureSoundsReady();
    }
  }, { once: true, passive: true });
  
  document.getElementById('upload-bg-btn').addEventListener('click', () => {
    document.getElementById('bg-file-input').click();
  });
  
  document.getElementById('default-bg').addEventListener('click', () => {
    useCustomBg = false;
    setPreference('odak_use_custom_bg', 'false');
    updateBackgroundSelection();
    applyBackground();
  });
  
  document.getElementById('custom-bg').addEventListener('click', () => {
    if (customBackground) {
      useCustomBg = true;
      setPreference('odak_use_custom_bg', 'true');
      updateBackgroundSelection();
      applyBackground();
    }
  });

  document.getElementById('download-all-btn').addEventListener('click', downloadAllDocuments);
  document.getElementById('restore-backup-btn').addEventListener('click', () => {
    document.getElementById('backup-file-input').click();
  });

  document.getElementById('documents-search').addEventListener('input', (e) => {
    documentSearchQuery = e.target.value;
    updateDocumentsList();
  });

  document.getElementById('documents-sort').addEventListener('change', (e) => {
    documentSortMode = e.target.value;
    updateDocumentsList();
  });

  document.addEventListener('keydown', handleDialogKeys);

  document.addEventListener('click', (e) => {
    const volumePopup = document.getElementById('volume-popup');
    const soundBtn = document.getElementById('sound-btn');
    if (!volumePopup.contains(e.target) && !soundBtn.contains(e.target)) {
      closeVolume();
    }
  });

  makePopupDraggable('settings-popup');
  makePopupDraggable('list-popup');
  makePopupDraggable('info-popup');

  // Add event listeners for info popup
  const infoBtn = document.getElementById('info-btn');
  const closeInfoBtn = document.getElementById('close-info');
  const letsGoBtn = document.getElementById('lets-go-btn');

  infoBtn.addEventListener('click', toggleInfo);
  closeInfoBtn.addEventListener('click', closeInfoPopup);
  letsGoBtn.addEventListener('click', handleLetsGo);
  document.getElementById('open-example-btn').addEventListener('click', () => {
    if (!flushDraft() || libraryLocked) return;
    ensureExampleDocument(true);
    if (loadDocument(EXAMPLE_DOCUMENT_ID)) handleLetsGo();
  });




});
