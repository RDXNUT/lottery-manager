let editingInstallmentId = null; // เก็บ ID เมื่อมีการแก้ไข

// ฟังก์ชันแปลงวันที่ 2024-04-16 เป็น "16 เมษายน 2567"
function formatThaiDate(dateStr) {
    if(!dateStr) return "";
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    
    // แยกปี-เดือน-วัน จากรูปแบบ YYYY-MM-DD
    const parts = dateStr.split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    let day = parseInt(parts[2]);

    // ตรวจสอบ: ถ้าปีที่ส่งมาต่ำกว่า 2400 (เช่น 2024) ให้บวก 543 เพื่อเป็น พ.ศ.
    // แต่ถ้าปีส่งมาเกิน 2400 อยู่แล้ว (เช่น 2567) แสดงว่าเป็น พ.ศ. อยู่แล้ว "ไม่ต้องบวกเพิ่ม"
    if (year < 2400) {
        year = year + 543;
    }

    return `${day} ${months[month]} ${year}`;
}

let currentUser = null;
let installments = [];
let currentInstallmentId = null;
let currentDigitLimit = 2;
let isCloudDataLoaded = false; // ตัวแปรป้องกันการเขียนทับข้อมูลเดิม


// --- 1. ระบบจัดการ Auth และปุ่ม Header ---
function initApp() {
    if (!window.fbMethods) {
        setTimeout(initApp, 100);
        return;
    }

    window.fbMethods.onAuthStateChanged(window.fbAuth, async (user) => {
        const badge = document.querySelector('.demo-badge');
        const loginBtn = document.getElementById('login-nav-btn');

        if (user) {
            // --- กรณีมีผู้ใช้ล็อกอิน (หรือรีเฟรชหน้าจอแล้วยังล็อกอินอยู่) ---
            currentUser = user;
            loginBtn.innerText = user.displayName;
            loginBtn.onclick = () => askLogout(); 
            badge.innerText = "☁️ คลาวด์ซิงค์";
            badge.style.color = "#2ecc71";
            
            isCloudDataLoaded = false; // บล็อกการเซฟชั่วคราวระหว่างรอโหลดจาก Cloud
            await loadDataFromCloud();
        } else {
            // --- กรณีไม่ได้ล็อกอิน หรือเพิ่งสั่ง Logout ---
            currentUser = null;
            isCloudDataLoaded = true; // ให้เซฟลงเครื่องได้ตามปกติ
            loginBtn.innerText = "เข้าสู่ระบบ";
            loginBtn.onclick = () => openLoginModal(); 

            badge.innerText = "โหมดทดลองใช้";
            badge.style.color = "rgba(255,255,255,0.7)";
            
            // ดึงข้อมูลจากเครื่องมาแสดง
            const localData = localStorage.getItem('data_v1');
            installments = localData ? JSON.parse(localData) : [];
            renderInstallments();
        }
    });
}
// เรียกใช้งาน
initApp();

// 1. เปลี่ยนฟังก์ชันถามออกจากระบบเดิม
function askLogout() {
    const msg = `คุณต้องการออกจากระบบ\n(บัญชี: ${currentUser.displayName})\nใช่หรือไม่?`;
    document.getElementById('logout-message').innerText = msg;
    document.getElementById('logout-confirm-modal').style.display = 'flex'; // เปิดป๊อปอัพ
}

// 2. ฟังก์ชันสั่งออกจากระบบจริงๆ (เรียกใช้เมื่อกดปุ่มในป๊อปอัพ)
window.executeLogout = function() {
    window.fbMethods.signOut(window.fbAuth).then(() => {
        console.log("Logged Out");
        
        // --- ล้างข้อมูลทุกอย่างออกจากเครื่องทันที ---
        currentUser = null;
        installments = []; // ล้างอาเรย์ข้อมูล
        localStorage.removeItem('data_v1'); // ลบข้อมูลที่เซฟค้างในเครื่อง
        isCloudDataLoaded = false;
        
        // วาดหน้าจอใหม่ (จะกลายเป็นหน้าว่างสำหรับโหมดทดลอง)
        renderInstallments();
        
        closeLogoutModal();
    });
}
// 3. ฟังก์ชันปิดป๊อปอัพออกจากระบบ
window.closeLogoutModal = function() {
    document.getElementById('logout-confirm-modal').style.display = 'none';
}

// ฟังก์ชันโหลดข้อมูลจาก Cloud ---
async function loadDataFromCloud() {
    if (!currentUser) return;
    const dbRef = window.fbMethods.ref(window.fbDb);
    
    try {
        const snapshot = await window.fbMethods.get(window.fbMethods.child(dbRef, `users/${currentUser.uid}`));
        
        if (snapshot.exists()) {
            const data = snapshot.val().installments;
            // ดึงข้อมูลจาก Cloud มาใส่ในตัวแปรหลัก
            installments = Array.isArray(data) ? data : (data ? Object.values(data) : []);
            console.log("✅ โหลดข้อมูลจาก Cloud สำเร็จ");
        } else {
            // ถ้าบัญชีนี้ไม่มีข้อมูลใน Cloud จริงๆ ให้เริ่มที่ว่างเปล่า
            console.log("🆕 บัญชีใหม่: ไม่มีข้อมูลใน Cloud");
            installments = [];
        }
        
        isCloudDataLoaded = true; // ปลดล็อกให้สามารถเซฟข้อมูลได้
        renderInstallments();    // วาดหน้าจอ
        
        // เซฟลง LocalStorage สำรองไว้ด้วยเพื่อให้รีเฟรชครั้งหน้าเร็วขึ้น
        localStorage.setItem('data_v1', JSON.stringify(installments));
        
    } catch (error) {
        console.error("❌ Load Error:", error);
        isCloudDataLoaded = true;
    }
}

// --- 3. ฟังก์ชันบันทึกข้อมูล (ปรับปรุงใหม่) ---
async function saveData() {
    // 1. ถ้ายังโหลดข้อมูลจาก Cloud ไม่เสร็จ ห้ามเซฟทับเด็ดขาด!
    if (!isCloudDataLoaded) {
        console.log("⚠️ รอก่อน... ระบบกำลังโหลดข้อมูล ห้ามเซฟทับ");
        return;
    }

    // 2. เซฟลงเครื่องเสมอ
    localStorage.setItem('data_v1', JSON.stringify(installments));

    // 3. ถ้าล็อกอินอยู่ ให้ส่งขึ้น Cloud
    if (currentUser) {
        try {
            const userRef = window.fbMethods.ref(window.fbDb, 'users/' + currentUser.uid);
            await window.fbMethods.set(userRef, { 
                installments: installments,
                lastUpdate: Date.now(),
                userName: currentUser.displayName
            });
            console.log("☁️ ซิงค์ Cloud สำเร็จ");
        } catch (e) {
            console.error("☁️ Sync Error:", e);
        }
    }
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

// --- ฟังก์ชันจัดการ Modal (รวมชุดเดียว) ---
window.openLoginModal = function() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'flex'; // *** ต้องเป็น flex เท่านั้น ***
}

window.closeLoginModal = function() {
    document.getElementById('login-modal').style.display = 'none';
}
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
        // ใช้ฟังก์ชัน formatThaiDate แสดงผลวันที่
        const displayDate = inst.rawDate ? formatThaiDate(inst.rawDate) : inst.date;

        card.innerHTML = `
            <button class="btn-edit-inst" onclick="openEditInstallment(${inst.id}, event)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <div onclick="openInstallment(${inst.id})">
                <h3>${displayDate}</h3>
                <div class="label-group">
                    <span>ยอดรวม: <b>${inst.total.toLocaleString()}.-</b></span>
                    <span>${percent.toFixed(0)}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-fill ${colorClass}" style="width: ${Math.min(percent, 100)}%"></div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

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
    
    const inputNum = document.getElementById('input-number');
    const normalAmt = document.getElementById('input-amount');
    const threeOpts = document.getElementById('three-digit-options');

    inputNum.placeholder = "0".repeat(digit);
    inputNum.value = '';

    if(digit === 3) {
        normalAmt.style.display = 'none'; // ซ่อนช่องเงินปกติ
        threeOpts.style.display = 'block'; // โชว์ช่อง ตรง/โต๊ด
    } else {
        normalAmt.style.display = 'block';
        threeOpts.style.display = 'none';
    }
}

function limitDigits(el) {
    if (el.value.length > currentDigitLimit) {
        el.value = el.value.slice(0, currentDigitLimit);
    }
}

function saveEntry() {
    const name = document.getElementById('cust-name').value;
    const num = document.getElementById('input-number').value;
    const inst = installments.find(i => i.id === currentInstallmentId);
    
    if(!name || !num) { showAlert("กรุณากรอกชื่อและตัวเลข"); return; }

    let entryData = { id: Date.now(), name: name, number: num };

    if (currentDigitLimit === 3) {
        const amtS = parseFloat(document.getElementById('amt-straight').value) || 0;
        const amtT = parseFloat(document.getElementById('amt-toad').value) || 0;
        const isS = document.getElementById('check-straight').checked;
        const isT = document.getElementById('check-toad').checked;

        if ((isS && amtS > 0) || (isT && amtT > 0)) {
            entryData.amountStraight = isS ? amtS : 0;
            entryData.amountToad = isT ? amtT : 0;
            entryData.amount = entryData.amountStraight + entryData.amountToad;
        } else {
            showAlert("กรุณาระบุจำนวนเงิน ตรง หรือ โต๊ด"); return;
        }
    } else {
        const amt = parseFloat(document.getElementById('input-amount').value);
        if (isNaN(amt) || amt <= 0) { showAlert("กรุณาระบุจำนวนเงิน"); return; }
        entryData.amount = amt;
    }

    inst.entries.unshift(entryData);
    inst.total = inst.entries.reduce((sum, e) => sum + e.amount, 0);
    
    saveData(); updateUI(); updateNameList();
    document.getElementById('input-number').value = '';
    document.getElementById('amt-straight').value = '';
    document.getElementById('amt-toad').value = '';
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
        let amtText = `${e.amount}.-`;
        if(e.number.length === 3) {
            amtText = `<span style="font-size:0.9rem; color:#666;">(ตรง:${e.amountStraight} โต๊ด:${e.amountToad})</span> ${e.amount}.-`;
        }
        return `
            <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; font-size:1.1rem;">
                <span>เลข: <b>${e.number}</b></span>
                <span>${amtText}</span>
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
window.closeAlert = () => document.getElementById('alert-modal').style.display = 'none';
window.renderInstallments = renderInstallments;
// ฟังก์ชันเปิดเพิ่มงวด
window.createNewInstallment = function() {
    editingInstallmentId = null; // ล้าง ID การแก้ไข
    document.getElementById('modal-inst-title').innerText = "สร้างงวดใหม่";
    document.getElementById('btn-confirm-inst').innerText = "ตกลงสร้างงวด";
    document.getElementById('new-inst-date').value = '';
    document.getElementById('new-inst-max-total').value = 100000;
    document.getElementById('add-installment-modal').style.display = 'flex';
};
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
    const res3 = document.getElementById('result-3-digit').value; // เลขที่ออก 3 ตัว
    const res2 = document.getElementById('result-2-digit').value; // เลขที่ออก 2 ตัว

    let totalPayout = 0;
    let winners3 = [];
    let winners2 = [];

    inst.entries.forEach(e => {
        // --- กรณีเลข 2 หลัก (เหมือนเดิม) ---
        if (e.number.length === 2 && res2 && e.number === res2) {
            let winAmount = e.amount * 70;
            winners2.push({ ...e, winAmount, winType: "2 ตัวตรง" });
            totalPayout += winAmount;
        } 
        
        // --- กรณีเลข 3 หลัก (ปรับปรุงใหม่แยก ตรง/โต๊ด) ---
        else if (e.number.length === 3 && res3) {
            
            // 1. เช็คถูกรางวัล "ตรง"
            // เงื่อนไข: เลขต้องตรงเป๊ะ และ ต้องมียอดเงินที่แทงในช่อง "ตรง"
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
            // เงื่อนไข: เลขสลับกันได้ (isToad) และ ต้องมียอดเงินที่แทงในช่อง "โต๊ด"
            // หมายเหตุ: ถ้าออกตรงเป๊ะ คนที่แทงโต๊ดไว้ก็ได้ตังค์ด้วย (ตามกติกาทั่วไป)
            if (isToad(e.number, res3) && e.amountToad > 0) {
                let winAmount = e.amountToad * 150;
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

    // --- ส่วนแสดงผล HTML (เหมือนเดิมแต่ปรับยอดเงินที่แทงให้ตรงหมวด) ---
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
    content.innerHTML = ''; // ล้างข้อมูลเดิมก่อนวาดใหม่

    // 1. กลุ่มข้อมูลตามเลข
    const grouped = inst.entries.reduce((acc, e) => {
        if (searchTerm && !e.number.includes(searchTerm)) return acc;
        if (!acc[e.number]) acc[e.number] = { items: [], total: 0 };
        acc[e.number].items.push(e);
        acc[e.number].total += e.amount;
        return acc;
    }, {});

    const allKeys = Object.keys(grouped);

    // 2. แยกกลุ่ม 2 หลัก และ 3 หลัก พร้อมเรียงลำดับจากน้อยไปมาก
    const group2 = allKeys.filter(k => k.length === 2).sort((a, b) => a.localeCompare(b));
    const group3 = allKeys.filter(k => k.length === 3).sort((a, b) => a.localeCompare(b));

    if (group2.length === 0 && group3.length === 0) {
        content.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">ไม่พบข้อมูลเลขที่ค้นหา</div>`;
        return;
    }

    // 3. ฟังก์ชันช่วยวาดการ์ด
    const drawCards = (keys, title) => {
        if (keys.length > 0) {
            const header = document.createElement('h3');
            header.style = "margin: 20px 0 10px 5px; color: var(--navy); border-bottom: 2px solid #eee; padding-bottom: 5px;";
            header.innerText = title;
            content.appendChild(header);

            keys.forEach(num => {
                const data = grouped[num];
                const card = document.createElement('div');
                card.className = 'report-card';
                card.innerHTML = `
                    <div class="num-header">
                        <span class="num-title" style="font-size: 1.4rem;">เลข ${num}</span>
                        <b style="color:var(--navy); font-size:1.2rem;">รวม: ${data.total.toLocaleString()}.-</b>
                    </div>
                    ${data.items.map(e => `
                        <div class="person-row">
                            <span style="font-size: 1rem;">
                                <b>${e.name}</b> 
                                ${e.number.length === 3 ? `<br><small style="color:#888;">(ตรง:${e.amountStraight} โต๊ด:${e.amountToad})</small>` : ''}
                            </span> 
                            <span style="font-weight: 600;">${e.amount.toLocaleString()}.-</span>
                        </div>
                    `).join('')}
                `;
                content.appendChild(card);
            });
        }
    };

    // 4. สั่งวาดหมวด 2 หลักก่อน แล้วตามด้วย 3 หลัก
    drawCards(group2, "📊 หมวดเลข 2 หลัก (00-99)");
    drawCards(group3, "📊 หมวดเลข 3 หลัก (000-999)");
}

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