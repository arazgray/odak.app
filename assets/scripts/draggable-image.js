(function () {
    const CLASS_WRAPPER = 'imglib-wrapper';
    const CLASS_HANDLE = 'imglib-handle';
    const boundWrappers = new WeakSet();

    function injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
      .${CLASS_WRAPPER} {
        box-sizing: border-box;
        position: absolute;
        display: inline-block;
        z-index: 10;
        border: 1px dashed transparent;
        margin: 0 !important;
      }

      .${CLASS_WRAPPER} img {
        margin: 0 !important;
      }
  
      .${CLASS_WRAPPER}:hover {
        border-color: #aaa;
      }
  
      .${CLASS_HANDLE} {
        position: absolute;
        width: 10px;
        height: 10px;
        right: 0;
        bottom: 0;
        background: #000;
        cursor: se-resize;
        z-index: 20;
        opacity: 0;
        transition: opacity 0.2s;
      }
  
      .${CLASS_WRAPPER}:hover .${CLASS_HANDLE},
      .${CLASS_WRAPPER}:focus-within .${CLASS_HANDLE} {
        opacity: 1;
      }
  
      .imglib-delete {
        position: absolute;
        width: 20px;
        height: 20px;
        right: 0;
        padding-top: 2px;
        top: -10px;
        background: #ff4444;
        border-radius: 50%;
        cursor: pointer;
        z-index: 20;
        opacity: 0;
        transition: opacity 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        font-weight: bold;
        border: 2px solid white;
      }
  
      .${CLASS_WRAPPER}:hover .${CLASS_HANDLE},
      .${CLASS_WRAPPER}:hover .imglib-delete,
      .${CLASS_WRAPPER}:focus-within .imglib-delete {
        opacity: 1;
      }
  
      .${CLASS_WRAPPER}, .${CLASS_HANDLE} { touch-action: none; }
      .${CLASS_HANDLE} { border: 0; padding: 0; width: 24px; height: 24px; }
      @media (max-width: 768px) {
        #editor .${CLASS_WRAPPER} {
          position: relative;
          inset: auto !important;
          display: block;
          max-width: 100%;
          max-height: 50vh;
          touch-action: auto;
        }
        #editor .${CLASS_HANDLE} { display: none; }
        #editor .imglib-delete { top: 0; opacity: 1; width: 32px; height: 32px; }
      }
      `;
      document.head.appendChild(style);
    }

    function parseNumber(value, fallback) {
      const number = parseFloat(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function persistWrapperLayout(wrapper) {
      wrapper.dataset.odakX = String(Math.round(parseNumber(wrapper.style.left, wrapper.offsetLeft)));
      wrapper.dataset.odakY = String(Math.round(parseNumber(wrapper.style.top, wrapper.offsetTop)));
      wrapper.dataset.odakWidth = String(Math.round(wrapper.offsetWidth));
      wrapper.dataset.odakHeight = String(Math.round(wrapper.offsetHeight));
    }

    function requestDocumentSave(editor) {
      editor.dispatchEvent(new Event('odak-change'));
    }

    function bindDragResize(wrapper, editor) {
        if (boundWrappers.has(wrapper)) return;
        boundWrappers.add(wrapper);

        const handle = wrapper.querySelector(`.${CLASS_HANDLE}`);
        if (!handle) return;
      
        const img = wrapper.querySelector('img');
      function changeLayout(x, y, width, resize) {
        const parentWidth = (wrapper.offsetParent || editor).clientWidth;
        if (resize) {
          const ratio = img.naturalWidth / img.naturalHeight || wrapper.offsetWidth / wrapper.offsetHeight || 1;
          width = Math.max(32, Math.min(parentWidth - wrapper.offsetLeft, width));
          wrapper.style.width = `${width}px`;
          wrapper.style.height = `${width / ratio}px`;
        } else {
          wrapper.style.left = `${Math.max(0, Math.min(parentWidth - wrapper.offsetWidth, x))}px`;
          wrapper.style.top = `${Math.max(0, Math.min(editor.scrollHeight - wrapper.offsetHeight, y))}px`;
        }
      }
      let drag = null;
      wrapper.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('.imglib-delete') || drag ||
            matchMedia('(max-width: 768px)').matches) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: wrapper.offsetLeft,
          top: wrapper.offsetTop, width: wrapper.offsetWidth, resize: event.target === handle, changed: false };
        wrapper.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      wrapper.addEventListener('pointermove', event => {
        if (event.pointerId !== drag?.id) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!dx && !dy && !drag.changed) return;
        changeLayout(drag.left + dx, drag.top + dy, drag.width + dx, drag.resize);
        drag.changed = true;
      });
      function finish(event) {
        if (event.pointerId !== drag?.id) return;
        if (drag.changed) {
          persistWrapperLayout(wrapper);
          requestDocumentSave(editor);
        }
        drag = null;
      }
      wrapper.addEventListener('lostpointercapture', finish);
      handle.addEventListener('keydown', event => {
        const deltas = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };
        if (!deltas[event.key]) return;
        const [dx, dy] = deltas[event.key];
        event.preventDefault();
        changeLayout(wrapper.offsetLeft + dx, wrapper.offsetTop + dy,
          wrapper.offsetWidth + (dx || dy), event.shiftKey);
        persistWrapperLayout(wrapper);
        requestDocumentSave(editor);
      });
      }
      
  
    function initDraggableImages(editor) {
      if (!editor) return;

      const images = editor.querySelectorAll('img[data-draggable], .imglib-wrapper > img');
      images.forEach((img) => {
        const existing = img.closest(`.${CLASS_WRAPPER}`);
        if (existing && boundWrappers.has(existing)) return;
        const wrapper = existing || document.createElement('div');
        wrapper.className = CLASS_WRAPPER;
        wrapper.contentEditable = false;
  
        // Calculate dimensions with aspect ratio
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        const aspectRatio = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
        const layout = {
          x: parseNumber(existing?.dataset.odakX ?? img.dataset.odakX, img.offsetLeft),
          y: parseNumber(existing?.dataset.odakY ?? img.dataset.odakY, img.offsetTop),
          width: parseNumber(existing?.dataset.odakWidth ?? img.dataset.odakWidth, img.width || 200),
          height: parseNumber(existing?.dataset.odakHeight ?? img.dataset.odakHeight, null)
        };
        layout.width = Math.max(32, Math.min(1600, layout.width));
        layout.x = Math.max(0, layout.x);
        layout.y = Math.max(0, layout.y);
        if (!layout.height) {
          layout.height = layout.width / aspectRatio;
        }
  
        wrapper.dataset.odakX = String(Math.round(layout.x));
        wrapper.dataset.odakY = String(Math.round(layout.y));
        wrapper.dataset.odakWidth = String(Math.round(layout.width));
        wrapper.dataset.odakHeight = String(Math.round(layout.height));
        wrapper.style.width = layout.width + 'px';
        wrapper.style.height = layout.height + 'px';
        wrapper.style.top = layout.y + 'px';
        wrapper.style.left = `clamp(0px, ${layout.x}px, max(0px, calc(100% - ${layout.width}px)))`;
  
        // Clone and style image
        const newImg = img.cloneNode();
        newImg.style.width = '100%';
        newImg.style.height = '100%';
        newImg.style.objectFit = 'contain';
        newImg.draggable = false;
  
        const handle = document.createElement('button');
        handle.className = CLASS_HANDLE;
        handle.type = 'button';
        handle.setAttribute('aria-label', 'Image layout: arrows move; Shift with arrows resizes');
  
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'imglib-delete';
        deleteBtn.type = 'button';
        deleteBtn.textContent = '×';
        deleteBtn.setAttribute('aria-label', `Remove image${img.alt ? `: ${img.alt}` : ''}`);
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          wrapper.remove();
          requestDocumentSave(editor);
          editor.focus();
        });
  
        if (existing) wrapper.replaceChildren(newImg);
        else {
          img.replaceWith(wrapper);
          wrapper.appendChild(newImg);
        }
        wrapper.appendChild(handle);
        wrapper.appendChild(deleteBtn);

        bindDragResize(wrapper, editor);
      });
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      injectStyles();
      initDraggableImages(document.getElementById('editor'));
    });
  
    window.initDraggableImages = initDraggableImages;
  })();
