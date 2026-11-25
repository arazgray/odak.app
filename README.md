<p align="center">
  <img src="https://github.com/arazgray/odak.app/blob/main/assets/images/odak.svg" alt="Odak Logo" height="64"/>
  <h1 align="center" style="display:inline">Odak.app</h1>
</p>

<p align="center">
  <strong>Distraction-free Markdown writing app, fully offline and local-first.</strong><br>
  <strong>Version 3.1</strong><br>
  <a href="https://odak.app">Try it now!</a> | <a href="https://github.com/arazgray/markdown-editor">Powered by WYSIWYG Markdown Editor</a>
</p>

<p align="center">
  <a href="https://github.com/arazgray/odak.app/releases">
    <img src="https://img.shields.io/github/v/release/arazgray/odak.app?label=version&color=brightgreen" alt="Version">
  </a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/github/last-commit/arazgray/odak.app" alt="Last Commit">
  <img src="https://img.shields.io/github/languages/top/arazgray/odak.app" alt="Top Language">
</p>

---

## About

**Odak.app** is a clean, minimalist, and privacy-respecting writing app with **live Markdown rendering**—built to keep you in the flow.  
No accounts, no ads, no cloud, and no distractions. Everything is stored locally on your device.

> Your thoughts deserve a focused space. Odak is it.

---

## Features

- **Distraction-Free UI** – Auto-hides toolbars as you type, with optional nostalgic typewriter sounds  
- **Live Markdown Support** – Create, edit, import, and export Markdown documents
- **Local-First Storage** – All content is saved on your device; no internet or servers required  
- **Writing Library** – Search, sort, duplicate, rename, delete, and bulk-export your local writings  
- **Themes** – Switch between light, dark, and custom "Odak" theme for optimal writing comfort  
- **Custom UI** – Adjust font family, size, and editor width to your taste  
- **Multilingual** – Auto-detects RTL and LTR text for seamless international writing  
- **Layout-Aware Images** – Dragged image position and size can round-trip through Odak Markdown comments  
- **Backgrounds** – Add custom background images for personalized inspiration  
- **Offline-Ready** – Works offline, with PWA support for installation on desktop or mobile  

---

## Version 3.1

Odak 3.1 saves pending edits before switching or exporting, preserves custom titles, and reports storage failures without discarding the open draft. It improves Markdown round-trips, mobile controls, keyboard navigation and offline updates.

Use **Writings → Download backup** to save a local JSON copy of all writings. **Restore backup** adds the recovered writings as copies without replacing existing ones. Use the individual download button for a portable `.md` file. Clearing browser data can erase the local library; remote images still require a connection.

Odak supports headings, bold, italic, its own `__underline__` convention, inline code, fenced code on import/export, lists, checkboxes, quotes, links, images and horizontal rules. It is not a full CommonMark editor. Ctrl/Cmd + click opens an editor link.

Dragged images export as normal Markdown followed by optional Odak metadata comments, so other Markdown readers can ignore the layout data while Odak can restore it:

```md
![alt text](image-url)
<!-- odak:image {"x":120,"y":80,"width":240,"height":180} -->
```

---

## Screenshot

![Odak Screenshot](screenshot.png)

---

## Contributing

Pull requests and feedback are always welcome. Whether it's a typo fix or a major feature idea, your input is appreciated.

To run the regression suite, serve the repository with `python3 -m http.server 8765 --bind 127.0.0.1`, start Chrome with `--remote-debugging-port=9237` and a **fresh, dedicated** `--user-data-dir`, then run `node tests/browser-smoke.mjs` (Node 22+). The suite writes sample documents into that test profile and exercises editing, backups, mobile layout and offline reload.

Support development:

<a href="https://buymeacoffee.com/arazgray">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="200" alt="Buy Me A Coffee">
</a>

---

## License

This project is licensed under the **MIT License**.

---

## Contact

**Araz Gray**  
Email: [contact@arazgray.com](mailto:contact@arazgray.com)  
Website: [arazgray.com](https://arazgray.com)
