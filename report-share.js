/**
 * مشاركة التقرير بالبريد مع PDF
 */
(function () {
    'use strict';

    function reportToFormData(r, children) {
        const urgent = (children.recommendations || []).filter(x => x.type === 'urgent').map(x => x.text);
        const medium = (children.recommendations || []).filter(x => x.type === 'medium').map(x => x.text);
        const strategic = (children.recommendations || []).filter(x => x.type === 'strategic').map(x => x.text);

        return {
            specialistName: r.specialist_name,
            jobTitle: r.job_title,
            jobTitleOther: r.job_title_other || '',
            region: r.region,
            regionOther: r.region_other || '',
            centerName: r.center_name,
            visitPeriod: r.visit_period,
            entryDate: r.visit_date || r.entry_date,
            periodStart: r.period_start || '',
            periodEnd: r.period_end || '',
            staffCount: r.staff_count,
            studentCount: r.student_count,
            attendanceRate: r.attendance_rate,
            classroomsCount: r.classrooms_count,
            tentsCount: r.tents_count,
            challengesNotes: r.challenges_notes || '',
            overallRating: String(r.overall_rating || ''),
            continueSupport: r.continue_support || '',
            finalNotes: r.final_notes || '',
            challenges: (children.challenges || []).map(c => ({ text: c.description, percent: c.percentage ?? '' })),
            securityRisks: (children.security_risks || []).map(s => ({ type: s.risk_type, desc: s.description })),
            strategies: (children.strategies || []).map(s => ({ type: s.strategy_type, description: s.description })),
            competitions: (children.competitions || []).map(c => ({ name: c.name, details: c.details || '' })),
            communityParticipations: (children.community_participations || []).map(c => ({
                type: c.participation_type,
                outcomes: c.outcomes || ''
            })),
            initiatives: (children.initiatives || []).map(i => ({ name: i.name, description: i.description || '' })),
            successStories: (children.success_stories || []).map(s => ({
                name: s.title,
                challenge: s.challenge,
                solution: s.solution,
                impact: s.impact
            })),
            urgentRecommendations: urgent,
            mediumRecommendations: medium,
            strategicSolutions: strategic
        };
    }

    async function generatePdfBase64FromFormData(formData) {
        if (typeof ensureArabicFontLoaded === 'function') {
            await ensureArabicFontLoaded();
        }
        if (typeof buildReportContent !== 'function') {
            throw new Error('دالة buildReportContent غير متوفرة');
        }

        const period = [formData.periodStart, formData.periodEnd].filter(Boolean).join(' - ');
        const date = formData.entryDate
            ? new Date(formData.entryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
            : new Date().toLocaleDateString('ar-EG');

        const html = buildReportContent(formData, period, date);
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
        container.innerHTML = (typeof buildPdfFontStyleTag === 'function' ? buildPdfFontStyleTag() : '') + html;
        document.body.appendChild(container);

        const element = container.querySelector('.pdf-report');
        if (typeof applyPdfArabicFont === 'function') applyPdfArabicFont(element);

        await new Promise(r => setTimeout(r, 500));

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: typeof applyPdfFontToClone === 'function' ? applyPdfFontToClone : undefined
        });

        container.remove();

        const imgData = canvas.toDataURL('image/png');
        const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!JsPDF) throw new Error('jsPDF غير متاح');

        const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const margin = 10;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const printableWidth = pageWidth - margin * 2;
        const printableHeight = pageHeight - margin * 2;
        const imgWidth = printableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let offsetY = 0;
        let pageIndex = 0;
        while (offsetY < imgHeight) {
            if (pageIndex > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, margin - offsetY, imgWidth, imgHeight);
            offsetY += printableHeight;
            pageIndex++;
        }

        return pdf.output('datauristring').split(',')[1];
    }

    async function generatePdfForReportId(reportId) {
        const data = await fetchReportById(reportId);
        const formData = reportToFormData(data.report, data);
        return { formData, report: data.report, pdfBase64: await generatePdfBase64FromFormData(formData) };
    }

    async function showShareReportModal(reportId, reportSummary) {
        if (!window.currentUser) {
            Swal.fire('تنبيه', 'يرجى تسجيل الدخول أولاً', 'warning');
            return;
        }

        const defaultSubject = buildEmailSubject(reportSummary || {});
        const userEmail = window.currentProfile?.email || window.currentUser?.email || '';

        const { value: form } = await Swal.fire({
            title: '📧 إرسال التقرير بالبريد',
            html: `
                <div class="swal-auth-form">
                    <label class="swal-field">
                        <span>البريد الإلكتروني للمستلم (فاصلة بين عدة عناوين)</span>
                        <input id="share-to-email" type="text" class="swal2-input" placeholder="supervisor@example.com" dir="ltr">
                    </label>
                    <label class="swal-field">
                        <span>الموضوع</span>
                        <input id="share-subject" type="text" class="swal2-input" value="${defaultSubject.replace(/"/g, '&quot;')}">
                    </label>
                    <label class="swal-field">
                        <span>رسالة (اختياري)</span>
                        <textarea id="share-message" class="swal2-textarea" rows="3" placeholder="رسالة إضافية..."></textarea>
                    </label>
                    <label class="swal-field" style="flex-direction:row;align-items:center;gap:8px;">
                        <input type="checkbox" id="share-copy-me" ${userEmail ? 'checked' : ''}>
                        <span>إرسال نسخة لي (${userEmail || 'لا يوجد بريد في الملف'})</span>
                    </label>
                    ${!isEmailConfigured() ? '<p style="color:#b45309;font-size:13px;">⚠️ اضبط EMAILJS_CONFIG في config.js</p>' : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إرسال',
            cancelButtonText: 'إلغاء',
            focusConfirm: false,
            customClass: { popup: 'swal-rtl swal-wide' },
            preConfirm: () => {
                const to = document.getElementById('share-to-email')?.value?.trim();
                const subject = document.getElementById('share-subject')?.value?.trim();
                const message = document.getElementById('share-message')?.value?.trim();
                const copyMe = document.getElementById('share-copy-me')?.checked;
                if (!to) {
                    Swal.showValidationMessage('يرجى إدخال بريد المستلم');
                    return false;
                }
                let emails = to.split(/[,;]/).map(e => e.trim()).filter(Boolean);
                if (copyMe && userEmail && !emails.includes(userEmail)) emails.push(userEmail);
                return { emails, subject, message };
            }
        });

        if (!form) return;

        try {
            Swal.fire({ title: 'جاري التحضير...', text: 'إنشاء PDF وإرسال البريد', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            let pdfBase64, report;
            if (reportId) {
                const gen = await generatePdfForReportId(reportId);
                pdfBase64 = gen.pdfBase64;
                report = gen.report;
            } else if (typeof collectFormData === 'function') {
                const formData = collectFormData();
                report = {
                    center_name: formData.centerName,
                    specialist_name: formData.specialistName,
                    overall_rating: formData.overallRating,
                    continue_support: formData.continueSupport,
                    period_start: formData.periodStart,
                    period_end: formData.periodEnd,
                    visit_date: formData.entryDate
                };
                pdfBase64 = await generatePdfBase64FromFormData(formData);
            } else {
                throw new Error('لا توجد بيانات تقرير للإرسال');
            }

            await sendReportEmail({
                toEmails: form.emails,
                subject: form.subject,
                message: form.message,
                report,
                pdfBase64,
                reportId: reportId || null
            });

            Swal.fire('تم الإرسال', 'تم إرسال التقرير بالبريد بنجاح', 'success');
        } catch (err) {
            console.error('[share]', err);
            Swal.fire('خطأ', err.message || 'تعذر إرسال البريد', 'error');
        }
    }

    window.reportToFormData = reportToFormData;
    window.generatePdfBase64FromFormData = generatePdfBase64FromFormData;
    window.showShareReportModal = showShareReportModal;
})();
