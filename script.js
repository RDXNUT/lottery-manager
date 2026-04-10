let currentUser = null;
let installments = JSON.parse(localStorage.getItem('data_v1')) || [];
let currentInstallmentId = null;
let currentDigitLimit = 2;

// ตรวจสอบสถานะการล็อกอิน
function initAuth() {
    if (window.fbMethods) {
        window.fbMethods.onAuthStateChanged(window.fbAuth, (user) => {
            if (user) {
                currentUser = user;
                document.getElementById('login-nav-btn').innerText = user.displayName;
                document.querySelector('.demo-badge').innerText = "☁️ คลาวด์ซิงค์";
                document.querySelector('.demo-badge').style.color = "#2ecc71";
                loadDataFromCloud();
            } else {
                currentUser = null;
                document.getElementById('login-nav-btn').innerText = "เข้าสู่ระบบ";
                document.querySelector('.demo-badge').innerText = "โหมดทดลองใช้";
                document.querySelector('.demo-badge').style.color = "rgba(255,255,255,0.7)";
                installments = JSON.parse(localStorage.getItem('data_v1')) || [];
                renderInstallments();
            }
        });
    }
}
setTimeout(initAuth, 1000); // หน่วงเวลาเล็กน้อยเพื่อให้ Firebase พร้อมใช้งาน
// --- ฟังก์ชันจัดการ Modal (รวมชุดเดียว) ---
window.openLoginModal = function() { document.getElementById('login-modal').style.display = 'block'; }
window.closeLoginModal = function() { document.getElementById('login-modal').style.display = 'none'; }
window.closeAddModal = function() { document.getElementById('add-installment-modal').style.display = 'none'; }
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

// 2. ฟังก์ชันล็อกอิน Google
async function handleGoogleLogin() {
    try {
        if (!window.fbMethods) throw new Error("Firebase ยังไม่โหลด");
        await window.fbMethods.signInWithPopup(window.fbAuth, window.fbProvider);
        closeLoginModal();
    } catch (error) {
        console.error("Login Error:", error);
        showAlert("เข้าสู่ระบบไม่สำเร็จ หรือรอระบบโหลดสักครู่");
    }
}

// ฟังก์ชันบันทึกข้อมูล
async function saveData() {
    localStorage.setItem('data_v1', JSON.stringify(installments));
    if (currentUser && window.fbMethods) {
        try {
            const userRef = window.fbMethods.ref(window.fbDb, 'users/' + currentUser.uid);
            await window.fbMethods.set(userRef, { 
                installments: installments,
                lastUpdate: Date.now()
            });
        } catch (e) { console.error("Cloud Sync Error: ", e); }
    }
}

// ฟังก์ชันโหลดข้อมูล
async function loadDataFromCloud() {
    if (!currentUser || !window.fbMethods) return;
    const dbRef = window.fbMethods.ref(window.fbDb);
    try {
        const snapshot = await window.fbMethods.get(window.fbMethods.child(dbRef, `users/${currentUser.uid}`));
        if (snapshot.exists()) {
            installments = snapshot.val().installments || [];
            renderInstallments();
        }
    } catch (error) { console.error("Load Error: ", error); }
}

document.getElementById('user-list-btn').style.display = 'none';
document.getElementById('report-btn').style.display = 'none';
const MAX_INSTALLMENT_LIMIT = 100000;
const MAX_PERSON_LIMIT = 5000;

// เริ่มต้นโปรแกรม
renderInstallments();

function renderInstallments() {
    const list = document.getElementById('installment-list');
    list.innerHTML = '';
    
    installments.forEach(inst => {

        const limit = inst.maxTotal || 100000;
        const percent = (inst.total / limit) * 100;
        
        let colorClass = 'bg-green';
        if(percent >= 100) colorClass = 'bg-red';
        else if(percent >= 80) colorClass = 'bg-yellow';

        const card = document.createElement('div');
        card.className = 'inst-card';
        card.onclick = () => openInstallment(inst.id);
        card.innerHTML = `
            <h3>${inst.date}</h3>
            <div class="label-group">
                <span>ยอดรวม: <b>${inst.total.toLocaleString()}.-</b></span>
                <span>${percent.toFixed(0)}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-fill ${colorClass}" style="width: ${Math.min(percent, 100)}%"></div>
            </div>
        `;
        list.appendChild(card);
    });
}

function createNewInstallment() {
    document.getElementById('add-installment-modal').style.display = 'block';
    document.getElementById('new-inst-date').value = ''; // ล้างค่าเก่า
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

function openInstallment(id) {
    currentInstallmentId = id;
    const inst = installments.find(i => i.id === id);
    
    document.getElementById('view-title').innerText = inst.date;
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('input-view').style.display = 'block';
    
    // แสดงปุ่ม "รายชื่อ" และ "สรุปยอด" แบบ Flex
    document.getElementById('user-list-btn').style.display = 'flex';
    document.getElementById('report-btn').style.display = 'flex';
    
    updateUI();
    updateNameList();
}

function backToDashboard() {
    document.getElementById('view-title').innerText = "รายการงวดทั้งหมด";
    
    // สลับหน้าจอ
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('input-view').style.display = 'none';
    document.getElementById('report-view').style.display = 'none';
    
    // สั่งซ่อนปุ่มใน Header
    document.getElementById('user-list-btn').style.display = 'none';
    document.getElementById('report-btn').style.display = 'none';
    
    renderInstallments();
}

function setType(digit) {
    currentDigitLimit = digit;
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('input-number').placeholder = "0".repeat(digit);
    document.getElementById('input-number').value = '';
}

function limitDigits(el) {
    if (el.value.length > currentDigitLimit) {
        el.value = el.value.slice(0, currentDigitLimit);
    }
}

function saveEntry() {
    const name = document.getElementById('cust-name').value;
    const num = document.getElementById('input-number').value;
    const amount = parseFloat(document.getElementById('input-amount').value);

    if(!name || !num || isNaN(amount)) {
        showAlert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    const inst = installments.find(i => i.id === currentInstallmentId);
    inst.entries.unshift({
        id: Date.now(),
        name: name,
        number: num,
        amount: amount
    });
    
    // คำนวณยอดรวมใหม่
    inst.total = inst.entries.reduce((sum, entry) => sum + entry.amount, 0);
    
    saveData();
    updateUI();
    updateNameList();
    
    // ล้างค่าหลังบันทึก (ยกเว้นชื่อ เผื่อแทงต่อ)
    document.getElementById('input-number').value = '';
    document.getElementById('input-amount').value = '';
    document.getElementById('input-number').focus();
}

function updateUI() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    
    // เปลี่ยนจากค่าคงที่ MAX_INSTALLMENT_LIMIT เป็น inst.maxTotal
    const limit = inst.maxTotal || 100000; 
    const percent = (inst.total / limit) * 100;
    
    const fill = document.getElementById('main-progress-fill');
    document.getElementById('total-progress-text').innerText = `${inst.total.toLocaleString()} / ${limit.toLocaleString()}`;
    fill.style.width = Math.min(percent, 100) + '%';
    
    // เปลี่ยนสีตาม Logic ที่ระบุ
    fill.className = 'progress-fill';
    if(percent >= 100) fill.classList.add('bg-red');      // เกินลิมิต
    else if(percent >= 80) fill.classList.add('bg-yellow'); // ใกล้เต็ม
    else fill.classList.add('bg-green');                 // ปกติ

    // ... ส่วนแสดงรายการล่าสุดคงเดิม ...
    const recentDiv = document.getElementById('recent-entries');
    recentDiv.innerHTML = '';
    inst.entries.slice(0, 5).forEach(entry => {
        const item = document.createElement('div');
        item.className = 'entry-item';
        item.innerHTML = `
            <div class="info">${entry.name}: <span style="color:var(--navy)">${entry.number}</span> (${entry.amount}.-)</div>
            <button class="btn-delete" onclick="deleteEntry(${entry.id})">
                <!-- ใส่ไอคอนถังขยะ SVG แทนของเดิม -->
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        `;
        recentDiv.appendChild(item);
    });
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
    
    document.getElementById('delete-confirm-modal').style.display = 'block';
    
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
    modal.style.display = 'block';
}

function showCustomerDetail(name) {
    const inst = installments.find(i => i.id === currentInstallmentId);
    const items = inst.entries.filter(e => e.name === name);
    const total = items.reduce((sum, e) => sum + e.amount, 0);

    document.getElementById('detail-name').innerText = "ประวัติของ: " + name;
    document.getElementById('detail-total').innerText = `รวมทั้งหมด: ${total.toLocaleString()}.-`;
    
    const listDiv = document.getElementById('detail-items');
    listDiv.innerHTML = items.map(e => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; font-size:1.2rem;">
            <span>เลข: <b>${e.number}</b></span>
            <span>${e.amount}.-</span>
        </div>
    `).join('');

    document.getElementById('detail-modal').style.display = 'block';
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



// ฟังก์ชันสำหรับเรียกใช้งาน Alert แบบสวยงาม
function showAlert(msg) {
    document.getElementById('alert-message').innerText = msg;
    document.getElementById('alert-modal').style.display = 'block';
}
// ผูกฟังก์ชันเข้ากับ Window เพื่อให้ HTML เรียกใช้งานผ่าน onclick ได้ชัวร์ๆ
window.handleGoogleLogin = handleGoogleLogin;
window.renderInstallments = renderInstallments;
window.createNewInstallment = function() {
    document.getElementById('add-installment-modal').style.display = 'block';
    document.getElementById('new-inst-date').value = '';
    document.getElementById('new-inst-date').focus();
};
window.confirmCreateInstallment = function() {
    const dateInput = document.getElementById('new-inst-date');
    const dateStr = dateInput.value;
    const maxTotal = parseFloat(document.getElementById('new-inst-max-total').value) || 100000;
    if(!dateStr) { showAlert("กรุณาระบุวันที่"); return; }
    installments.push({ id: Date.now(), date: dateStr, total: 0, maxTotal: maxTotal, entries: [], paidList: {} });
    saveData(); renderInstallments(); closeAddModal();
};

// ฟังก์ชันปิด Alert 
function closeAlert() {
    document.getElementById('alert-modal').style.display = 'none';
}

// ฟังก์ชันถามก่อนลบทั้งงวด
function askDeleteInstallment() {
    const inst = installments.find(i => i.id === currentInstallmentId);
    
    // ตั้งค่าข้อความใน Modal ยืนยันการลบที่มีอยู่แล้ว
    document.getElementById('delete-detail').innerText = `ทั้งงวด: ${inst.date} (ยอดรวม ${inst.total.toLocaleString()}.-)`;
    document.getElementById('delete-confirm-modal').style.display = 'block';
    
    // เปลี่ยนคำสั่งปุ่มยืนยันให้เป็นการลบทั้งงวดแทน
    document.getElementById('confirm-delete-btn').onclick = function() {
        executeDeleteInstallment();
    };
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
    content.innerHTML = '';

    // แสดง/ซ่อน ช่องกรอกเลขรางวัล
    analysisControls.style.display = (currentTab === 'profit') ? 'block' : 'none';

    if (currentTab === 'person') {
        const perPerson = inst.entries.reduce((acc, e) => {
            acc[e.name] = (acc[e.name] || 0) + e.amount;
            return acc;
        }, {});

        Object.keys(perPerson).forEach(name => {
            const isPaid = inst.paidList && inst.paidList[name];
            const card = document.createElement('div');
            card.className = 'report-card';
            card.innerHTML = `
                <div class="person-row" style="font-size:1.3rem;">
                    <span><b>${name}</b></span>
                    <span style="color:var(--green)"><b>${perPerson[name].toLocaleString()}.-</b></span>
                </div>
                <button onclick="togglePaymentStatus('${name}')" 
                        class="btn-toggle-pay ${isPaid ? 'btn-status-paid' : 'btn-status-unpaid'}">
                    ${isPaid ? 'จ่ายเงินแล้ว' : 'จ่ายเงิน'}
                </button>
            `;
            content.appendChild(card);
        });

    } else if (currentTab === 'profit') {
        runAnalysis(); // เรียกใช้ฟังก์ชันคำนวณกำไร
    } else {
        // ส่วน 'number' (แยกตามเลข) คงเดิมจากโค้ดเก่า
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
    const res3 = document.getElementById('result-3-digit').value; // เลข 3 ตัวตรง
    const res2 = document.getElementById('result-2-digit').value; // เลข 2 ตัวตรง

    let totalPayout = 0;
    let winners = [];

    inst.entries.forEach(e => {
        let winAmount = 0;
        let winType = "";

        if (e.number.length === 2 && res2 && e.number === res2) {
            // 2 ตัวตรง (x70)
            winAmount = e.amount * 70;
            winType = "2 ตัวตรง";
        } else if (e.number.length === 3 && res3) {
            if (e.number === res3) {
                // 3 ตัวตรง (x500)
                winAmount = e.amount * 500;
                winType = "3 ตัวตรง";
            } else if (isToad(e.number, res3)) {
                // 3 ตัวโต๊ด (x150)
                winAmount = e.amount * 150;
                winType = "3 ตัวโต๊ด";
            }
        }

        if (winAmount > 0) {
            winners.push({ ...e, winAmount, winType });
            totalPayout += winAmount;
        }
    });

    const netProfit = inst.total - totalPayout;

    let html = `
        <div class="profit-summary-grid">
            <div class="summary-box"><h4>ยอดรับทั้งหมด</h4><p>${inst.total.toLocaleString()}</p></div>
            <div class="summary-box"><h4>ยอดจ่ายทั้งหมด</h4><p style="color:var(--red)">${totalPayout.toLocaleString()}</p></div>
            <div class="summary-box net-profit">
                <h4>กำไร/ขาดทุนสุทธิ</h4>
                <p class="${netProfit >= 0 ? 'text-profit' : 'text-loss'}">
                    ${netProfit.toLocaleString()} บาท
                </p>
            </div>
        </div>
    `;

    html += `<h3 style="margin: 20px 0 10px 5px;">2. ผู้โชคดี</h3>`;
    if (winners.length === 0) {
        html += `<div class="report-card" style="text-align:center; color:#999;">ยังไม่มีผู้ถูกรางวัล</div>`;
    } else {
        winners.forEach(w => {
            const isPaid = inst.paidList && inst.paidList[w.name];
            html += `
                <div class="report-card winner-item" style="border-left: 5px solid ${w.winType.includes('โต๊ด') ? '#3498db' : '#f1c40f'}">
                    <div class="person-row">
                        <span><b>${w.name}</b> (${w.winType}: ${w.number})</span>
                        <span class="text-profit">ถูก ${w.winAmount.toLocaleString()}.-</span>
                    </div>
                    <button onclick="togglePaymentStatus('${w.name}')" 
                            class="btn-toggle-pay ${isPaid ? 'btn-status-paid' : 'btn-status-unpaid'}">
                        ${isPaid ? 'จ่ายเงินแล้ว' : 'จ่ายเงิน'}
                    </button>
                </div>
            `;
        });
    }
    // ส่วนที่ 3 (ยอดตัดส่ง) 
    content.innerHTML = html;
}
// ฟังก์ชันเสริมสำหรับแยกตามเลข 
function renderNumberGroupedReport(inst, content) {
    // 1. กลุ่มข้อมูลตามเลข
    const grouped = inst.entries.reduce((acc, e) => {
        if (!acc[e.number]) acc[e.number] = { items: [], total: 0 };
        acc[e.number].items.push(e);
        acc[e.number].total += e.amount;
        return acc;
    }, {});

    // 2. แปลงเป็น Array และเรียงลำดับตาม total (มากไปน้อย)
    const sortedNumbers = Object.keys(grouped).sort((a, b) => grouped[b].total - grouped[a].total);

    // 3. แสดงผล
    sortedNumbers.forEach(num => {
        const data = grouped[num];
        const card = document.createElement('div');
        card.className = 'report-card';
        card.innerHTML = `
            <div class="num-header">
                <span class="num-title">เลข ${num}</span>
                <b style="color:var(--navy); font-size:1.3rem;">รวม: ${data.total.toLocaleString()}.-</b>
            </div>
            ${data.items.map(e => `<div class="person-row"><span>${e.name}</span> <span>${e.amount.toLocaleString()}.-</span></div>`).join('')}
        `;
        content.appendChild(card);
    });
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

// ฟังก์ชันสำหรับเชื่อมต่อ Firebase (ทำปุ่มรอไว้ก่อน)
function handleGoogleLogin() {
    console.log("กำลังเชื่อมต่อกับ Firebase Google Auth...");
    // หลังจากนี้ค่อยเอาโค้ด Firebase Auth มาใส่ตรงนี้
    showAlert("ระบบล็อกอินจะเปิดใช้งานเร็วๆ นี้ (Firebase Setup Required)");
}

// แก้ไขฟังก์ชัน window.onclick เดิมเพื่อให้ปิด Login Modal ได้ด้วย
window.onclick = function(event) {
    const loginModal = document.getElementById('login-modal');
    const customerModal = document.getElementById('customer-modal');
    const detailModal = document.getElementById('detail-modal');
    const addModal = document.getElementById('add-installment-modal');
    
    if (event.target == loginModal) closeLoginModal();
    if (event.target == customerModal) closeCustomerModal();
    if (event.target == detailModal) closeDetailModal();
    if (event.target == addModal) closeAddModal();
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