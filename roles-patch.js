(() => {
  // مَسار يعتمد حسابين فقط: المعلم والوكيل.
  // الوكيل مسؤول أيضاً عن إدارة الصفوف والفصول والطلاب.

  if (typeof demoRole !== 'undefined' && demoRole === 'admin') {
    demoRole = 'vice';
    localStorage.setItem(DEMO_ROLE_KEY, 'vice');
  }

  const originalRenderHome = renderHome;
  renderHome = function () {
    originalRenderHome();
    if (currentRole() === 'vice') {
      const quick = app.querySelector('.quick');
      if (quick && !quick.querySelector('[data-vice-students]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('data-vice-students', '1');
        button.innerHTML = '<b>إدارة الطلاب والفصول</b><span>إضافة الفصول وإسناد الطلاب إليها</span>';
        button.onclick = () => setRoute('students');
        quick.appendChild(button);
      }
    }
  };

  renderStudents = function () {
    const role = currentRole();
    const canEdit = role === 'vice';

    app.innerHTML = `
      <div class="page-head">
        <div class="kicker">البيانات الأساسية</div>
        <h2 class="page-title">الطلاب والفصول</h2>
        <p class="page-sub">أنشئ الفصول أولًا، ثم أسند كل طالب إلى فصله.</p>
      </div>
      ${!canEdit
        ? `<div class="notice">يمكن للمعلم مشاهدة بيانات الطلاب، بينما الإضافة والتعديل متاحان للوكيل.</div>`
        : `<div class="success-note">إدارة الصفوف والفصول والطلاب متاحة لحساب الوكيل.</div>`}
      <section class="card">
        <div class="section-head">
          <h3>الفصول</h3>
          ${canEdit ? `<button id="addClass">+ إضافة فصل</button>` : ''}
        </div>
        <div>
          ${state.classes.length ? state.classes.map((item) => `
            <div class="list-row">
              <div>
                <b>${esc(classNameById(item.id))}</b><br>
                <span>${state.students.filter((student) => String(student.class_id) === String(item.id)).length} طالب</span>
              </div>
              ${canEdit ? `<button class="mini-btn" data-addstudent="${esc(item.id)}">إضافة طالب</button>` : ''}
            </div>`).join('') : `<div class="empty">لم تتم إضافة فصول بعد</div>`}
        </div>
      </section>

      <section class="section card">
        <div class="section-head">
          <h3>جميع الطلاب</h3>
          <span class="count-chip">${state.students.length} طالب</span>
        </div>
        <div class="search-wrap">
          <input id="studentSearch" class="input" placeholder="بحث باسم الطالب..." />
        </div>
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
      document.querySelectorAll('[data-addstudent]').forEach((button) => {
        button.onclick = () => openStudentDialog(button.dataset.addstudent);
      });
    }
  };

  openAccountDialog = function () {
    const role = currentRole();
    accountSubtitle.textContent = mode === 'cloud' ? 'الحساب المتصل' : 'تبديل أدوار المعاينة';

    if (mode === 'cloud') {
      const roleLabel = role === 'vice' ? 'الوكيل' : 'المعلم';
      accountDialogBody.innerHTML = `
        <div class="account-card">
          <div>
            <strong>${esc(currentName())}</strong>
            <span>${roleLabel}${profile?.subject ? ` • ${esc(profile.subject)}` : ''}</span>
          </div>
        </div>
        <button id="logoutBtn" class="danger-btn" type="button">تسجيل الخروج</button>`;

      document.getElementById('logoutBtn').onclick = async () => {
        accountDialog.close();
        await supabaseClient.auth.signOut();
      };
    } else {
      const demoRoles = [
        ['teacher', 'المعلم', 'إنشاء الإحالات ومتابعة رد الوكيل'],
        ['vice', 'الوكيل', 'استقبال الإحالات والرد عليها وإدارة الطلاب والفصول']
      ];

      accountDialogBody.innerHTML = demoRoles.map(([key, label, description]) => `
        <button type="button" class="role-option" data-demo-role="${key}">
          <b>${label}${demoRole === key ? ' ✓' : ''}</b>
          <span>${description}</span>
        </button>`).join('');

      document.querySelectorAll('[data-demo-role]').forEach((button) => {
        button.onclick = () => {
          demoRole = button.dataset.demoRole;
          localStorage.setItem(DEMO_ROLE_KEY, demoRole);
          accountDialog.close();
          currentRoute = 'home';
          render();
          toastMsg(`تم التبديل إلى حساب ${demoRole === 'vice' ? 'الوكيل' : 'المعلم'}`);
        };
      });
    }

    accountDialog.showModal();
  };

  // app.js ربط الزر بالدالة القديمة قبل تحميل هذا الملف.
  accountChip.onclick = openAccountDialog;
})();