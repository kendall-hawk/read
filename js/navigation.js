// js/navigation.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.Navigation = (() => {
    let _navContainer = null;
    let _contentArea = null;
    let _navData = [];
    let _activeSeriesLink = null;
    let _seriesLinksMap = new Map();
    let _chapterLinksMap = new Map();

    const init = (navContainer, contentArea, navData) => {
        _navContainer = navContainer;
        _contentArea = contentArea;
        _navData = navData.map(series => ({
            ...series,
            chapters: series.chapters.map(chapter => ({ ...chapter, seriesId: series.seriesId }))
        }));

        renderNavigation();
        handleInitialLoadAndPopstate();
    };

    const renderNavigation = () => {
        _navContainer.innerHTML = '';
        _seriesLinksMap.clear();
        _chapterLinksMap.clear();

        const navList = document.createElement('ul');
        navList.classList.add('main-nav-list');

        _navData.forEach((seriesData) => {
            const seriesItem = document.createElement('li');
            seriesItem.classList.add('series-item');
            const seriesLink = document.createElement('a');
            seriesLink.href = `#series=${seriesData.seriesId}`;
            seriesLink.textContent = seriesData.series;
            seriesLink.dataset.seriesId = seriesData.seriesId;
            seriesLink.classList.add('series-link');

            seriesLink.addEventListener('click', (e) => {
                e.preventDefault();
                setActiveSeries(seriesData.seriesId);
                history.pushState({ type: 'series', id: seriesData.seriesId }, '', `#series=${seriesData.seriesId}`);
            });
            seriesItem.appendChild(seriesLink);
            navList.appendChild(seriesItem);
            _seriesLinksMap.set(seriesData.seriesId, seriesLink);
        });
        _navContainer.appendChild(navList);
    };

    const setActiveSeries = (seriesId) => {
        const seriesLink = _seriesLinksMap.get(seriesId);
        if (seriesLink) {
            if (_activeSeriesLink) {
                _activeSeriesLink.classList.remove('active');
            }
            seriesLink.classList.add('active');
            _activeSeriesLink = seriesLink;

            const selectedSeriesData = _navData.find(s => s.seriesId === seriesId);
            if (selectedSeriesData) {
                document.dispatchEvent(new CustomEvent('seriesSelected', {
                    detail: { seriesId: selectedSeriesData.seriesId, chapters: selectedSeriesData.chapters }
                }));
            }
        } else {
            console.warn(`[Navigation] Series link with ID "${seriesId}" not found.`);
        }
    };

    const setActiveChapter = (chapterId) => {
        _seriesLinksMap.forEach(link => link.classList.remove('active'));
        _chapterLinksMap.forEach(link => link.classList.remove('active'));

        const chapterLink = _chapterLinksMap.get(chapterId);
        if (chapterLink) {
            chapterLink.classList.add('active');
            const seriesIdForChapter = chapterLink.dataset.seriesId;
            const seriesLink = _seriesLinksMap.get(seriesIdForChapter);
            if (seriesLink) {
                seriesLink.classList.add('active');
                _activeSeriesLink = seriesLink;
            }
        } else {
            const allChapters = _navData.flatMap(s => s.chapters);
            const chapterData = allChapters.find(c => c.id === chapterId);
            if(chapterData && chapterData.seriesId) {
                const seriesLink = _seriesLinksMap.get(chapterData.seriesId);
                 if (seriesLink) {
                    if (_activeSeriesLink) { _activeSeriesLink.classList.remove('active'); }
                    seriesLink.classList.add('active');
                    _activeSeriesLink = seriesLink;
                }
            }
        }
    };

    const loadChapterContent = async (chapterId) => {
        const allChapters = _navData.flatMap(s => s.chapters);
        const chapterData = allChapters.find(c => c.id === chapterId);
        
        if (!chapterData) {
            console.error(`[navigation.js] 无法找到ID为 "${chapterId}" 的章节数据。`);
            _contentArea.innerHTML = `<p style="color: red;">章节数据无效，无法加载。</p>`;
            return;
        }

        const chapterFilePath = `chapters/${chapterId}.html`;
        try {
            const response = await fetch(chapterFilePath);
            if (!response.ok) throw new Error(`HTTP 错误! 状态: ${response.status}`);
            const chapterHtml = await response.text();
            _contentArea.innerHTML = chapterHtml;

            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: chapterData.audio, chapterData: chapterData }
            }));
        } catch (error) {
            console.error('[navigation.js] 加载章节失败:', error);
            _contentArea.innerHTML = `<p style="color: red;">抱歉，章节内容加载失败。</p>`;
            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: false, error: true }
            }));
        }
    };
    
    // ✨ 新增：统一的章节导航函数，封装了 history 操作
    const navigateToChapter = (chapterId) => {
        console.log(`[Navigation] Navigating to chapter: ${chapterId}`);
        const allChapters = _navData.flatMap(s => s.chapters);
        const chapterData = allChapters.find(c => c.id === chapterId);

        if (chapterData) {
            loadChapterContent(chapterId);
            history.pushState({ type: 'chapter', id: chapterId }, '', `#${chapterId}`);
        } else {
            console.warn(`[Navigation] navigateToChapter 失败: 找不到ID为 "${chapterId}" 的章节。`);
        }
    };

    const handleInitialLoadAndPopstate = () => {
        const allChapters = _navData.flatMap(s => s.chapters);
        const allSeries = _navData;
        const currentHash = window.location.hash.substring(1);
        let defaultSeries = allSeries[0];
        
        let initialLoadType = 'series';
        let initialLoadId = defaultSeries?.seriesId;

        if (currentHash.startsWith('series=')) {
            initialLoadType = 'series';
            initialLoadId = currentHash.substring('series='.length);
        } else if (currentHash) {
            const chapterExists = allChapters.some(c => c.id === currentHash);
            if (chapterExists) {
                initialLoadType = 'chapter';
                initialLoadId = currentHash;
            }
        }

        if (initialLoadType === 'series') {
            const selectedSeries = allSeries.find(s => s.seriesId === initialLoadId) || defaultSeries;
            if (selectedSeries) {
                setActiveSeries(selectedSeries.seriesId);
                history.replaceState({ type: 'series', id: selectedSeries.seriesId }, '', `#series=${selectedSeries.seriesId}`);
            }
        } else if (initialLoadType === 'chapter') {
            loadChapterContent(initialLoadId);
            history.replaceState({ type: 'chapter', id: initialLoadId }, '', `#${initialLoadId}`);
        }

        window.addEventListener('popstate', (event) => {
            const state = event.state;
            if (state && state.type === 'series') {
                setActiveSeries(state.id);
            } else if (state && state.type === 'chapter') {
                loadChapterContent(state.id);
            } else {
                 if(defaultSeries) setActiveSeries(defaultSeries.seriesId);
            }
        });
    };

    return {
        init: init,
        navigateToChapter: navigateToChapter,
        setActiveChapter: setActiveChapter,
    };
})();
