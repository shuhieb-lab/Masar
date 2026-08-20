const CONFIG = window.MASAR_CONFIG || {};
const DEMO_STORAGE_KEY = 'masar_v02_demo_state';
const DEMO_ROLE_KEY = 'masar_v02_demo_role';

const roleNames = { teacher: 'المعلم', vice: 'الوكيل', admin: 'المدير' };
const statusNames = { pending: 'بانتظار الرد', answered: 'تم الرد', closed: 'مغلقة' };

const seed = {
  classes: [
    { id: 'c1', grade: 'الأول متوسط', section: 'أ' },
    { id: 'c2', grade: 'الأول متوسط', section: 'ب' },
    { id: 'c3', grade: 'الثاني متوسط', section: 'أ' },
    { id: 'c4', grade: 'الثاني متوسط', section: 'ب' }
  ],
  students: [
    { id: 's1', name: 'أحمد الزهراني', class_id: 'c3' },
    { id: 's2', name: 'بدر العنزي', class_id: 'c3' },
    { id: 's3', name: 'خالد الشهري', class_id: 'c3' },
    { id: 's4', name: 'سلطان العتيبي', class_id: 'c4' },
    { id: 's5', name: 'عبدالله القحطاني', class_id: 'c4' }
  ],
  referrals: [
    {
      id: 'R-1001', student_id: 's1', teacher_id: 'demo-teacher', teacher_name: 'أ. عبدالله السلطان',
      reason: 'كثرة الغياب', description: 'الطالب تغيب عدة مرات خلال الأسبوعين الماضيين دون عذر واضح.',
      teacher_action: 'تم التواصل مع ولي الأمر عبر الرسائل ولم تتم الاستجابة.', status: 'answered',
      created_at: '2026-08-20T08:30:00+03:00', vice_reply: 'تم التواصل مع ولي الأمر هاتفيًا والتنبيه على أهمية انتظام الطالب، وسيتم متابعة الغياب خلال الأسبوع القادم.',
      vice_id: 'demo-vice', vice_name: 'أ. خالد العتيبي', replied_at: '2026-08-20T10:15:00+03:00', closed_at: null
    },
    {
      id: 'R-1002', student_id: 's2', teacher_id: 'demo-teacher', teacher_name: 'أ. عبدالله السلطان',
      reason: 'سلوك داخل الحصة', description: 'تكرر الحديث الجانبي وعدم الالتزام بالتوجيه أثناء الحصة.',
      teacher_action: 'تم تنبيه الطالب مرتين وتغيير مكان جلوسه.', status: 'pending',
      created_at: '2026-08-20T11:20:00+03:00', vice_reply: '', vice_id: null, vice_name: '', replied_at: null, closed_at: null
    }
  ]
};

const authView = document.getElementById('authView');
const appShell = document.getElementById('appShell');
const app = document.getElementById('app');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const authStatus = document.getElementById('authStatus');
const demoGate = document.getElementById('demoGate');
const enterDemo = document.getElementById('enterDemo');
const accountChip = document.getElementById('accountChip');
const accountDialog = document.getElementById('accountDialog');
const accountSubtitle = document.getElementById('accountSubtitle');
const accountDialogBody = document.getElementById('accountDialogBody');
const entityDialog = document.getElementById('entityDialog');
const entityForm = document.getElementById('entityForm');
const entityTitle = document.getElementById('entityTitle');
const entitySubtitle = document.getElementById('entitySubtitle');
const entityFields = document.getElementById('entityFields');
const toast = document.getElementById('toast');

let supabaseClient = null;
let realtimeChannel = null;
let mode = 'demo';
let session = null;
let profile = null;
let state = clone(seed);
let demoRole = localStorage.getItem(DEMO_ROLE_KEY) || 'teacher';
let currentRoute = 'home';
let referralFilter = 'all';
let selectedReferralId = null;
let entityAction = null;
let isRefreshing = false;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}
function backendConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && !CONFIG.supabaseUrl.includes('YOUR-PROJECT') && !CONFIG.supabaseAnonKey.includes('YOUR-ANON'));
}
function currentRole() { return mode === 'cloud' ? profile?.role : demoRole; }
function currentName() {
  if (mode === 'cloud') return profile?.full_name || session?.user?.email || 'مستخدم مَسار';
  return demoRole === 'teacher' ? 'أ. عبدالله السلطان' : demoRole === 'vice' ? 'أ. خالد العتيبي' : 'أ. مدير المدرسة';
}
function saveDemo() { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); }
function loadDemo() {
  try { return JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)) || clone(seed); }
  catch { return clone(seed); }
}
function toastMsg(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastMsg.timer);
  toastMsg.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }
  catch { return '—'; }
}
function classById(id) { return state.classes.find((item) => String(item.id) === String(id)); }
function studentById(id) { return state.students.find((item) => String(item.id) === String(id)); }
function classNameById(id) {
  const item = classById(id);
  return item ? `${item.grade} — ${item.section}` : 'غير محدد';
}
function badge(status) { return `<span class="badge ${esc(status)}">${esc(statusNames[status] || status)}</span>`; }
function setLoading(message = 'جاري تحميل البيانات...') {
  app.innerHTML = `<div class="loading"><div class="spinner"></div>${esc(message)}</div>`;
}

async function init() {
  authView.hidden = false;
  if (!backendConfigured()) {
    mode = 'demo';
    loginForm.hidden = true;
    demoGate.hidden = false;
    return;
  }

  if (!window.supabase?.createClient) {
    authStatus.textContent = 'تعذر تحميل مكتبة الاتصال. تحقق من اتصال الإنترنت ثم أعد المحاولة.';
    return;
  }

  mode = 'cloud';
  supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  loginForm.hidden = false;
  demoGate.hidden = true;

  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) await enterCloudApp(data.session);

  supabaseClient.auth.onAuthStateChange(async (event, nextSession) => {
    if (event === 'SIGNED_OUT') showAuth();
    if (event === 'SIGNED_IN' && nextSession && !session) await enterCloudApp(nextSession);
  });
}

function showAuth() {
  session = null;
  profile = null;
  if (realtimeChannel && supabaseClient) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = null;
  appShell.hidden = true;
  authView.hidden = false;
  authStatus.textContent = '';
}

async function enterCloudApp(nextSession) {
  session = nextSession;
  authStatus.textContent = 'جاري فتح الحساب...';

  const { data: profileData, error } = await supabaseClient
    .from('profiles')
    .select('id, full_name, role, subject')
    .eq('id', session.user.id)
    .single();

  if (error || !profileData) {
    authStatus.textContent = 'تم تسجيل الدخول، لكن ملف المستخدم غير موجود. نفّذ ملف supabase-setup.sql ثم أعد المحاولة.';
    await supabaseClient.auth.signOut();
    return;
  }

  profile = profileData;
  authView.hidden = true;
  appShell.hidden = false;
  currentRoute = 'home';
  setLoading();
  await refreshCloudData(false);
  subscribeRealtime();
}

function enterDemoApp() {
  mode = 'demo';
  state = loadDemo();
  authView.hidden = true;
  appShell.hidden = false;
  currentRoute = 'home';
  render();
}

async function refreshCloudData(silent = false) {
  if (!supabaseClient || isRefreshing) return;
  isRefreshing = true;
  if (!silent) setLoading();
  try {
    const [classesRes, studentsRes, referralsRes] = await Promise.all([
      supabaseClient.from('classes').select('*').order('grade').order('section'),
      supabaseClient.from('students').select('*').order('name'),
      supabaseClient.from('referrals').select('*').order('created_at', { ascending: false })
    ]);

    const firstError = classesRes.error || studentsRes.error || referralsRes.error;
    if (firstError) throw firstError;

    state = {
      classes: classesRes.data || [],
      students: studentsRes.data || [],
      referrals: referralsRes.data || []
    };
    render();
  } catch (error) {
    app.innerHTML = `<div class="error-note">تعذر تحميل البيانات: ${esc(error.message || 'خطأ غير معروف')}</div><button class="secondary-btn" id="retryLoad">إعادة المحاولة</button>`;
    document.getElementById('retryLoad').onclick = () => refreshCloudData(false);
  } finally {
    isRefreshing = false;
  }
}

function subscribeRealtime() {
  if (!supabaseClient || realtimeChannel) return;
  realtimeChannel = supabaseClient
    .channel('masar-referrals-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals' }, async () => {
      await refreshCloudData(true);
      toastMsg('تم تحديث الإحالات');
    })
    .subscribe();
}

function setRoute(route) {
  if (route === 'new' && currentRole() !== 'teacher') {
    toastMsg('إنشاء الإحالة مخصص للمعلم');
    return;
  }
  currentRoute = route;
  render();
}

function render() {
  if (appShell.hidden) return;
  const role = currentRole();
  accountChip.textContent = `${currentName()} ▾`;
  document.querySelectorAll('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.route === currentRoute));
  const fab = document.querySelector('.fab');
  fab.disabled = role !== 'teacher';

  if (currentRoute === 'home') renderHome();
  else if (currentRoute === 'referrals') renderReferrals();
  else if (currentRoute === 'new') renderNewReferral();
  else if (currentRoute === 'students') renderStudents();
  else if (currentRoute === 'settings') renderSettings();
  else if (currentRoute === 'detail') renderDetail();
  else renderHome();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function visibleReferrals() {
  const role = currentRole();
  if (mode === 'cloud') return [...state.referrals];
  if (role === 'teacher') return state.referrals.filter((item) => item.teacher_id === 'demo-teacher');
  return [...state.referrals];
}

function renderHome() {
  const role = currentRole();
  const referrals = visibleReferrals();
  const counts = Object.fromEntries(['pending', 'answered', 'closed'].map((status) => [status, referrals.filter((item) => item.status === status).length]));
  const recent = [...referrals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  const roleLine = role === 'teacher'
    ? 'أنشئ إحالة للطالب وتابع رد الوكيل من نفس المسار.'
    : role === 'vice'
      ? 'راجع الإحالات الواردة، سجّل الإجراء، ثم أرسل الرد للمعلم.'
      : 'أدر بيانات المدرسة من الصفوف والفصول حتى إسناد الطلاب.';

  app.innerHTML = `
    <section class="hero">
      <small>${esc(roleNames[role] || '')}</small>
      <h2>مرحبًا ${esc(currentName())}</h2>
      <p>${esc(roleLine)}</p>
      <div class="cloud-pill">${mode === 'cloud' ? 'متصل بقاعدة البيانات المشتركة' : 'نسخة معاينة محلية'}</div>
    </section>
    <section class="stats">
      <div class="stat"><b>${referrals.length}</b><span>إجمالي الإحالات</span></div>
      <div class="stat"><b>${counts.pending}</b><span>بانتظار الرد</span></div>
      <div class="stat"><b>${counts.answered}</b><span>تم الرد</span></div>
      <div class="stat"><b>${counts.closed}</b><span>مغلقة</span></div>
    </section>
    <section class="section">
      <div class="section-head"><h3>إجراءات سريعة</h3></div>
      <div class="quick">
        ${role === 'teacher' ? `<button class="gold-quick" data-go="new"><b>إحالة جديدة</b><span>اختيار طالب وإرسال الحالة للوكيل</span></button>` : ''}
        ${role === 'vice' ? `<button class="gold-quick" data-filter-go="pending"><b>بانتظار الإجراء</b><span>${counts.pending} إحالة تحتاج إلى رد</span></button>` : ''}
        ${role === 'admin' ? `<button class="gold-quick" data-go="students"><b>إدارة الطلاب</b><span>إضافة فصل وإسناد الطلاب إليه</span></button>` : ''}
        <button data-go="referrals"><b>سجل الإحالات</b><span>متابعة المعاملات وحالاتها</span></button>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h3>أحدث الإحالات</h3><button data-go="referrals">عرض الكل</button></div>
      <div>${recent.length ? recent.map(referralCard).join('') : `<div class="empty"><div class="empty-icon">◎</div>لا توجد إحالات بعد</div>`}</div>
    </section>`;
  bindCommon();
}

function referralCard(referral) {
  const student = studentById(referral.student_id);
  const className = student ? classNameById(student.class_id) : '—';
  return `<article class="card ref-card" data-ref="${esc(referral.id)}">
    <div>
      <h4>${esc(student?.name || 'طالب غير معروف')}</h4>
      <div class="meta">${esc(className)}<br>${esc(referral.reason)} • ${esc(fmtDate(referral.created_at))}</div>
    </div>
    <div>${badge(referral.status)}</div>
  </article>`;
}

function renderReferrals() {
  const tabs = ['all', 'pending', 'answered', 'closed'];
  let rows = visibleReferrals().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (referralFilter !== 'all') rows = rows.filter((item) => item.status === referralFilter);

  app.innerHTML = `
    <div class="page-head">
      <div class="kicker">سجل المعاملات</div>
      <h2 class="page-title">الإحالات</h2>
      <p class="page-sub">تابع كل إحالة من لحظة الإرسال حتى الرد وإغلاق المعاملة.</p>
    </div>
    <div class="tabs">${tabs.map((tab) => `<button class="tab ${referralFilter === tab ? 'active' : ''}" data-filter="${tab}">${tab === 'all' ? 'الكل' : statusNames[tab]}</button>`).join('')}</div>
    <section class="section">${rows.length ? rows.map(referralCard).join('') : `<div class="empty"><div class="empty-icon">✓</div>لا توجد إحالات ضمن هذا التصنيف</div>`}</section>`;

  document.querySelectorAll('[data-filter]').forEach((button) => button.onclick = () => {
    referralFilter = button.dataset.filter;
    renderReferrals();
  });
  bindCommon();
}

function renderNewReferral() {
  if (currentRole() !== 'teacher') {
    setRoute('home');
    return;
  }

  const classOptions = state.classes.map((item) => `<option value="${esc(item.id)}">${esc(classNameById(item.id))}</option>`).join('');
  app.innerHTML = `
    <div class="page-head">
      <div class="kicker">إجراء جديد</div>
      <h2 class="page-title">إحالة طالب</h2>
      <p class="page-sub">اختر الطالب، ثم دوّن الحالة والإجراء الذي تم اتخاذه قبل رفعها للوكيل.</p>
    </div>
    <form id="refForm" class="form-card">
      <div class="row">
        <div class="field"><label>الصف / الفصل</label><select id="classSelect" class="select" required><option value="">اختر الفصل</option>${classOptions}</select></div>
        <div class="field"><label>اسم الطالب</label><select id="studentSelect" class="select" required disabled><option value="">اختر الفصل أولًا</option></select></div>
      </div>
      <div class="field">
        <label>سبب التحويل</label>
        <select id="reason" class="select" required>
          <option value="">اختر السبب</option>
          <option>كثرة الغياب</option><option>التأخر الصباحي</option><option>سلوك داخل الحصة</option><option>عدم تنفيذ المهام</option><option>مشكلة بين الطلاب</option><option>أخرى</option>
        </select>
      </div>
      <div class="field"><label>وصف الحالة</label><textarea id="description" class="textarea" maxlength="500" placeholder="اكتب تفاصيل الحالة بشكل واضح..." required></textarea></div>
      <div class="field"><label>الإجراء المتخذ من المعلم</label><textarea id="teacherAction" class="textarea" maxlength="350" placeholder="ما الإجراء الذي اتخذته قبل الإحالة؟" required></textarea></div>
      <button id="submitReferral" class="primary-btn" type="submit">إرسال للوكيل</button>
    </form>`;

  const classSelect = document.getElementById('classSelect');
  const studentSelect = document.getElementById('studentSelect');
  classSelect.onchange = () => {
    const students = state.students.filter((student) => String(student.class_id) === String(classSelect.value));
    studentSelect.disabled = !classSelect.value;
    studentSelect.innerHTML = `<option value="">اختر الطالب</option>${students.map((student) => `<option value="${esc(student.id)}">${esc(student.name)}</option>`).join('')}`;
  };

  document.getElementById('refForm').onsubmit = async (event) => {
    event.preventDefault();
    const submitButton = document.getElementById('submitReferral');
    submitButton.disabled = true;
    submitButton.textContent = 'جاري الإرسال...';
    const payload = {
      student_id: studentSelect.value,
      teacher_id: mode === 'cloud' ? session.user.id : 'demo-teacher',
      teacher_name: currentName(),
      reason: document.getElementById('reason').value,
      description: document.getElementById('description').value.trim(),
      teacher_action: document.getElementById('teacherAction').value.trim(),
      status: 'pending'
    };

    try {
      if (mode === 'cloud') {
        const { data, error } = await supabaseClient.from('referrals').insert(payload).select('*').single();
        if (error) throw error;
        selectedReferralId = data.id;
        await refreshCloudData(true);
      } else {
        const item = {
          ...payload,
          id: `R-${String(Date.now()).slice(-6)}`,
          created_at: new Date().toISOString(),
          vice_reply: '', vice_id: null, vice_name: '', replied_at: null, closed_at: null
        };
        state.referrals.push(item);
        saveDemo();
        selectedReferralId = item.id;
      }
      currentRoute = 'detail';
      render();
      toastMsg('تم إرسال الإحالة للوكيل');
    } catch (error) {
      toastMsg(`تعذر الإرسال: ${error.message || 'خطأ غير معروف'}`);
      submitButton.disabled = false;
      submitButton.textContent = 'إرسال للوكيل';
    }
  };
}

function renderDetail() {
  const referral = state.referrals.find((item) => String(item.id) === String(selectedReferralId));
  if (!referral) {
    currentRoute = 'referrals';
    render();
    return;
  }
  const student = studentById(referral.student_id);
  const role = currentRole();

  app.innerHTML = `
    <div class="page-head">
      <div class="kicker">رقم ${esc(String(referral.id).slice(0, 12))}</div>
      <h2 class="page-title">تفاصيل الإحالة</h2>
      <p class="page-sub">${esc(student?.name || '—')} • ${esc(student ? classNameById(student.class_id) : '—')}</p>
    </div>
    <div class="info-strip"><span>الحالة الحالية</span>${badge(referral.status)}</div>
    <section class="section card detail-grid">
      <div class="detail-item"><b>تاريخ الإحالة</b><p>${esc(fmtDate(referral.created_at))}</p></div>
      <div class="detail-item"><b>سبب التحويل</b><p>${esc(referral.reason)}</p></div>
      <div class="detail-item"><b>وصف الحالة</b><p>${esc(referral.description)}</p></div>
      <div class="detail-item"><b>الإجراء المتخذ من المعلم</b><p>${esc(referral.teacher_action)}</p></div>
      <div class="detail-item"><b>المعلم المحيل</b><p>${esc(referral.teacher_name)}</p></div>
    </section>
    ${referral.vice_reply ? `<section class="section reply-box"><h3>رد الوكيل</h3><div class="reply-content">${esc(referral.vice_reply)}</div><div style="margin-top:10px"><small>${esc(referral.vice_name || '')} • ${esc(fmtDate(referral.replied_at))}</small></div></section>` : ''}
    ${role === 'vice' && referral.status === 'pending' ? `
      <section class="section form-card">
        <h3 style="margin-top:0">إجراء الوكيل</h3>
        <div class="field"><label>رد الوكيل</label><textarea id="viceReply" class="textarea" maxlength="700" placeholder="اكتب الإجراء الذي تم اتخاذه..." required></textarea></div>
        <button id="sendReply" class="primary-btn">إرسال الرد للمعلم</button>
      </section>` : ''}
    ${role === 'teacher' && referral.status === 'answered' ? `<section class="section"><button id="ackClose" class="secondary-btn">تم الاطلاع على الرد وإغلاق المعاملة</button></section>` : ''}
    ${referral.status === 'closed' ? `<section class="section"><div class="success-note">تم إغلاق المعاملة، وبقيت محفوظة في سجل الطالب للرجوع إليها.</div></section>` : ''}
    <section class="section"><button class="secondary-btn" data-go="referrals">العودة لسجل الإحالات</button></section>`;

  const sendReply = document.getElementById('sendReply');
  if (sendReply) sendReply.onclick = async () => {
    const text = document.getElementById('viceReply').value.trim();
    if (!text) return toastMsg('اكتب رد الوكيل أولًا');
    sendReply.disabled = true;
    sendReply.textContent = 'جاري إرسال الرد...';
    try {
      if (mode === 'cloud') {
        const { error } = await supabaseClient.from('referrals').update({
          vice_reply: text,
          vice_id: session.user.id,
          vice_name: currentName(),
          replied_at: new Date().toISOString(),
          status: 'answered'
        }).eq('id', referral.id);
        if (error) throw error;
        await refreshCloudData(true);
      } else {
        referral.vice_reply = text;
        referral.vice_id = 'demo-vice';
        referral.vice_name = currentName();
        referral.replied_at = new Date().toISOString();
        referral.status = 'answered';
        saveDemo();
      }
      render();
      toastMsg('تم إرسال الرد للمعلم');
    } catch (error) {
      sendReply.disabled = false;
      sendReply.textContent = 'إرسال الرد للمعلم';
      toastMsg(`تعذر إرسال الرد: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const ackClose = document.getElementById('ackClose');
  if (ackClose) ackClose.onclick = async () => {
    ackClose.disabled = true;
    try {
      if (mode === 'cloud') {
        const { error } = await supabaseClient.from('referrals').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', referral.id);
        if (error) throw error;
        await refreshCloudData(true);
      } else {
        referral.status = 'closed';
        referral.closed_at = new Date().toISOString();
        saveDemo();
      }
      render();
      toastMsg('تم إغلاق المعاملة');
    } catch (error) {
      ackClose.disabled = false;
      toastMsg(`تعذر الإغلاق: ${error.message || 'خطأ غير معروف'}`);
    }
  };
  bindCommon();
}

function renderStudents() {
  const role = currentRole();
  const canEdit = role === 'admin';
  app.innerHTML = `
    <div class="page-head">
      <div class="kicker">البيانات الأساسية</div>
      <h2 class="page-title">الطلاب والفصول</h2>
      <p class="page-sub">أنشئ الفصول أولًا، ثم أسند كل طالب إلى فصله.</p>
    </div>
    ${!canEdit ? `<div class="notice">يمكنك مشاهدة البيانات، بينما الإضافة والتعديل متاحان لحساب المدير.</div>` : ''}
    <section class="card">
      <div class="section-head"><h3>الفصول</h3>${canEdit ? `<button id="addClass">+ إضافة فصل</button>` : ''}</div>
      <div>${state.classes.length ? state.classes.map((item) => `
        <div class="list-row">
          <div><b>${esc(classNameById(item.id))}</b><br><span>${state.students.filter((student) => String(student.class_id) === String(item.id)).length} طالب</span></div>
          ${canEdit ? `<button class="mini-btn" data-addstudent="${esc(item.id)}">إضافة طالب</button>` : ''}
        </div>`).join('') : `<div class="empty">لم تتم إضافة فصول بعد</div>`}</div>
    </section>
    <section class="section card">
      <div class="section-head"><h3>جميع الطلاب</h3><span class="count-chip">${state.students.length} طالب</span></div>
      <div class="search-wrap"><input id="studentSearch" class="input" placeholder="بحث باسم الطالب..." /></div>
      <div id="studentsList">${studentsListHtml(state.students)}</div>
    </section>`;

  const search = document.getElementById('studentSearch');
  search.oninput = () => {
    const query = search.value.trim();
    const list = state.students.filter((student) => student.name.includes(query));
    document.getElementById('studentsList').innerHTML = studentsListHtml(list);
  };

  if (canEdit) {
    document.getElementById('addClass').onclick = () => openClassDialog();
    document.querySelectorAll('[data-addstudent]').forEach((button) => button.onclick = () => openStudentDialog(button.dataset.addstudent));
  }
}

function studentsListHtml(list) {
  return list.length ? list.map((student) => `<div class="list-row"><div><b>${esc(student.name)}</b><br><span>${esc(classNameById(student.class_id))}</span></div></div>`).join('') : `<div class="empty">لا توجد نتائج</div>`;
}

function openClassDialog() {
  entityAction = 'class';
  entityTitle.textContent = 'إضافة فصل';
  entitySubtitle.textContent = 'أدخل الصف والفصل، مثال: الثاني متوسط — أ';
  entityFields.innerHTML = `
    <div class="field"><label>الصف</label><input id="entityGrade" class="input" placeholder="مثال: الثاني متوسط" required /></div>
    <div class="field"><label>الفصل</label><input id="entitySection" class="input" placeholder="مثال: أ" required /></div>`;
  entityDialog.showModal();
}

function openStudentDialog(classId) {
  entityAction = { type: 'student', classId };
  entityTitle.textContent = 'إضافة طالب';
  entitySubtitle.textContent = classNameById(classId);
  entityFields.innerHTML = `<div class="field"><label>اسم الطالب</label><input id="entityStudentName" class="input" placeholder="الاسم الكامل" required /></div>`;
  entityDialog.showModal();
}

async function handleEntitySubmit(event) {
  event.preventDefault();
  try {
    if (entityAction === 'class') {
      const grade = document.getElementById('entityGrade').value.trim();
      const section = document.getElementById('entitySection').value.trim();
      if (!grade || !section) return;
      if (mode === 'cloud') {
        const { error } = await supabaseClient.from('classes').insert({ grade, section });
        if (error) throw error;
        await refreshCloudData(true);
      } else {
        state.classes.push({ id: `c${Date.now()}`, grade, section });
        saveDemo();
      }
      toastMsg('تمت إضافة الفصل');
    } else if (entityAction?.type === 'student') {
      const name = document.getElementById('entityStudentName').value.trim();
      if (!name) return;
      if (mode === 'cloud') {
        const { error } = await supabaseClient.from('students').insert({ name, class_id: entityAction.classId });
        if (error) throw error;
        await refreshCloudData(true);
      } else {
        state.students.push({ id: `s${Date.now()}`, name, class_id: entityAction.classId });
        saveDemo();
      }
      toastMsg('تمت إضافة الطالب');
    }
    entityDialog.close();
    renderStudents();
  } catch (error) {
    toastMsg(`تعذر الحفظ: ${error.message || 'خطأ غير معروف'}`);
  }
}

function renderSettings() {
  const role = currentRole();
  app.innerHTML = `
    <div class="page-head">
      <div class="kicker">النظام والحساب</div>
      <h2 class="page-title">الإعدادات</h2>
      <p class="page-sub">حالة الاتصال والصلاحية والبيانات الأساسية للنسخة الحالية.</p>
    </div>
    <section class="card">
      <div class="list-row"><div><b>المستخدم</b><br><span>${esc(currentName())}</span></div><span class="count-chip">${esc(roleNames[role])}</span></div>
      <div class="list-row"><div><b>طريقة التشغيل</b><br><span>${mode === 'cloud' ? 'Supabase • حساب حقيقي وقاعدة مشتركة' : 'معاينة محلية على هذا الجهاز'}</span></div><div class="sync-row"><span class="sync-dot ${mode === 'demo' ? 'demo' : ''}"></span>${mode === 'cloud' ? 'متصل' : 'تجريبي'}</div></div>
      <div class="list-row"><div><b>البيانات الحالية</b><br><span>${state.students.length} طالب • ${state.classes.length} فصل • ${visibleReferrals().length} إحالة</span></div></div>
    </section>
    ${mode === 'cloud' ? `<section class="section"><div class="success-note">النسخة متصلة بقاعدة مشتركة. رد الوكيل يظهر للمعلم من جهاز آخر، مع تحديث مباشر للإحالات.</div></section>` : `<section class="section"><div class="notice">لتفعيل الحسابات الحقيقية: أنشئ مشروع Supabase، نفّذ ملف supabase-setup.sql، ثم ضع URL و Anon Key داخل config.js.</div></section>`}
    ${mode === 'demo' ? `<section class="section"><button id="resetDemo" class="danger-btn">إعادة بيانات المعاينة</button></section>` : ''}`;

  const resetDemo = document.getElementById('resetDemo');
  if (resetDemo) resetDemo.onclick = () => {
    if (!confirm('إعادة بيانات المعاينة للوضع الأول؟')) return;
    state = clone(seed);
    saveDemo();
    render();
    toastMsg('تمت إعادة بيانات المعاينة');
  };
}

function bindCommon() {
  document.querySelectorAll('[data-go]').forEach((element) => element.onclick = () => setRoute(element.dataset.go));
  document.querySelectorAll('[data-ref]').forEach((element) => element.onclick = () => {
    selectedReferralId = element.dataset.ref;
    currentRoute = 'detail';
    render();
  });
  document.querySelectorAll('[data-filter-go]').forEach((element) => element.onclick = () => {
    referralFilter = element.dataset.filterGo;
    currentRoute = 'referrals';
    render();
  });
}

function openAccountDialog() {
  const role = currentRole();
  accountSubtitle.textContent = mode === 'cloud' ? 'الحساب المتصل' : 'تبديل أدوار المعاينة';
  if (mode === 'cloud') {
    accountDialogBody.innerHTML = `
      <div class="account-card"><div><strong>${esc(currentName())}</strong><span>${esc(roleNames[role])}${profile?.subject ? ` • ${esc(profile.subject)}` : ''}</span></div></div>
      <button id="logoutBtn" class="danger-btn" type="button">تسجيل الخروج</button>`;
    document.getElementById('logoutBtn').onclick = async () => {
      accountDialog.close();
      await supabaseClient.auth.signOut();
    };
  } else {
    accountDialogBody.innerHTML = Object.entries(roleNames).map(([key, label]) => `
      <button type="button" class="role-option" data-demo-role="${key}"><b>${label}${demoRole === key ? ' ✓' : ''}</b><span>${key === 'teacher' ? 'إنشاء الإحالات ومتابعة الردود' : key === 'vice' ? 'استقبال الإحالات والرد عليها' : 'إدارة الصفوف والفصول والطلاب'}</span></button>`).join('');
    document.querySelectorAll('[data-demo-role]').forEach((button) => button.onclick = () => {
      demoRole = button.dataset.demoRole;
      localStorage.setItem(DEMO_ROLE_KEY, demoRole);
      accountDialog.close();
      currentRoute = 'home';
      render();
      toastMsg(`تم التبديل إلى حساب ${roleNames[demoRole]}`);
    });
  }
  accountDialog.showModal();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  authStatus.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'جاري تسجيل الدخول...';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) authStatus.textContent = 'تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.';
  loginBtn.disabled = false;
  loginBtn.textContent = 'دخول إلى مَسار';
});

enterDemo.onclick = enterDemoApp;
accountChip.onclick = openAccountDialog;
document.getElementById('closeAccountDialog').onclick = () => accountDialog.close();
document.getElementById('closeEntityDialog').onclick = () => entityDialog.close();
entityForm.addEventListener('submit', handleEntitySubmit);

document.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => setRoute(button.dataset.route)));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
init();
