/**
 * WYSIWYG Markdown Editor
 * v=4.0
 * A lightweight, real-time markdown editor with live rendering and LTR-RTL support
 * Usage: MarkdownEditor.init('your-div-id');
 * Author: Araz Gholami @arazgholami
 * Email: contact@arazgholami.com
 */

class MarkdownEditor {
    constructor(element) {
        this.editor = element;
        this.isProcessing = false;
        this.checkboxSelectionBeforeToggle = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.editor.addEventListener('mousedown', (e) => {
            this.handleCheckboxMouseDown(e);
        });
        this.editor.addEventListener('click', (e) => {
            this.handleCheckboxClick(e);
        });
        this.editor.addEventListener('input', (e) => {
            this.handleInput(e);
        });
        this.editor.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        this.editor.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleCheckboxMouseDown(e) {
        if (!e.target.matches('input[type="checkbox"]')) return;

        const selection = window.getSelection();
        this.checkboxSelectionBeforeToggle = selection.rangeCount > 0
            ? selection.getRangeAt(0).cloneRange()
            : null;

        e.preventDefault();
    }

    handleCheckboxClick(e) {
        if (!e.target.matches('input[type="checkbox"]')) return;

        if (this.checkboxSelectionBeforeToggle) {
            const selection = window.getSelection();
            try {
                this.editor.focus({ preventScroll: true });
            } catch (error) {
                this.editor.focus();
            }
            selection.removeAllRanges();
            selection.addRange(this.checkboxSelectionBeforeToggle);
        }

        this.checkboxSelectionBeforeToggle = null;
    }

    handleInput(e) {
        if (this.isProcessing) return;

        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        this.normalizeCheckboxPlaceholder(range);

        if (range.startContainer === this.editor ||
            (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode === this.editor)) {
            const div = document.createElement('div');
        div.setAttribute('dir', 'auto');

        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            div.appendChild(range.startContainer.cloneNode(true));
            this.editor.removeChild(range.startContainer);
        } else {
            div.innerHTML = '<br>';
        }
        this.editor.appendChild(div);
        this.setCursorAtEnd(div);
        return;
            }

            const textContent = range.startContainer.textContent || '';
            const cursorPos = range.startOffset;

            this.processMarkdown(textContent, cursorPos, range);
    }

    handleKeyDown(e) {
        if (e.key === 'Backspace') {
            this.handleBackspace(e);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);
            const textContent = range.startContainer.textContent || '';
            
            if (textContent.trim() === '---') {
                this.createHorizontalRule(range.startContainer);
                return;
            }
        
            if (e.shiftKey) {
                let currentElement = range.startContainer;
                if (currentElement.nodeType === Node.TEXT_NODE) {
                    currentElement = currentElement.parentElement;
                }
                if (currentElement.tagName === 'BLOCKQUOTE') {
                    const br = document.createElement('br');
                    if (range.startContainer.nodeType === Node.TEXT_NODE) {
                        const text = range.startContainer.textContent;
                        const beforeText = text.substring(0, range.startOffset);
                        const afterText = text.substring(range.startOffset);
                        const beforeNode = document.createTextNode(beforeText);
                        const afterNode = document.createTextNode(afterText);
                        const parent = range.startContainer.parentNode;
                        parent.replaceChild(beforeNode, range.startContainer);
                        parent.insertBefore(br, beforeNode.nextSibling);
                        const nbsp = document.createTextNode('\u00A0');
                        parent.insertBefore(nbsp, br.nextSibling);
                        parent.insertBefore(afterNode, nbsp.nextSibling);
                        range.setStart(afterNode, 0);
                        range.setEnd(afterNode, 0);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } else {
                        currentElement.appendChild(br);
                        const nbsp = document.createTextNode('\u00A0');
                        currentElement.appendChild(nbsp);
                        this.setCursorAfter(nbsp);
                    }
                    return;
                }
            }
        
            // Find the closest list item by traversing up the DOM
            let currentElement = range.startContainer;
            if (currentElement.nodeType === Node.TEXT_NODE) {
                currentElement = currentElement.parentElement;
            }
            
            let listItem = null;
            let temp = currentElement;
            while (temp && temp !== this.editor) {
                if (temp.tagName === 'LI') {
                    listItem = temp;
                    break;
                }
                temp = temp.parentElement;
            }
        
            // Handle checkbox items
            const checkboxContainer = this.findCheckboxContainer(currentElement);
            if (checkboxContainer) {
                const checkboxText = this.getCheckboxText(checkboxContainer);
                if (checkboxText.trim() === '') {
                    const div = document.createElement('div');
                    div.setAttribute('dir', 'auto');
                    div.innerHTML = '<br>';
                    if (checkboxContainer.nextSibling) {
                        checkboxContainer.parentNode.insertBefore(div, checkboxContainer.nextSibling);
                    } else {
                        checkboxContainer.parentNode.appendChild(div);
                    }
                    checkboxContainer.parentNode.removeChild(checkboxContainer);
                    this.setCursorAtEnd(div);
                    return;
                } else {
                    this.createNewCheckboxItem(checkboxContainer);
                    return;
                }
            }
        
            // Handle list items (both UL and OL)
            if (listItem) {
                // Get the text content of the list item, excluding any nested elements
                const listItemText = this.getListItemTextContent(listItem);
                
                if (listItemText.trim() === '') {
                    // Exit the list - create a new div
                    const div = document.createElement('div');
                    div.setAttribute('dir', 'auto');
                    div.innerHTML = '<br>';
                    const list = listItem.parentNode;
                    if (list.nextSibling) {
                        list.parentNode.insertBefore(div, list.nextSibling);
                    } else {
                        list.parentNode.appendChild(div);
                    }
                    list.removeChild(listItem);
                    if (list.children.length === 0) {
                        list.parentNode.removeChild(list);
                    }
                    this.setCursorAtEnd(div);
                    return;
                } else {
                    // Create a new list item
                    const newLi = document.createElement('li');
                    newLi.setAttribute('dir', 'auto');
                    
                    // Handle splitting text if cursor is in the middle
                    if (range.startContainer.nodeType === Node.TEXT_NODE) {
                        const textNode = range.startContainer;
                        const offset = range.startOffset;
                        const beforeText = textNode.textContent.substring(0, offset);
                        const afterText = textNode.textContent.substring(offset);
                        
                        // Update current list item with text before cursor
                        textNode.textContent = beforeText;
                        
                        // Add remaining text to new list item
                        if (afterText.length > 0) {
                            newLi.textContent = afterText;
                        } else {
                            newLi.innerHTML = '<br>';
                        }
                    } else {
                        newLi.innerHTML = '<br>';
                    }
                    
                    const list = listItem.parentNode;
                    if (listItem.nextSibling) {
                        list.insertBefore(newLi, listItem.nextSibling);
                    } else {
                        list.appendChild(newLi);
                    }
                    this.setCursorAtStart(newLi);
                    return;
                }
            }
        
            // Handle regular text - create new line
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const textNode = range.startContainer;
                const offset = range.startOffset;
                const beforeText = textNode.textContent.substring(0, offset);
                const afterText = textNode.textContent.substring(offset);
        
                const newDiv = document.createElement('div');
                newDiv.setAttribute('dir', 'auto');
                if (afterText.length > 0) {
                    newDiv.textContent = afterText;
                } else {
                    newDiv.innerHTML = '<br>';
                }
        
                let parentBlock = textNode.parentNode;
                while (parentBlock && parentBlock.parentNode !== this.editor) {
                    parentBlock = parentBlock.parentNode;
                }
        
                if (parentBlock && parentBlock.parentNode === this.editor) {
                    if (parentBlock.nextSibling) {
                        this.editor.insertBefore(newDiv, parentBlock.nextSibling);
                    } else {
                        this.editor.appendChild(newDiv);
                    }
                } else {
                    this.editor.appendChild(newDiv);
                }
        
                textNode.textContent = beforeText;
                this.setCursorAtStart(newDiv);
                return;
            }
        
            // Default case - create new div
            const div = document.createElement('div');
            div.setAttribute('dir', 'auto');
            div.innerHTML = '<br>';
            let container = range.startContainer;
            while (container && container !== this.editor && container.parentNode !== this.editor) {
                container = container.parentNode;
            }
            if (container === this.editor) {
                this.editor.appendChild(div);
            } else if (container && container.parentNode === this.editor) {
                if (container.nextSibling) {
                    this.editor.insertBefore(div, container.nextSibling);
                } else {
                    this.editor.appendChild(div);
                }
            } else {
                this.editor.appendChild(div);
            }
            this.setCursorAtEnd(div);
        }
    }

    findCheckboxContainer(element) {
        let current = element;
        while (current && current !== this.editor) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const checkbox = current.querySelector('input[type="checkbox"]');
                if (checkbox && current.parentNode === this.editor) {
                    return current;
                }
            }
            current = current.parentNode;
        }
        return null;
    }

    getCheckboxText(container) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node.textContent);
        }
        
        return textNodes.join('').replace(/\u200B/g, '');
    }

    normalizeCheckboxPlaceholder(range) {
        if (range.startContainer.nodeType !== Node.TEXT_NODE) return;

        const textNode = range.startContainer;
        if (!textNode.textContent.includes('\u200B')) return;

        const checkboxContainer = this.findCheckboxContainer(textNode.parentElement);
        if (!checkboxContainer) return;

        const normalizedText = textNode.textContent.replace(/\u200B/g, '');
        if (normalizedText.length === 0) return;

        const offset = Math.max(
            0,
            range.startOffset - (textNode.textContent.slice(0, range.startOffset).match(/\u200B/g) || []).length
        );

        textNode.textContent = normalizedText;
        range.setStart(textNode, Math.min(offset, textNode.textContent.length));
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    createNewCheckboxItem(currentContainer) {
        const div = document.createElement('div');
        div.setAttribute('dir', 'auto');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        
        const textNode = document.createTextNode('\u200B');
        
        div.appendChild(checkbox);
        div.appendChild(textNode);
        
        if (currentContainer.nextSibling) {
            currentContainer.parentNode.insertBefore(div, currentContainer.nextSibling);
        } else {
            currentContainer.parentNode.appendChild(div);
        }
        
        this.setCursorAtEnd(textNode);
    }

    handleKeyUp(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            this.handleArrowEscape();
        }
    }

    processMarkdown(text, cursorPos, range) {
        this.isProcessing = true;

        const patterns = [
            { regex: /`([^`]+)`/, handler: (match) => this.createInlineCode(text, match, range.startContainer), minPos: (match) => text.indexOf(match[0]) + match[0].length },
            { regex: /^-\s\[x\]\s(.*)/, handler: (match) => this.createCheckbox(match[1], range.startContainer, true), minPos: 6 },
            { regex: /^-\s\[\s?\]\s(.*)/, handler: (match) => this.createCheckbox(match[1], range.startContainer, false), minPos: 5 },
            { regex: /^(#{1,6})\s(.*)$/, handler: (match) => this.replaceWithElement(`h${match[1].length}`, match[2], range.startContainer), minPos: (match) => match[1].length + 1 },
            { regex: /^>\s(.+)$/, handler: (match) => this.createBlockquote(match[1], range.startContainer), minPos: 2 },
            { regex: /^---\s*$/, handler: (match) => this.createHorizontalRule(range.startContainer), minPos: 3 },
            { regex: /!\[([^\]]*)\]\(([^)\s]+)\)/, handler: (match) => this.createImage(match[1], match[2], text, range.startContainer), minPos: (match) => text.indexOf(match[0]) + match[0].length },
            { regex: /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/, handler: (match) => this.createLink(match[1], match[2], text, range.startContainer), minPos: (match) => text.indexOf(match[0]) + match[0].length },
            { regex: /\*\*(.*?)\*\*/, handler: (match) => this.replaceInlineMarkdown(text, match, 'strong', range.startContainer), minPos: (match) => text.indexOf(match[0]) + match[0].length },
            { regex: /(?<!\*)\*([^*]+)\*(?!\*)/, handler: (match) => this.replaceInlineMarkdown(text, match, 'em', range.startContainer), minPos: (match) => text.indexOf(match[0]) + match[0].length },
            { regex: /__(.+?)__/, handler: (match) => this.replaceInlineMarkdown(text, match, 'u', range.startContainer), minPos: (match) => text.indexOf(match[0]) + match[0].length },
            { regex: /^(\d+)\.\s(.+)$/, handler: (match) => this.createOrderedListItem(match[2], range.startContainer), minPos: (match) => match[1].length + 2 },
            { regex: /^-\s(?!\[)(.+)$/, handler: (match) => this.createListItem(match[1], range.startContainer), minPos: 2 }
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const minPos = typeof pattern.minPos === 'function' ? pattern.minPos(match) : pattern.minPos;
                if (cursorPos > minPos) {
                    pattern.handler(match);
                    this.isProcessing = false;
                    return;
                }
            }
        }

        this.isProcessing = false;
    }

    replaceWithElement(tagName, content, textNode) {
        const element = document.createElement(tagName);
        element.textContent = content;

        const parent = textNode.parentNode;
        parent.replaceChild(element, textNode);

        this.setCursorAtEnd(element);
    }

    createBlockquote(content, textNode) {
        const blockquote = document.createElement('blockquote');
        blockquote.setAttribute('dir', 'auto');
        blockquote.textContent = content;

        const parent = textNode.parentNode;
        parent.replaceChild(blockquote, textNode);

        this.setCursorAtEnd(blockquote);
    }

    createInlineCode(text, match, textNode) {
        const code = document.createElement('code');
        code.setAttribute('dir', 'auto');
        code.textContent = match[1];

        this.insertElementWithText(code, text, match[0], textNode);
    }

    replaceInlineMarkdown(text, match, tagName, textNode) {
        const element = document.createElement(tagName);
        element.setAttribute('dir', 'auto');
        element.textContent = match[1];

        this.insertElementWithText(element, text, match[0], textNode);
    }

    insertElementWithText(element, text, matchText, textNode) {
        const beforeText = text.substring(0, text.indexOf(matchText));
        const afterText = text.substring(text.indexOf(matchText) + matchText.length);

        const parent = textNode.parentNode;

        if (beforeText) {
            const beforeNode = document.createTextNode(beforeText);
            parent.insertBefore(beforeNode, textNode);
        }

        parent.insertBefore(element, textNode);

        if (afterText) {
            const afterNode = document.createTextNode(afterText);
            parent.insertBefore(afterNode, textNode);
        }

        parent.removeChild(textNode);
        this.setCursorAfter(element);
    }

    createListItem(content, textNode) {
        const li = document.createElement('li');
        li.setAttribute('dir', 'auto');
        li.textContent = content;

        const parent = textNode.parentNode;

        let ul = null;

        if (parent.previousElementSibling && parent.previousElementSibling.tagName === 'UL') {
            ul = parent.previousElementSibling;
        }

        if (!ul) {
            ul = document.createElement('ul');
            ul.setAttribute('dir', 'auto');
            parent.parentNode.insertBefore(ul, parent);
        }

        ul.appendChild(li);
        parent.parentNode.removeChild(parent);

        this.setCursorAtEnd(li);
    }

    createOrderedListItem(content, textNode) {
        const li = document.createElement('li');
        li.setAttribute('dir', 'auto');
        li.textContent = content;

        const parent = textNode.parentNode;
        let ol = null;

        if (parent.previousElementSibling && parent.previousElementSibling.tagName === 'OL') {
            ol = parent.previousElementSibling;
        }

        if (!ol) {
            ol = document.createElement('ol');
            ol.setAttribute('dir', 'auto');
            parent.parentNode.insertBefore(ol, parent);
        }

        ol.appendChild(li);
        parent.parentNode.removeChild(parent);

        this.setCursorAtEnd(li);
    }

    createCheckbox(content, textNode, checked = false) {
        const checkbox = document.createElement('input');
        checkbox.setAttribute('dir', 'auto');
        checkbox.type = 'checkbox';
        if (checked) {
            checkbox.setAttribute('checked', '');
            checkbox.checked = true;
        }

        const hasContent = content.length > 0;
        const labelText = document.createTextNode(hasContent ? content : '\u200B');

        const parent = textNode.parentNode;
        parent.insertBefore(checkbox, textNode);
        parent.insertBefore(labelText, textNode);
        parent.removeChild(textNode);

        this.setCursorAtEnd(labelText);
    }

    createLink(text, url, fullText, textNode) {
        const link = document.createElement('a');
        link.href = this.sanitizeUrl(url);
        link.textContent = text;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const match = fullText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        this.insertElementWithText(link, fullText, match[0], textNode);
    }

    createImage(alt, src, fullText, textNode) {
        const img = document.createElement('img');
        img.src = this.sanitizeUrl(src, true);
        img.alt = alt;
        img.setAttribute('data-draggable', '');

        const match = fullText.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        this.insertElementWithText(img, fullText, match[0], textNode);
        if (typeof initDraggableImages === 'function') {
            if (img.complete) {
                initDraggableImages(this.editor);
            } else {
                img.addEventListener('load', () => initDraggableImages(this.editor), { once: true });
            }
        }
    }

    sanitizeUrl(url, allowDataImage = false) {
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

    createHorizontalRule(textNode) {
        const hr = document.createElement('hr');

        const parent = textNode.parentNode;
        parent.replaceChild(hr, textNode);

        const div = document.createElement('div');
        div.setAttribute('dir', 'auto');
        div.innerHTML = '<br>';
        parent.insertBefore(div, hr.nextSibling);

        this.setCursorAtEnd(div);
    }

    handleBackspace(e) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const element = range.startContainer.parentElement;
            const textContent = range.startContainer.textContent;
            if (range.startOffset === textContent.length && this.isBackspaceRevertibleElement(element)) {
                e.preventDefault();
                this.convertToPlain(element);
                return;
            }
        } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            const element = range.startContainer;
            if (this.isBackspaceRevertibleElement(element)) {
                const textNode = element.firstChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE && range.startOffset === textNode.textContent.length) {
                    e.preventDefault();
                    this.convertToPlain(element);
                    return;
                }
            }

            const prevElement = range.startContainer.childNodes[range.startOffset - 1];
            if (prevElement && this.isBackspaceRevertibleElement(prevElement)) {
                e.preventDefault();
                this.convertToPlain(prevElement);
                return;
            }
        }
    }

    handleArrowEscape() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const element = range.startContainer.parentElement;

        if (this.isStyledElement(element) && range.startOffset === range.startContainer.textContent.length) {
            this.setCursorAfter(element);
        }
    }

    isStyledElement(element) {
        return ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'EM', 'U', 'CODE', 'LI', 'BLOCKQUOTE', 'A', 'IMG', 'HR'].includes(element.tagName);
    }

    isBackspaceRevertibleElement(element) {
        return ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'EM', 'U', 'CODE', 'BLOCKQUOTE', 'A', 'IMG', 'HR'].includes(element.tagName);
    }

    convertToPlain(element) {
        const text = element.textContent;
        const plain = text;

        if (element.tagName === 'LI') {
            const parentList = element.parentElement;
            const div = document.createElement('div');
            div.setAttribute('dir', 'auto');
            div.textContent = plain;
            if (parentList.nextSibling) {
                parentList.parentNode.insertBefore(div, parentList.nextSibling);
            } else {
                parentList.parentNode.appendChild(div);
            }
            parentList.removeChild(element);
            if (parentList.children.length === 0) {
                parentList.parentNode.removeChild(parentList);
            }
            this.setCursorAtEnd(div.childNodes[0] || div);
            return;
        }

        const textNode = document.createTextNode(plain);
        element.parentNode.replaceChild(textNode, element);
        this.setCursorAtEnd(textNode);
    }

    setCursorAtEnd(element) {
        const range = document.createRange();
        const selection = window.getSelection();

        if (element.nodeType === Node.TEXT_NODE) {
            range.setStart(element, element.textContent.length);
        } else {
            range.selectNodeContents(element);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    setCursorAfter(element) {
        const range = document.createRange();
        const selection = window.getSelection();

        range.setStartAfter(element);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    setCursorAtStart(element) {
        const range = document.createRange();
        const selection = window.getSelection();

        if (element.nodeType === Node.TEXT_NODE) {
            range.setStart(element, 0);
        } else {
            range.selectNodeContents(element);
            range.collapse(true);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    static init(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element with id "${elementId}" not found`);
            return null;
        }

        element.setAttribute('contenteditable', 'true');
        element.setAttribute('spellcheck', 'false');
        element.setAttribute('dir', 'auto');

        if (options.placeholder) {
            element.setAttribute('placeholder', options.placeholder);
        }

        if (options.autofocus !== false) {
            element.focus();
        }

        return new MarkdownEditor(element);
    }

    getListItemTextContent(listItem) {
        // Get only the direct text content of the list item, not nested elements
        let text = '';
        for (let child of listItem.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            }
        }
        return text;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const autoElements = document.querySelectorAll('[data-markdown-editor]');
    autoElements.forEach(element => {
        const options = {
            placeholder: element.getAttribute('placeholder'),
                         autofocus: element.getAttribute('data-autofocus') !== 'false'
        };
        MarkdownEditor.init(element.id, options);
    });
});

window.MarkdownEditor = MarkdownEditor;
