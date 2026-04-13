// --- สเตตัสเริ่มต้น ---
let installments = [];
let currentUser = null;
let currentInstallmentId = null;
let currentDigitLimit = 2;
let isCloudDataLoaded = false; 
let personFilter = 'all';
let editingInstallmentId = null;

// --- ฟังก์ชันจัดการวันที่ ---
function formatThaiDate(dateStr) {
    if(!dateStr) return "";
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const parts = dateStr.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    let day = parseInt(parts[2]);
    if (year < 2400) year += 543;
    return `${day} ${months[month]} ${year}`;
}

// --- 1. ระบบจัดการ Auth และการซิงค์ข้อมูล ---
function initApp() {
    if (!window.fbMethods) {
        setTimeout(initApp, 100);
        return;
    }

    // ฟังการเปลี่ยนแปลงสถานะการล็อกอิน (ตัวเดียวจบ)
    window.fbMethods.onAuthStateChanged(window.fbAuth, async (user) => {
        const loginBtn = document.getElementById('login-nav-btn');
        const badge = document.querySelector('.demo-badge');

        if (user) {
            // [กรณีล็อกอินแล้ว]
            currentUser = user;
            loginBtn.innerText = user.displayName.split(' ')[0]; // แสดงชื่อสั้นๆ
            loginBtn.onclick = () => askLogout(); // เปลี่ยนให้เป็นปุ่มออกจากระบบ
            
            badge.innerText = "☁️ คลาวด์ซิงค์";
            badge.style.color = "#2ecc71";

            isCloudDataLoaded = false; 
            await loadDataFromCloud(); 
        } else {
            // [กรณีไม่ได้ล็อกอิน]
            currentUser = null;
            loginBtn.innerText = "เข้าสู่ระบบ";
            loginBtn.onclick = () => openLoginModal(); // เปลี่ยนให้เป็นปุ่มล็อกอิน
            
            badge.innerText = "โหมดทดลองใช้";
            badge.style.color = "rgba(255,255,255,0.7)";
            
            isCloudDataLoaded = true;
            installments = JSON.parse(localStorage.getItem('data_guest')) || [];
            renderInstallments();
        }
    });
}

// โหลดข้อมูลจาก Firebase
async function loadDataFromCloud() {
    if (!currentUser) return;
    const dbRef = window.fbMethods.ref(window.fbDb);
    try {
        const snapshot = await window.fbMethods.get(window.fbMethods.child(dbRef, `users/${currentUser.uid}`));
        if (snapshot.exists()) {
            const data = snapshot.val().installments;
            installments = Array.isArray(data) ? data : (data ? Object.values(data) : []);
            console.log("✅ ดึงข้อมูลจาก Cloud สำเร็จ");
        } else {
            installments = [];
            console.log("ℹ️ บัญชีใหม่: เริ่มต้นข้อมูลว่าง");
        }
        isCloudDataLoaded = true; 
        renderInstallments();
    } catch (error) {
        console.error("❌ Load Error:", error);
        isCloudDataLoaded = true;
    }
}

// บันทึกข้อมูล
async function saveData() {
    if (currentUser && isCloudDataLoaded) {
        try {
            const userRef = window.fbMethods.ref(window.fbDb, `users/${currentUser.uid}`);
            await window.fbMethods.set(userRef, { 
                installments: installments,
                lastUpdate: Date.now(),
                userName: currentUser.displayName
            });
        } catch (e) { console.error("☁️ Sync Error:", e); }
    } else if (!currentUser) {
        localStorage.setItem('data_guest', JSON.stringify(installments));
    }
}

// --- 2. การจัดการหน้าจอและ Modal ---
function renderInstallments() {
    const list = document.getElementById('installment-list');
    list.innerHTML = '';
    installments.forEach(inst => {
        const limit = inst.maxTotal || 100000;
        const percent = (inst.total / limit) * 100;
        let colorClass = percent >= 100 ? 'bg-red' : (percent >= 80 ? 'bg-yellow' : 'bg-green');
        const displayDate = inst.rawDate ? formatThaiDate(inst.rawDate) : inst.date;

        const card = document.createElement('div');
        card.className = 'inst-card';
        card.innerHTML = `
            <button class="btn-edit-inst" onclick="openEditInstallment(${inst.id}, event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <div onclick="openInstallment(${inst.id})">
                <h3 style="margin:0 0 10px 0; font-size:1.1rem;">${displayDate}</h3>
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>รวม: <b>${inst.total.toLocaleString()}</b></span>
                    <span>${percent.toFixed(0)}%</span>
                </div>
                <div class="progress-bar-bg"><div class="progress-fill ${colorClass}" style="width: ${Math.min(percent, 100)}%"></div></div>
            </div>`;
        list.appendChild(card);
    });
}

function openInstallment(id) {
    currentInstallmentId = id;
    const inst = installments.find(i => i.id === id);
    document.getElementById('view-title').innerText = inst.date;
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('input-view').style.display = 'block';
    document.getElementById('user-list-btn').style.display = 'flex';
    document.getElementById('report-btn').style.display = 'flex';
    document.getElementById('login-nav-btn').style.display = 'none';
    document.querySelector('.demo-badge').style.display = 'none';
    updateUI();
}

function backToDashboard() {
    document.getElementById('view-title').innerText = "รายการงวดทั้งหมด";
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('input-view').style.display = 'none';
    document.getElementById('report-view').style.display = 'none';
    document.getElementById('user-list-btn').style.display = 'none';
    document.getElementById('report-btn').style.display = 'none';
    document.getElementById('login-nav-btn').style.display = 'block';
    document.querySelector('.demo-badge').style.display = 'block';
    renderInstallments();
}

// --- 3. การทำงานของปุ่ม Auth ---
window.handleGoogleLogin = async function() {
    try {
        await window.fbMethods.signInWithPopup(window.fbAuth, window.fbProvider);
        closeLoginModal();
    } catch (e) { console.error(e); }
};

window.executeLogout = function() {
    window.fbMethods.signOut(window.fbAuth).then(() => {
        closeLogoutModal();
    });
};

function askLogout() {
    document.getElementById('logout-message').innerText = `ต้องการออกจากระบบบัญชี ${currentUser.displayName}?`;
    document.getElementById('logout-confirm-modal').style.display = 'flex';
}

// --- ฟังก์ชันพื้นฐานอื่นๆ (Copy จาก Logic เดิมที่ถูกต้อง) ---
function saveEntry() {
    const name = document.getElementById('cust-name').value;
    const num = document.getElementById('input-number').value;
    const inst = installments.find(i => i.id === currentInstallmentId);
    if(!name || !num || num.length !== currentDigitLimit) { showAlert("กรุณากรอกข้อมูลให้ครบ"); return; }

    let entry = { id: Date.now(), name, number: num, amount: 0 };
    if (currentDigitLimit === 3) {
        entry.amountStraight = parseFloat(document.getElementById('amt-straight').value) || 0;
        entry.amountToad = parseFloat(document.getElementById('amt-toad').value) || 0;
        entry.amount = entry.amountStraight + entry.amountToad;
    } else {
        entry.amountUpper = parseFloat(document.getElementById('amt-upper').value) || 0;
        entry.amountLower = parseFloat(document.getElementById('amt-lower').value) || 0;
        entry.amount = entry.amountUpper + entry.amountLower;
    }

    if(entry.amount <= 0) { showAlert("กรุณากรอกจำนวนเงิน"); return; }
    inst.entries.unshift(entry);
    inst.total = inst.entries.reduce((s, e) => s + e.amount, 0);
    saveData(); updateUI();
    document.getElementById('input-number').value = '';
    document.getElementById('input-number').focus();
}

function updateUI() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    const limit = inst.maxTotal || 100000;
    const percent = (inst.total / limit) * 100;
    document.getElementById('total-progress-text').innerText = `${inst.total.toLocaleString()} / ${limit.toLocaleString()}`;
    const fill = document.getElementById('main-progress-fill');
    fill.style.width = Math.min(percent, 100) + '%';
    fill.className = 'progress-fill ' + (percent >= 100 ? 'bg-red' : (percent >= 80 ? 'bg-yellow' : 'bg-green'));

    const recentDiv = document.getElementById('recent-entries');
    recentDiv.innerHTML = inst.entries.slice(0, 5).map(e => `
        <div class="entry-item" style="display:flex; justify-content:space-between; padding:10px; background:white; margin-bottom:5px; border-radius:8px;">
            <span><b>${e.name}</b>: ${e.number} (${e.amount}.-)</span>
            <button onclick="deleteEntry(${e.id})" style="color:red; border:none; background:none; cursor:pointer;">ลบ</button>
        </div>`).join('');
}

// --- ปิดท้ายด้วยการรันแอป ---
initApp();

// ผูกฟังก์ชันเข้า Window (เพื่อให้ HTML เรียกใช้ได้)
window.openLoginModal = () => document.getElementById('login-modal').style.display = 'flex';
window.closeLoginModal = () => document.getElementById('login-modal').style.display = 'none';
window.closeLogoutModal = () => document.getElementById('logout-confirm-modal').style.display = 'none';
window.closeAddModal = () => document.getElementById('add-installment-modal').style.display = 'none';
window.showAlert = (msg) => { document.getElementById('alert-message').innerText = msg; document.getElementById('alert-modal').style.display = 'flex'; };
window.closeAlert = () => document.getElementById('alert-modal').style.display = 'none';
window.setType = (d) => { 
    currentDigitLimit = d; 
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('two-digit-options').style.display = d === 2 ? 'block' : 'none';
    document.getElementById('three-digit-options').style.display = d === 3 ? 'block' : 'none';
};
window.limitDigits = (el) => { if(el.value.length > currentDigitLimit) el.value = el.value.slice(0, currentDigitLimit); };
window.createNewInstallment = () => { editingInstallmentId = null; document.getElementById('add-installment-modal').style.display = 'flex'; };
window.confirmCreateInstallment = () => {
    const rawDate = document.getElementById('new-inst-date').value;
    const max = parseFloat(document.getElementById('new-inst-max-total').value) || 100000;
    if(!rawDate) return;
    installments.push({ id: Date.now(), rawDate, date: formatThaiDate(rawDate), total: 0, maxTotal: max, entries: [], paidList: {} });
    saveData(); renderInstallments(); closeAddModal();
};
window.onclick = (e) => { if(e.target.className === 'modal') e.target.style.display = 'none'; };