/*
 * Odak.app is a clean, minimalist, and privacy-respecting writing app with live Markdown rendering—built to keep you in the flow. No accounts, no ads, no cloud, and no distractions. Everything is stored locally on your device.
 * v=3.0-20260626-V
 * Author: Araz Gholami @arazgholami
 * Email: contact@arazgholami.com
 */

let currentDocumentId = null;
let isTyping = false;
let typingTimer = null;
let autosaveTimer = null;
let soundEnabled = true;
let soundVolume = 0.5; 
let currentTheme = 'light'; // Default theme
let isFullscreen = false;
let documents = {};
let customBackground = null; 
let documentSearchQuery = '';
let documentSortMode = 'updated-desc';
const ASSET_VERSION = '3.0-20260626-V';

let fontFamily = 'Vazir'; 
let fontSize = 120; 
let editorWidth = 830; 
let systemFonts = []; 
let useCustomBg = false; 

const EXAMPLE_DOCUMENT_ID = 'odak_example_markdown_v3';
const EXAMPLE_MARKDOWN = `# Odak Markdown Example

This document shows the Markdown syntax currently supported by Odak 3.0.

## Text Formatting

Write **bold text**, *italic text*, __underlined text__, and \`inline code\`.

### Links

Visit [Odak.app](https://odak.app) or [email the author](mailto:contact@odak.app).

### Image

![Odak logo](https://odak.app/assets/images/odak.svg?v=3.0-20260626-V)
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
  autosaveTimer = setTimeout(() => {
    saveCurrentDocumentContent();
  }, 700);
}

MarkdownEditor.init('editor', {
  placeholder: 'What\'s in your mind?',
  autofocus: true
});

const editor = document.getElementById('editor');
const toolbar = document.getElementById('toolbar');
const topbar = document.getElementById('topbar');
const statusBar = document.getElementById('status-bar');
const settingsPopup = document.getElementById('settings-popup');
const counter = document.getElementById('counter');
const listPopup = document.getElementById('list-popup');
const documentsListElement = document.getElementById('documents-list');
const fileInput = document.getElementById('file-input');

// Add input event listener for typing
editor.addEventListener('input', () => {
  handleTypingState();
  updateCounter();
  scheduleAutosave();
});

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
  ensureExampleDocument();
  loadPreferences();  
  if (currentDocumentId && documents[currentDocumentId]) {
    loadDocument(currentDocumentId);
  } else {
    createNewDocument(true);
  }  
  updateCounter();  
  applyTheme();  
  applyBackground();
  updateBackgroundSelection();  
  initBootstrapTooltips();
  updateFullscreenButtonVisibility();
  toggleToolbarAndStatusbar('show');
  
  // Check if this is the first visit
  const hasSeenInfo = localStorage.getItem('odak_has_seen_info');
  if (!hasSeenInfo) {
    showInfoPopup();
  }
}

function loadDocumentsFromStorage() {
  const savedDocuments = localStorage.getItem('odak_documents');
  if (savedDocuments) {
    try {
      const parsed = JSON.parse(savedDocuments);
      documents = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.error('Could not parse saved documents. Starting with an empty library.', error);
      documents = {};
      localStorage.removeItem('odak_documents');
      localStorage.removeItem('odak_current_document');
    }
  }
  
  const lastDocumentId = localStorage.getItem('odak_current_document');
  if (lastDocumentId) {
    currentDocumentId = lastDocumentId;
  }

  if (currentDocumentId && !documents[currentDocumentId]) {
    currentDocumentId = null;
    localStorage.removeItem('odak_current_document');
  }
}

function ensureExampleDocument() {
  if (documents[EXAMPLE_DOCUMENT_ID]) return;

  const hadDocuments = Object.keys(documents).length > 0;
  const now = new Date().toISOString();
  documents[EXAMPLE_DOCUMENT_ID] = {
    id: EXAMPLE_DOCUMENT_ID,
    title: 'Odak Markdown Example',
    content: convertMarkdownToHtml(EXAMPLE_MARKDOWN),
    created: now,
    updated: now
  };

  if (!hadDocuments || !currentDocumentId) {
    currentDocumentId = EXAMPLE_DOCUMENT_ID;
  }

  saveDocumentsToStorage();
}

function loadPreferences() {
  
  const savedSoundVolume = localStorage.getItem('odak_sound_volume');
  if (savedSoundVolume !== null) {
    soundVolume = parseFloat(savedSoundVolume);
    document.getElementById('volume-slider').value = soundVolume * 100;
    document.getElementById('volume-value').textContent = Math.round(soundVolume * 100) + '%';
    soundEnabled = soundVolume > 0;
    updateSoundButton();
  } else {
    
    soundVolume = 0.5;
    document.getElementById('volume-slider').value = 50;
    document.getElementById('volume-value').textContent = '50%';
    updateSoundButton();
  }  
  const savedTheme = localStorage.getItem('odak_theme');
  if (savedTheme && ['light', 'dark', 'odak'].includes(savedTheme)) {
    currentTheme = savedTheme;
  } else {
    // Migrate from old theme system if needed
    const oldThemePref = localStorage.getItem('odak_dark_mode');
    if (oldThemePref !== null) {
      currentTheme = oldThemePref === 'true' ? 'dark' : 'light';
      localStorage.removeItem('odak_dark_mode');
      localStorage.setItem('odak_theme', currentTheme);
    }
  }
  applyTheme();  
  const savedFontFamily = localStorage.getItem('odak_font_family');
  if (savedFontFamily !== null) {
    fontFamily = savedFontFamily;
  }  
  const savedFontSize = localStorage.getItem('odak_font_size');
  if (savedFontSize !== null) {
    fontSize = parseInt(savedFontSize);
  }
  document.getElementById('font-size-slider').value = fontSize;
  updateFontSizeLabel();  
  const savedEditorWidth = localStorage.getItem('odak_editor_width');
  if (savedEditorWidth !== null) {
    editorWidth = parseInt(savedEditorWidth);
    document.getElementById('editor-width-input').value = editorWidth;
  }  
  try {
    const savedCustomBackground = localStorage.getItem('odak_custom_background');
    const savedUseCustomBg = localStorage.getItem('odak_use_custom_bg');
    
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
    
    localStorage.removeItem('odak_custom_background');
    localStorage.setItem('odak_use_custom_bg', 'false');
  }  
  applySettings();
}


function handleKeyDown(e) {
  if (!soundEnabled) return;  
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
  fullscreenBtn.classList.toggle('hidden', isStandaloneDisplay());
}


function toggleFullscreen() {
  if (!isFullscreen) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    }
    document.getElementById('fullscreen-btn').innerHTML = '<i class="fas fa-compress"></i>';
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    document.getElementById('fullscreen-btn').innerHTML = '<i class="fas fa-expand"></i>';
  }
  
  isFullscreen = !isFullscreen;
}

function setTheme(theme) {
  if (['light', 'dark', 'odak'].includes(theme)) {
    currentTheme = theme;
    localStorage.setItem('odak_theme', theme);
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
  settingsPopup.classList.toggle('hidden');
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
  
  // Apply font sizes to all elements
  const allElements = editor.querySelectorAll('*');
  allElements.forEach(element => {
    if (element.tagName === 'H1') {
      element.style.fontSize = 'var(--h1-font-size)';
    } else if (element.tagName === 'H2') {
      element.style.fontSize = 'var(--h2-font-size)';
    } else if (element.tagName === 'H3') {
      element.style.fontSize = 'var(--h3-font-size)';
    } else if (element.tagName === 'H4') {
      element.style.fontSize = 'calc(var(--h3-font-size) * 0.9)';
    } else if (element.tagName === 'H5') {
      element.style.fontSize = 'calc(var(--h3-font-size) * 0.8)';
    } else if (element.tagName === 'H6') {
      element.style.fontSize = 'calc(var(--h3-font-size) * 0.7)';
    } else if (element.tagName === 'DIV' || 
               element.tagName === 'P' || 
               element.tagName === 'LI' || 
               element.tagName === 'BLOCKQUOTE') {
      element.style.fontSize = 'var(--div-font-size)';
    }
  });
  
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
    
    
    img.src = event.target.result;
  };  
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
  } else {
    volumePopup.classList.add('hidden');
  }
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
}

function createNewDocument(silent = false) {
  if (silent) {
    generateNewDocument()
  } else {
    if (confirm('Are you sure you want to create a new document? This action cannot be undone.')) {
      generateNewDocument()
    }
  }
}

function generateNewDocument() {
  const newId = 'doc_' + Date.now();  
  documents[newId] = {
    id: newId,
    title: 'Untitled Document',
    content: '',
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };  
  currentDocumentId = newId;  
  saveDocumentsToStorage();  
  loadDocument(newId);  
  editor.focus();
}

function saveCurrentDocumentContent() {
  if (!currentDocumentId) return;
  if (!documents[currentDocumentId]) {
    documents[currentDocumentId] = {
      id: currentDocumentId,
      title: 'Untitled Document',
      content: '',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
  }
  const content = editor.innerHTML;
  let title = 'Untitled Document';
  const firstLine = editor.textContent.trim().split('\n')[0];
  if (firstLine) {
    title = firstLine.substring(0, 20);
  }  
  documents[currentDocumentId].title = title;
  documents[currentDocumentId].content = content;
  documents[currentDocumentId].updated = new Date().toISOString();  
  saveDocumentsToStorage();
}

window.saveCurrentDocumentContent = saveCurrentDocumentContent;

function saveCurrentDocument() {
  if (!currentDocumentId) return;  
  saveCurrentDocumentContent();
  const saveBtn = document.getElementById('save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Saved';
  
  setTimeout(() => {
    saveBtn.textContent = originalText;
  }, 1500);
}

function saveDocumentTitle(id, newTitle) {
  if (!id || !documents[id]) return;  
  if (!newTitle.trim()) {
    newTitle = 'Untitled Document';
  }  
  documents[id].title = newTitle;
  documents[id].updated = new Date().toISOString();  
  saveDocumentsToStorage();
}

function saveDocumentsToStorage() {
  try {
    localStorage.setItem('odak_documents', JSON.stringify(documents));
    if (currentDocumentId) {
      localStorage.setItem('odak_current_document', currentDocumentId);
    }
  } catch (error) {
    console.error('Unable to save documents:', error);
    alert('Odak could not save your latest change. Browser storage may be full.');
  }
}

function loadDocument(id) {
  if (!documents[id]) return;
  currentDocumentId = id;
  editor.innerHTML = documents[id].content;
  updateCounter();
  localStorage.setItem('odak_current_document', currentDocumentId);

  if (typeof initDraggableImages === 'function') {
    initDraggableImages(editor);
  }
}

function toggleDocumentsList() {
  
  updateDocumentsList();  
  listPopup.classList.toggle('hidden');
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
    
    const docTitle = document.createElement('div');
    docTitle.className = 'document-title';
    docTitle.textContent = doc.title;
    docTitle.setAttribute('title', 'Double-click to rename');
    
    
    let clickTimer = null;
    let preventSingleClick = false;
    
    docTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (preventSingleClick) {
        return;
      }
      
      
      if (docTitle.contentEditable === 'true') {
        return;
      }
      
      
      if (clickTimer === null) {
        clickTimer = setTimeout(() => {
          clickTimer = null;
          if (!preventSingleClick) {
            
            loadDocument(doc.id);
            listPopup.classList.add('hidden');
          }
        }, 300); 
      }
    });
    
    
    docTitle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      
      
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      
      
      preventSingleClick = true;
      
      
      docTitle.contentEditable = true;
      docTitle.focus();
      
      
      const range = document.createRange();
      range.selectNodeContents(docTitle);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    
    
    docTitle.addEventListener('blur', () => {
      saveDocumentTitle(doc.id, docTitle.textContent.trim());
      docTitle.contentEditable = false;
      
      
      setTimeout(() => {
        preventSingleClick = false;
      }, 300);
    });
    
    docTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        docTitle.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        docTitle.textContent = doc.title; 
        docTitle.contentEditable = false;
        
        
        setTimeout(() => {
          preventSingleClick = false;
        }, 300);
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
      if (confirm('Are you sure you want to delete this document?')) {
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
    
    docActions.appendChild(downloadBtn);
    docActions.appendChild(duplicateBtn);
    docActions.appendChild(deleteBtn);
    
    docItem.appendChild(docTitle);
    docItem.appendChild(docDate);
    docItem.appendChild(docActions);
    
    
    docItem.addEventListener('click', () => {
      loadDocument(doc.id);
      listPopup.classList.add('hidden');
    });
    
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
  
  delete documents[id];  
  saveDocumentsToStorage();  
  updateDocumentsList();  
  if (id === currentDocumentId) {
    createNewDocument(true);
  }
}

function duplicateDocument(id) {
  if (!documents[id]) return;
  const source = documents[id];
  const newId = 'doc_' + Date.now();
  const now = new Date().toISOString();
  documents[newId] = {
    id: newId,
    title: `${source.title || 'Untitled Document'} Copy`,
    content: source.content,
    created: now,
    updated: now
  };
  currentDocumentId = newId;
  saveDocumentsToStorage();
  loadDocument(newId);
  updateDocumentsList();
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
  
  const doc = documents[id];
  const markdownContent = convertToMarkdown(doc.content);  
  const firstLine = markdownContent.split('\n')[0].replace(/^#\s+/, '').trim();
  const fileName = `${sanitizeFileName(firstLine || doc.title).toLowerCase()}.md`;  
  const blob = new Blob([markdownContent], {type: 'text/markdown'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAllDocuments() {
  if (typeof JSZip !== 'undefined') {
    createAndDownloadZip();
    return;
  }

  const bundle = Object.values(documents)
    .map(doc => {
      const title = doc.title || 'Untitled Document';
      return `# ${title}\n\n${convertToMarkdown(doc.content)}`;
    })
    .join('\n\n---\n\n');

  const blob = new Blob([bundle], {type: 'text/markdown'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'odak-writings.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function createAndDownloadZip() {
  const zip = new JSZip();
  const docs = Object.values(documents);  
  docs.forEach(doc => {
    
    const content = doc.content;
    
    const markdown = convertToMarkdown(content);
    
    const firstLine = markdown.split('\n')[0].replace(/^#\s+/, '').trim();
    const fileName = `${sanitizeFileName(firstLine || doc.title)}.md`;
    
    
    zip.file(fileName, markdown);
  });  
  zip.generateAsync({type: 'blob'}).then(blob => {
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'odak-writings.zip';
    document.body.appendChild(a);
    a.click();
    
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });
}

function convertToMarkdown(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  function processNode(node, context = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Create new context for nested ordered lists
      if (tagName === 'ol') {
        context.olCounter = 1;
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
        case 'blockquote': return "\n" + `> ${childContent}` + "\n";
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
            const number = context.olCounter || 1;
            context.olCounter = number + 1;
            return `${number}. ${childContent}\n`;
          } else {
            return `- ${childContent}\n`;
          }
        case 'input':
          return '';
        case 'br':
          return '';
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
    if (result.trim() || (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'hr')) {
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
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    
    
    const newId = 'doc_' + Date.now();
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    
    
    let htmlContent = '';
    if (file.name.endsWith('.md')) {
      htmlContent = convertMarkdownToHtml(content);
    } else {
      
      htmlContent = `<p dir="auto">${content.replace(/\n/g, '</p><p dir="auto">')}</p>`;
    }
    
    
    documents[newId] = {
      id: newId,
      title: fileName,
      content: htmlContent,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    
    currentDocumentId = newId;
    saveDocumentsToStorage();
    loadDocument(newId);
    updateCounter();
  };
  
  reader.readAsText(file);  
  fileInput.value = '';
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

  if (e.button !== 0 || (!e.ctrlKey && !e.metaKey)) return;

  const href = sanitizeUrl(link.getAttribute('href') || '');
  if (!href || href === '#') return;

  window.open(href, '_blank', 'noopener,noreferrer');
}

function renderInlineMarkdown(markdown) {
  const tokens = [];
  let escaped = escapeHtml(markdown)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, src) => {
      const token = `\u0000${tokens.length}\u0000`;
      tokens.push(renderImageMarkdown(alt, src));
      return token;
    })
    .replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g, (match, text, href) => {
      const token = `\u0000${tokens.length}\u0000`;
      tokens.push(`<a href="${escapeHtml(sanitizeUrl(href))}" target="_blank" rel="noopener noreferrer">${text}</a>`);
      return token;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>');

  tokens.forEach((html, index) => {
    escaped = escaped.replace(`\u0000${index}\u0000`, html);
  });

  return escaped;
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
  const lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let listType = '';
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (inList) {
        html += `<${listType} dir="auto">${listItems.join('')}</${listType}>`;
        inList = false;
        listItems = [];
      }
      html += '<div dir="auto"></div>';
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
      const content = line.replace(/^>\s*/, '');
      html += `<blockquote dir="auto">${renderInlineMarkdown(content)}</blockquote>`;
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
    if (/^-\s\[( |x)\]\s(.*)/.test(line)) {
      const match = line.match(/^-\s\[( |x)\]\s(.*)/);
      const checked = match[1] === 'x';
      const content = match[2];
      html += `<div dir="auto"><input type="checkbox" ${checked ? 'checked' : ''} dir="auto"> ${renderInlineMarkdown(content)}</div>`;
      continue;
    }
    
    // Ordered Lists
    if (line.match(/^\d+\.\s/)) {
      if (!inList || listType !== 'ol') {
        if (inList) {
          html += `<${listType} dir="auto">${listItems.join('')}</${listType}>`;
        }
        inList = true;
        listType = 'ol';
        listItems = [];
      }
      const content = line.replace(/^\d+\.\s*/, '');
      listItems.push(`<li dir="auto">${renderInlineMarkdown(content)}</li>`);
      continue;
    }

    // Unordered Lists
    if (line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        if (inList) {
          html += `<${listType} dir="auto">${listItems.join('')}</${listType}>`;
        }
        inList = true;
        listType = 'ul';
        listItems = [];
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
  if (inList) {
    html += `<${listType} dir="auto">${listItems.join('')}</${listType}>`;
  }

  return html;
}

function updateCounter() {
  // Get all text nodes recursively from the editor
  const textNodes = [];
  const walk = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walk.nextNode()) {
    textNodes.push(node.textContent);
  }
  
  // Join all text nodes and normalize whitespace
  const text = textNodes.join(' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = text === '' ? 0 : words.length;
  
  counter.textContent = `${wordCount} words`;
}

function handleShortcuts(e) {
  
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    saveCurrentDocument();
  }  
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    createNewDocument();
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
    if (e.button !== 0) return; // Only left mouse button
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
  if (window.innerWidth <= 768) {
    if (mode == 'hide') {
      toolbar.style.opacity = 0;
      statusBar.style.opacity = 1;
      statusBar.style.bottom = 'env(safe-area-inset-bottom, 0px)';
    } else {
      toolbar.style.opacity = 1;
      statusBar.style.opacity = 1;
      statusBar.style.bottom = 'env(safe-area-inset-bottom, 0px)';
    }
  } else {
    if (mode == 'hide') {
      toolbar.style.opacity = 0;
      toolbar.style.left = '-100px';
      statusBar.style.opacity = 0;
      statusBar.style.bottom = '-100px';
    } else {
      toolbar.style.opacity = 1;
      toolbar.style.left = '5px';
      statusBar.style.opacity = 1;
      statusBar.style.bottom = '0';
    }
  }
}

function toggleInfo() {
  const infoPopup = document.getElementById('info-popup');
  infoPopup.classList.toggle('hidden');
}

function showInfoPopup() {
  const infoPopup = document.getElementById('info-popup');
  infoPopup.classList.remove('hidden');
}

function closeInfoPopup() {
  const infoPopup = document.getElementById('info-popup');
  infoPopup.classList.add('hidden');
}

function closeOpenPopups() {
  [listPopup, settingsPopup, document.getElementById('info-popup')].forEach(popup => {
    if (popup) {
      popup.classList.add('hidden');
    }
  });
}

function handleLetsGo() {
  localStorage.setItem('odak_has_seen_info', 'true');
  closeInfoPopup();
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

document.addEventListener('change', syncCheckboxAttribute);
document.addEventListener('click', syncCheckboxAttribute);

document.addEventListener('DOMContentLoaded', () => {
  init();

  editor.addEventListener('click', () => {
    saveCurrentDocumentContent();
  });
  editor.addEventListener('click', handleEditorLinkClick);
  
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
  document.getElementById('close-list').addEventListener('click', () => listPopup.classList.add('hidden'));
  document.getElementById('close-settings').addEventListener('click', () => settingsPopup.classList.add('hidden'));
  
  // Add event listeners for file inputs
  fileInput.addEventListener('change', handleFileUpload);
  document.getElementById('bg-file-input').addEventListener('change', handleBackgroundUpload);
  
  // Add event listeners for settings controls
  document.getElementById('font-family-select').addEventListener('change', (e) => {
    fontFamily = e.target.value;
    localStorage.setItem('odak_font_family', fontFamily);
    applySettings();
  });
  
  document.getElementById('font-size-slider').addEventListener('input', (e) => {
    fontSize = parseInt(e.target.value);
    localStorage.setItem('odak_font_size', fontSize);
    updateFontSizeLabel();
    applySettings();
  });
  
  document.getElementById('editor-width-input').addEventListener('change', (e) => {
    editorWidth = parseInt(e.target.value);
    localStorage.setItem('odak_editor_width', editorWidth);
    applySettings();
  });
  
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
    });
  });
  
  document.getElementById('volume-slider').addEventListener('input', (e) => {
    soundVolume = parseInt(e.target.value) / 100;
    document.getElementById('volume-value').textContent = e.target.value + '%';
    updateSoundButton();
    Object.values(mediaSounds).flat().forEach(sound => {
      sound.volume = soundVolume / 3;
    });
    localStorage.setItem('odak_sound_volume', soundVolume);
  });

  document.getElementById('close-volume').addEventListener('click', () => {
    document.getElementById('volume-popup').classList.add('hidden');
  });

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
    localStorage.setItem('odak_use_custom_bg', 'false');
    updateBackgroundSelection();
    applyBackground();
  });
  
  document.getElementById('custom-bg').addEventListener('click', () => {
    if (customBackground) {
      useCustomBg = true;
      localStorage.setItem('odak_use_custom_bg', 'true');
      updateBackgroundSelection();
      applyBackground();
    }
  });

  document.getElementById('download-all-btn').addEventListener('click', downloadAllDocuments);

  document.getElementById('documents-search').addEventListener('input', (e) => {
    documentSearchQuery = e.target.value;
    updateDocumentsList();
  });

  document.getElementById('documents-sort').addEventListener('change', (e) => {
    documentSortMode = e.target.value;
    updateDocumentsList();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOpenPopups();
    }
  });

  document.addEventListener('click', (e) => {
    const volumePopup = document.getElementById('volume-popup');
    const soundBtn = document.getElementById('sound-btn');
    if (!volumePopup.contains(e.target) && !soundBtn.contains(e.target)) {
      volumePopup.classList.add('hidden');
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




});
