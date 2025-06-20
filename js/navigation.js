// js/navigation.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.Navigation = (() => {
    let _navContainer = null;
    let _contentArea = null;
    let _navData = [];
    let _activeSeriesLink = null; // 新增：保存当前激活的系列链接

    // 初始化导航功能
    const init = (navContainer, contentArea, navData) => {
        _navContainer = navContainer;
        _contentArea = contentArea;
        _navData = navData;

        renderNavigation();
        handleInitialLoadAndPopstate();
    };

    // 渲染导航菜单 (只显示系列)
    const renderNavigation = () => {
        const navList = document.createElement('ul');
        navList.classList.add('main-nav-list'); // 添加一个类名方便CSS控制

        _navData.forEach((seriesData) => {
            const seriesItem = document.createElement('li');
            seriesItem.classList.add('series-item');

            const seriesLink = document.createElement('a');
            seriesLink.href = `#series=${seriesData.seriesId}`; // URL hash now reflects series
            seriesLink.textContent = seriesData.series;
            seriesLink.dataset.seriesId = seriesData.seriesId;
            seriesLink.classList.add('series-link'); // 添加类名方便CSS选择和激活

            seriesLink.addEventListener('click', (e) => {
                e.preventDefault();
                setActiveSeriesLink(seriesLink); // 激活系列链接
                // 触发一个自定义事件，通知 main.js 加载系列内容
                document.dispatchEvent(new CustomEvent('seriesSelected', {
                    detail: { seriesId: seriesData.seriesId, chapters: seriesData.chapters }
                }));
                // 更新浏览器URL
                history.pushState({ type: 'series', id: seriesData.seriesId }, '', `#series=${seriesData.seriesId}`);
            });
            seriesItem.appendChild(seriesLink);
            navList.appendChild(seriesItem);
        });
        _navContainer.appendChild(navList);
    };

    // 设置激活的系列链接
    const setActiveSeriesLink = (linkElement) => {
        if (_activeSeriesLink) {
            _activeSeriesLink.classList.remove('active');
        }
        if (linkElement) {
            linkElement.classList.add('active');
            _activeSeriesLink = linkElement;
        }
    };

    // 设置激活的章节链接 (保持不变，因为章节仍可能被直接加载)
    const setActiveChapterLink = (linkElement) => {
        // 清除所有激活状态
        _navContainer.querySelectorAll('.series-link.active').forEach(a => a.classList.remove('active'));
        _navContainer.querySelectorAll('.chapter-link.active').forEach(a => a.classList.remove('active'));

        if (linkElement) {
            linkElement.classList.add('active');

            // 找到所属的系列并激活它
            const chapterId = linkElement.dataset.chapterId;
            // 找到所属系列的ID，注意这里需要遍历 _navData 来找到章节所属的系列
            let seriesIdForChapter = null;
            for(const series of _navData) {
                if (series.chapters.some(c => c.id === chapterId)) {
                    seriesIdForChapter = series.seriesId;
                    break;
                }
            }

            if (seriesIdForChapter) {
                const seriesLink = _navContainer.querySelector(`a[data-series-id="${seriesIdForChapter}"]`);
                if (seriesLink) {
                    seriesLink.classList.add('active');
                }
            }
        }
    };

    // 加载章节内容到主显示区域 (与之前基本一致，但将不再由 series click 直接触发)
    // 这个函数会由 main.js 在接收到 chapterLoaded 事件时调用
    const loadChapterContent = async (chapterId, hasAudio) => {
        const chapterFilePath = `chapters/${chapterId}.html`;

        try {
            const response = await fetch(chapterFilePath);
            if (!response.ok) {
                throw new Error(`HTTP 错误! 状态: ${response.status}`);
            }
            const chapterHtml = await response.text();

            _contentArea.innerHTML = chapterHtml; // 设置内容区域HTML

            // 触发 'chapterLoaded' 自定义事件，通知 main.js 进行后续处理
            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: hasAudio }
            }));

        } catch (error) {
            console.error('[navigation.js] 加载章节失败:', error);
            _contentArea.innerHTML = `<p style="color: red;">抱歉，章节内容加载失败。请检查文件或网络连接。</p>`;
            document.dispatchEvent(new CustomEvent('chapterLoaded', {
                detail: { chapterId: chapterId, hasAudio: false, error: true } // 传递错误信息
            }));
        }
    };

    // 处理初始加载和浏览器前进/后退
    const handleInitialLoadAndPopstate = () => {
        // 获取所有章节和系列，用于查找
        const allChapters = _navData.flatMap(s => s.chapters);
        const allSeries = _navData;

        // 根据 URL hash 决定初始加载内容
        const currentHash = window.location.hash.substring(1); // 移除 #

        let initialLoadType = 'series'; // 默认加载第一个系列
        let initialLoadId = allSeries[0]?.seriesId; // 默认第一个系列的ID

        if (currentHash.startsWith('series=')) {
            initialLoadType = 'series';
            initialLoadId = currentHash.substring('series='.length);
        } else if (currentHash) { // 假定其他非空哈希是章节ID
            initialLoadType = 'chapter';
            initialLoadId = currentHash;
        }

        if (initialLoadType === 'series') {
            const selectedSeries = allSeries.find(s => s.seriesId === initialLoadId) || allSeries[0];
            if (selectedSeries) {
                const seriesLink = _navContainer.querySelector(`a[data-series-id="${selectedSeries.seriesId}"]`);
                setActiveSeriesLink(seriesLink);
                // 触发 seriesSelected 事件
                document.dispatchEvent(new CustomEvent('seriesSelected', {
                    detail: { seriesId: selectedSeries.seriesId, chapters: selectedSeries.chapters }
                }));
                // 更新浏览器URL状态 (以防从其他页面进来没有正确状态)
                history.replaceState({ type: 'series', id: selectedSeries.seriesId }, '', `#series=${selectedSeries.seriesId}`);
            }
        } else if (initialLoadType === 'chapter') {
            const selectedChapter = allChapters.find(c => c.id === initialLoadId);
            if (selectedChapter) {
                // 加载单个章节内容
                loadChapterContent(selectedChapter.id, selectedChapter.audio);
                // 激活所属系列
                const seriesLinkForChapter = _navContainer.querySelector(`a[data-series-id="${selectedChapter.seriesId}"]`);
                setActiveSeriesLink(seriesLinkForChapter);
                // 更新浏览器URL状态
                history.replaceState({ type: 'chapter', id: selectedChapter.id }, '', `#${selectedChapter.id}`);
            } else {
                // 如果章节ID无效，回到默认系列
                const defaultSeries = allSeries[0];
                if (defaultSeries) {
                    const seriesLink = _navContainer.querySelector(`a[data-series-id="${defaultSeries.seriesId}"]`);
                    setActiveSeriesLink(seriesLink);
                    document.dispatchEvent(new CustomEvent('seriesSelected', {
                        detail: { seriesId: defaultSeries.seriesId, chapters: defaultSeries.chapters }
                    }));
                    history.replaceState({ type: 'series', id: defaultSeries.seriesId }, '', `#series=${defaultSeries.seriesId}`);
                }
            }
        }


        // 监听 popstate 事件
        window.addEventListener('popstate', (event) => {
            const state = event.state;
            if (state && state.type === 'series') {
                const selectedSeries = allSeries.find(s => s.seriesId === state.id) || allSeries[0];
                if (selectedSeries) {
                    const seriesLink = _navContainer.querySelector(`a[data-series-id="${selectedSeries.seriesId}"]`);
                    setActiveSeriesLink(seriesLink);
                    document.dispatchEvent(new CustomEvent('seriesSelected', {
                        detail: { seriesId: selectedSeries.seriesId, chapters: selectedSeries.chapters }
                    }));
                }
            } else if (state && state.type === 'chapter') {
                const selectedChapter = allChapters.find(c => c.id === state.id);
                if (selectedChapter) {
                    loadChapterContent(selectedChapter.id, selectedChapter.audio);
                    // 激活所属系列
                    const seriesLinkForChapter = _navContainer.querySelector(`a[data-series-id="${selectedChapter.seriesId}"]`);
                    setActiveSeriesLink(seriesLinkForChapter);
                }
            } else { // 应对无状态或无效状态（例如首次加载）
                 const defaultSeries = allSeries[0];
                 if (defaultSeries) {
                    const seriesLink = _navContainer.querySelector(`a[data-series-id="${defaultSeries.seriesId}"]`);
                    setActiveSeriesLink(seriesLink);
                    document.dispatchEvent(new CustomEvent('seriesSelected', {
                        detail: { seriesId: defaultSeries.seriesId, chapters: defaultSeries.chapters }
                    }));
                 }
            }
        });
    };

    return {
        init: init,
        // 暴露 loadChapterContent，以便 main.js 在点击章节链接时调用
        loadChapterContent: loadChapterContent
    };
})();
