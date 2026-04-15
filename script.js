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
    
    // 1. อัปเดต Progress Bar ด้านบน
    const limit = inst.maxTotal || 100000; 
    const percent = (inst.total / limit) * 100;
    
    const fill = document.getElementById('main-progress-fill');
    document.getElementById('total-progress-text').innerText = `${inst.total.toLocaleString()} / ${limit.toLocaleString()}`;
    fill.style.width = Math.min(percent, 100) + '%';
    
    // เปลี่ยนสี Progress Bar ตามยอด
    fill.className = 'progress-fill';
    if(percent >= 100) fill.classList.add('bg-red');      
    else if(percent >= 80) fill.classList.add('bg-yellow'); 
    else fill.classList.add('bg-green');                 

    // 2. อัปเดตรายการล่าสุด 5 รายการ (คืนค่าไอคอนถังขยะ SVG สีแดง)
    const recentDiv = document.getElementById('recent-entries');
    recentDiv.innerHTML = inst.entries.slice(0, 5).map(e => `
        <div class="entry-item">
            <div class="info"><b>${e.name}</b>: <span style="color:var(--navy)">${e.number}</span> (${e.amount}.-)</div>
            <button class="btn-delete" onclick="deleteEntry(${e.id})">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
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

// 2. ฟังก์ชันสั่งออกจากระบบจริงๆ (เรียกใช้เมื่อกดปุ่มในป๊อปอัพ)
window.executeLogout = function() {
    window.fbMethods.signOut(window.fbAuth).then(() => {
        // ล้างตัวแปรใน JS
        currentUser = null;
        installments = [];
        isCloudDataLoaded = false;
        
        // ไม่ต้องลบ data_guest เพราะเป็นของโหมดทดลองใช้ 
        // แต่ข้อมูลบัญชีจะถูกดึงใหม่จาก Cloud เมื่อ Login บัญชีอื่น
        
        renderInstallments();
        closeLogoutModal();
        console.log("🚀 ออกจากระบบและล้างหน่วยความจำเรียบร้อย");
    });
}


// --- ระบบตรวจสอบ Firebase และสถานะการล็อกอิน ---
function startApp() {
    if (window.fbMethods && window.fbAuth) {
        console.log("✅ ระบบ Firebase เชื่อมต่อสำเร็จ");
        
        window.fbMethods.onAuthStateChanged(window.fbAuth, (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('login-nav-btn').innerText = user.displayName;
                const badge = document.querySelector('.demo-badge');
                badge.innerText = "☁️ คลาวด์ซิงค์";
                badge.style.color = "#2ecc71";
                loadDataFromCloud();
            } else {
                currentUser = null;
                document.getElementById('login-nav-btn').innerText = "เข้าสู่ระบบ";
                const badge = document.querySelector('.demo-badge');
                badge.innerText = "โหมดทดลองใช้";
                badge.style.color = "rgba(255,255,255,0.7)";
                renderInstallments();
            }
        });
    } else {
        setTimeout(startApp, 100); // วนเช็คจนกว่า Firebase จะโหลดเสร็จ
    }
}
startApp();

// --- ฟังก์ชันล็อกอิน Google (ตัวจริง) ---
async function handleGoogleLogin() {
    try {
        if (!window.fbMethods) return;
        await window.fbMethods.signInWithPopup(window.fbAuth, window.fbProvider);
        closeLoginModal();
    } catch (error) {
        console.error("Login Error:", error);
        showAlert("เข้าสู่ระบบไม่สำเร็จ หรือคุณปิดหน้าต่างล็อกอิน");
    }
}

window.closeCustomerModal = function() { document.getElementById('customer-modal').style.display = 'none'; }
window.closeDetailModal = function() { document.getElementById('detail-modal').style.display = 'none'; }
window.closeAlert = function() { document.getElementById('alert-modal').style.display = 'none'; }
window.closeDeleteModal = function() { document.getElementById('delete-confirm-modal').style.display = 'none'; }

// 1. ตรวจสอบสถานะการล็อกอินอัตโนมัติเมื่อเปิดแอป
window.fbMethods.onAuthStateChanged(window.fbAuth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-nav-btn').innerText = user.displayName;
        document.querySelector('.demo-badge').innerText = "☁️ คลาวด์ซิงค์";
        document.querySelector('.demo-badge').style.color = "var(--green)";
        loadDataFromCloud(); // โหลดข้อมูลจาก Firebase
    } else {
        currentUser = null;
        document.getElementById('login-nav-btn').innerText = "เข้าสู่ระบบ";
        document.querySelector('.demo-badge').innerText = "โหมดทดลองใช้";
        document.querySelector('.demo-badge').style.color = "rgba(255,255,255,0.7)";
        // ถ้าไม่ล็อกอิน ใช้ข้อมูลในเครื่อง (LocalStorage)
        installments = JSON.parse(localStorage.getItem('data_v1')) || [];
        renderInstallments();
    }
});

document.getElementById('user-list-btn').style.display = 'none';
document.getElementById('report-btn').style.display = 'none';
const MAX_INSTALLMENT_LIMIT = 100000;
const MAX_PERSON_LIMIT = 5000;

// เริ่มต้นโปรแกรม
renderInstallments();


function createNewInstallment() {
    document.getElementById('add-installment-modal').style.display = 'flex';
    document.getElementById('new-inst-date').value = '';
    document.getElementById('new-inst-date').focus();
}

// ฟังก์ชันปิด Modal
function closeAddModal() {
    const modal = document.getElementById('add-installment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ฟังก์ชันยืนยันการสร้าง 
function confirmCreateInstallment() {
    const dateInput = document.getElementById('new-inst-date');
    const dateStr = dateInput.value;
    const maxTotalInput = document.getElementById('new-inst-max-total');
    
    const maxTotal = parseFloat(maxTotalInput.value) || 100000;
    
    if(!dateStr) {
        showAlert("กรุณาระบุวันที่ให้เรียบร้อย");
        return;
    }
    
    const newInst = {
        id: Date.now(),
        date: dateStr,
        total: 0,
        maxTotal: maxTotal,
        entries: [],
        paidList: {} 
    };
    
    installments.push(newInst);
    saveData();
    renderInstallments();
    closeAddModal();
}

function setType(digit) {
    currentDigitLimit = digit;
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const inputNum = document.getElementById('input-number');
    const twoOpts = document.getElementById('two-digit-options');
    const threeOpts = document.getElementById('three-digit-options');

    inputNum.placeholder = "0".repeat(digit);
    inputNum.value = '';

    if(digit === 3) {
        twoOpts.style.display = 'none';
        threeOpts.style.display = 'block';
    } else {
        twoOpts.style.display = 'block';
        threeOpts.style.display = 'none';
    }
}

function limitDigits(el) {
    if (el.value.length > currentDigitLimit) {
        el.value = el.value.slice(0, currentDigitLimit);
    }
}

// ตัวแปรเก็บ ID ที่รอการลบ
let entryIdToDelete = null;

// เปลี่ยนฟังก์ชันลบเดิม เป็นการเปิด Modal ยืนยัน
function deleteEntry(entryId) {
    entryIdToDelete = entryId;
    const inst = installments.find(i => i.id === currentInstallmentId);
    const entry = inst.entries.find(e => e.id === entryId);
    
    // แสดงรายละเอียดในกล่องดีไซน์ใหม่
    const detailBox = document.getElementById('delete-detail');
    detailBox.innerHTML = `
        <span style="font-size: 1rem; color: #999; font-weight: normal; display: block; margin-bottom: 5px;">รายการที่จะลบ:</span>
        ${entry.name}<br>
        <span style="font-size: 1.8rem;">${entry.number}</span> (${entry.amount}.-)
    `;
    
    document.getElementById('delete-confirm-modal').style.display = 'flex';
    
    document.getElementById('confirm-delete-btn').onclick = function() {
        executeDelete();
    };
}

function executeDelete() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    inst.entries = inst.entries.filter(e => e.id !== entryIdToDelete);
    inst.total = inst.entries.reduce((sum, entry) => sum + entry.amount, 0);
    
    saveData();
    updateUI();
    closeDeleteModal();
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal').style.display = 'none';
    entryIdToDelete = null;
}

function updateNameList() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    const names = [...new Set(inst.entries.map(e => e.name))];
    const dataList = document.getElementById('name-list');
    dataList.innerHTML = names.map(n => `<option value="${n}">`).join('');
}

// ระบบ Modal รายชื่อ
function openCustomerModal() {
    const modal = document.getElementById('customer-modal');
    const container = document.getElementById('customer-summary-list');
    const inst = installments.find(i => i.id === currentInstallmentId);
    
    const summary = inst.entries.reduce((acc, entry) => {
        acc[entry.name] = (acc[entry.name] || 0) + entry.amount;
        return acc;
    }, {});

    container.innerHTML = '';
    for(let name in summary) {
        const total = summary[name];
        const div = document.createElement('div');
        div.className = `inst-card`; // ลบ class status-red ออก
        div.style.marginBottom = '12px';
        div.onclick = () => showCustomerDetail(name);
        div.innerHTML = `
            <div class="label-group" style="margin-bottom:0;">
                <span style="font-size:1.2rem;"><b>${name}</b></span>
                <span style="font-size:1.2rem; color:var(--navy);"><b>${total.toLocaleString()}.-</b></span>
            </div>
            <!-- หลอดพลังถูกลบออกแล้ว -->
        `;
        container.appendChild(div);
    }
    document.getElementById('customer-modal').style.display = 'flex';
}

function showCustomerDetail(name) {
    const inst = installments.find(i => i.id === currentInstallmentId);
    const items = inst.entries.filter(e => e.name === name);
    const total = items.reduce((sum, e) => sum + e.amount, 0);

    document.getElementById('detail-name').innerText = "ประวัติของ: " + name;
    document.getElementById('detail-total').innerText = `รวมทั้งหมด: ${total.toLocaleString()}.-`;
    
    const listDiv = document.getElementById('detail-items');
    listDiv.innerHTML = items.map(e => {
        let detailText = ""; // ตัวแปรเก็บข้อความรายละเอียด (บน/ล่าง หรือ ตรง/โต๊ด)

        // กรณีเลข 3 หลัก
        if(e.number.length === 3) {
            detailText = `<span style="font-size:0.85rem; color:#666;">(ตรง:${e.amountStraight || 0} โต๊ด:${e.amountToad || 0})</span> `;
        } 
        // กรณีเลข 2 หลัก (เพิ่มส่วนนี้เข้าไป)
        else if(e.number.length === 2) {
            let labels = [];
            if(e.amountUpper > 0) labels.push(`บน:${e.amountUpper}`);
            if(e.amountLower > 0) labels.push(`ล่าง:${e.amountLower}`);
            detailText = `<span style="font-size:0.85rem; color:#666;">(${labels.join(' ')})</span> `;
        }

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 10px; border-bottom:1px solid #eee; font-size:1.1rem;">
                <span>เลข: <b>${e.number}</b></span>
                <span style="text-align: right;">
                    ${detailText}
                    <b>${e.amount.toLocaleString()}.-</b>
                </span>
            </div>
        `;
    }).join('');

    document.getElementById('detail-modal').style.display = 'flex';
}

function closeCustomerModal() { document.getElementById('customer-modal').style.display = 'none'; }
function closeDetailModal() { document.getElementById('detail-modal').style.display = 'none'; }

function saveData() {
    localStorage.setItem('data_v1', JSON.stringify(installments));
}

// ปิด Modal เมื่อคลิกข้างนอก
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = "none";
    }
}

// ฟังก์ชันปิด Modal เพิ่มงวด
function closeAddModal() {
    const modal = document.getElementById('add-installment-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}


// ฟังก์ชันแจ้งเตือน
function showAlert(msg) {
    document.getElementById('alert-message').innerText = msg;
    document.getElementById('alert-modal').style.display = 'flex';
}

// ผูกฟังก์ชันเข้ากับ Window เพื่อให้ HTML เรียกใช้งานผ่าน onclick ได้ชัวร์ๆ
window.handleGoogleLogin = handleGoogleLogin;
window.openLoginModal = () => document.getElementById('login-modal').style.display = 'flex';
window.closeLoginModal = () => document.getElementById('login-modal').style.display = 'none';
window.renderInstallments = renderInstallments;
// ฟังก์ชันเปิด Modal ในโหมดแก้ไข
window.openEditInstallment = function(id, event) {
    event.stopPropagation(); // กันไม่ให้ไปเปิดหน้างวด
    editingInstallmentId = id;
    const inst = installments.find(i => i.id === id);
    
    document.getElementById('modal-inst-title').innerText = "แก้ไขข้อมูลวันที่/งบ";
    document.getElementById('btn-confirm-inst').innerText = "บันทึกการแก้ไข";
    document.getElementById('new-inst-date').value = inst.rawDate || ""; // วันที่แบบ YYYY-MM-DD
    document.getElementById('new-inst-max-total').value = inst.maxTotal || 100000;
    document.getElementById('add-installment-modal').style.display = 'flex';
};
window.confirmCreateInstallment = function() {
    const rawDate = document.getElementById('new-inst-date').value;
    const maxTotal = parseFloat(document.getElementById('new-inst-max-total').value) || 100000;

    if(!rawDate) { showAlert("กรุณาเลือกวันที่"); return; }

    if (editingInstallmentId) {
        // โหมดแก้ไข
        const inst = installments.find(i => i.id === editingInstallmentId);
        inst.rawDate = rawDate;
        inst.date = formatThaiDate(rawDate);
        inst.maxTotal = maxTotal;
    } else {
        // โหมดสร้างใหม่
        installments.push({ 
            id: Date.now(), 
            rawDate: rawDate,
            date: formatThaiDate(rawDate), 
            total: 0, 
            maxTotal: maxTotal, 
            entries: [], 
            paidList: {} 
        });
    }

    saveData(); 
    renderInstallments(); 
    closeAddModal();
};
// ฟังก์ชันปิด Alert 
function closeAlert() {
    document.getElementById('alert-modal').style.display = 'none';
}

// ฟังก์ชันลบ
function askDeleteInstallment() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    document.getElementById('delete-detail').innerText = `ทั้งงวด: ${inst.date}`;
    document.getElementById('delete-confirm-modal').style.display = 'flex';
    document.getElementById('confirm-delete-btn').onclick = function() { executeDeleteInstallment(); };
}

// ฟังก์ชันลบงวดออกจากระบบจริงๆ
function executeDeleteInstallment() {
    installments = installments.filter(i => i.id !== currentInstallmentId);
    saveData();
    closeDeleteModal();
    backToDashboard(); // กลับไปหน้าแรกทันทีหลังลบ
    renderInstallments(); // วาดหน้างวดใหม่
}

let currentTab = 'number';

function openReportView() {
    document.getElementById('input-view').style.display = 'none';
    document.getElementById('report-view').style.display = 'block';
    document.getElementById('user-list-btn').style.display = 'none';
    document.getElementById('report-btn').style.display = 'none';
    renderReport();
}

function backToInput() {
    document.getElementById('input-view').style.display = 'block';
    document.getElementById('report-view').style.display = 'none';
    document.getElementById('user-list-btn').style.display = 'flex';
    document.getElementById('report-btn').style.display = 'flex';
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    // ซ่อนช่องค้นหาถ้าไม่ใช่หน้าแยกเลข
    document.getElementById('search-box-wrap').style.display = (tab === 'number') ? 'block' : 'none';
    renderReport();
}

function renderReport() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    const content = document.getElementById('report-content');
    const analysisControls = document.getElementById('profit-analysis-controls');
    const personSubTabs = document.getElementById('person-sub-tabs');
    const searchWrap = document.getElementById('search-box-wrap');
    
    content.innerHTML = '';
    analysisControls.style.display = (currentTab === 'profit') ? 'block' : 'none';
    searchWrap.style.display = (currentTab === 'number') ? 'block' : 'none';
    personSubTabs.style.display = (currentTab === 'person') ? 'flex' : 'none';

    // ดึงเลขที่ออก (ถ้ามี)
    const res3 = document.getElementById('result-3-digit').value;
    const res2U = document.getElementById('result-2-upper').value;
    const res2L = document.getElementById('result-2-lower').value;

    if (currentTab === 'person') {
    // 1. เช็คก่อนว่ากรอกเลขรางวัลหรือยัง
    const hasResults = res3 || res2U || res2L;

    // 2. ถ้าเลือกเมนู ถูก/ไม่ถูกรางวัล แต่ยังไม่ได้กรอกเลขรางวัล ให้ขึ้นคำเตือน
    if (personFilter !== 'all' && !hasResults) {
        content.innerHTML = `
            <div style="text-align:center; padding:40px 20px; background:white; border-radius:15px; border:2px dashed #ccc; color:#666;">
                <div style="font-size:3rem; margin-bottom:15px;">📝</div>
                <h3>ยังไม่ได้กรอกเลขรางวัล</h3>
                <p>กรุณาไปที่เมนู <b>"วิเคราะห์กำไร"</b> เพื่อกรอกเลขที่ออกก่อน <br>ระบบจึงจะสามารถแยกรายชื่อผู้ถูกรางวัลให้ได้ครับ</p>
                <button onclick="switchTab('profit')" class="btn-save" style="width:auto; padding:10px 25px; font-size:1rem; margin-top:10px;">ไปกรอกเลขรางวัล</button>
            </div>
        `;
        return; // หยุดการทำงาน ไม่ต้องวาดรายชื่อ
    }

    // --- 3. ส่วนการประมวลผลรายชื่อ (โค้ดเดิมที่ปรับปรุงแล้ว) ---
    const personData = inst.entries.reduce((acc, e) => {
        if (!acc[e.name]) acc[e.name] = { entries: [], totalBet: 0, totalWin: 0 };
        acc[e.name].entries.push(e);
        acc[e.name].totalBet += e.amount;
        
        let win = 0;
        if (e.number.length === 2) {
            if (res2U && e.number === res2U) win += (e.amountUpper || 0) * 70;
            if (res2L && e.number === res2L) win += (e.amountLower || 0) * 70;
        } else if (e.number.length === 3 && res3) {
            if (e.number === res3) win += (e.amountStraight || 0) * 500;
            if (isToad(e.number, res3) && e.number !== res3) win += (e.amountToad || 0) * 100;
        }
        acc[e.name].totalWin += win;
        return acc;
    }, {});

    Object.keys(personData).forEach(name => {
        const data = personData[name];
        const isWinner = data.totalWin > 0;

        if (personFilter === 'winner' && !isWinner) return;
        if (personFilter === 'loser' && isWinner) return;

        const isPaid = inst.paidList && inst.paidList[name];
        const card = document.createElement('div');
        card.className = 'report-card';
        if (isWinner) card.style.borderLeft = "8px solid #f1c40f";

        card.innerHTML = `
            <div class="person-row">
                <span style="font-size:1.4rem;"><b>${name}</b> ${isWinner ? '⭐' : ''}</span>
                <button onclick="togglePaymentStatus('${name}')" class="btn-toggle-pay ${isPaid ? 'btn-status-paid' : 'btn-status-unpaid'}" style="width:auto; padding:5px 15px; margin:0;">
                    ${isPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}
                </button>
            </div>
            
            <div style="background:#f9f9f9; padding:10px; border-radius:10px; margin:10px 0;">
                ${data.entries.map(e => {
                    let detail = e.number.length === 3 
                        ? `(ตรง:${e.amountStraight} โต๊ด:${e.amountToad})` 
                        : `(บน:${e.amountUpper} ล่าง:${e.amountLower})`;
                    return `<div style="font-size:0.85rem; color:#555;">เลข ${e.number} ${detail} = <b>${e.amount}.-</b></div>`;
                }).join('')}
            </div>

            <div class="person-row" style="border-top:1px dashed #ccc; padding-top:10px;">
                <span>ยอดแทงรวม: <b>${data.totalBet.toLocaleString()}.-</b></span>
                <span style="${isWinner ? 'color:#27ae60; font-weight:bold;' : 'color:#999;'}">
                    ${isWinner ? `ถูกรางวัล: ${data.totalWin.toLocaleString()}.-` : 'ไม่ถูกรางวัล'}
                </span>
            </div>
        `;
        content.appendChild(card);
    });

    } else if (currentTab === 'profit') {
        runAnalysis();
    } else {
        renderNumberGroupedReport(inst, content);
    }
}

function filterReport() { renderReport(); }

// ระบบคัดลอกลง LINE
function copyToClipboard() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    let text = `📊 สรุปยอดงวด: ${inst.date}\n`;
    text += `💰 ยอดรวมทั้งหมด: ${inst.total.toLocaleString()} บาท\n`;
    text += `--------------------------\n`;
    
    // ดึงเฉพาะเลขที่ยอดเยอะ 3 อันดับแรก
    const grouped = inst.entries.reduce((acc, e) => {
        acc[e.number] = (acc[e.number] || 0) + e.amount;
        return acc;
    }, {});
    
    const topNums = Object.entries(grouped).sort((a,b) => b[1] - a[1]).slice(0, 5);
    text += `:\n`;
    topNums.forEach(([num, amt]) => {
        text += `เลข ${num} : ${amt} บาท\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        showAlert("คัดลอกสรุปยอดลง Clipboard แล้ว!");
    });
}

// แก้ไขฟังก์ชัน openInstallment เดิม ให้โชว์ปุ่ม Report ด้วย
const oldOpenInstallment = openInstallment;
openInstallment = function(id) {
    oldOpenInstallment(id);
    document.getElementById('report-btn').style.display = 'flex';
}
// ฟังก์ชันสลับสถานะการจ่ายเงิน
function togglePaymentStatus(name) {
    const inst = installments.find(i => i.id === currentInstallmentId);
    if (!inst.paidList) inst.paidList = {}; // สร้าง object เก็บสถานะถ้ายังไม่มี
    
    // สลับค่า true/false
    inst.paidList[name] = !inst.paidList[name];
    
    saveData();
    renderReport(); // วาดหน้าจอใหม่ทันที
}

// ฟังก์ชันเช็คว่าเลข 3 ตัวเป็นเลขสลับ (โต๊ด) หรือไม่
function isToad(entryNum, winNum) {
    if (entryNum.length !== 3 || winNum.length !== 3) return false;
    return entryNum.split('').sort().join('') === winNum.split('').sort().join('');
}

// ฟังก์ชันวิเคราะห์กำไร
function runAnalysis() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    const content = document.getElementById('report-content');
    const res3 = document.getElementById('result-3-digit').value; 
    const res2U = document.getElementById('result-2-upper').value; // บน
    const res2L = document.getElementById('result-2-lower').value; // ล่าง

    let totalPayout = 0;
    let winners3 = [];
    let winners2 = [];

    inst.entries.forEach(e => {
        // --- เลข 2 หลัก ---
        if (e.number.length === 2) {
            // บน
            if (res2U && e.number === res2U && e.amountUpper > 0) {
                let winAmount = e.amountUpper * 70;
                winners2.push({ ...e, winAmount, winType: "2 ตัวบน", displayAmount: e.amountUpper });
                totalPayout += winAmount;
            }
            // ล่าง
            if (res2L && e.number === res2L && e.amountLower > 0) {
                let winAmount = e.amountLower * 70;
                winners2.push({ ...e, winAmount, winType: "2 ตัวล่าง", displayAmount: e.amountLower });
                totalPayout += winAmount;
            }
        } 
        // --- เลข 3 หลัก ---
        else if (e.number.length === 3 && res3) {
    
            // 1. เช็คถูกรางวัล "ตรง"
            // เงื่อนไข: เลขต้องตรงเป๊ะ และ มียอดเงินแทงตรง
            if (e.number === res3 && e.amountStraight > 0) {
                let winAmount = e.amountStraight * 500;
                winners3.push({ 
                    ...e, 
                    winAmount, 
                    winType: "3 ตัวตรง", 
                    displayAmount: e.amountStraight 
                });
                totalPayout += winAmount;
            }

            // 2. เช็คถูกรางวัล "โต๊ด" 
            // เงื่อนไข: 1.สลับตำแหน่งได้ (isToad) 2.เลขต้อง "ไม่ตรงเป๊ะ" (e.number !== res3) 3.มียอดเงินแทงโต๊ด
            if (isToad(e.number, res3) && e.number !== res3 && e.amountToad > 0) {
                let winAmount = e.amountToad * 100;
                winners3.push({ 
                    ...e, 
                    winAmount, 
                    winType: "3 ตัวโต๊ด", 
                    displayAmount: e.amountToad 
                });
                totalPayout += winAmount;
            }
        }
    });

    renderProfitHTML(inst, totalPayout, winners3, winners2, content);
}

// แยกฟังก์ชันแสดงผลออกมาเพื่อให้โค้ดสะอาดขึ้น
function renderProfitHTML(inst, totalPayout, winners3, winners2, content) {
    const netProfit = inst.total - totalPayout;
    let html = `
        <div class="profit-summary-grid">
            <div class="summary-box"><h4>ยอดรับทั้งหมด</h4><p>${inst.total.toLocaleString()}</p></div>
            <div class="summary-box"><h4>ยอดจ่ายทั้งหมด</h4><p style="color:var(--red)">${totalPayout.toLocaleString()}</p></div>
            <div class="summary-box net-profit">
                <h4>กำไร/ขาดทุนสุทธิ</h4>
                <p class="${netProfit >= 0 ? 'text-profit' : 'text-loss'}">${netProfit.toLocaleString()} บาท</p>
            </div>
        </div>
        <h3 style="margin:25px 0 10px; color:var(--navy); border-bottom:2px solid #ddd;">รายชื่อผู้ถูกรางวัล</h3>
    `;

    // แสดงหมวด 3 ตัว
    html += `<h4 style="margin:15px 0 5px;">⭐ หมวดเลข 3 ตัว</h4>`;
    if(winners3.length === 0) html += `<div class="report-card" style="text-align:center; color:#999;">ไม่มีผู้ถูกรางวัล</div>`;
    winners3.forEach(w => {
        html += generateWinnerCard(w, inst);
    });

    // แสดงหมวด 2 ตัว
    html += `<h4 style="margin:20px 0 5px;">⭐ หมวดเลข 2 ตัว</h4>`;
    if(winners2.length === 0) html += `<div class="report-card" style="text-align:center; color:#999;">ไม่มีผู้ถูกรางวัล</div>`;
    winners2.forEach(w => {
        html += generateWinnerCard(w, inst);
    });

    content.innerHTML = html;
}

// ฟังก์ชันเสริมสำหรับสร้าง HTML การ์ดผู้ชนะ (เพื่อลดความซ้ำซ้อนของโค้ด)
function generateWinnerCard(w, inst) {
    const displayAmt = w.displayAmount || w.amount; 
    return `
        <div class="report-card winner-item" style="border-left: 5px solid ${w.winType.includes('โต๊ด') ? '#3498db' : '#f1c40f'}; margin-bottom: 10px;">
            <div class="person-row" style="margin-bottom: 0; padding: 5px 0;">
                <span>
                    <b>${w.name}</b> 
                    <span style="font-size: 0.9rem; color: #666;">(${w.winType}: ${w.number})</span>
                    <br>
                    <span style="color:#888; font-size:0.85rem;">(ทุนเดิมพัน: ${displayAmt.toLocaleString()}.-)</span>
                </span>
                <span class="text-profit" style="font-size: 1.3rem; font-weight: 700;">
                    ถูก ${w.winAmount.toLocaleString()}.-
                </span>
            </div>
        </div>
    `;
}
// ฟังก์ชันเสริมสำหรับแยกตามเลข 
function renderNumberGroupedReport(inst, content) {
    const searchTerm = document.getElementById('search-number').value;
    content.innerHTML = ''; 

    // 1. จัดโครงสร้างข้อมูลใหม่: [เลข][ประเภท] = { รายชื่อ, ยอดรวมประเภท }
    const grouped = inst.entries.reduce((acc, e) => {
        if (searchTerm && !e.number.includes(searchTerm)) return acc;
        
        if (!acc[e.number]) acc[e.number] = {};

        // ฟังก์ชันช่วยในการเพิ่มข้อมูลลงกลุ่มย่อย
        const addSubGroup = (type, amt) => {
            if (amt <= 0) return;
            if (!acc[e.number][type]) acc[e.number][type] = { items: [], subTotal: 0 };
            acc[e.number][type].items.push({ name: e.name, amount: amt });
            acc[e.number][type].subTotal += amt;
        };

        if (e.number.length === 2) {
            addSubGroup('บน', e.amountUpper || 0);
            addSubGroup('ล่าง', e.amountLower || 0);
        } else {
            addSubGroup('ตรง', e.amountStraight || 0);
            addSubGroup('โต๊ด', e.amountToad || 0);
        }
        return acc;
    }, {});

    const sortedNums = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    if (sortedNums.length === 0) {
        content.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">ไม่พบข้อมูลตัวเลข</div>`;
        return;
    }

    // 2. วาดการ์ดแสดงผล
    sortedNums.forEach(num => {
        const types = grouped[num];
        const card = document.createElement('div');
        card.className = 'report-card';
        
        let typesHtml = '';
        for (const [typeName, data] of Object.entries(types)) {
            const badgeClass = (typeName === 'บน' || typeName === 'ตรง') ? 'badge-upper' : 'badge-lower';
            
            typesHtml += `
                <div class="num-group-box">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-left:4px solid ${typeName==='บน'||typeName==='ตรง'?'#3498db':'#e74c3c'}; padding-left:10px;">
                        <span class="type-badge ${badgeClass}">${typeName}</span>
                        <b style="color:var(--navy)">รวม ${typeName}: ${data.subTotal.toLocaleString()}.-</b>
                    </div>
                    ${data.items.map(item => `
                        <div class="person-row" style="padding-left:15px; font-size:0.95rem;">
                            <span>${item.name}</span>
                            <span style="color:#555;">${item.amount.toLocaleString()}.-</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="num-header" style="background:#f8f9fa; margin:-15px -15px 15px -15px; padding:12px 15px; border-radius:15px 15px 0 0;">
                <span class="num-title" style="color:var(--dark-blue)">เลข ${num}</span>
            </div>
            ${typesHtml}
        `;
        content.appendChild(card);
    });
}
    

    drawCards(group2, "📊 หมวดเลข 2 หลัก (00-99)");
    drawCards(group3, "📊 หมวดเลข 3 หลัก (000-999)");

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}


// แก้ไขฟังก์ชัน window.onclick เดิมเพื่อให้ปิด Login Modal ได้ด้วย
window.onclick = function(event) {
    const loginModal = document.getElementById('login-modal');
    const custModal = document.getElementById('customer-modal');
    const detailModal = document.getElementById('detail-modal');
    const addModal = document.getElementById('add-installment-modal');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const alertModal = document.getElementById('alert-modal');
    const logoutModal = document.getElementById('logout-confirm-modal'); // เพิ่มบรรทัดนี้

    if (event.target == loginModal) closeLoginModal();
    if (event.target == custModal) closeCustomerModal();
    if (event.target == detailModal) closeDetailModal();
    if (event.target == addModal) closeAddModal();
    if (event.target == deleteModal) closeDeleteModal();
    if (event.target == alertModal) closeAlert();
    if (event.target == logoutModal) closeLogoutModal(); // เพิ่มบรรทัดนี้
}
// --- ส่วนจัดการหน้าต่าง Login Modal ---

// ฟังก์ชันเปิดหน้าต่างล็อกอิน
function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        console.error("หา id 'login-modal' ไม่เจอในไฟล์ HTML");
    }
}

// ฟังก์ชันปิดหน้าต่างล็อกอิน
function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

// แก้ไขฟังก์ชัน window.onclick เดิม ให้รองรับการคลิกข้างนอกเพื่อปิด Modal ล็อกอินด้วย
window.onclick = function(event) {
    const loginModal = document.getElementById('login-modal');
    const custModal = document.getElementById('customer-modal');
    const detailModal = document.getElementById('detail-modal');
    const addModal = document.getElementById('add-installment-modal');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const alertModal = document.getElementById('alert-modal');

    if (event.target == loginModal) closeLoginModal();
    if (event.target == custModal) closeCustomerModal();
    if (event.target == detailModal) closeDetailModal();
    if (event.target == addModal) closeAddModal();
    if (event.target == deleteModal) closeDeleteModal();
    if (event.target == alertModal) closeAlert();
}

function setPersonFilter(filter) {
    personFilter = filter;
    
    // ค้นหาปุ่มทั้งหมดใน Sub-tab
    const buttons = document.querySelectorAll('#person-sub-tabs .tab-btn');
    
    buttons.forEach(btn => {
        btn.classList.remove('active'); // เอาสีขาวออกก่อนทุกปุ่ม
        
        // เช็คเงื่อนไขเพื่อใส่สีขาวให้ปุ่มที่ถูกเลือก
        if (filter === 'all' && btn.innerText === 'ทั้งหมด') btn.classList.add('active');
        if (filter === 'winner' && btn.innerText === 'ถูกรางวัล') btn.classList.add('active');
        if (filter === 'loser' && btn.innerText === 'ไม่ถูกรางวัล') btn.classList.add('active');
    });
    
    renderReport(); // วาดหน้าจอใหม่
}