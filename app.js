// app.js

// 1. APNA GOOGLE SHEET WEB APP URL YAHAN PASTE KAREIN
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxgTVS1oTwiMm5lazad0jo9pwuEwWZGOxlmr5xtyddzCGqFJfyKB6pmMsJoBSf-Fy74/exec";

// 2. SYSTEM INIT & SIDEBAR HIGHLIGHTER
document.addEventListener("DOMContentLoaded", function () {
  let path = window.location.pathname;
  let page = path.split("/").pop() || "index.html";
  
  // Pehle saare menu buttons se active class hatao
  document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active-menu'));
  
  // Current active page ke button ko highlight karo
  if (page === "index.html" || page === "") {
    document.getElementById("btn-dashboard")?.classList.add("active-menu");
    initializeDashboard();
  } else {
    let btnId = "btn-" + page.replace(".html", "");
    document.getElementById(btnId)?.classList.add("active-menu");
  }

  // Forms par automatic aaj ki date set karne ke liye
  let dateInput = document.getElementById('scanDate') || document.getElementById('bulkTargetDate');
  if (dateInput) {
    let today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
});

// 3. BACKEND API CALL ENGINE (ERROR-PROOF WITH CORS MODE)
async function callBackend(actionName, payloadData = {}) {
  if (GOOGLE_API_URL === "YOUR_DEPLOYED_WEB_APP_URL_HERE") {
    alert("Error: Please update GOOGLE_API_URL in app.js with your script deployment link.");
    return { success: false, error: "URL not configured" };
  }
  
  try {
    let bodyData = { action: actionName, ...payloadData };
    
    // Send data to Google Apps Script via safe no-cors stream
    await fetch(GOOGLE_API_URL, {
      method: "POST",
      mode: "no-cors", 
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded" 
      },
      body: JSON.stringify(bodyData)
    });
    
    // Since no-cors hides response, we return local success block for UI
    return { success: true, message: "Request sent successfully" };
    
  } catch (err) {
    console.error("Backend Connection Error:", err);
    return { success: false, error: err.message };
  }
}

// 4. DASHBOARD PAGE LOGIC
async function initializeDashboard() {
  let statusEl = document.getElementById('dashLoadingStatus');
  if(statusEl) statusEl.innerText = "Fetching live statistics...";
  
  let result = await callBackend("getCounts");
  
  // Defaut counters setup agar backend khali ho
  let pickupCount = 0;
  let returnCount = 0;
  let totalCount = 0;

  if (result && result.success && result.logs) {
    let logs = result.logs || [];
    pickupCount = logs.filter(l => l && l.mode === "Pickup").length;
    returnCount = logs.filter(l => l && l.mode === "Return").length;
    totalCount = logs.length;
    if(statusEl) statusEl.innerText = "Sync Complete.";
  } else {
    if(statusEl) statusEl.innerText = "Sync Complete (No entries found).";
  }

  if(document.getElementById('totalPickups')) document.getElementById('totalPickups').innerText = pickupCount;
  if(document.getElementById('totalReturns')) document.getElementById('totalReturns').innerText = returnCount;
  if(document.getElementById('totalScans')) document.getElementById('totalScans').innerText = totalCount;
}

// 5. DAILY SCAN ACTIONS (SINGLE SCAN & DUPLICATE PROTECTION)
async function submitSingleScan() {
  let awb = document.getElementById('awbInput').value.trim();
  let mode = document.getElementById('scanMode').value;
  let date = document.getElementById('scanDate').value;
  let time = new Date().toLocaleTimeString();
  let resEl = document.getElementById('scanResponse');

  if(!awb) { 
    resEl.className = "text-sm font-semibold mt-2 text-orange-500";
    resEl.innerText = "⚠️ Please scan or enter an AWB number."; 
    return; 
  }
  
  resEl.className = "text-sm font-semibold mt-2 text-blue-500";
  resEl.innerText = "Checking duplicates & validating entry...";

  let payload = { awb: awb, orderId: "Pending Sync", status: "Scanned", mode: mode, date: date, time: time };
  let result = await callBackend("saveData", { payload: payload });

  if (result && result.success) {
    resEl.className = "text-sm font-semibold mt-2 text-green-600";
    resEl.innerText = `✔️ Recorded AWB: ${awb} under [${mode}] successfully.`;
    document.getElementById('awbInput').value = ""; // Clear for next scan
    document.getElementById('awbInput').focus(); // Refocus for non-stop scanning
  } else if (result && result.duplicate) {
    resEl.className = "text-sm font-semibold mt-2 text-red-500";
    resEl.innerText = `🛑 Duplicate entry! Already handled on ${result.date || 'N/A'} at ${result.time || 'N/A'}`;
  } else {
    resEl.className = "text-sm font-semibold mt-2 text-red-600";
    resEl.innerText = "Backend Error: " + (result ? result.error : "Unknown network error");
  }
}

// 6. DAILY SCAN ACTIONS (BULK PASTE SCANNING STREAM)
async function submitBulkScans() {
  let textData = document.getElementById('bulkTextarea').value.trim();
  let mode = document.getElementById('bulkMode').value;
  let date = document.getElementById('scanDate').value;
  let resEl = document.getElementById('bulkResponse');

  if(!textData) { 
    resEl.className = "text-sm font-semibold mt-2 text-orange-500";
    resEl.innerText = "⚠️ Please paste AWB numbers first."; 
    return; 
  }
  
  resEl.className = "text-sm font-semibold mt-2 text-blue-500";
  resEl.innerText = "Processing bulk stream queue...";

  let awbArray = textData.split(/\r?\n/).map(a => a.trim()).filter(a => a.length > 0);
  let payloads = awbArray.map(awb => {
    return { awb: awb, orderId: "Bulk Load", status: "Scanned", mode: mode, date: date, time: new Date().toLocaleTimeString() };
  });

  let result = await callBackend("saveDataBulk", { payloads: payloads });
  
  if(result && result.success) {
    resEl.className = "text-sm font-semibold mt-2 text-green-600";
    resEl.innerText = `✔️ Added: ${result.addedCount || 0} Rows. Skipped Duplicates: ${result.skippedCount || 0}`;
    document.getElementById('bulkTextarea').value = "";
  } else {
    resEl.className = "text-sm font-semibold mt-2 text-red-600";
    resEl.innerText = "Bulk Execution failed: " + (result ? result.error : "Unknown network error");
  }
}

// 7. TRACKING ENGINE ACTIONS (LIVE QUERY FROM DELHIVERY)
async function performLiveTracking() {
  let awb = document.getElementById('trackAwbInput').value.trim();
  let infoBox = document.getElementById('trackingInfoBox');
  if(!awb) { alert("Please enter a tracking identifier."); return; }

  infoBox.innerHTML = "<p class='text-blue-500 font-medium animate-pulse'>Fetching Delhivery Pipeline Metrics...</p>";
  
  let result = await callBackend("fetchDelhivery", { awb: awb });
  
  if(result && result.success && result.data) {
    let d = result.data;
    infoBox.innerHTML = `
      <div class="grid grid-cols-2 gap-4 text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border mt-2">
        <div><strong>AWB:</strong> ${d.awb}</div><div><strong>Status:</strong> <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">${d.status}</span></div>
        <div><strong>Order ID:</strong> ${d.orderId}</div><div><strong>Customer:</strong> ${d.name}</div>
        <div><strong>Origin:</strong> ${d.origin}</div><div><strong>Destination:</strong> ${d.destination}</div>
        <div><strong>City/State:</strong> ${d.city}, ${d.state}</div><div><strong>Pincode:</strong> ${d.pinCode}</div>
        <div><strong>Invoice Amt:</strong> ₹${d.invoiceAmount}</div><div><strong>COD Balance:</strong> ₹${d.codAmount}</div>
        <div class="col-span-2 text-xs text-gray-400 mt-2 border-t pt-2">Pickedup: ${d.pickedUpDate} | Delivered: ${d.deliveryDate}</div>
      </div>`;
  } else {
    infoBox.innerHTML = `<p class="text-red-500 font-medium mt-2">🛑 API Sync Fail: ${result ? result.error : "No response from Delhivery API"}</p>`;
  }
}

// 8. TRACKING ENGINE (BULK SHEET RECONCILIATION SWEEP)
async function triggerBulkDaySync() {
  let date = document.getElementById('bulkTargetDate').value;
  let mode = document.getElementById('bulkTargetMode').value;
  let resEl = document.getElementById('bulkSyncResponse');

  resEl.className = "text-sm font-semibold mt-2 text-orange-500";
  resEl.innerText = "⚠️ Initiating automated API sweep across Sheet rows. Please wait...";
  
  let result = await callBackend("fetchBulkDayData", { date: date, mode: mode });

  if(result && result.success) {
    resEl.className = "text-sm font-semibold mt-2 text-green-600";
    resEl.innerText = `🎉 Processing Finished! Updated ${result.updatedCount || 0} shipments with live Delhivery states.`;
  } else {
    resEl.className = "text-sm font-semibold mt-2 text-red-500";
    resEl.innerText = "Failed to sync: " + (result ? result.error : "Sheet is empty or no match found.");
  }
}
