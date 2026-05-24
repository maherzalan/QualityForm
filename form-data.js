/**
 *  جمع بيانات النموذج بشكل منظم
 */
(function () {
    'use strict';

    function clampPercentValue(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        return Math.min(100, Math.max(0, num));
    }

    function resolveOtherValue(selected, other) {
        if (selected === 'أخرى' && other?.trim()) return `أخرى: ${other.trim()}`;
        return selected || '';
    }

    function collectChallenges() {
        const items = [];
        document.querySelectorAll('#challengesContainer .dynamic-item').forEach(item => {
            const text = item.querySelector('textarea')?.value?.trim();
            if (!text) return;
            const percentInput = item.querySelector('[name^="challenge_percent_"]');
            const percentVal = percentInput?.value;
            items.push({
                text,
                percent: percentVal === '' || percentVal === undefined ? '' : clampPercentValue(percentVal)
            });
        });
        return items;
    }

    function collectSecurityRisks() {
        const items = [];
        document.querySelectorAll('#securityRisksContainer .dynamic-item').forEach(item => {
            const desc = item.querySelector('[name^="security_desc_"]')?.value?.trim();
            if (!desc) return;
            const typeVal = item.querySelector('[name^="security_type_"]')?.value || '';
            const otherVal = item.querySelector('[name^="security_type_other_"]')?.value || '';
            items.push({
                type: resolveOtherValue(typeVal, otherVal),
                desc
            });
        });
        return items;
    }

    function collectStrategies() {
        const items = [];
        document.querySelectorAll('#strategiesContainer .dynamic-item').forEach(item => {
            const desc = item.querySelector('[name^="strategy_desc_"]')?.value?.trim();
            if (!desc) return;
            const typeVal = item.querySelector('[name^="strategy_type_"]')?.value || '';
            const otherVal = item.querySelector('[name^="strategy_type_other_"]')?.value || '';
            items.push({
                type: resolveOtherValue(typeVal, otherVal),
                description: desc
            });
        });
        return items;
    }

    function collectCommunityParticipations() {
        const items = [];
        document.querySelectorAll('#communityContainer .dynamic-item').forEach(item => {
            const typeVal = item.querySelector('[name^="community_type_"]')?.value;
            if (!typeVal) return;
            const otherVal = item.querySelector('[name^="community_type_other_"]')?.value || '';
            items.push({
                type: resolveOtherValue(typeVal, otherVal),
                outcomes: item.querySelector('[name^="community_outcomes_"]')?.value || ''
            });
        });
        return items;
    }

    function collectInitiatives() {
        const items = [];
        document.querySelectorAll('#initiativesContainer .dynamic-item').forEach(item => {
            const name = item.querySelector('[name^="initiative_name_"]')?.value?.trim();
            if (!name) return;
            items.push({
                name,
                description: item.querySelector('[name^="initiative_desc_"]')?.value || ''
            });
        });
        return items;
    }

    function collectCompetitions() {
        const items = [];
        document.querySelectorAll('#competitionsContainer .dynamic-item').forEach(item => {
            const name = item.querySelector('[name^="comp_name_"]')?.value?.trim();
            if (!name) return;
            items.push({
                name,
                details: item.querySelector('[name^="comp_details_"]')?.value || ''
            });
        });
        return items;
    }

    function collectSuccessStories() {
        const items = [];
        document.querySelectorAll('#successStoriesContainer .dynamic-item').forEach(item => {
            const name = item.querySelector('[name^="story_name_"]')?.value?.trim();
            if (!name) return;
            items.push({
                name,
                challenge: item.querySelector('[name^="story_challenge_"]')?.value || '',
                solution: item.querySelector('[name^="story_solution_"]')?.value || '',
                impact: item.querySelector('[name^="story_impact_"]')?.value || ''
            });
        });
        return items;
    }

    function collectTextareaList(containerId, namePrefix) {
        const items = [];
        document.querySelectorAll(`#${containerId} .dynamic-item`).forEach(item => {
            const val = item.querySelector(`[name^="${namePrefix}"]`)?.value?.trim();
            if (val) items.push(val);
        });
        return items;
    }

    function collectFormData() {
        const attendanceRaw = document.getElementById('attendanceRate')?.value;

        return {
            specialistName: document.getElementById('specialistName')?.value?.trim() || '',
            jobTitle: document.getElementById('jobTitle')?.value || '',
            jobTitleOther: document.querySelector('[name="jobTitleOther"]')?.value?.trim() || '',
            region: document.getElementById('region')?.value || '',
            regionOther: document.querySelector('[name="regionOther"]')?.value?.trim() || '',
            centerName: document.getElementById('centerName')?.value?.trim() || '',
            visitPeriod: document.querySelector('[name="visitPeriod"]')?.value || '',
            entryDate: document.getElementById('entryDate')?.value || '',
            periodStart: document.getElementById('periodStart')?.value || '',
            periodEnd: document.getElementById('periodEnd')?.value || '',
            staffCount: document.getElementById('staffCount')?.value || '0',
            studentCount: document.getElementById('studentCount')?.value || '0',
            attendanceRate: attendanceRaw === '' || attendanceRaw === undefined ? '' : clampPercentValue(attendanceRaw),
            classroomsCount: document.getElementById('classroomsCount')?.value || '0',
            tentsCount: document.getElementById('tentsCount')?.value || '0',
            challengesNotes: document.getElementById('challengesNotes')?.value?.trim() || '',
            overallRating: document.getElementById('overallRating')?.value || '',
            continueSupport: document.getElementById('continueSupport')?.value || '',
            finalNotes: document.getElementById('finalNotes')?.value?.trim() || '',
            challenges: collectChallenges(),
            securityRisks: collectSecurityRisks(),
            strategies: collectStrategies(),
            communityParticipations: collectCommunityParticipations(),
            initiatives: collectInitiatives(),
            competitions: collectCompetitions(),
            successStories: collectSuccessStories(),
            urgentRecommendations: collectTextareaList('urgentRecommendationsContainer', 'urgent_'),
            mediumRecommendations: collectTextareaList('mediumRecommendationsContainer', 'medium_'),
            strategicSolutions: collectTextareaList('strategicSolutionsContainer', 'strategic_')
        };
    }

    window.collectFormData = collectFormData;
    window.clampPercentValue = clampPercentValue;
})();
