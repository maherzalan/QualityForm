/**
 * عرض وإدارة التقارير السابقة
 */
(function () {
    'use strict';

    const RATING_LABELS = {
        1: '⭐ ضعيف جداً',
        2: '⭐⭐ ضعيف',
        3: '⭐⭐⭐ متوسط',
        4: '⭐⭐⭐⭐ جيد',
        5: '⭐⭐⭐⭐⭐ ممتاز'
    };

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    function renderReportCard(report) {
        const rating = report.overall_rating ? RATING_LABELS[report.overall_rating] || report.overall_rating : 'غير محدد';
        const period = [report.period_start, report.period_end].filter(Boolean).join(' — ');

        return `
            <article class="report-card" data-id="${report.id}">
                <div class="report-card-header">
                    <h3 class="report-card-title">${escapeHtml(report.center_name)}</h3>
                    <span class="report-card-rating">${escapeHtml(rating)}</span>
                </div>
                <div class="report-card-meta">
                    <p><strong>المختص:</strong> ${escapeHtml(report.specialist_name)}</p>
                    <p><strong>تاريخ الزيارة:</strong> ${escapeHtml(formatDate(report.visit_date || report.entry_date))}</p>
                    ${period ? `<p><strong>الفترة:</strong> ${escapeHtml(period)}</p>` : ''}
                </div>
                <div class="report-card-stats">
                    <span>👥 ${escapeHtml(report.staff_count ?? 0)} موظف</span>
                    <span>🎓 ${escapeHtml(report.student_count ?? 0)} طالب</span>
                    <span>📈 ${escapeHtml(report.attendance_rate ?? 0)}% حضور</span>
                </div>
                <div class="report-card-actions">
                    <button type="button" class="btn-report-view" onclick="viewReportDetails('${report.id}')">عرض التفاصيل</button>
                    <button type="button" class="btn-report-delete" onclick="confirmDeleteReport('${report.id}')">حذف</button>
                </div>
            </article>
        `;
    }

    async function loadPreviousReports() {
        const listEl = document.getElementById('reportsList');
        const emptyEl = document.getElementById('reportsEmpty');
        if (!listEl) return;

        listEl.innerHTML = '<p class="reports-loading">جاري تحميل التقارير...</p>';
        if (emptyEl) emptyEl.classList.add('hidden');

        try {
            const reports = await fetchUserReports();
            if (!reports.length) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.classList.remove('hidden');
                return;
            }
            if (emptyEl) emptyEl.classList.add('hidden');
            listEl.innerHTML = reports.map(renderReportCard).join('');
        } catch (err) {
            listEl.innerHTML = '';
            Swal.fire('خطأ', err.message || 'تعذر تحميل التقارير', 'error');
        }
    }

    function sectionBlock(title, color, content) {
        if (!content) return '';
        return `
            <section class="detail-section" style="border-right-color:${color}">
                <h4 style="color:${color}">${escapeHtml(title)}</h4>
                <div class="detail-section-body">${content}</div>
            </section>
        `;
    }

    function detailCard(html, color = '#667eea') {
        return `<div class="detail-card" style="border-right-color:${color}">${html}</div>`;
    }

    async function viewReportDetails(reportId) {
        try {
            Swal.fire({ title: 'جاري التحميل...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const data = await fetchReportById(reportId);
            const r = data.report;

            const urgent = data.recommendations.filter(x => x.type === 'urgent');
            const medium = data.recommendations.filter(x => x.type === 'medium');
            const strategic = data.recommendations.filter(x => x.type === 'strategic');

            const html = `
                <div class="report-details">
                    ${sectionBlock('📋 البيانات الأساسية', '#667eea', detailCard(`
                        <p><strong>المركز:</strong> ${escapeHtml(r.center_name)}</p>
                        <p><strong>المختص:</strong> ${escapeHtml(r.specialist_name)}</p>
                        <p><strong>المسمى:</strong> ${escapeHtml(r.job_title)}${r.job_title_other ? ` (${escapeHtml(r.job_title_other)})` : ''}</p>
                        <p><strong>المنطقة:</strong> ${escapeHtml(r.region)}${r.region_other ? ` (${escapeHtml(r.region_other)})` : ''}</p>
                        <p><strong>فترة الزيارة:</strong> ${escapeHtml(r.visit_period)}</p>
                        <p><strong>تاريخ الزيارة:</strong> ${escapeHtml(formatDate(r.visit_date))}</p>
                    `))}
                    ${sectionBlock('📊 الإحصائيات', '#764ba2', detailCard(`
                        <p><strong>الموظفين:</strong> ${escapeHtml(r.staff_count)}</p>
                        <p><strong>الطلبة:</strong> ${escapeHtml(r.student_count)}</p>
                        <p><strong>نسبة الحضور:</strong> ${escapeHtml(r.attendance_rate)}%</p>
                        <p><strong>الغرف الصفية:</strong> ${escapeHtml(r.classrooms_count)}</p>
                        <p><strong>الخيام:</strong> ${escapeHtml(r.tents_count)}</p>
                    `, '#764ba2')}
                    ${sectionBlock('⚠️ التحديات', '#f59e0b', data.challenges.map((c, i) => detailCard(
                        `<strong>التحدي ${i + 1}:</strong> ${escapeHtml(c.description)}${c.percentage != null ? `<br><strong>النسبة:</strong> ${escapeHtml(c.percentage)}%` : ''}`,
                        '#f59e0b'
                    )).join(''))}
                    ${sectionBlock('🔒 المخاطر الأمنية', '#ef4444', data.security_risks.map((s, i) => detailCard(
                        `<strong>${escapeHtml(s.risk_type)}:</strong><br>${escapeHtml(s.description)}`, '#ef4444'
                    )).join(''))}
                    ${r.challenges_notes ? sectionBlock('📝 ملاحظات التحديات', '#f59e0b', detailCard(escapeHtml(r.challenges_notes), '#f59e0b')) : ''}
                    ${sectionBlock('🎨 استراتيجيات التعلم', '#8b5cf6', data.strategies.map((s, i) => detailCard(
                        `<strong>${i + 1}. ${escapeHtml(s.strategy_type)}</strong><br>${escapeHtml(s.description)}`, '#8b5cf6'
                    )).join(''))}
                    ${sectionBlock('🏆 المسابقات', '#10b981', data.competitions.map(c => detailCard(
                        `<strong>${escapeHtml(c.name)}</strong>${c.details ? `<br>${escapeHtml(c.details)}` : ''}`, '#10b981'
                    )).join(''))}
                    ${sectionBlock('🤝 المشاركة المجتمعية', '#0ea5e9', data.community_participations.map((c, i) => detailCard(
                        `<strong>${i + 1}. ${escapeHtml(c.participation_type)}</strong>${c.outcomes ? `<br>${escapeHtml(c.outcomes)}` : ''}`, '#0ea5e9'
                    )).join(''))}
                    ${sectionBlock('🌟 المبادرات', '#f97316', data.initiatives.map(i => detailCard(
                        `<strong>${escapeHtml(i.name)}</strong><br>${escapeHtml(i.description)}`, '#f97316'
                    )).join(''))}
                    ${sectionBlock('📖 قصص النجاح', '#f59e0b', data.success_stories.map(s => detailCard(`
                        <strong>${escapeHtml(s.title)}</strong>
                        <p><strong>التحدي:</strong> ${escapeHtml(s.challenge)}</p>
                        <p><strong>الحل:</strong> ${escapeHtml(s.solution)}</p>
                        <p><strong>الأثر:</strong> ${escapeHtml(s.impact)}</p>
                    `, '#f59e0b')).join(''))}
                    ${sectionBlock('🚨 توصيات عاجلة', '#ef4444', urgent.map(u => detailCard(`⚠️ ${escapeHtml(u.text)}`, '#ef4444')).join(''))}
                    ${sectionBlock('📅 توصيات متوسطة', '#3b82f6', medium.map(u => detailCard(`📌 ${escapeHtml(u.text)}`, '#3b82f6')).join(''))}
                    ${sectionBlock('🎯 حلول استراتيجية', '#10b981', strategic.map(u => detailCard(`✨ ${escapeHtml(u.text)}`, '#10b981')).join(''))}
                    ${sectionBlock('📊 التقييم النهائي', '#667eea', detailCard(`
                        <p><strong>التقييم:</strong> ${escapeHtml(RATING_LABELS[r.overall_rating] || r.overall_rating)}</p>
                        <p><strong>استمرار الدعم:</strong> ${escapeHtml(r.continue_support)}</p>
                        ${r.final_notes ? `<p><strong>ملاحظات:</strong> ${escapeHtml(r.final_notes)}</p>` : ''}
                    `))}
                </div>
            `;

            Swal.fire({
                title: `تقرير: ${r.center_name}`,
                html,
                width: '720px',
                confirmButtonText: 'إغلاق',
                customClass: { popup: 'swal-rtl swal-wide swal-details' }
            });
        } catch (err) {
            Swal.fire('خطأ', err.message || 'تعذر تحميل التفاصيل', 'error');
        }
    }

    async function confirmDeleteReport(reportId) {
        const card = document.querySelector(`.report-card[data-id="${reportId}"]`);
        const title = card?.querySelector('.report-card-title')?.textContent || 'هذا التقرير';

        const result = await Swal.fire({
            title: 'تأكيد الحذف',
            html: `هل أنت متأكد من حذف تقرير <strong>${escapeHtml(title)}</strong>؟<br>لا يمكن التراجع عن هذا الإجراء.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'swal-rtl' }
        });

        if (!result.isConfirmed) return;

        try {
            Swal.fire({ title: 'جاري الحذف...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await deleteReport(reportId);
            await loadPreviousReports();
            Swal.fire('تم', 'تم حذف التقرير بنجاح', 'success');
        } catch (err) {
            Swal.fire('خطأ', err.message || 'تعذر حذف التقرير', 'error');
        }
    }

    window.loadPreviousReports = loadPreviousReports;
    window.viewReportDetails = viewReportDetails;
    window.confirmDeleteReport = confirmDeleteReport;
})();
