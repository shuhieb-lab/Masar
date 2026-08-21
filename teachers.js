(() => {
  const baseRender = render;
  const baseRenderHome = renderHome;
  const baseRenderSettings = renderSettings;

  const style = document.createElement('style');
  style.textContent = `
    .teacher-tools{display:flex;gap:8px;flex-wrap:wrap}
    .teacher-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid rgba(15,44,41,.08)}
    .teacher-card:last-child{border-bottom:0}
    .teacher-card b{display:block;color:#173f3b}
    .teacher-card span{display:block;margin-top:4px;color:#6f7f7b;font-size:12px}
    .teacher-reset{border:1px solid #d5e4e1;background:#fff;color:#0b7772;border-radius:11px;padding:8px 10px;font:inherit;font-size:12px;font-weight:800}
    .teacher-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .teacher-status{display:inline-flex!important;align-items:center;gap:5px;width:max-content;padding:4px 8px;border-radius:999px;font-size:11px!important;font-weight:800}
    .teacher-status.active{background:#eaf7f3;color:#08776b}
    .teacher-status.stopped{background:#fff1ed;color:#a64027}
    .teacher-toggle{border:1px solid #e2c6bd;background:#fff;color:#a64027;border-radius:11px;padding:8px 10px;font:inherit;font-size:12px;font-weight:800}
    .teacher-toggle.enable{border-color:#b9dcd4;color:#08776b;background:#f5fbf9}
    .teacher-login-note{background:#f8f3e6;border:1px solid #ead9a7;border-radius:14px;padding:12px 14px;line-height:1.8;color:#71591d}
    .password-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media(max-width:560px){.password-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function normalizeName(value) {
    return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  }

  function readableFunctionError(data, error) {
    const code = data?.error || '';
    if (code === 'USERNAME_EXISTS') return 'يوجد معلم بنفس اسم الدخول. اكتب الاسم بشكل أكثر اكتمالًا.';
    if (code === 'WEAK_PASSWORD') return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
    if (code === 'INVALID_NAME' || code === 'INVALID_USERNAME') return 'تحقق من اسم المعلم.';
    if (code === 'FORBIDDEN') return 'إضافة المعلمين متاحة لحساب الوكيل فقط.';
    if (code === 'UNAUTHORIZED') return 'انتهت الجلسة. سجّل الدخول من جديد.';
    if (code === 'ACCOUNT_DISABLED') return 'هذا الحساب موقوف من الوكيل.';
    if (code === 'STATUS_FAILED') return 'تعذر تغيير حالة المعلم.';
    return error?.message || data?.detail || 'تعذر تنفيذ العملية.';
  }

  async function loginWithNameOrEmail(identifier, password) {
    if (identifier.includes('@')) {
      return await supabaseClient.auth.signInWithPassword({ email: identifier, password });
    }

    const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
      body: { action: 'login', username: normalizeName(identifier), password }
    });

    if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
      return { error: error || new Error('INVALID_LOGIN') };
    }

    return await supabaseClient.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
  }

  // التقاط الإرسال قبل مستمع app.js القديم حتى يدعم الدخول بالاسم.
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!supabaseClient) return;
    authStatus.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'جاري تسجيل الدخول...';

    const identifier = normalizeName(document.getElementById('loginEmail').value);
    const password = document.getElementById('loginPassword').value;

    try {
      if (!identifier || !password) throw new Error('MISSING');
      const { error } = await loginWithNameOrEmail(identifier, password);
      if (error) throw error;
    } catch {
      authStatus.textContent = 'تعذر تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'دخول إلى مَسار';
    }
  }, true);

  render = function () {
    if (currentRoute === 'teachers') {
      renderTeachers();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    baseRender();
  };

  renderHome = function () {
    baseRenderHome();

    if (currentRole() === 'vice') {
      const quick = app.querySelector('.quick');
      if (quick && !quick.querySelector('[data-teachers-go]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gold-quick';
        button.dataset.teachersGo = '1';
        button.innerHTML = '<b>إدارة المعلمين</b><span>إضافة معلم وتعيين كلمة مرور مؤقتة</span>';
        button.onclick = () => setRoute('teachers');
        quick.appendChild(button);
      }
    }
  };

  renderSettings = function () {
    baseRenderSettings();

    if (mode !== 'cloud') return;

    const role = currentRole();

    if (role === 'vice') {
      app.insertAdjacentHTML('beforeend', `
        <section class="section card">
          <div class="section-head">
            <div>
              <h3>المعلمون</h3>
              <span style="font-size:12px;color:#71807c">إدارة حسابات المعلمين</span>
            </div>
            <button id="openTeachersSettings" type="button">فتح</button>
          </div>
          <div class="teacher-login-note">المعلم يدخل إلى مَسار باسمه وكلمة المرور التي يحددها الوكيل.</div>
        </section>`);
      document.getElementById('openTeachersSettings').onclick = () => setRoute('teachers');
    }

    app.insertAdjacentHTML('beforeend', `
      <section class="section form-card">
        <h3 style="margin-top:0">تغيير كلمة المرور</h3>
        <p class="page-sub" style="margin-top:0">يمكنك تغيير كلمة مرور حسابك من هنا في أي وقت.</p>
        <form id="changePasswordForm">
          <div class="password-grid">
            <div class="field">
              <label>كلمة المرور الجديدة</label>
              <input id="newPassword" class="input" type="password" minlength="6" autocomplete="new-password" required />
            </div>
            <div class="field">
              <label>تأكيد كلمة المرور</label>
              <input id="confirmPassword" class="input" type="password" minlength="6" autocomplete="new-password" required />
            </div>
          </div>
          <button id="changePasswordBtn" class="primary-btn" type="submit">حفظ كلمة المرور الجديدة</button>
        </form>
      </section>`);

    document.getElementById('changePasswordForm').onsubmit = async (event) => {
      event.preventDefault();
      const password = document.getElementById('newPassword').value;
      const confirm = document.getElementById('confirmPassword').value;
      if (password.length < 6) return toastMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      if (password !== confirm) return toastMsg('كلمتا المرور غير متطابقتين');

      const button = document.getElementById('changePasswordBtn');
      button.disabled = true;
      button.textContent = 'جاري الحفظ...';
      const { error } = await supabaseClient.auth.updateUser({ password });
      button.disabled = false;
      button.textContent = 'حفظ كلمة المرور الجديدة';

      if (error) return toastMsg('تعذر تغيير كلمة المرور');
      document.getElementById('changePasswordForm').reset();
      toastMsg('تم تغيير كلمة المرور بنجاح');
    };
  };

  async function fetchTeachers() {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, full_name, username, role, subject, created_at, is_active')
      .eq('role', 'teacher')
      .order('full_name');

    if (error) throw error;
    return data || [];
  }

  function teacherRows(teachers) {
    if (!teachers.length) {
      return '<div class="empty"><div class="empty-icon">◎</div>لم تتم إضافة معلمين بعد</div>';
    }

    return teachers.map((teacher) => {
      const active = teacher.is_active !== false;
      return `
        <div class="teacher-card">
          <div>
            <b>${esc(teacher.full_name || 'معلم')}</b>
            <span>اسم الدخول: ${esc(teacher.username || teacher.full_name || '—')}</span>
            <span class="teacher-status ${active ? 'active' : 'stopped'}">${active ? '● نشط' : '● موقوف'}</span>
          </div>
          <div class="teacher-actions">
            <button class="teacher-reset" type="button"
              data-reset-teacher="${esc(teacher.id)}"
              data-teacher-name="${esc(teacher.full_name || 'المعلم')}">
              كلمة مرور مؤقتة
            </button>
            <button class="teacher-toggle ${active ? '' : 'enable'}" type="button"
              data-toggle-teacher="${esc(teacher.id)}"
              data-teacher-name="${esc(teacher.full_name || 'المعلم')}"
              data-active="${active ? 'true' : 'false'}">
              ${active ? 'إيقاف المعلم' : 'تفعيل المعلم'}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  async function renderTeachers() {
    if (mode !== 'cloud' || currentRole() !== 'vice') {
      toastMsg('إدارة المعلمين متاحة للوكيل فقط');
      currentRoute = 'home';
      baseRender();
      return;
    }

    app.innerHTML = `
      <div class="page-head">
        <div class="kicker">إدارة الحسابات</div>
        <h2 class="page-title">المعلمون</h2>
        <p class="page-sub">أضف المعلم وحدد له كلمة مرور مؤقتة. اسم دخوله الافتراضي هو اسمه نفسه.</p>
      </div>

      <section class="form-card">
        <h3 style="margin-top:0">+ إضافة معلم</h3>
        <form id="addTeacherForm">
          <div class="field">
            <label>اسم المعلم</label>
            <input id="teacherFullName" class="input" placeholder="مثال: عبدالله محمد السلطان" maxlength="120" required />
          </div>
          <div class="field">
            <label>كلمة مرور مؤقتة</label>
            <input id="teacherTempPassword" class="input" type="password" minlength="6" autocomplete="new-password" placeholder="6 أحرف على الأقل" required />
          </div>
          <div class="teacher-login-note">سيستخدم المعلم <b>اسمه نفسه</b> للدخول، ويمكنه تغيير كلمة المرور لاحقًا من الإعدادات.</div>
          <button id="createTeacherBtn" class="primary-btn" type="submit">إضافة المعلم</button>
        </form>
      </section>

      <section class="section card">
        <div class="section-head">
          <h3>المعلمون المسجلون</h3>
          <span id="teachersCount" class="count-chip">...</span>
        </div>
        <div id="teachersList"><div class="loading"><div class="spinner"></div>جاري تحميل المعلمين...</div></div>
      </section>

      <section class="section">
        <button class="secondary-btn" id="teachersBack" type="button">العودة للرئيسية</button>
      </section>`;

    document.getElementById('teachersBack').onclick = () => setRoute('home');

    async function reloadTeachers() {
      const list = document.getElementById('teachersList');
      try {
        const teachers = await fetchTeachers();
        document.getElementById('teachersCount').textContent = `${teachers.length} معلم`;
        list.innerHTML = teacherRows(teachers);

        list.querySelectorAll('[data-reset-teacher]').forEach((button) => {
          button.onclick = async () => {
            const teacherId = button.dataset.resetTeacher;
            const teacherName = button.dataset.teacherName;
            const newPassword = prompt(`اكتب كلمة مرور مؤقتة جديدة لـ ${teacherName}\n(6 أحرف على الأقل)`);
            if (newPassword === null) return;
            if (newPassword.length < 6) return toastMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

            button.disabled = true;
            const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
              body: { action: 'reset_password', teacher_id: teacherId, password: newPassword }
            });
            button.disabled = false;

            if (error || data?.error) return toastMsg(readableFunctionError(data, error));
            toastMsg('تم تعيين كلمة المرور المؤقتة');
          };
        });

        list.querySelectorAll('[data-toggle-teacher]').forEach((button) => {
          button.onclick = async () => {
            const teacherId = button.dataset.toggleTeacher;
            const teacherName = button.dataset.teacherName;
            const isActive = button.dataset.active === 'true';
            const nextActive = !isActive;

            const question = isActive
              ? `إيقاف حساب ${teacherName}؟\nلن يستطيع الدخول إلى مَسار، وستبقى إحالاته السابقة محفوظة.`
              : `إعادة تفعيل حساب ${teacherName}؟`;
            if (!confirm(question)) return;

            button.disabled = true;
            const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
              body: { action: 'set_teacher_active', teacher_id: teacherId, active: nextActive }
            });
            button.disabled = false;

            if (error || data?.error) return toastMsg(readableFunctionError(data, error));
            toastMsg(nextActive ? 'تم تفعيل المعلم' : 'تم إيقاف المعلم');
            await reloadTeachers();
          };
        });
      } catch (error) {
        list.innerHTML = `<div class="error-note">تعذر تحميل المعلمين: ${esc(error.message || 'خطأ غير معروف')}</div>`;
      }
    }

    document.getElementById('addTeacherForm').onsubmit = async (event) => {
      event.preventDefault();
      const fullName = normalizeName(document.getElementById('teacherFullName').value);
      const password = document.getElementById('teacherTempPassword').value;
      if (fullName.length < 2) return toastMsg('اكتب اسم المعلم');
      if (password.length < 6) return toastMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

      const button = document.getElementById('createTeacherBtn');
      button.disabled = true;
      button.textContent = 'جاري إضافة المعلم...';

      const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
        body: {
          action: 'create_teacher',
          full_name: fullName,
          username: fullName,
          password
        }
      });

      button.disabled = false;
      button.textContent = 'إضافة المعلم';

      if (error || data?.error) {
        toastMsg(readableFunctionError(data, error));
        return;
      }

      document.getElementById('addTeacherForm').reset();
      toastMsg('تمت إضافة المعلم بنجاح');
      await reloadTeachers();
    };

    await reloadTeachers();
  }
})();