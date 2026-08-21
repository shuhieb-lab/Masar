(() => {
  const BUTTON_ID = 'exportPdfBtn';

  function safeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[char]));
  }

  function dateText(value) {
    if (!value) return '—';
    try {
      if (typeof fmtDate === 'function') return fmtDate(value);
      return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return '—';
    }
  }

  function getClosedReferral() {
    try {
      if (typeof state === 'undefined' || typeof selectedReferralId === 'undefined') return null;
      const referral = state.referrals?.find((item) => String(item.id) === String(selectedReferralId));
      if (!referral || referral.status !== 'closed') return null;

      const student = typeof studentById === 'function'
        ? studentById(referral.student_id)
        : state.students?.find((item) => String(item.id) === String(referral.student_id));

      let classLabel = '—';
      if (student) {
        if (typeof classNameById === 'function') classLabel = classNameById(student.class_id);
        else {
          const cls = state.classes?.find((item) => String(item.id) === String(student.class_id));
          if (cls) classLabel = `${cls.grade} — ${cls.section}`;
        }
      }

      return { referral, student, classLabel };
    } catch {
      return null;
    }
  }

  function field(label, value, wide = false) {
    return `
      <div style="border:1px solid #e7e2d7;border-radius:12px;padding:11px 13px;${wide ? 'grid-column:1/-1;' : ''}background:#fff;break-inside:avoid;">
        <div style="font-size:11px;color:#8b7751;margin-bottom:5px;font-weight:700;">${safeHtml(label)}</div>
        <div style="font-size:13px;color:#163a39;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;">${safeHtml(value || '—')}</div>
      </div>`;
  }

  function buildReport({ referral, student, classLabel }) {
    const report = document.createElement('div');
    report.id = 'masarPdfReport';
    report.dir = 'rtl';
    report.style.cssText = 'position:relative;width:194mm;min-height:277mm;margin:0 auto;background:#fff;color:#173d3b;font-family:Tahoma,Arial,sans-serif;box-sizing:border-box;padding:12mm;-webkit-font-smoothing:antialiased;';

    report.innerHTML = `
      <div style="border:1px solid #d8c18e;border-radius:20px;overflow:hidden;background:#fff;">
        <div style="background:linear-gradient(135deg,#075f5c,#0b7772);color:#fff;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;">
          <div>
            <div style="font-size:30px;font-weight:800;letter-spacing:-1px;">مَسار</div>
            <div style="font-size:12px;opacity:.9;margin-top:4px;">إحالة ذكية • متابعة راقية</div>
          </div>
          <div style="text-align:left;">
            <div style="font-size:17px;font-weight:800;">تقرير إحالة طالب</div>
            <div style="font-size:11px;opacity:.88;margin-top:5px;">نسخة معتمدة بعد إغلاق المعاملة</div>
          </div>
        </div>

        <div style="padding:20px 22px 8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            ${field('رقم الإحالة', String(referral.id))}
            ${field('الحالة النهائية', 'مغلقة')}
            ${field('اسم الطالب', student?.name || '—')}
            ${field('الصف / الفصل', classLabel)}
            ${field('تاريخ الإحالة', dateText(referral.created_at))}
            ${field('تاريخ إغلاق المعاملة', dateText(referral.closed_at))}
          </div>

          <div style="font-size:15px;font-weight:800;color:#075f5c;margin:16px 0 9px;padding-bottom:7px;border-bottom:2px solid #d7bd82;">بيانات الإحالة</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            ${field('سبب التحويل', referral.reason, true)}
            ${field('وصف الحالة', referral.description, true)}
            ${field('الإجراء المتخذ من المعلم', referral.teacher_action, true)}
            ${field('المعلم المحيل', referral.teacher_name)}
            ${field('وقت الإحالة', dateText(referral.created_at))}
          </div>

          <div style="font-size:15px;font-weight:800;color:#075f5c;margin:18px 0 9px;padding-bottom:7px;border-bottom:2px solid #d7bd82;">إجراء الوكيل</div>
          <div style="background:#eef8f5;border:1px solid #b9d9d3;border-radius:15px;padding:15px 16px;break-inside:avoid;">
            <div style="font-size:13px;line-height:1.95;color:#173d3b;white-space:pre-wrap;overflow-wrap:anywhere;">${safeHtml(referral.vice_reply || '—')}</div>
            <div style="height:1px;background:#cfe4df;margin:13px 0;"></div>
            <div style="display:flex;justify-content:space-between;gap:14px;font-size:11px;color:#5c7471;">
              <span><b style="color:#315d59;">الوكيل:</b> ${safeHtml(referral.vice_name || '—')}</span>
              <span><b style="color:#315d59;">تاريخ الرد:</b> ${safeHtml(dateText(referral.replied_at))}</span>
            </div>
          </div>

          <div style="margin-top:18px;background:#fbf7ee;border:1px solid #e4d2a8;border-radius:14px;padding:12px 15px;display:flex;align-items:center;justify-content:space-between;gap:12px;break-inside:avoid;">
            <div>
              <div style="font-size:11px;color:#93783e;">الحالة النهائية</div>
              <div style="font-size:16px;font-weight:800;color:#075f5c;margin-top:3px;">تم إغلاق المعاملة</div>
            </div>
            <div style="width:38px;height:38px;border-radius:12px;background:#0b7772;color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;">✓</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:28px;break-inside:avoid;">
            <div style="text-align:center;font-size:11px;color:#617573;"><div style="height:34px;border-bottom:1px solid #9dafad;margin-bottom:6px;"></div>توقيع المعلم</div>
            <div style="text-align:center;font-size:11px;color:#617573;"><div style="height:34px;border-bottom:1px solid #9dafad;margin-bottom:6px;"></div>توقيع الوكيل</div>
            <div style="text-align:center;font-size:11px;color:#617573;"><div style="height:34px;border-bottom:1px solid #9dafad;margin-bottom:6px;"></div>توقيع ولي الأمر</div>
          </div>

          <div style="margin-top:28px;padding-top:10px;border-top:1px solid #ebe6dc;text-align:center;font-size:9.5px;line-height:1.7;color:#84908f;">
            تم إنشاء هذا التقرير إلكترونيًا من نظام مَسار بعد إغلاق المعاملة، ويمكن طباعته أو مشاركته عند الحاجة.
          </div>
        </div>
      </div>`;

    return report;
  }

  function fileName(data) {
    const studentName = (data.student?.name || 'طالب').replace(/[\\/:*?"<>|]/g, '-').trim();
    const referralId = String(data.referral.id).replace(/[\\/:*?"<>|]/g, '-');
    return `مسار-تقرير-${studentName}-${referralId}.pdf`;
  }

  function printFallback(report) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
      return;
    }
    printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير مَسار</title><style>@page{size:A4;margin:8mm}body{margin:0;background:#fff}#masarPdfReport{position:static!important;left:auto!important;width:auto!important;padding:0!important}</style></head><body>${report.outerHTML}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    printWindow.document.close();
  }

  async function exportPdf() {
    const data = getClosedReferral();
    if (!data) return;

    const button = document.getElementById(BUTTON_ID);
    const oldText = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'جاري تجهيز التقرير...';
    }

    const report = buildReport(data);

    // مهم لأجهزة iPhone/iPad: html2canvas قد ينتج صفحة بيضاء إذا كان العنصر
    // خارج مساحة العرض (مثل left:-10000px). لذلك نضع التقرير مؤقتًا داخل
    // طبقة فعلية في الشاشة أثناء الالتقاط ثم نحذفها بعد إنشاء الملف.
    const stage = document.createElement('div');
    stage.id = 'masarPdfStage';
    stage.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483646',
      'overflow:auto',
      'background:#f3f1eb',
      'padding:8px',
      'box-sizing:border-box',
      '-webkit-overflow-scrolling:touch'
    ].join(';');
    stage.appendChild(report);

    const oldBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(stage);

    try {
      if (document.fonts?.ready) {
        try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]); } catch {}
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      if (typeof window.html2pdf !== 'function') {
        printFallback(report);
        return;
      }

      const options = {
        margin: [8, 8, 8, 8],
        filename: fileName(data),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: Math.min(2, window.devicePixelRatio || 1.5),
          useCORS: true,
          backgroundColor: '#ffffff',
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(report.scrollWidth, document.documentElement.clientWidth),
          windowHeight: Math.max(report.scrollHeight, document.documentElement.clientHeight)
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      await window.html2pdf().set(options).from(report).save();
      if (typeof toastMsg === 'function') toastMsg('تم تجهيز تقرير PDF');
    } catch (error) {
      console.error('PDF export failed', error);
      printFallback(report);
    } finally {
      stage.remove();
      document.body.style.overflow = oldBodyOverflow;
      if (button) {
        button.disabled = false;
        button.textContent = oldText || 'تصدير تقرير الحالة PDF';
      }
    }
  }

  function injectButton() {
    const data = getClosedReferral();
    const host = document.getElementById('app');
    if (!data || !host || document.getElementById(BUTTON_ID)) return;

    const title = host.querySelector('.page-title')?.textContent?.trim();
    if (title !== 'تفاصيل الإحالة') return;

    const backButton = host.querySelector('[data-go="referrals"]');
    const backSection = backButton?.closest('.section');
    const section = document.createElement('section');
    section.className = 'section';
    section.innerHTML = `
      <button id="${BUTTON_ID}" class="primary-btn" type="button">تصدير تقرير الحالة PDF</button>
      <div style="text-align:center;color:#71817f;font-size:12px;margin-top:8px;line-height:1.6;">نسخة A4 جاهزة للطباعة أو المشاركة مع الإدارة وولي الأمر</div>`;

    if (backSection) backSection.before(section);
    else host.appendChild(section);

    document.getElementById(BUTTON_ID)?.addEventListener('click', exportPdf);
  }

  const observer = new MutationObserver(() => setTimeout(injectButton, 0));
  const start = () => {
    const host = document.getElementById('app');
    if (!host) return;
    observer.observe(host, { childList: true, subtree: true });
    injectButton();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
