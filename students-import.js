(() => {
  let bulkTargetClassId = null;

  const style = document.createElement('style');
  style.textContent = `
    .class-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px}
    .class-actions button{border:1px solid rgba(11,119,114,.18);background:#fff;color:#0b7772;border-radius:12px;padding:8px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
    .class-actions button.bulk-main{background:#0b7772;color:#fff;border-color:#0b7772}
    .class-actions button.excel-btn{background:#f7f1df;color:#765b17;border-color:#ead9a7}
    .bulk-card{width:min(94vw,560px)}
    .bulk-help{background:#f7faf9;border:1px solid #e3ecea;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.8;color:#52605e}
    .bulk-textarea{min-height:220px;resize:vertical;line-height:1.9}
    .excel-picker{display:block;border:1px dashed #b8cbc7;border-radius:14px;padding:13px;background:#fbfdfc}
    .excel-picker input{display:block;width:100%;margin-top:7px;font:inherit}
    .bulk-count{font-size:12px;color:#687774;min-height:20px;margin-top:7px}
    .bulk-summary{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .bulk-chip{background:#eef7f5;color:#0b7772;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800}
    .student-class-block{padding:14px 0;border-bottom:1px solid rgba(15,44,41,.08)}
    .student-class-block:last-child{border-bottom:0}
    .student-class-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .student-class-top span{font-size:12px;color:#687774}
    .class-open{border:0;background:transparent;padding:0;text-align:right;font:inherit;color:inherit;cursor:pointer;min-width:120px}
    .class-open b{font-size:18px;color:#173f3b}
    .class-open small{display:block;margin-top:6px;color:#0b7772;font-size:12px;font-weight:800}
    .class-student-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid rgba(15,44,41,.08)}
    .class-student-row:last-child{border-bottom:0}
    .class-student-row b{color:#173f3b}
    .student-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .student-actions button{border:1px solid #d5e4e1;background:#fff;border-radius:11px;padding:8px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
    .student-move{color:#0b7772}
    .student-delete{color:#a64027;border-color:#e3c6bd!important}
    .class-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}
    .class-toolbar button{flex:1;min-width:115px}
    .move-dialog-card{width:min(94vw,500px)}
  `;
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.id = 'bulkStudentsDialog';
  dialog.className = 'dialog';
  dialog.innerHTML = `
    <form id="bulkStudentsForm" class="dialog-card bulk-card">
      <div class="dialog-head">
        <div>
          <h2>إضافة طلاب جماعيًا</h2>
          <p id="bulkStudentsClassName"></p>
        </div>
        <button id="closeBulkStudentsDialog" class="icon-btn" type="button" aria-label="إغلاق">×</button>
      </div>

      <div class="bulk-help">
        اكتب كل اسم في سطر مستقل، أو اختر ملف Excel. عند استيراد Excel ستظهر الأسماء في الحقل أولًا لمراجعتها قبل الحفظ.
      </div>

      <div class="field">
        <label for="bulkStudentsText">أسماء الطلاب</label>
        <textarea id="bulkStudentsText" class="textarea bulk-textarea" placeholder="محمد أحمد القحطاني&#10;عبدالله خالد الدوسري&#10;سلمان علي الشمري"></textarea>
        <div id="bulkStudentsCount" class="bulk-count"></div>
      </div>

      <label class="excel-picker">
        <b>استيراد من Excel</b>
        <span style="display:block;font-size:12px;color:#687774;margin-top:3px">يدعم .xlsx و .xls و .csv — يكفي وجود أسماء الطلاب في عمود.</span>
        <input id="bulkExcelFile" type="file" accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />
      </label>

      <div id="bulkStudentsSummary" class="bulk-summary"></div>

      <button id="saveBulkStudents" class="primary-btn" type="submit">حفظ الطلاب</button>
    </form>`;
  document.body.appendChild(dialog);

  const form = document.getElementById('bulkStudentsForm');
  const namesField = document.getElementById('bulkStudentsText');
  const excelInput = document.getElementById('bulkExcelFile');
  const countEl = document.getElementById('bulkStudentsCount');
  const summaryEl = document.getElementById('bulkStudentsSummary');
  const saveBtn = document.getElementById('saveBulkStudents');

  function cleanName(value) {
    return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function isActiveStudent(student) {
    return student?.is_active !== false;
  }

  function activeStudents() {
    return state.students.filter(isActiveStudent);
  }

  function isHeader(value) {
    const v = cleanName(value).toLowerCase();
    return ['الاسم', 'اسم', 'اسم الطالب', 'اسم الطالبة', 'الطالب', 'الطالبة', 'name', 'student', 'student name'].includes(v);
  }

  function parseTextarea() {
    const names = namesField.value
      .split(/\r?\n/)
      .map(cleanName)
      .filter(Boolean)
      .filter((name) => !isHeader(name));

    const seen = new Set();
    return names.filter((name) => {
      const key = name.toLocaleLowerCase('ar');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function updateCount() {
    const names = parseTextarea();
    countEl.textContent = names.length ? `${names.length} اسم جاهز للحفظ` : 'اكتب الأسماء تحت بعضها، كل اسم في سطر.';
    summaryEl.innerHTML = names.length ? `<span class="bulk-chip">${names.length} طالب</span>` : '';
  }

  function openBulkStudentsDialog(classId, source = 'bulk') {
    bulkTargetClassId = classId;
    const label = classNameById(classId);
    document.getElementById('bulkStudentsClassName').textContent = label;
    namesField.value = '';
    excelInput.value = '';
    summaryEl.innerHTML = '';
    updateCount();
    dialog.showModal();
    if (source === 'excel') {
      namesField.placeholder = 'اختر ملف Excel من الأسفل، وستظهر الأسماء هنا للمراجعة.';
    } else {
      namesField.placeholder = 'محمد أحمد القحطاني\nعبدالله خالد الدوسري\nسلمان علي الشمري';
      setTimeout(() => namesField.focus(), 60);
    }
  }

  async function parseExcel(file) {
    if (!file) return;
    if (!window.XLSX) {
      toastMsg('تعذر تحميل أداة Excel. تحقق من الإنترنت ثم أعد المحاولة.');
      return;
    }

    countEl.textContent = 'جاري قراءة ملف Excel...';
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

      let nameColumn = -1;
      for (let r = 0; r < Math.min(rows.length, 8); r++) {
        for (let c = 0; c < (rows[r] || []).length; c++) {
          const cell = cleanName(rows[r][c]);
          const lower = cell.toLowerCase();
          if (cell.includes('اسم') || lower === 'name' || lower.includes('student name')) {
            nameColumn = c;
            break;
          }
        }
        if (nameColumn >= 0) break;
      }

      const extracted = [];
      for (const row of rows) {
        if (!row || !row.length) continue;
        let value = '';

        if (nameColumn >= 0) {
          value = cleanName(row[nameColumn]);
        } else {
          const candidates = row
            .map(cleanName)
            .filter(Boolean)
            .filter((cell) => !/^[\d٠-٩\s\-\.]+$/.test(cell));
          value = candidates[0] || '';
        }

        if (!value || isHeader(value)) continue;
        extracted.push(value);
      }

      const unique = [];
      const seen = new Set();
      for (const name of extracted) {
        const key = name.toLocaleLowerCase('ar');
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(name);
        }
      }

      if (!unique.length) {
        namesField.value = '';
        updateCount();
        toastMsg('لم أجد أسماء واضحة في الملف');
        return;
      }

      namesField.value = unique.join('\n');
      updateCount();
      summaryEl.innerHTML = `<span class="bulk-chip">تم استيراد ${unique.length} اسم</span><span class="bulk-chip">راجع ثم احفظ</span>`;
      toastMsg(`تمت قراءة ${unique.length} اسمًا من Excel`);
    } catch (error) {
      console.error(error);
      countEl.textContent = 'تعذر قراءة الملف.';
      toastMsg('تعذر قراءة ملف Excel');
    }
  }

  namesField.addEventListener('input', updateCount);
  excelInput.addEventListener('change', () => parseExcel(excelInput.files?.[0]));
  document.getElementById('closeBulkStudentsDialog').onclick = () => dialog.close();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!bulkTargetClassId) return;

    const enteredNames = parseTextarea();
    if (!enteredNames.length) {
      toastMsg('أدخل اسم طالب واحد على الأقل');
      namesField.focus();
      return;
    }

    const existingKeys = new Set(
      state.students
        .filter((student) => isActiveStudent(student) && String(student.class_id) === String(bulkTargetClassId))
        .map((student) => cleanName(student.name).toLocaleLowerCase('ar'))
    );

    const newNames = enteredNames.filter((name) => !existingKeys.has(name.toLocaleLowerCase('ar')));
    const skipped = enteredNames.length - newNames.length;

    if (!newNames.length) {
      toastMsg('كل الأسماء موجودة مسبقًا في هذا الفصل');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري حفظ الطلاب...';

    try {
      if (mode === 'cloud') {
        const payload = newNames.map((name) => ({ name, class_id: bulkTargetClassId }));
        const { error } = await supabaseClient.from('students').insert(payload);
        if (error) throw error;
        await refreshCloudData(true);
      } else {
        const stamp = Date.now();
        newNames.forEach((name, index) => {
          state.students.push({ id: `s${stamp}${index}`, name, class_id: bulkTargetClassId, is_active: true });
        });
        saveDemo();
      }

      dialog.close();
      renderStudents();

      const skippedText = skipped ? ` وتم تجاهل ${skipped} مكرر` : '';
      toastMsg(`تمت إضافة ${newNames.length} طالبًا${skippedText}`);
    } catch (error) {
      console.error(error);
      toastMsg(`تعذر حفظ الطلاب: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'حفظ الطلاب';
    }
  });

  let selectedClassId = null;

  function currentClassStudents(classId) {
    return state.students
      .filter((student) => isActiveStudent(student) && String(student.class_id) === String(classId))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  }

  async function moveStudent(studentId, targetClassId) {
    const student = state.students.find((item) => String(item.id) === String(studentId));
    if (!student) return;

    if (mode === 'cloud') {
      const { error } = await supabaseClient
        .from('students')
        .update({ class_id: targetClassId })
        .eq('id', studentId);
      if (error) throw error;
      await refreshCloudData(true);
    } else {
      student.class_id = targetClassId;
      saveDemo();
    }
  }

  async function archiveStudent(studentId) {
    const student = state.students.find((item) => String(item.id) === String(studentId));
    if (!student) return;

    if (mode === 'cloud') {
      const { error } = await supabaseClient
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);
      if (error) throw error;
      await refreshCloudData(true);
    } else {
      student.is_active = false;
      saveDemo();
    }
  }

  function openMoveStudentDialog(studentId) {
    const student = state.students.find((item) => String(item.id) === String(studentId));
    if (!student) return;

    const targets = state.classes.filter((item) => String(item.id) !== String(student.class_id));
    if (!targets.length) {
      toastMsg('لا يوجد فصل آخر لنقل الطالب إليه');
      return;
    }

    const moveDialog = document.createElement('dialog');
    moveDialog.className = 'dialog';
    moveDialog.innerHTML = `
      <form class="dialog-card move-dialog-card">
        <div class="dialog-head">
          <div>
            <h2>نقل الطالب</h2>
            <p>${esc(student.name)}</p>
          </div>
          <button type="button" class="icon-btn" data-close-move aria-label="إغلاق">×</button>
        </div>
        <div class="field">
          <label>الفصل الجديد</label>
          <select class="select" id="moveStudentTarget" required>
            <option value="">اختر الفصل</option>
            ${targets.map((item) => `<option value="${esc(item.id)}">${esc(classNameById(item.id))}</option>`).join('')}
          </select>
        </div>
        <button class="primary-btn" type="submit">نقل الطالب</button>
      </form>`;

    document.body.appendChild(moveDialog);
    moveDialog.querySelector('[data-close-move]').onclick = () => moveDialog.close();

    moveDialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const target = moveDialog.querySelector('#moveStudentTarget').value;
      if (!target) return;

      const button = moveDialog.querySelector('.primary-btn');
      button.disabled = true;
      button.textContent = 'جاري النقل...';

      try {
        await moveStudent(studentId, target);
        moveDialog.close();
        moveDialog.remove();
        renderClassStudents(selectedClassId);
        toastMsg(`تم نقل ${student.name}`);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'نقل الطالب';
        toastMsg(`تعذر نقل الطالب: ${error.message || 'خطأ غير معروف'}`);
      }
    };

    moveDialog.addEventListener('close', () => {
      if (moveDialog.isConnected) moveDialog.remove();
    });
    moveDialog.showModal();
  }

  function renderClassStudents(classId) {
    selectedClassId = classId;
    const classItem = classById(classId);
    if (!classItem) {
      renderStudents();
      return;
    }

    const canEdit = currentRole() === 'vice';
    const students = currentClassStudents(classId);

    app.innerHTML = `
      <div class="page-head">
        <div class="kicker">الفصل</div>
        <h2 class="page-title">${esc(classNameById(classId))}</h2>
        <p class="page-sub">${students.length} طالب في هذا الفصل</p>
      </div>

      ${canEdit ? `
        <div class="class-toolbar">
          <button class="secondary-btn" id="classAddOne">+ طالب واحد</button>
          <button class="secondary-btn" id="classAddBulk">إضافة جماعية</button>
          <button class="secondary-btn" id="classAddExcel">استيراد Excel</button>
        </div>` : ''}

      <section class="section card">
        <div class="section-head">
          <h3>طلاب الفصل</h3>
          <span class="count-chip">${students.length} طالب</span>
        </div>

        <div id="classStudentList">
          ${students.length ? students.map((student) => `
            <div class="class-student-row">
              <div><b>${esc(student.name)}</b></div>
              ${canEdit ? `
                <div class="student-actions">
                  <button type="button" class="student-move" data-move-student="${esc(student.id)}">نقل</button>
                  <button type="button" class="student-delete" data-delete-student="${esc(student.id)}" data-student-name="${esc(student.name)}">حذف</button>
                </div>` : ''}
            </div>`).join('') : `<div class="empty"><div class="empty-icon">◎</div>لا يوجد طلاب في هذا الفصل</div>`}
        </div>
      </section>

      <section class="section">
        <button class="secondary-btn" id="backToClasses" type="button">العودة إلى الفصول</button>
      </section>`;

    document.getElementById('backToClasses').onclick = () => renderStudents();

    if (canEdit) {
      document.getElementById('classAddOne').onclick = () => openStudentDialog(classId);
      document.getElementById('classAddBulk').onclick = () => openBulkStudentsDialog(classId, 'bulk');
      document.getElementById('classAddExcel').onclick = () => openBulkStudentsDialog(classId, 'excel');

      document.querySelectorAll('[data-move-student]').forEach((button) => {
        button.onclick = () => openMoveStudentDialog(button.dataset.moveStudent);
      });

      document.querySelectorAll('[data-delete-student]').forEach((button) => {
        button.onclick = async () => {
          const studentId = button.dataset.deleteStudent;
          const studentName = button.dataset.studentName;
          const ok = confirm(`حذف ${studentName} من قوائم الطلاب؟\n\nستبقى إحالاته وتقاريره السابقة محفوظة في النظام.`);
          if (!ok) return;

          button.disabled = true;
          try {
            await archiveStudent(studentId);
            renderClassStudents(classId);
            toastMsg('تم حذف الطالب من القوائم');
          } catch (error) {
            button.disabled = false;
            toastMsg(`تعذر حذف الطالب: ${error.message || 'خطأ غير معروف'}`);
          }
        };
      });
    }
  }

  renderStudents = function () {
    const role = currentRole();
    const canEdit = role === 'vice';
    const active = activeStudents();

    app.innerHTML = `
      <div class="page-head">
        <div class="kicker">البيانات الأساسية</div>
        <h2 class="page-title">الطلاب والفصول</h2>
        <p class="page-sub">اضغط على اسم الفصل لاستعراض طلابه أو نقلهم وإدارة بياناتهم.</p>
      </div>

      ${!canEdit
        ? `<div class="notice">يمكن للمعلم مشاهدة بيانات الطلاب، بينما إدارة الطلاب والفصول متاحة للوكيل.</div>`
        : `<div class="success-note">اضغط على أي فصل للدخول إلى قائمة طلابه، ومن هناك يمكنك نقل طالب أو حذفه.</div>`}

      <section class="card">
        <div class="section-head">
          <h3>الفصول</h3>
          ${canEdit ? `<button id="addClass">+ إضافة فصل</button>` : ''}
        </div>

        <div>
          ${state.classes.length ? state.classes.map((item) => {
            const count = active.filter((student) => String(student.class_id) === String(item.id)).length;
            return `
              <div class="student-class-block">
                <div class="student-class-top">
                  <button type="button" class="class-open" data-open-class="${esc(item.id)}">
                    <b>${esc(classNameById(item.id))}</b>
                    <span>${count} طالب</span>
                    <small>استعراض الطلاب ←</small>
                  </button>
                </div>

                ${canEdit ? `
                  <div class="class-actions">
                    <button type="button" data-addstudent="${esc(item.id)}">+ طالب واحد</button>
                    <button type="button" class="bulk-main" data-bulkstudents="${esc(item.id)}">إضافة جماعية</button>
                    <button type="button" class="excel-btn" data-excelstudents="${esc(item.id)}">استيراد Excel</button>
                  </div>` : ''}
              </div>`;
          }).join('') : `<div class="empty">لم تتم إضافة فصول بعد</div>`}
        </div>
      </section>

      <section class="section card">
        <div class="section-head">
          <h3>جميع الطلاب</h3>
          <span class="count-chip">${active.length} طالب</span>
        </div>
        <div class="search-wrap">
          <input id="studentSearch" class="input" placeholder="بحث باسم الطالب..." />
        </div>
        <div id="studentsList">${studentsListHtml(active)}</div>
      </section>`;

    document.querySelectorAll('[data-open-class]').forEach((button) => {
      button.onclick = () => renderClassStudents(button.dataset.openClass);
    });

    const search = document.getElementById('studentSearch');
    search.oninput = () => {
      const query = search.value.trim();
      const list = active.filter((student) => student.name.includes(query));
      document.getElementById('studentsList').innerHTML = studentsListHtml(list);
    };

    if (canEdit) {
      document.getElementById('addClass').onclick = () => openClassDialog();

      document.querySelectorAll('[data-addstudent]').forEach((button) => {
        button.onclick = () => openStudentDialog(button.dataset.addstudent);
      });

      document.querySelectorAll('[data-bulkstudents]').forEach((button) => {
        button.onclick = () => openBulkStudentsDialog(button.dataset.bulkstudents, 'bulk');
      });

      document.querySelectorAll('[data-excelstudents]').forEach((button) => {
        button.onclick = () => openBulkStudentsDialog(button.dataset.excelstudents, 'excel');
      });
    }
  };

  // لا نعرض الطلاب المحذوفين عند إنشاء إحالة جديدة.
  if (typeof renderNewReferral === 'function') {
    const originalRenderNewReferral = renderNewReferral;
    renderNewReferral = function () {
      originalRenderNewReferral();

      const classSelect = document.getElementById('classSelect');
      const studentSelect = document.getElementById('studentSelect');
      if (!classSelect || !studentSelect) return;

      classSelect.onchange = () => {
        const students = state.students.filter(
          (student) => isActiveStudent(student) && String(student.class_id) === String(classSelect.value)
        );
        studentSelect.disabled = !classSelect.value;
        studentSelect.innerHTML = `<option value="">اختر الطالب</option>${students.map(
          (student) => `<option value="${esc(student.id)}">${esc(student.name)}</option>`
        ).join('')}`;
      };
    };
  }

  window.openBulkStudentsDialog = openBulkStudentsDialog;
})();