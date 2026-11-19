/* Shared UI for /ai-pdf-detector and /ai-resume-detector. Needs pdf-lib.min.js and pdf-clean.js. */
(function () {
  const MAX_BYTES = 100 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  const dropZone = $('dropZone');
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
  ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.add('bg-brand-100/80', 'border-brand-600')));
  ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('bg-brand-100/80', 'border-brand-600')));
  dropZone.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
  dropZone.addEventListener('click', e => { if (e.target === dropZone) $('fileInput').click(); });
  $('fileInput').addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; });

  const VERDICTS = {
    ai: { icon: '!', box: 'bg-red-100 text-red-600', text: 'text-red-600', title: 'AI signals found', sub: 'This file\'s own data says AI was involved. See the evidence below.' },
    provenance: { icon: 'i', box: 'bg-amber-100 text-amber-600', text: 'text-amber-600', title: 'Provenance data found', sub: 'Content Credentials are attached, but they don\'t explicitly say AI was used.' },
    none: { icon: '✓', box: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-600', title: 'No AI signals in the file', sub: 'Nothing in this PDF\'s data says AI was used. Most AI tools don\'t label PDFs, so this doesn\'t prove a person wrote it.' },
    error: { icon: '!', box: 'bg-red-100 text-red-600', text: 'text-red-600', title: 'Could not read this PDF', sub: '' }
  };

  function setVerdict(key, sub) {
    const v = VERDICTS[key];
    $('resultsContainer').classList.remove('hidden');
    $('statusIcon').className = 'w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl font-bold ' + v.box;
    $('statusIcon').textContent = v.icon;
    $('statusTitle').className = 'text-xl font-extrabold ' + v.text;
    $('statusTitle').textContent = v.title;
    $('statusSub').textContent = sub || v.sub;
  }

  function showError(msg) {
    setVerdict('error', msg);
    $('fileLine').textContent = '';
    ['evidenceCard', 'madeWithCard', 'checkedCard'].forEach(id => $(id).classList.add('hidden'));
    $('uploadStatusText').textContent = 'Drag and drop your PDF here';
  }

  async function handleFile(file) {
    if (!(/\.pdf$/i.test(file.name) || file.type === 'application/pdf')) return showError('Please choose a PDF file (.pdf).');
    if (file.size > MAX_BYTES) return showError('This file is larger than 100 MB.');
    $('uploadStatusText').textContent = 'Checking ' + file.name + '…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await loadPdfEngine();
      const r = await PdfClean.detect(bytes);
      render(r, file);
      $('uploadStatusText').textContent = 'Drop another PDF to check it';
      $('resultsContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'ai_pdf_check', verdict: r.verdict, page_path: window.location.pathname });
    } catch (err) {
      showError(err && (err.code === 'ENCRYPTED' || err.code === 'ENGINE') ? err.message : 'This file could not be read as a PDF. It may be damaged or not a real PDF.');
    }
  }

  function render(r, file) {
    setVerdict(r.verdict);
    $('fileLine').textContent = `${file.name} · ${fmtSize(file.size)} · ${r.pages} page${r.pages === 1 ? '' : 's'}`;

    // Evidence
    const items = r.signals.map(s => `
      <div class="border rounded-2xl p-4 ${s.level === 'strong' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}">
        <p class="font-bold text-sm ${s.level === 'strong' ? 'text-red-800' : 'text-amber-800'}">${esc(s.title)}</p>
        <p class="text-sm mt-0.5 ${s.level === 'strong' ? 'text-red-700' : 'text-amber-700'} break-words">${esc(s.detail)}</p>
      </div>`).concat(r.notes.map(n => `
      <div class="border rounded-2xl p-4 bg-slate-50 border-slate-200">
        <p class="font-bold text-sm text-slate-800">${esc(n.title)}</p>
        <p class="text-sm mt-0.5 text-slate-600">${esc(n.detail)}</p>
      </div>`));
    $('evidenceList').innerHTML = items.length ? items.join('') : '<p class="text-sm text-slate-500">No AI labels, AI tool names or AI-labelled images were found in this file.</p>';
    $('evidenceCard').classList.remove('hidden');

    // What made it
    const made = r.madeWith || [];
    $('madeWithList').innerHTML = made.map(m => `
      <div class="text-sm">
        <p class="font-semibold text-slate-800">${esc(m.meaning || 'Software not in our list of common apps.')}</p>
        <p class="text-xs text-slate-500 break-all mt-0.5">${esc(m.role)}: <code class="bg-slate-100 px-1 rounded">${esc(m.raw)}</code></p>
      </div>`).join('') || '<p class="text-sm text-slate-500">This PDF doesn\'t name the app that made it.</p>';
    $('madeWithCard').classList.remove('hidden');

    // What was checked
    const meta = r.report.total;
    $('checkedList').innerHTML = [
      'The app and software named in the document properties',
      'Hidden XMP data, including AI source fields',
      'C2PA Content Credentials attached to the PDF',
      `${r.imagesChecked} photo${r.imagesChecked === 1 ? '' : 's'} inside the PDF (C2PA, IPTC, EXIF and XMP)`
    ].map(t => `<li>${esc(t)}</li>`).join('');
    $('removeHint').innerHTML = meta
      ? `This PDF also carries ${meta} other metadata item${meta === 1 ? '' : 's'} (author, software, dates and more). <a href="/remove-pdf-metadata" class="text-brand-600 font-semibold hover:underline">Remove them with the PDF Metadata Remover</a>.`
      : 'This PDF has no other hidden metadata.';
    $('checkedCard').classList.remove('hidden');
  }
})();
