// js/navigation.js (调整后)

window.EnglishSite = window.EnglishSite || {};

EnglishSite.Navigation = (() => {
    let _navContainer = null;
    let _navData = []; // 仅存储导航数据
    let _activeSeriesLink = null; // 仍用于跟踪当前激活的系列链接DOM
    let _seriesLinksMap = new Map(); // 存储系列链接的DOM引用

    // 章节链接映射将不再由 navigation.js 维护，因为侧边栏消失了
    // 如果 main.js 需要在顶部导航条中显示当前章节的链接，则需要在 main.js 中维护

    const init = (navContainer, navData) => { // contentArea 不再需要作为参数传入
        _navContainer = navContainer;
        // 为每个章节添加 seriesId，方便查找
        _navData = navData.map(series => ({
            ...series,
            chapters: series.chapters.map(chapter => ({ ...chapter, seriesId: series.seriesId }))
        }));

        renderNavigation(); // 渲染顶部的系列导航
        handleInitialLoadAndPopstate(); // 处理初始加载和 popstate
    };

    // 渲染顶部的系列导航（例如：一个横向的系列名称列表）
    const renderNavigation = () => {
        _navContainer.innerHTML = '';
        _seriesLinksMap.clear();

        const navList = document.createElement('ul');
        navList.classList.add('main-nav-list'); // 对应 CSS 样式

        _navData.forEach((seriesData) => {
            const seriesItem = document.createElement('li');
            const seriesLink = document.createElement('a');
            seriesLink.href = `#series=${seriesData.seriesId}`;
            seriesLink.textContent = seriesData.series;
            seriesLink.dataset.seriesId = seriesData.seriesId;
            seriesLink.classList.add('series-link');

            seriesLink.addEventListener('click', (e) => {
                e.preventDefault();
                // 设置活跃系列，并让 main.js 监听 seriesSelected 事件来渲染系列概览
                setActiveSeries(seriesData.seriesId);
                history.pushState({ type: 'series', id: seriesData.seriesId }, '', `#series=${seriesData.seriesId}`);
            });
            seriesItem.appendChild(seriesLink);
            navList.appendChild(seriesItem);
            _seriesLinksMap.set(seriesData.seriesId, seriesLink);
        });
        _navContainer.appendChild(navList);
    };

    // 设置活跃系列，并触发事件通知 main.js 更新内容区域为系列概览
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
            console.warn(`[Navigation] Series link with ID "${seriesId}" not found in top navigation. `);
            // 如果 URL 指定的系列不存在，或者没有默认系列，尝试回退到第一个系列
            const defaultSeries = _navData[0];
            if (defaultSeries && seriesId !== defaultSeries.seriesId) {
                console.log(`[Navigation] Falling back to default series: ${defaultSeries.seriesId}`);
                setActiveSeries(defaultSeries.seriesId);
            }
        }
    };

    // 设置活跃章节（现在仅用于高亮顶部导航中的所属系列）
    const setActiveChapter = (chapterId) => {
        // 先移除所有系列链接的激活状态
        _seriesLinksMap.forEach(link => link.classList.remove('active'));

        // 查找当前章节数据
        const allChapters = _navData.flatMap(s => s.chapters);
        const chapterData = allChapters.find(c => c.id === chapterId);

        if (chapterData) {
            // 高亮所属系列
            const seriesLink = _seriesLinksMap.get(chapterData.seriesId);
            if (seriesLink) {
                seriesLink.classList.add('active');
                _activeSeriesLink = seriesLink; // 更新当前活跃系列引用
            }
        } else {
            console.warn(`[Navigation] setActiveChapter 无法找到 ID 为 "${chapterId}" 的章节数据。`);
        }
    };

    // 加载章节内容（此函数仍保留在 navigation.js，因为它处理章节文件的 fetch 和 DOM 注入）
    const loadChapterContent = async (chapterId, contentArea) => { // contentArea 现在作为参数传入
        const allChapters = _navData.flatMap(s => s.chapters);
        const chapterData = allChapters.find(c => c.id === chapterId);
        
        if (!chapterData) {
            console.error(`[navigation.js] 无法找到ID为 "${chapterId}" 的章节数据。`);
            contentArea.innerHTML = `<p style="color: red;">章节数据无效，无法加载。</p>`;
            document.dispatchEvent(new CustomEvent('chapterLoadError', { // 触发错误事件
                detail: { chapterId: chapterId, error: true, message: '章节数据无效' }
            }));
            return;
        }

        const chapterFilePath = `chapters/${chapterId}.html`;
        try {
            const response = await fetch(chapterFilePath);
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status} (${response.statusText})`);
            }
            const chapterHtml = await response.text();
            contentArea.innerHTML = chapterHtml; // 将内容插入到 DOM

            // 触发 chapterLoaded 事件，通知 main.js 进行后续的模块初始化
            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: chapterData.audio, chapterData: chapterData }
            }));
        } catch (error) {
            console.error('[navigation.js] 加载章节失败:', error);
            contentArea.innerHTML = `<p style="color: red;">抱歉，章节内容加载失败。</p>`;
            document.dispatchEvent(new CustomEvent('chapterLoadError', { // 触发错误事件
                detail: { chapterId: chapterId, error: true, message: '章节内容加载失败', originalError: error }
            }));
        }
    };
    
    // 统一的章节导航函数，封装了 history 操作
    // 它需要 contentArea 的引用，因此也作为参数传入
    const navigateToChapter = (chapterId, contentArea) => {
        console.log(`[Navigation] Navigating to chapter: ${chapterId}`);
        const allChapters = _navData.flatMap(s => s.chapters);
        const chapterData = allChapters.find(c => c.id === chapterId);

        if (chapterData) {
            loadChapterContent(chapterId, contentArea); // 调用加载函数
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
        
        let initialLoadType = 'series'; // 默认加载类型为系列概览
        let initialLoadId = defaultSeries?.seriesId; // 默认加载第一个系列

        // 检查 URL hash
        if (currentHash.startsWith('series=')) {
            initialLoadType = 'series';
            initialLoadId = currentHash.substring('series='.length);
        } else if (currentHash) { // 如果有 hash 但不是 series= 开头，认为是章节ID
            const chapterExists = allChapters.some(c => c.id === currentHash);
            if (chapterExists) {
                initialLoadType = 'chapter';
                initialLoadId = currentHash;
            }
        }
        
        // 执行初始加载
        if (initialLoadType === 'series') {
            const selectedSeries = allSeries.find(s => s.seriesId === initialLoadId) || defaultSeries;
            if (selectedSeries) {
                setActiveSeries(selectedSeries.seriesId); // 触发 seriesSelected，main.js 会渲染概览
                history.replaceState({ type: 'series', id: selectedSeries.seriesId }, '', `#series=${selectedSeries.seriesId}`);
            } else if (defaultSeries) { // 如果 URL 指定的系列不存在，回退到第一个系列
                setActiveSeries(defaultSeries.seriesId);
                history.replaceState({ type: 'series', id: defaultSeries.seriesId }, '', `#series=${defaultSeries.seriesId}`);
            }
        } else if (initialLoadType === 'chapter') {
            // 在这里，我们需要 contentArea 的引用，但 navigation.js 模块中没有
            // 所以将 navigateToChapter 暴露出去，并在 main.js 中调用
            // 或者，将 _contentArea 作为 init 参数传入 navigation.js 的私有变量
            // 为了简化，这里假定 main.js 会在 navigation.init 之后调用 navigateToChapter
            // 或者：我们可以将 _contentArea 传递给 navigation.js 的 init 函数作为内部私有变量
            // 为了保持模块职责分离，我倾向于通过事件通知 main.js
            document.dispatchEvent(new CustomEvent('initialChapterLoad', { detail: { chapterId: initialLoadId } }));
            history.replaceState({ type: 'chapter', id: initialLoadId }, '', `#${initialLoadId}`);
        } else { // 如果没有任何 hash，则默认显示第一个系列的概览
             if(defaultSeries) {
                setActiveSeries(defaultSeries.seriesId);
                history.replaceState({ type: 'series', id: defaultSeries.seriesId }, '', `#series=${defaultSeries.seriesId}`);
             } else {
                 console.warn('[Navigation] No series data available to load.');
             }
        }

        // 监听 popstate 事件
        window.addEventListener('popstate', (event) => {
            const state = event.state;
            if (state && state.type === 'series') {
                setActiveSeries(state.id); // 触发 seriesSelected
            } else if (state && state.type === 'chapter') {
                // main.js 将监听 chapterLoaded 事件并处理
                document.dispatchEvent(new CustomEvent('popstateChapterLoad', { detail: { chapterId: state.id } }));
            } else {
                 // 如果 popstate 状态为空或不匹配，回退到默认系列概览
                 if(defaultSeries) setActiveSeries(defaultSeries.seriesId);
            }
        });
    };

    return {
        init: init,
        // 暴露 navigateToChapter 和 loadChapterContent 给 main.js 调用，需要 main.js 传递 contentArea
        navigateToChapter: (chapterId) => navigateToChapter(chapterId, document.getElementById('content')),
        // loadChapterContent: (chapterId) => loadChapterContent(chapterId, document.getElementById('content')), // 内部使用，不暴露
        setActiveChapter: setActiveChapter,
        getAllSeriesData: () => _navData // 新增：暴露 navData，供 main.js 使用
    };
})();
