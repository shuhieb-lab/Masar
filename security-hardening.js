(() => {
  'use strict';

  const MIN_NEW_PASSWORD = 8;
  const MAX_PASSWORD = 256;
  const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
  const MAX_EXCEL_ROWS = 5000;

  function notify(message) {
    if (typeof toastMsg === 'function') toastMsg(message);
    else console.warn(message);
  }

  function hardenPasswordFields(root = document) {
    root.querySelectorAll?.('input[type="password"]').forEach((input) => {
      input.maxLength = MAX_PASSWORD;
    });

    ['newPassword', 'confirmPassword', 'teacherTempPassword'].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.minLength = MIN_NEW_PASSWORD;
      input.maxLength = MAX_PASSWORD;
      if (id === 'teacherTempPassword') input.placeholder = '8 أحرف على الأقل';
    });
  }

  hardenPasswordFields();
  const observer = new MutationObserver(() => hardenPasswordFields());
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === 'addTeacherForm') {
      const password = document.getElementById('teacherTempPassword')?.value || '';
      if (password.length < MIN_NEW_PASSWORD) {
        event.preventDefault();
        event.stopImmediatePropagation();
        notify('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      }
      return;
    }

    if (form.id !== 'changePasswordForm') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const password = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';

    if (password.length < MIN_NEW_PASSWORD) {
      notify('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (password.length > MAX_PASSWORD) {
      notify('كلمة المرور أطول من الحد المسموح');
      return;
    }
    if (password !== confirmPassword) {
      notify('كلمتا المرور غير متطابقتين');
      return;
    }
    if (!supabaseClient) {
      notify('تعذر الاتصال بالخادم');
      return;
    }

    const button = document.getElementById('changePasswordBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'جاري الحفظ...';
    }

    try {
      const { data, error } = await supabaseClient.functions.invoke('masar-security', {
        body: { action: 'change_password', password }
      });

      if (error || data?.error) throw error || new Error(data.error);
      form.reset();
      notify('تم تغيير كلمة المرور بنجاح');
    } catch (error) {
      console.error('secure password change failed', error);
      notify('تعذر تغيير كلمة المرور');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'حفظ كلمة المرور الجديدة';
      }
    }
  }, true);

  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-reset-teacher]') : null;
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const teacherId = button.dataset.resetTeacher;
    const teacherName = button.dataset.teacherName || 'المعلم';
    const newPassword = prompt(`اكتب كلمة مرور مؤقتة جديدة لـ ${teacherName}\n(8 أحرف على الأقل)`);
    if (newPassword === null) return;
    if (newPassword.length < MIN_NEW_PASSWORD) return notify('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    if (newPassword.length > MAX_PASSWORD) return notify('كلمة المرور أطول من الحد المسموح');

    button.disabled = true;
    try {
      const { data, error } = await supabaseClient.functions.invoke('masar-auth', {
        body: { action: 'reset_password', teacher_id: teacherId, password: newPassword }
      });
      if (error || data?.error) throw error || new Error(data.error);
      notify('تم تعيين كلمة المرور المؤقتة');
    } catch (error) {
      console.error('secure password reset failed', error);
      notify('تعذر تعيين كلمة المرور المؤقتة');
    } finally {
      button.disabled = false;
    }
  }, true);

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'bulkExcelFile') return;
    const file = input.files?.[0];
    if (!file) return;

    const extension = (file.name.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = '';
      notify('نوع الملف غير مسموح');
      return;
    }

    if (file.size > MAX_EXCEL_BYTES) {
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = '';
      notify('حجم ملف Excel يجب ألا يتجاوز 5 MB');
    }
  }, true);

  if (window.XLSX?.read) {
    const originalRead = window.XLSX.read.bind(window.XLSX);
    window.XLSX.read = (data, options = {}) => {
      const size = Number(data?.byteLength ?? data?.length ?? 0);
      if (size > MAX_EXCEL_BYTES) throw new Error('EXCEL_FILE_TOO_LARGE');
      return originalRead(data, {
        ...options,
        cellFormula: false,
        cellHTML: false,
        cellNF: false,
      });
    };
  }

  if (window.XLSX?.utils?.sheet_to_json) {
    const originalSheetToJson = window.XLSX.utils.sheet_to_json.bind(window.XLSX.utils);
    window.XLSX.utils.sheet_to_json = (...args) => {
      const rows = originalSheetToJson(...args);
      if (Array.isArray(rows) && rows.length > MAX_EXCEL_ROWS) {
        throw new Error('EXCEL_TOO_MANY_ROWS');
      }
      return rows;
    };
  }
})();
