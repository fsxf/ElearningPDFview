// ==UserScript==
// @name         复旦 eLearning PDF 预览
// @namespace    https://github.com/fsxf/ElearningPDFview
// @version      0.1.1
// @description  在 SpeedGrader 中直接预览 PDF 提交文件，同时保留原有下载功能。
// @author       fsxf
// @homepageURL  https://github.com/fsxf/ElearningPDFview
// @supportURL   https://github.com/fsxf/ElearningPDFview/issues
// @downloadURL  https://raw.githubusercontent.com/fsxf/ElearningPDFview/main/fudan-elearning-pdf-preview.user.js
// @updateURL    https://raw.githubusercontent.com/fsxf/ElearningPDFview/main/fudan-elearning-pdf-preview.user.js
// @match        https://elearning.fudan.edu.cn/courses/*/gradebook/speed_grader*
// @icon         https://elearning.fudan.edu.cn/favicon.ico
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_ID = 'fdu-elearning-pdf-preview';
  const BUTTON_CLASS = `${SCRIPT_ID}__button`;
  const STYLE_ID = `${SCRIPT_ID}__style`;
  const processedLinks = new Map();
  const observedDocuments = new WeakSet();

  let overlay = null;
  let viewerFrame = null;
  let titleElement = null;
  let statusElement = null;
  let openTabButton = null;
  let downloadLink = null;
  let activeBlobUrl = null;
  let activeRequest = null;
  let activeRequestNumber = 0;

  function injectButtonStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BUTTON_CLASS} {
        appearance: none;
        border: 1px solid #1f6fba;
        border-radius: 4px;
        background: #fff;
        color: #155a96;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.35em;
        font: inherit;
        line-height: 1.25;
        margin-left: 0.5em;
        padding: 0.32em 0.62em;
        vertical-align: middle;
      }
      .${BUTTON_CLASS}:hover {
        background: #eef6fd;
      }
      .${BUTTON_CLASS}:focus-visible {
        outline: 2px solid #1f6fba;
        outline-offset: 2px;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function linkText(link) {
    return [
      link.textContent,
      link.getAttribute('title'),
      link.getAttribute('aria-label'),
      link.getAttribute('download'),
      link.getAttribute('href'),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function isPdfSubmissionLink(link) {
    if (!(link instanceof link.ownerDocument.defaultView.HTMLAnchorElement)) return false;

    let url;
    try {
      url = new URL(link.href, link.ownerDocument.location.href);
    } catch {
      return false;
    }

    if (url.origin !== window.location.origin) return false;

    const isSubmissionDownload =
      /\/courses\/[^/]+\/assignments\/[^/]+\/submissions\/[^/?#]+/i.test(url.pathname) &&
      url.searchParams.has('download');

    return isSubmissionDownload && /\.pdf(?:\s|$|[?#)\]])/i.test(linkText(link));
  }

  function fileNameFor(link) {
    const label = linkText(link).replace(/\s+/g, ' ').trim();
    const match = label.match(/([^/\\]+\.pdf)(?:\s|$|[?#)\]])/i);
    return match ? match[1] : 'PDF 提交文件';
  }

  function normalizedDownloadUrl(link) {
    const url = new URL(link.href, link.ownerDocument.location.href);
    url.searchParams.set('inline', '1');
    return url;
  }

  function addPreviewButton(link) {
    if (processedLinks.has(link)) return;

    const button = link.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.textContent = '预览 PDF';
    button.setAttribute('aria-label', `预览 ${fileNameFor(link)}`);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      previewPdf(link);
    });

    link.insertAdjacentElement('afterend', button);
    processedLinks.set(link, button);
  }

  function removeStaleButtons() {
    for (const [link, button] of processedLinks) {
      if (!link.isConnected || !isPdfSubmissionLink(link)) {
        button.remove();
        processedLinks.delete(link);
      }
    }
  }

  function documentsToScan() {
    const documents = [document];

    for (const frame of document.querySelectorAll('iframe')) {
      try {
        if (frame.contentDocument) documents.push(frame.contentDocument);
      } catch {
        // Cross-origin frames are intentionally ignored.
      }
    }

    return documents;
  }

  function observeDocument(doc) {
    if (observedDocuments.has(doc)) return;
    observedDocuments.add(doc);
    injectButtonStyles(doc);

    const observer = new MutationObserver(scheduleScan);
    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'title', 'aria-label'],
    });
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    window.requestAnimationFrame(() => {
      scanScheduled = false;
      scanForPdfLinks();
    });
  }

  function scanForPdfLinks() {
    removeStaleButtons();

    for (const doc of documentsToScan()) {
      observeDocument(doc);
      for (const link of doc.querySelectorAll('a[href]')) {
        if (isPdfSubmissionLink(link)) addPreviewButton(link);
      }
    }
  }

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = `${SCRIPT_ID}__overlay-host`;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;';
    document.documentElement.appendChild(overlay);

    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light dark; }
        * { box-sizing: border-box; }
        .backdrop {
          align-items: center;
          background: rgba(18, 27, 39, 0.72);
          display: flex;
          height: 100%;
          justify-content: center;
          padding: 2vh 2vw;
          width: 100%;
        }
        .dialog {
          background: #f7f9fb;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.38);
          color: #17212b;
          display: grid;
          grid-template-rows: auto 1fr;
          height: 96vh;
          min-height: 360px;
          overflow: hidden;
          width: min(96vw, 1500px);
        }
        .header {
          align-items: center;
          background: #fff;
          border-bottom: 1px solid #d8dee6;
          display: flex;
          gap: 10px;
          min-height: 52px;
          padding: 8px 12px 8px 16px;
        }
        .title {
          flex: 1;
          font: 600 15px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action {
          align-items: center;
          background: #fff;
          border: 1px solid #b8c1cc;
          border-radius: 4px;
          color: #17212b;
          cursor: pointer;
          display: inline-flex;
          font: 14px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          text-decoration: none;
        }
        .action:hover { background: #eef3f7; }
        .action:focus-visible { outline: 2px solid #1f6fba; outline-offset: 2px; }
        .action[hidden] { display: none; }
        .close { font-size: 21px; min-width: 38px; padding: 0; }
        .content { background: #e7ebef; min-height: 0; position: relative; }
        .status {
          align-items: center;
          background: #fff;
          color: #334155;
          display: flex;
          font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          inset: 0;
          justify-content: center;
          padding: 28px;
          position: absolute;
          text-align: center;
          white-space: pre-line;
          z-index: 1;
        }
        .status[hidden] { display: none; }
        iframe { background: #d8dde3; border: 0; height: 100%; width: 100%; }
        @media (max-width: 700px) {
          .backdrop { padding: 0; }
          .dialog { border-radius: 0; height: 100%; width: 100%; }
          .header { flex-wrap: wrap; }
          .title { flex-basis: 100%; }
        }
      </style>
      <div class="backdrop" role="presentation">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="fdu-pdf-title">
          <header class="header">
            <div class="title" id="fdu-pdf-title">PDF 预览</div>
            <button class="action open-tab" type="button" hidden>新标签页打开</button>
            <a class="action download" hidden>下载原文件</a>
            <button class="action close" type="button" aria-label="关闭预览">×</button>
          </header>
          <div class="content">
            <div class="status">正在载入 PDF…</div>
            <iframe title="PDF 预览"></iframe>
          </div>
        </section>
      </div>
    `;

    titleElement = shadow.querySelector('.title');
    statusElement = shadow.querySelector('.status');
    viewerFrame = shadow.querySelector('iframe');
    openTabButton = shadow.querySelector('.open-tab');
    downloadLink = shadow.querySelector('.download');

    shadow.querySelector('.close').addEventListener('click', closeOverlay);
    shadow.querySelector('.backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('backdrop')) closeOverlay();
    });
    openTabButton.addEventListener('click', () => {
      if (activeBlobUrl) window.open(activeBlobUrl, '_blank', 'noopener');
    });
  }

  function revokeActiveBlob() {
    if (!activeBlobUrl) return;
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }

  function closeOverlay() {
    if (!overlay) return;
    if (activeRequest) activeRequest.abort();
    activeRequest = null;
    activeRequestNumber += 1;
    viewerFrame.src = 'about:blank';
    overlay.style.display = 'none';
    document.documentElement.style.overflow = '';
    revokeActiveBlob();
  }

  function showOverlay(fileName, originalUrl) {
    createOverlay();
    if (activeRequest) activeRequest.abort();
    activeRequest = null;
    viewerFrame.src = 'about:blank';
    revokeActiveBlob();

    titleElement.textContent = fileName;
    statusElement.hidden = false;
    statusElement.textContent = '正在载入 PDF…';
    openTabButton.hidden = true;
    downloadLink.hidden = false;
    downloadLink.href = originalUrl;
    downloadLink.textContent = '下载原文件';
    overlay.style.display = 'block';
    document.documentElement.style.overflow = 'hidden';
  }

  function byteSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function looksLikePdf(buffer) {
    const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024));
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

    for (let offset = 0; offset <= bytes.length - signature.length; offset += 1) {
      if (signature.every((value, index) => bytes[offset + index] === value)) return true;
    }
    return false;
  }

  async function previewPdf(link) {
    let url;
    try {
      url = normalizedDownloadUrl(link);
    } catch {
      window.alert('无法识别这个 PDF 链接。');
      return;
    }

    const fileName = fileNameFor(link);
    showOverlay(fileName, link.href);

    const requestNumber = ++activeRequestNumber;
    activeRequest = new AbortController();

    try {
      const response = await fetch(url.href, {
        credentials: 'same-origin',
        redirect: 'follow',
        signal: activeRequest.signal,
        headers: {
          Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.1',
        },
      });

      if (!response.ok) {
        throw new Error(`服务器返回 ${response.status} ${response.statusText}`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const buffer = await response.arrayBuffer();

      if (requestNumber !== activeRequestNumber) return;
      if (!contentType.includes('pdf') && !looksLikePdf(buffer)) {
        const loginHint = contentType.includes('text/html')
          ? '\n登录状态可能已经失效，请刷新页面并重新登录。'
          : '';
        throw new Error(`返回的内容不是 PDF（${contentType || '未知类型'}）。${loginHint}`);
      }

      const blob = new Blob([buffer], { type: 'application/pdf' });
      activeBlobUrl = URL.createObjectURL(blob);
      viewerFrame.src = `${activeBlobUrl}#toolbar=1&navpanes=0&view=FitH`;
      statusElement.hidden = true;
      openTabButton.hidden = false;
      titleElement.textContent = `${fileName} · ${byteSize(blob.size)}`;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (requestNumber !== activeRequestNumber) return;

      statusElement.hidden = false;
      statusElement.textContent = [
        'PDF 预览失败。',
        error instanceof Error ? error.message : String(error),
        '',
        '你仍可以使用右上角的“下载原文件”。',
      ].join('\n');
    } finally {
      if (requestNumber === activeRequestNumber) activeRequest = null;
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay && overlay.style.display !== 'none') {
      closeOverlay();
    }
  });

  scanForPdfLinks();
  window.setInterval(scanForPdfLinks, 1500);
})();
