// app.js
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxD7G40d_5S0SK8ET4zhm_m-VJ_4OpLo57BNobuPFOirVSCvfG_MRyqYFKNMOc1VcP9/exec";

// 1. SYSTEM INIT & SIDEBAR HIGHLIGHTER
document.addEventListener("DOMContentLoaded", function () {
  let path = window.location.pathname;
  let page = path.split("/").pop() || "index.html";
  
  document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active-menu'));
  
  if (page === "index.html" || page === "") {
    document.getElementById("btn-dashboard")?.classList.add("active-menu");
    initializeDashboard();
  } else {
    let btnId = "btn-" + page.replace(".html", "");
    document.getElementById(btnId)?.classList.add("active-menu");
  }

  // Auto-fill system dates on forms
  let dateInput = document.getElementById('scanDate') || document.getElementById('bulkTargetDate');
  if (dateInput) {
    let today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
});

// 2. BACKEND API CALL ENGINE
async function callBackend(actionName, payloadData = {}) {
  if (GOOGLE_API_URL === "YOUR_DEPLOYED_WEB_APP_URL_HERE") {
    alert("Error: Please update GOOGLE_API_URL in app.js with your script deployment link.");
    return { success: false, error: "URL not configured" };
  }
  
  try {
    let bodyData = { action: actionName, ...payloadData };
    let response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" }, // Standard stream avoiding strict Pre-flight blocks
      body: JSON.stringify(bodyData)
    });
    let resText = await response.text();
    return JSON.parse(resText);
  } catch (err) {
    console.error("Backend Error:", err);
    return { success: false, error: err.message };
  }
}

// 3. DASHBOARD PAGE LOGIC
async function initializeDashboard() {
  let statusEl = document.getElementById('dashLoadingStatus');
  if(statusEl) statusEl.innerText = "Fetching live statistics...";
  
  let result = await callBackend("getCounts");
  if (result.success && result.logs) {
    let logs = result.logs;
    let pickupCount = logs.filter(l => l.mode === "Pickup").length;
    let returnCount = logs.filter(l => l.mode === "Return").length;
    
    if(document.getElementById('totalPickups')) document.getElementById('totalPickups').innerText = pickupCount;
    if(document.getElementById('totalReturns')) document.getElementById('totalReturns').innerText = returnCount;
    if(document.getElementById('totalScans')) document.getElementById('totalScans').innerText = logs.length;
    if(statusEl) statusEl.innerText = "Sync Complete.";
  } else {
    if(statusEl) statusEl.innerText = "Failed to sync analytics.";
  }
}

// 4. DAILY SCAN ACTIONS
async function submitSingleScan() {
  let awb = document.getElementById('awbInput').value.trim();
  let mode = document.getElementById('scanMode').value;
  let date = document.getElementById('scanDate').value;
  let time = new Date().toLocaleTimeString();
  let resEl = document.getElementById('scanResponse');

  if(!awb) { resEl.innerText = "⚠️ Please scan/enter an AWB"; return; }
  resEl.innerText = "Validating entry...";

  let payload = { awb: awb, orderId: "Pending Sync", status: "Scanned", mode: mode, date: date, time: time };
  let result = await callBackend("saveData", { payload: payload });

  if (result.success) {
    resEl.className = "text-sm font-semibold mt-2 text-green-600";
    resEl.innerText = `✔️ Recorded AWB: ${awb} under [${mode}]`;
    document.getElementById('awbInput').value = ""; // Clear for next scan
  } else if (result.duplicate) {
    resEl.className = "text-sm font-semibold mt-2 text-red-500";
    resEl.innerText = `🛑 Duplicate entry found! Handled on ${result.date} at ${result.time}`;
  } else {
    resEl.innerText = "Error: " + result.error;
  }
}

// Bulk Data Scanners Parser
async function submitBulkScans() {
  let textData = document.getElementById('bulkTextarea').value.trim();
  let mode = document.getElementById('bulkMode').value;
  let date = document.getElementById('scanDate').value;
  let resEl = document.getElementById('bulkResponse');

  if(!textData) { resEl.innerText = "⚠️ Paste AWBs first"; return; }
  resEl.innerText = "Processing bulk stream queue...";

  let awbArray = textData.split(/\r?\n/).map(a => a.trim()).filter(a => a.length > 0);
  let payloads = awbArray.map(awb => {
    return { awb: awb, orderId: "Bulk Load", status: "Scanned", mode: mode, date: date, time: new Date().toLocaleTimeString() };
  });

  let result = await callBackend("saveDataBulk", { payloads: payloads });
  if(result.success) {
    resEl.className = "text-sm font-semibold mt-2 text-green-600";
    resEl.innerText = `✔️ Added: ${result.addedCount} Rows. Skipped Duplicates: ${result.skippedCount}`;
    document.getElementById('bulkTextarea').value = "";
  } else {
    resEl.innerText = "Execution failed: " + result.error;
  }
}

// 5. TRACKING ENGINE ACTIONS
async function performLiveTracking() {
  let awb = document.getElementById('trackAwbInput').value.trim();
  let infoBox = document.getElementById('trackingInfoBox');
  if(!awb) { alert("Enter tracking identifier"); return; }

  infoBox.innerHTML = "<p class='text-blue-500 font-medium animate-pulse'>Fetching Delhivery Pipeline Metrics...</p>";
  
  let result = await callBackend("fetchDelhivery", { awb: awb });
  if(result.success) {
    let d = result.data;
    infoBox.innerHTML = `
      <div class="grid grid-cols-2 gap-4 text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border">
        <div><strong>AWB:</strong> ${d.awb}</div><div><strong>Status:</strong> <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">${d.status}</span></div>
        <div><strong>Order ID:</strong> ${d.orderId}</div><div><strong>Customer:</strong> ${d.name}</div>
        <div><strong>Origin:</strong> ${d.origin}</div><div><strong>Destination:</strong> ${d.destination}</div>
        <div><strong>City/State:</strong> ${d.city}, ${d.state}</div><div><strong>Pincode:</strong> ${d.pinCode}</div>
        <div><strong>Invoice Amt:</strong> ₹${d.invoiceAmount}</div><div><strong>COD Balance:</strong> ₹${d.codAmount}</div>
        <div class="col-span-2 text-xs text-gray-400 mt-2">Pickedup: ${d.pickedUpDate} | Delivered: ${d.deliveryDate}</div>
      </div>`;
  } else {
    infoBox.innerHTML = `<p class="text-red-500 font-medium">🛑 API Sync Fail: ${result.error}</p>`;
  }
}

// Bulk API Sync Engine Caller
async function triggerBulkDaySync() {
  let date = document.getElementById('bulkTargetDate').value;
  let mode = document.getElementById('bulkTargetMode').value;
  let resEl = document.getElementById('bulkSyncResponse');

  resEl.innerText = "⚠️ Initiating automated API sweep across Sheet rows. Please wait...";
  let result = await callBackend("fetchBulkDayData", { date: date, mode: mode });

  if(result.success) {
    resEl.className = "text-sm font-semibold mt-2 text-green-600";
    resEl.innerText = `🎉 Processing Finished! Updated ${result.updatedCount} shipments with live Delhivery states.`;
  } else {
    resEl.className = "text-sm font-semibold mt-2 text-red-500";
    resEl.innerText = "Failed: " + result.error;
  }
}
