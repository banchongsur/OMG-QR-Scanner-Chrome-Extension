const $ = (id) => document.getElementById(id);
const scanButton = $("scanPage");
const fileInput = $("fileInput");
const statusText = $("status");
const statusDetail = $("statusDetail");
const statusDot = $("statusDot");
const progressBar = $("progressBar");
const results = $("results");
const resultsSection = $("resultsSection");
const previewSection = $("previewSection");
const preview = $("preview");
const previewCtx = preview.getContext("2d", { willReadFrequently: true });
const found = new Map();
let busy = false;
let jsqrReady = typeof globalThis.jsQR === "function";
let pdfjsPromise = null;

function setStatus(message, detail = "", state = "ready", progress = null) {
  statusText.textContent = message;
  statusDetail.textContent = detail;
  statusDot.className = "pulse" + (state === "busy" ? " busy" : state === "error" ? " error" : "");
  if (progress !== null) progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
}
function clearResults() {
  // Reset all scan data and rendered result cards.
  found.clear();
  results.replaceChildren();
  resultsSection.hidden = true;
  $("resultCount").textContent = "0 รายการ";

  // Clear the actual canvas bitmap too, not only hide the preview section.
  previewCtx.clearRect(0, 0, preview.width, preview.height);
  preview.width = 0;
  preview.height = 0;
  previewSection.hidden = true;

  // Clear any selected file and progress from the previous operation.
  fileInput.value = "";
  progressBar.style.width = "0%";
}
function addResult(value, source) {
  if (!value) return;
  if (found.has(value)) {
    const old = found.get(value);
    if (!old.sources.includes(source)) {
      old.sources.push(source);
      old.sourceNode.textContent = old.sources.join(" · ");
    }
    return;
  }
  const card = document.createElement("article");
  card.className = "result-card";
  const top = document.createElement("div");
  top.className = "result-top";
  const title = document.createElement("div");
  title.className = "result-title";
  title.textContent = `QR Code ${found.size + 1}`;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "อ่านได้";
  top.append(title, badge);

  const sourceNode = document.createElement("div");
  sourceNode.className = "result-source";
  sourceNode.textContent = source;

  const output = document.createElement("textarea");
  output.readOnly = true;
  output.value = value;
  output.rows = Math.min(5, Math.max(2, Math.ceil(value.length / 48)));

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const copy = document.createElement("button");
  copy.textContent = "คัดลอกข้อความ";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("คัดลอกแล้ว", "นำข้อมูลไปวางในแอปอื่นได้");
    } catch {
      output.focus(); output.select();
      setStatus("เลือกข้อความแล้ว", "กด Ctrl+C เพื่อคัดลอก");
    }
  });
  actions.append(copy);
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      const open = document.createElement("button");
      open.textContent = "เปิดลิงก์";
      open.addEventListener("click", () => chrome.tabs.create({ url: url.href }));
      actions.append(open);
    }
  } catch {}
  card.append(top, sourceNode, output, actions);
  results.append(card);
  found.set(value, { sources: [source], sourceNode });
  resultsSection.hidden = false;
  $("resultCount").textContent = `${found.size} รายการ`;
}

function setPreview(canvas) {
  preview.width = canvas.width;
  preview.height = canvas.height;
  previewCtx.clearRect(0, 0, preview.width, preview.height);
  previewCtx.drawImage(canvas, 0, 0);
  previewSection.hidden = false;
}
function makeCanvas(width, height) {
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  return c;
}
function scaleCanvas(source, maxSide = 2600) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = makeCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
  canvas.getContext("2d", {willReadFrequently:true}).drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function ensureJsQR() {
  if (typeof globalThis.jsQR === "function") { jsqrReady = true; return true; }
  // The popup's classic script normally loads this first. If absent, native BarcodeDetector can still work.
  return false;
}
async function ensurePdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(chrome.runtime.getURL("lib/pdf.mjs")).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.mjs");
      return pdfjs;
    }).catch((err) => {
      pdfjsPromise = null;
      throw new Error("ยังไม่มีไลบรารี PDF.js ในโฟลเดอร์ lib กรุณารัน download-libraries.ps1 แล้ว Reload Extension (" + err.message + ")");
    });
  }
  return pdfjsPromise;
}

// Use native BarcodeDetector when available, otherwise use local jsQR and tiled scans.
// Tiling lets jsQR detect multiple codes per page, deduplicated by decoded value.
async function scanCanvas(canvas, source) {
  let count = 0;
  const Detector = globalThis.BarcodeDetector;
  if (Detector) {
    try {
      const detector = new Detector({ formats: ["qr_code"] });
      const bitmap = await createImageBitmap(canvas);
      try {
        const codes = await detector.detect(bitmap);
        for (const code of codes) {
          if (code.rawValue && !found.has(code.rawValue)) {
            addResult(code.rawValue, source);
            count++;
          } else if (code.rawValue) addResult(code.rawValue, source);
        }
        // Native detector may return zero on a difficult image; fall through to jsQR if present.
        if (codes.length > 0) return count;
      } finally { bitmap.close(); }
    } catch (e) {
      // Native API can be unavailable in some Chrome contexts; try jsQR below.
    }
  }

  if (typeof globalThis.jsQR !== "function") {
    throw new Error("ไม่พบตัวอ่าน QR Code (jsQR.js) และ Chrome ใช้ BarcodeDetector ไม่ได้ กรุณารัน download-libraries.ps1 ในโฟลเดอร์ Extension แล้วกด Reload");
  }

  const w = canvas.width, h = canvas.height;
  const sourceCtx = canvas.getContext("2d", {willReadFrequently:true});
  const levels = [1, 2, 3, 4, 6];
  for (const divisions of levels) {
    const cellW = w / divisions, cellH = h / divisions;
    const padX = divisions === 1 ? 0 : cellW * 0.18;
    const padY = divisions === 1 ? 0 : cellH * 0.18;
    for (let row = 0; row < divisions; row++) {
      for (let col = 0; col < divisions; col++) {
        const x = Math.max(0, Math.floor(col * cellW - padX));
        const y = Math.max(0, Math.floor(row * cellH - padY));
        const right = Math.min(w, Math.ceil((col + 1) * cellW + padX));
        const bottom = Math.min(h, Math.ceil((row + 1) * cellH + padY));
        const rw = right - x, rh = bottom - y;
        if (rw < 32 || rh < 32) continue;
        const imageData = sourceCtx.getImageData(x, y, rw, rh);
        const code = globalThis.jsQR(imageData.data, rw, rh, { inversionAttempts: "attemptBoth" });
        if (code) {
          if (!found.has(code.data)) count++;
          addResult(code.data, source);
        }
      }
    }
  }
  return count;
}

async function scanImageFile(file) {
  if (file.size > 100 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 100 MB");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) return scanPdf(file);
  if (!(file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name))) {
    throw new Error("ชนิดไฟล์ไม่รองรับ กรุณาเลือก PNG, JPG, WEBP หรือ PDF");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = scaleCanvas(bitmap);
    setPreview(canvas);
    await scanCanvas(canvas, file.name);
  } finally { bitmap.close(); }
}
async function scanPdf(file) {
  const pdfjs = await ensurePdfJs();
  const pdf = await pdfjs.getDocument({data: await file.arrayBuffer()}).promise;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      setStatus(`กำลังสแกน PDF หน้า ${n}/${pdf.numPages}`, `พบ QR แล้ว ${found.size} รายการ`, "busy", (n - 1) / pdf.numPages * 100);
      const page = await pdf.getPage(n);
      const base = page.getViewport({scale:1});
      const viewport = page.getViewport({scale:Math.min(2.5, 1900 / Math.max(base.width, base.height))});
      const canvas = makeCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const c = canvas.getContext("2d", {willReadFrequently:true});
      await page.render({canvasContext:c, canvas, viewport}).promise;
      if (n === 1) setPreview(canvas);
      await scanCanvas(canvas, `${file.name} · หน้า ${n}`);
      page.cleanup();
      setStatus(`กำลังสแกน PDF หน้า ${n}/${pdf.numPages}`, `พบ QR แล้ว ${found.size} รายการ`, "busy", n / pdf.numPages * 100);
    }
  } finally { await pdf.destroy(); }
}
async function scanCurrentTab() {
  const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
  if (!tab?.id) throw new Error("ไม่พบแท็บที่กำลังใช้งาน");
  // Pass the target browser window explicitly. The side panel is a separate
  // extension context, so do not rely on an implicit current-window lookup.
  // Host permission <all_urls> in manifest.json allows capture on ordinary web pages.
  if (tab.url && /^(chrome|edge|about|devtools):\/\//i.test(tab.url)) {
    throw new Error("Chrome ไม่อนุญาตให้ส่วนขยายจับภาพหน้าภายในของเบราว์เซอร์ เช่น chrome:// หรือหน้า DevTools กรุณาเปิดหน้าเว็บปกติแล้วลองอีกครั้ง");
  }
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (err) {
    const message = err?.message || String(err);
    if (/activeTab|permission|invoked/i.test(message)) {
      throw new Error("Chrome ยังไม่อนุญาตให้จับภาพแท็บนี้ กรุณาเปิดหน้าเว็บปกติ แล้วคลิกไอคอน OMG QR Scanner เพื่อเปิดแถบด้านข้าง จากนั้นกด ‘สแกนหน้าจอทันที’ อีกครั้ง หากเป็นหน้า chrome://, Chrome Web Store หรือ PDF Viewer ภายใน ให้ดาวน์โหลดภาพ/PDF แล้วใช้แท็บ ‘สแกนจากไฟล์’ แทน");
    }
    throw err;
  }
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = scaleCanvas(bitmap);
    setPreview(canvas);
    await scanCanvas(canvas, `หน้าจอ: ${tab.title || "แท็บปัจจุบัน"} (ส่วนที่มองเห็น)`);
  } finally { bitmap.close(); }
}
async function runScan(task) {
  if (busy) return;
  busy = true;
  scanButton.disabled = true;
  fileInput.disabled = true;
  clearResults();
  previewSection.hidden = true;
  setStatus("กำลังเริ่มสแกน...", "กำลังเตรียมตัวอ่าน QR Code", "busy", 5);
  try {
    await task();
    if (found.size) setStatus(`สแกนเสร็จ พบ ${found.size} QR Code`, "คัดลอกข้อความหรือเปิดลิงก์ได้จากรายการด้านล่าง", "ready", 100);
    else setStatus("ไม่พบ QR Code", "ลองใช้ไฟล์ต้นฉบับที่คมชัดขึ้น หรือขยาย QR Code ให้ใหญ่ขึ้น", "ready", 100);
  } catch (err) {
    console.error("QR Scanner error:", err);
    setStatus("สแกนไม่สำเร็จ", err?.message || String(err), "error", 0);
  } finally {
    busy = false;
    scanButton.disabled = false;
    fileInput.disabled = false;
  }
}

scanButton.addEventListener("click", () => runScan(scanCurrentTab));
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) runScan(() => scanImageFile(file));
  fileInput.value = "";
});
$("clearResults").addEventListener("click", () => {
  if (busy) return;
  clearResults();
  setStatus("เริ่มต้นใหม่แล้ว", "ล้างผลลัพธ์และตัวอย่างภาพเดิมทั้งหมดแล้ว พร้อมสแกนใหม่", "ready", 0);
});

// Native drag/drop handling. Prevent default at document level so Chrome opens the file
// in the popup instead of navigating away from it.
const dropzone = $("dropzone");
for (const type of ["dragenter", "dragover"]) {
  document.addEventListener(type, e => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) {
      e.preventDefault();
      dropzone.classList.add("dragover");
    }
  });
}
for (const type of ["dragleave", "dragend"]) {
  document.addEventListener(type, () => dropzone.classList.remove("dragover"));
}
document.addEventListener("drop", e => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  runScan(() => scanImageFile(file));
});
// The dropzone is a <label for="fileInput">. Let the browser open the
// picker directly from the user's label click; calling fileInput.click() here
// as well can trigger a second, non-user-activated file chooser in Chrome.


// Three persistent Side Panel modes.
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === button));
  document.querySelectorAll('.tab-panel').forEach(panel => {
    const active = panel.dataset.panel === button.dataset.tab;
    panel.hidden = !active; panel.classList.toggle('active', active);
  });
}));

// Startup diagnostic should always be visible if script executed.
setStatus("พร้อมสแกน", "เลือกหนึ่งในสองแท็บเพื่อเริ่มต้น", "ready", 0);
