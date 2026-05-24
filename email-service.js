/**
 * إرسال التقارير عبر EmailJS + تسجيل السجل
 */
(function () {
    'use strict';

    function getEmailJsConfig() {
        return window.EMAILJS_CONFIG || {};
    }

    function isEmailConfigured() {
        const c = getEmailJsConfig();
        return !!(c.serviceId && c.templateId && c.publicKey && !c.serviceId.includes('YOUR_'));
    }

    function buildEmailSubject(report) {
        const center = report?.center_name || report?.centerName || 'المركز';
        const date = report?.visit_date || report?.entryDate || new Date().toISOString().split('T')[0];
        return `تقرير ضبط الجودة - ${center} - ${date}`;
    }

    function buildEmailBody(report, customMessage) {
        const center = report?.center_name || report?.centerName || '-';
        const specialist = report?.specialist_name || report?.specialistName || '-';
        const rating = report?.overall_rating || report?.overallRating || '-';
        const support = report?.continue_support || report?.continueSupport || '-';
        const period = [report?.period_start, report?.period_end].filter(Boolean).join(' — ') || '-';

        return `${customMessage ? customMessage + '\n\n' : ''}السلام عليكم،

تم إرفاق تقرير ضبط الجودة الخاص بـ ${center} للفترة ${period}.

تفاصيل سريعة:
- المختص: ${specialist}
- التقييم العام: ${rating}/5
- دعم مستمر: ${support}

لمزيد من التفاصيل، يرجى الاطلاع على المرفق.

مع الشكر،
نظام ضبط الجودة`;
    }

    async function sendReportEmail({ toEmails, subject, message, report, pdfBase64, reportId }) {
        if (!isEmailConfigured()) {
            throw new Error('لم يتم ضبط EmailJS في config.js (serviceId, templateId, publicKey)');
        }

        const cfg = getEmailJsConfig();
        const recipients = (Array.isArray(toEmails) ? toEmails : String(toEmails).split(/[,;]/))
            .map(e => e.trim())
            .filter(Boolean);

        if (!recipients.length) throw new Error('يرجى إدخال بريد مستلم واحد على الأقل');

        if (typeof emailjs === 'undefined') {
            throw new Error('مكتبة EmailJS غير محمّلة');
        }

        emailjs.init(cfg.publicKey);

        const subj = subject || buildEmailSubject(report);
        const body = buildEmailBody(report, message);
        const attachmentName = `quality_report_${(report?.center_name || 'report').replace(/\s+/g, '_')}.pdf`;

        const results = [];
        for (const to_email of recipients) {
            try {
                await emailjs.send(cfg.serviceId, cfg.templateId, {
                    to_email,
                    subject: subj,
                    message: body,
                    center_name: report?.center_name || report?.centerName || '',
                    specialist_name: report?.specialist_name || report?.specialistName || '',
                    attachment_name: attachmentName,
                    attachment_data: pdfBase64 || ''
                });
                results.push({ email: to_email, ok: true });
                if (reportId && typeof logEmailSend === 'function') {
                    await logEmailSend({ reportId, sentTo: to_email, subject: subj, status: 'success' });
                }
            } catch (err) {
                results.push({ email: to_email, ok: false, error: err.message });
                if (reportId && typeof logEmailSend === 'function') {
                    await logEmailSend({
                        reportId,
                        sentTo: to_email,
                        subject: subj,
                        status: 'failed',
                        errorMessage: err.message
                    });
                }
            }
        }

        const failed = results.filter(r => !r.ok);
        if (failed.length === results.length) {
            throw new Error(failed[0]?.error || 'فشل إرسال البريد لجميع المستلمين');
        }

        return results;
    }

    window.isEmailConfigured = isEmailConfigured;
    window.buildEmailSubject = buildEmailSubject;
    window.buildEmailBody = buildEmailBody;
    window.sendReportEmail = sendReportEmail;
})();
