/*
 * Shared "Remove AI & Download" flow for every TryMetaClear tool page.
 * Shows a real progress bar (upload -> cleaning -> download) and a success
 * message once the cleaned file has been saved.
 *
 * Usage: cleanAndDownload({ file, endpoint, button, anchor })
 *   file     - the File the user uploaded
 *   endpoint - the /api/v1/clean URL
 *   button   - the download button (disabled while running)
 *   anchor   - element the status panel is placed after (defaults to the button's card)
 */
(function () {
  const PANEL_ID = 'cleanStatusPanel';

  function removePanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();
  }

  function buildPanel(anchor) {
    removePanel();
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.className = 'bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-4 space-y-3';
    panel.innerHTML = `
      <div class="flex items-center justify-between text-sm font-bold text-slate-800">
        <span data-label>Uploading your file...</span>
        <span data-pct class="text-blue-600">0%</span>
      </div>
      <div class="w-full bg-slate-200 h-3 rounded-full overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-track>
        <div data-bar class="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out" style="width:0%"></div>
      </div>
      <p data-note class="text-xs text-slate-500">Please keep this page open until your download starts.</p>
    `;
    anchor.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function setProgress(panel, pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    panel.querySelector('[data-bar]').style.width = pct + '%';
    panel.querySelector('[data-pct]').textContent = pct + '%';
    panel.querySelector('[data-track]').setAttribute('aria-valuenow', String(pct));
    if (label) panel.querySelector('[data-label]').textContent = label;
  }

  function showSuccess(panel, fileName) {
    panel.className = 'bg-emerald-50 p-6 rounded-2xl border border-emerald-200 mt-4 flex items-start gap-4';
    panel.innerHTML = `
      <div class="w-10 h-10 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold" aria-hidden="true">&#10003;</div>
      <div>
        <p class="font-extrabold text-emerald-800 text-base">AI label cleaned and downloaded</p>
        <p class="text-xs text-emerald-700 mt-1">Saved as <span data-name class="font-semibold break-all"></span>. Check your Downloads folder.</p>
      </div>
    `;
    panel.querySelector('[data-name]').textContent = fileName; // textContent: file names are user input
  }

  function showError(panel) {
    panel.className = 'bg-rose-50 p-6 rounded-2xl border border-rose-200 mt-4';
    panel.innerHTML = `
      <p class="font-extrabold text-rose-700 text-base">Something went wrong</p>
      <p class="text-xs text-rose-600 mt-1">We couldn't clean this file. Please check your connection and try again.</p>
    `;
  }

  window.cleanAndDownload = function ({ file, endpoint, button, anchor }) {
    if (!file || !button || button.disabled) return;

    const originalHtml = button.innerHTML;
    const outName = `cleared_${file.name}`;
    const panel = buildPanel(anchor || button.closest('.rounded-2xl, .rounded-3xl') || button);

    button.disabled = true;
    button.innerHTML = '<span>Cleaning...</span>';

    // Phases: upload 0-40%, server cleaning 40-80% (estimated), download 80-100%.
    let creep = null;
    const stopCreep = () => { if (creep) { clearInterval(creep); creep = null; } };
    const startCreep = (from, to, label) => {
      stopCreep();
      let pct = from;
      setProgress(panel, pct, label);
      creep = setInterval(() => {
        pct += (to - pct) * 0.08;   // eases toward `to` without reaching it
        setProgress(panel, pct);
      }, 200);
    };
    const finish = () => { stopCreep(); button.disabled = false; button.innerHTML = originalHtml; };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.responseType = 'blob';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(panel, (e.loaded / e.total) * 40, 'Uploading your file...');
    };
    xhr.upload.onload = () => startCreep(40, 78, 'Removing AI metadata...');

    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        stopCreep();
        setProgress(panel, 80 + (e.loaded / e.total) * 20, 'Preparing your download...');
      } else if (!creep) {
        startCreep(80, 97, 'Preparing your download...');
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { finish(); showError(panel); return; }
      stopCreep();
      setProgress(panel, 100, 'Done');

      const url = URL.createObjectURL(xhr.response);
      const a = document.createElement('a');
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'file_download', file_name: file.name, page_path: window.location.pathname });

      setTimeout(() => { finish(); showSuccess(panel, outName); }, 400);
    };

    xhr.onerror = xhr.ontimeout = () => { console.error('Clean download error'); finish(); showError(panel); };

    const formData = new FormData();
    formData.append('file', file);
    setProgress(panel, 0, 'Uploading your file...');
    xhr.send(formData);
  };

  // A new file means old status no longer applies.
  document.addEventListener('change', (e) => { if (e.target && e.target.type === 'file') removePanel(); }, true);
  document.addEventListener('drop', removePanel, true);
})();
