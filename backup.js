(() => {
  const style = document.createElement('style');
  style.textContent = `
    .backup-card{position:relative;overflow:hidden}
    .backup-card:before{content:"";position:absolute;width:120px;height:120px;border-radius:50%;left:-55px;top:-58px;background:rgba(11,129,122,.045);pointer-events:none}
    .backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}
    .backup-download,.backup-restore{border:0;border-radius:15px;padding:13px 12px;font:inherit;font-size:12px;font-weight:900}
    .backup-download{background:linear-gradient(135deg,#075954,#0b817a);color:#fff;box-shadow:0 8px 18px rgba(8,127,120,.14)}
    .backup-restore{background:#fff9ec;color:#8a641f;border:1px solid #ead7ac}
    .backup-download:disabled,.backup-restore:disabled{opacity:.55}
    .backup-note{margin-top:11px;padding:10px 12px;border-radius:13px;background:#f7faf9;border:1px solid #e3ecea;color:#687774;font-size:10px;line-height:1.8}
    .backup-note b{color:#315854}
    .backup-status{min-height:18px;margin-top:9px;color:#667775;font-size:10px;line-height:1.7}
    .backup-counts{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
    .backup-count{background:#eef7f5;color:#0b7772;border-radius:999px;padding:5px 8px;font-size:9.5px;font-weight:850}
    @media(max-width:390px){.backup-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const previousRenderSettings = renderSettings;

  function prettyDate(value) {
    try {
      return new Intl.DateTimeFormat('ar-SA', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value));
    } catch {
      return String(value || '');
    }
  }

  function fileDate(value = new Date()) {
    const d = new Date(value);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}-${mi}`;
  }

  function downloadBackup(backup, prefix = 'masar-backup') {
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}_${fileDate(backup.created_at)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function readableError(data, error) {
    const code = data?.error || '';
    if (code === 'INVALID_BACKUP') return 'الملف المختار ليس نسخة احتياطية صحيحة من مَسار.';
    if (code === 'WRONG_PROJECT') return 'هذه النسخة الاحتياطية تخص مشروع مَسار آخر.';
    if (code === 'BACKUP_TOO_LARGE') return 'حجم النسخة الاحتياطية أكبر من الحد المسموح.';
    if (code === 'RESTORE_FAILED') return `تعذر الاستعادة: ${data?.detail || 'تحقق من الملف وحاول من جديد.'}`;
    if (code === 'BACKUP_FAILED') return 'تعذر إنشاء النسخة الاحتياطية.';
    if (code === 'UNAUTHORIZED') return 'انتهت الجلسة. سجل الدخول من جديد.';
    return error?.message || data?.detail || 'حدث خطأ غير متوقع.';
  }

  function backupCardHtml() {
    return `
      <section class="section card backup-card" id="backupRestoreCard">
        <div class="section-head">
          <div>
            <h3>النسخ الاحتياطي والاستعادة</h3>
            <p class="page-sub" style="margin-top:4px">احتفظ بنسخة كاملة من بيانات مَسار واستعدها عند الحاجة.</p>
          </div>
        </div>

        <div class="backup-counts">
          <span class="backup-count">${state.classes.length} فصل</span>
          <span class="backup-count">${state.students.length} طالب</span>
          <span class="backup-count">${state.referrals.length} إحالة</span>
        </div>

        <div class="backup-actions">
          <button type="button" class="backup-download" id="downloadMasarBackup">تنزيل نسخة احتياطية</button>
          <button type="button" class="backup-restore" id="restoreMasarBackup">استعادة نسخة</button>
        </div>

        <input id="restoreMasarFile" type="file" accept=".json,application/json" hidden />

        <div class="backup-note">
          <b>مهم:</b> النسخة تشمل الفصول والطلاب والإحالات وأسماء وحالات الحسابات.
          كلمات المرور وبيانات الدخول السرية لا تُحفظ داخل الملف.
          الاستعادة تستبدل بيانات المدرسة الحالية بالنسخة التي تختارها.
        </div>

        <div class="backup-status" id="backupRestoreStatus"></div>
      </section>`;
  }

  async function refreshCurrentProfile() {
    if (!session?.user?.id) return;
    const { data } = await supabaseClient
      .from('profiles')
      .select('id, full_name, role, subject')
      .eq('id', session.user.id)
      .single();
    if (data) profile = data;
  }

  function bindBackupControls() {
    const downloadBtn = document.getElementById('downloadMasarBackup');
    const restoreBtn = document.getElementById('restoreMasarBackup');
    const fileInput = document.getElementById('restoreMasarFile');
    const status = document.getElementById('backupRestoreStatus');

    if (!downloadBtn || !restoreBtn || !fileInput || !status) return;

    downloadBtn.onclick = async () => {
      downloadBtn.disabled = true;
      restoreBtn.disabled = true;
      status.textContent = 'جاري تجهيز النسخة الاحتياطية...';

      const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
        body: { action: 'backup' }
      });

      downloadBtn.disabled = false;
      restoreBtn.disabled = false;

      if (error || data?.error || !data?.backup) {
        status.textContent = readableError(data, error);
        toastMsg('تعذر إنشاء النسخة الاحتياطية');
        return;
      }

      downloadBackup(data.backup);
      status.textContent = `تم إنشاء النسخة: ${prettyDate(data.backup.created_at)}`;
      toastMsg('تم تنزيل النسخة الاحتياطية');
    };

    restoreBtn.onclick = () => {
      fileInput.value = '';
      fileInput.click();
    };

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      if (file.size > 12_000_000) {
        status.textContent = 'حجم الملف أكبر من الحد المسموح.';
        return;
      }

      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        status.textContent = 'تعذر قراءة الملف. اختر ملف نسخة احتياطية بصيغة JSON.';
        return;
      }

      if (
        backup?.format !== 'masar-backup' ||
        Number(backup?.version) !== 1 ||
        !backup?.data ||
        !Array.isArray(backup.data.classes) ||
        !Array.isArray(backup.data.students) ||
        !Array.isArray(backup.data.referrals)
      ) {
        status.textContent = 'الملف المختار ليس نسخة احتياطية صحيحة من مَسار.';
        return;
      }

      const classes = backup.data.classes.length;
      const students = backup.data.students.length;
      const referrals = backup.data.referrals.length;
      const createdAt = prettyDate(backup.created_at);

      const confirmed = confirm(
        `استعادة نسخة مَسار؟\n\n` +
        `تاريخ النسخة: ${createdAt}\n` +
        `الفصول: ${classes}\n` +
        `الطلاب: ${students}\n` +
        `الإحالات: ${referrals}\n\n` +
        `سيتم استبدال بيانات المدرسة الحالية بهذه النسخة.\n` +
        `كلمات المرور لن تتغير.\n\n` +
        `هل تريد المتابعة؟`
      );
      if (!confirmed) return;

      restoreBtn.disabled = true;
      downloadBtn.disabled = true;
      status.textContent = 'جاري استعادة البيانات... لا تغلق الصفحة.';

      const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
        body: { action: 'restore', backup }
      });

      if (error || data?.error || !data?.ok) {
        restoreBtn.disabled = false;
        downloadBtn.disabled = false;
        status.textContent = readableError(data, error);
        toastMsg('تعذر استعادة النسخة');
        return;
      }

      status.textContent = 'تمت الاستعادة بنجاح. جاري تحديث مَسار...';

      await refreshCurrentProfile();
      await refreshCloudData(true);

      toastMsg('تمت استعادة النسخة الاحتياطية بنجاح');
      setTimeout(() => {
        currentRoute = 'settings';
        render();
      }, 100);
    };
  }

  renderSettings = function () {
    previousRenderSettings();

    if (mode !== 'cloud' || currentRole() !== 'vice') return;
    if (document.getElementById('backupRestoreCard')) return;

    const credit = app.querySelector('.settings-credit');
    if (credit) {
      credit.insertAdjacentHTML('beforebegin', backupCardHtml());
    } else {
      app.insertAdjacentHTML('beforeend', backupCardHtml());
    }

    bindBackupControls();
  };
})();
