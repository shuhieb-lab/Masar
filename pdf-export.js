(() => {
  const BUTTON_ID = 'exportPdfBtn';

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function safeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[char]));
  }

  function dateText(value) {
    if (!value) return '—';
    try {
      if (typeof fmtDate === 'function') return fmtDate(value);
      return new Intl.DateTimeFormat('ar-SA', {
        dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(value));
    } catch {
      return '—';
    }
  }

  function getClosedReferral() {
    try {
      if (typeof state === 'undefined' || typeof selectedReferralId === 'undefined') return null;
      const referral = state.referrals?.find(
        (item) => String(item.id) === String(selectedReferralId)
      );
      if (!referral || referral.status !== 'closed') return null;

      const student = typeof studentById === 'function'
        ? studentById(referral.student_id)
        : state.students?.find((item) => String(item.id) === String(referral.student_id));

      let classLabel = '—';
      if (student) {
        if (typeof classNameById === 'function') {
          classLabel = classNameById(student.class_id);
        } else {
          const cls = state.classes?.find(
            (item) => String(item.id) === String(student.class_id)
          );
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
      <div class="pdf-field ${wide ? 'pdf-wide' : ''}">
        <div class="pdf-label">${safeHtml(label)}</div>
        <div class="pdf-value">${safeHtml(value || '—')}</div>
      </div>`;
  }

  function reportHtml({ referral, student, classLabel }) {
    return `
      <article class="masar-print-sheet" dir="rtl">
        <div class="masar-print-inner">
          <header class="pdf-head">
            <div>
              <div class="pdf-brand">مَسار</div>
              <div class="pdf-tag">إحالة ذكية • متابعة راقية</div>
            </div>
            <div class="pdf-head-title">
              <strong>تقرير إحالة طالب</strong>
              <span>نسخة بعد إغلاق المعاملة</span>
            </div>
          </header>

          <main class="pdf-body">
            <div class="pdf-grid pdf-summary">
              ${field('رقم الإحالة', String(referral.id))}
              ${field('الحالة النهائية', 'مغلقة')}
              ${field('اسم الطالب', student?.name || '—')}
              ${field('الصف / الفصل', classLabel)}
              ${field('تاريخ الإحالة', dateText(referral.created_at))}
              ${field('تاريخ الإغلاق', dateText(referral.closed_at))}
            </div>

            <h2 class="pdf-section-title">بيانات الإحالة</h2>
            <div class="pdf-grid">
              ${field('سبب التحويل', referral.reason, true)}
              ${field('وصف الحالة', referral.description, true)}
              ${field('الإجراء المتخذ من المعلم', referral.teacher_action, true)}
              ${field('المعلم المحيل', referral.teacher_name)}
              ${field('وقت الإحالة', dateText(referral.created_at))}
            </div>

            <h2 class="pdf-section-title">إجراء الوكيل</h2>
            <section class="pdf-reply">
              <div class="pdf-reply-text">${safeHtml(referral.vice_reply || '—')}</div>
              <div class="pdf-reply-meta">
                <span><b>الوكيل:</b> ${safeHtml(referral.vice_name || '—')}</span>
                <span><b>تاريخ الرد:</b> ${safeHtml(dateText(referral.replied_at))}</span>
              </div>
            </section>

            <section class="pdf-closed">
              <div>
                <small>الحالة النهائية</small>
                <strong>تم إغلاق المعاملة</strong>
              </div>
              <div class="pdf-check">✓</div>
            </section>

            <section class="pdf-signatures">
              <div><span></span>توقيع المعلم</div>
              <div><span></span>توقيع الوكيل</div>
              <div><span></span>توقيع ولي الأمر</div>
            </section>

            <footer class="pdf-foot">
              تم إنشاء هذا التقرير إلكترونيًا من نظام مَسار بعد إغلاق المعاملة،
              ويمكن طباعته أو حفظه بصيغة PDF ومشاركته عند الحاجة.
            </footer>
          </main>
        </div>
      </article>`;
  }

  function printCss() {
    return `
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; background:#eef1ef; }
      body {
        font-family: Tahoma, Arial, sans-serif;
        color:#173d3b;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-toolbar {
        position:sticky; top:0; z-index:20;
        display:flex; gap:10px; align-items:center; justify-content:center;
        padding:12px;
        background:rgba(255,255,255,.96);
        border-bottom:1px solid #e2e6e4;
      }
      .print-toolbar button {
        border:0; border-radius:12px; padding:12px 18px;
        font:700 14px Tahoma,Arial,sans-serif; cursor:pointer;
      }
      .print-primary { background:#0b7772; color:#fff; }
      .print-secondary { background:#edf3f1; color:#174e4b; }
      .print-note { text-align:center; font-size:12px; color:#687b78; padding:0 12px 10px; background:#fff; }
      .masar-print-sheet {
        width:210mm;
        min-height:297mm;
        margin:14px auto 30px;
        background:#fff;
        padding:10mm;
        box-shadow:0 4px 22px rgba(0,0,0,.12);
      }
      .masar-print-inner {
        width:190mm;
        min-height:277mm;
        border:1px solid #d8c18e;
        border-radius:16px;
        overflow:hidden;
        background:#fff;
      }
      .pdf-head {
        background:linear-gradient(135deg,#075f5c,#0b7772);
        color:#fff;
        padding:14px 18px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
      }
      .pdf-brand { font-size:25px; font-weight:800; line-height:1.1; }
      .pdf-tag { font-size:10px; opacity:.9; margin-top:4px; }
      .pdf-head-title { text-align:left; display:flex; flex-direction:column; gap:4px; }
      .pdf-head-title strong { font-size:15px; }
      .pdf-head-title span { font-size:9.5px; opacity:.9; }
      .pdf-body { padding:13px 16px 10px; }
      .pdf-grid {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }
      .pdf-summary { margin-bottom:10px; }
      .pdf-field {
        border:1px solid #e7e2d7;
        border-radius:9px;
        padding:7px 9px;
        background:#fff;
        min-height:50px;
        break-inside:avoid;
        page-break-inside:avoid;
      }
      .pdf-wide { grid-column:1/-1; }
      .pdf-label {
        font-size:9px; color:#8b7751; font-weight:700; margin-bottom:3px;
      }
      .pdf-value {
        font-size:11px; color:#163a39; line-height:1.55;
        white-space:pre-wrap; overflow-wrap:anywhere;
      }
      .pdf-section-title {
        margin:11px 0 6px;
        padding-bottom:5px;
        border-bottom:2px solid #d7bd82;
        color:#075f5c;
        font-size:12px;
      }
      .pdf-reply {
        background:#eef8f5;
        border:1px solid #b9d9d3;
        border-radius:11px;
        padding:10px 12px;
        break-inside:avoid;
        page-break-inside:avoid;
      }
      .pdf-reply-text {
        font-size:11px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere;
      }
      .pdf-reply-meta {
        border-top:1px solid #cfe4df;
        margin-top:8px; padding-top:7px;
        display:flex; justify-content:space-between; gap:10px;
        color:#5c7471; font-size:9px;
      }
      .pdf-closed {
        margin-top:10px;
        background:#fbf7ee;
        border:1px solid #e4d2a8;
        border-radius:10px;
        padding:8px 10px;
        display:flex; align-items:center; justify-content:space-between;
        break-inside:avoid; page-break-inside:avoid;
      }
      .pdf-closed small { display:block; font-size:9px; color:#93783e; }
      .pdf-closed strong { display:block; margin-top:2px; font-size:13px; color:#075f5c; }
      .pdf-check {
        width:30px; height:30px; border-radius:9px;
        display:flex; align-items:center; justify-content:center;
        background:#0b7772; color:#fff; font-size:16px;
      }
      .pdf-signatures {
        display:grid; grid-template-columns:1fr 1fr 1fr;
        gap:10px; margin-top:16px;
        break-inside:avoid; page-break-inside:avoid;
      }
      .pdf-signatures div { text-align:center; font-size:9px; color:#617573; }
      .pdf-signatures span {
        display:block; height:25px; border-bottom:1px solid #9dafad; margin-bottom:4px;
      }
      .pdf-foot {
        margin-top:14px; padding-top:7px;
        border-top:1px solid #ebe6dc;
        text-align:center; font-size:8.5px; line-height:1.5; color:#84908f;
      }

      @page { size: A4 portrait; margin: 0; }

      @media print {
        html, body {
          width:210mm !important;
          height:297mm !important;
          background:#fff !important;
          overflow:visible !important;
        }
        .print-toolbar, .print-note { display:none !important; }
        .masar-print-sheet {
          width:210mm !important;
          height:297mm !important;
          min-height:297mm !important;
          margin:0 !important;
          padding:10mm !important;
          box-shadow:none !important;
          overflow:hidden !important;
          break-after:avoid !important;
          page-break-after:avoid !important;
        }
        .masar-print-inner {
          width:190mm !important;
          min-height:277mm !important;
          max-height:277mm !important;
          overflow:hidden !important;
        }
      }

      @media screen and (max-width: 900px) {
        body { overflow-x:auto; }
        .masar-print-sheet { transform-origin: top right; }
      }
    `;
  }

  function fileName(data) {
    const studentName = (data.student?.name || 'طالب')
      .replace(/[\\/:*?"<>|]/g, '-').trim();
    const referralId = String(data.referral.id)
      .replace(/[\\/:*?"<>|]/g, '-');
    return `مسار-تقرير-${studentName}-${referralId}`;
  }

  function openPrintA4(data) {
    // نفتح النافذة مباشرة داخل حدث النقر حتى لا يمنعها iPhone/Chrome.
    const w = window.open('', '_blank');
    if (!w) {
      alert('تعذر فتح نسخة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
      return;
    }

    const title = fileName(data);
    w.document.open();
    w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0b7772">
  <title>${safeHtml(title)}</title>
  <style>${printCss()}</style>
</head>
<body>
  <div class="print-toolbar">
    <button class="print-primary" onclick="window.print()">طباعة / حفظ PDF</button>
    <button class="print-secondary" onclick="window.close()">إغلاق</button>
  </div>
  <div class="print-note">الصفحة أدناه بمقاس A4 كامل 210 × 297 مم. عند الطباعة اختر A4 ونسبة 100%.</div>
  ${reportHtml(data)}
</body>
</html>`);
    w.document.close();

    // على أجهزة iPhone لا نستخدم html2canvas إطلاقًا؛ المعاينة الأصلية للمتصفح
    // تحافظ على العربية ومقاس A4 ولا تقص الصفحة.
    if (!isIOS) {
      // لا نفتح الطباعة تلقائياً حتى يراجع المستخدم المعاينة أولاً.
    }
  }

  function exportPdf() {
    const data = getClosedReferral();
    if (!data) return;
    openPrintA4(data);
    if (typeof toastMsg === 'function') {
      toastMsg('تم فتح نسخة A4 الجاهزة للطباعة');
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
      <button id="${BUTTON_ID}" class="primary-btn" type="button">
        تصدير تقرير الحالة A4
      </button>
      <div style="text-align:center;color:#71817f;font-size:12px;margin-top:8px;line-height:1.6;">
        يفتح نسخة A4 أصلية للطباعة أو الحفظ PDF بدون قص على iPhone
      </div>`;

    if (backSection) backSection.before(section);
    else host.appendChild(section);

    document.getElementById(BUTTON_ID)?.addEventListener('click', exportPdf);
  }

  const observer = new MutationObserver(() => setTimeout(injectButton, 0));

  const start = () => {
    const host = document.getElementById('app');
    if (!host) return;
    observer.observe(host, { childList:true, subtree:true });
    injectButton();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();