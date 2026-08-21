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
        .filter((student) => String(student.class_id) === String(bulkTargetClassId))
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
          state.students.push({ id: `s${stamp}${index}`, name, class_id: bulkTargetClassId });
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

  renderStudents = function () {
    const role = currentRole();
    const canEdit = role === 'vice';

    app.innerHTML = `
      <div class="page-head">
        <div class="kicker">البيانات الأساسية</div>
        <h2 class="page-title">الطلاب والفصول</h2>
        <p class="page-sub">أنشئ الفصول أولًا، ثم أضف الطلاب يدويًا أو جماعيًا أو من Excel.</p>
      </div>

      ${!canEdit
        ? `<div class="notice">يمكن للمعلم مشاهدة بيانات الطلاب، بينما إدارة الطلاب والفصول متاحة للوكيل.</div>`
        : `<div class="success-note">يمكنك إضافة طالب واحد، أو لصق قائمة أسماء، أو استيرادها من Excel.</div>`}

      <section class="card">
        <div class="section-head">
          <h3>الفصول</h3>
          ${canEdit ? `<button id="addClass">+ إضافة فصل</button>` : ''}
        </div>

        <div>
          ${state.classes.length ? state.classes.map((item) => `
            <div class="student-class-block">
              <div class="student-class-top">
                <div>
                  <b>${esc(classNameById(item.id))}</b><br>
                  <span>${state.students.filter((student) => String(student.class_id) === String(item.id)).length} طالب</span>
                </div>
              </div>

              ${canEdit ? `
                <div class="class-actions">
                  <button type="button" data-addstudent="${esc(item.id)}">+ طالب واحد</button>
                  <button type="button" class="bulk-main" data-bulkstudents="${esc(item.id)}">إضافة جماعية</button>
                  <button type="button" class="excel-btn" data-excelstudents="${esc(item.id)}">استيراد Excel</button>
                </div>` : ''}
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

      document.querySelectorAll('[data-bulkstudents]').forEach((button) => {
        button.onclick = () => openBulkStudentsDialog(button.dataset.bulkstudents, 'bulk');
      });

      document.querySelectorAll('[data-excelstudents]').forEach((button) => {
        button.onclick = () => openBulkStudentsDialog(button.dataset.excelstudents, 'excel');
      });
    }
  };

  window.openBulkStudentsDialog = openBulkStudentsDialog;
})();