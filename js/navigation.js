window.EnglishSite = window.EnglishSite || {};

EnglishSite.Navigation = (() => {
    let _navContainer = null;
    let _contentArea = null;
    let _navData = [];
    let _activeSeriesLink = null; // 保存当前激活的系列链接

    // 新增：缓存系列和章节链接DOM元素 🚀
    let _seriesLinksMap = new Map();
    let _chapterLinksMap = new Map();

    // 初始化导航功能
    const init = (navContainer, contentArea, navData) => {
        _navContainer = navContainer;
        _contentArea = contentArea;
        // 假设 navData 中的章节对象已经包含了 seriesId ✨
        _navData = navData.map(series => ({
            ...series,
            chapters: series.chapters.map(chapter => ({
                ...chapter,
                seriesId: series.seriesId // 确保章节有 seriesId，如果数据源不提供，这里补充
            }))
        }));

        renderNavigation();
        handleInitialLoadAndPopstate();
    };

    // 渲染导航菜单 (只显示系列)
    const renderNavigation = () => {
        // 清空旧的导航，防止重复渲染
        _navContainer.innerHTML = '';
        _seriesLinksMap.clear(); // 清空缓存
        _chapterLinksMap.clear(); // 清空缓存

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
                // 设置激活的系列链接，并触发事件通知 main.js
                setActiveSeries(seriesData.seriesId); // 统一系列激活逻辑
                // 更新浏览器URL
                history.pushState({ type: 'series', id: seriesData.seriesId }, '', `#series=${seriesData.seriesId}`);
            });
            seriesItem.appendChild(seriesLink);
            navList.appendChild(seriesItem);

            // 缓存系列链接DOM元素 🚀
            _seriesLinksMap.set(seriesData.seriesId, seriesLink);

            // 如果章节也在这里渲染（未来扩展），可以在此缓存章节链接
            // 例如:
            // const chapterList = document.createElement('ul');
            // seriesData.chapters.forEach(chapter => {
            //     const chapterLink = document.createElement('a');
            //     chapterLink.href = `#${chapter.id}`;
            //     chapterLink.textContent = chapter.title;
            //     chapterLink.dataset.chapterId = chapter.id;
            //     chapterLink.dataset.seriesId = chapter.seriesId; // 确保有这个属性
            //     chapterLink.classList.add('chapter-link');
            //     _chapterLinksMap.set(chapter.id, chapterLink); // 缓存章节链接
            //     // chapterLink.addEventListener('click', (e) => { ... });
            //     // chapterList.appendChild(chapterLink);
            // });
            // seriesItem.appendChild(chapterList);
        });
        _navContainer.appendChild(navList);
    };

    // 统一设置激活系列和触发事件的函数
    const setActiveSeries = (seriesId) => {
        const seriesLink = _seriesLinksMap.get(seriesId); // 从缓存获取 🚀
        if (seriesLink) {
            if (_activeSeriesLink) {
                _activeSeriesLink.classList.remove('active');
            }
            seriesLink.classList.add('active');
            _activeSeriesLink = seriesLink;

            // 找到对应的系列数据
            const selectedSeriesData = _navData.find(s => s.seriesId === seriesId);
            if (selectedSeriesData) {
                // 触发一个自定义事件，通知 main.js 加载系列内容
                document.dispatchEvent(new CustomEvent('seriesSelected', {
                    detail: { seriesId: selectedSeriesData.seriesId, chapters: selectedSeriesData.chapters }
                }));
            }
        } else {
            console.warn(`[Navigation] Series link with ID "${seriesId}" not found.`);
        }
    };

    // 统一设置激活的章节链接 (同时激活所属系列) ✨
    const setActiveChapter = (chapterId) => {
        // 清除所有激活状态 (通过缓存的Map来移除active类) 🚀
        _seriesLinksMap.forEach(link => link.classList.remove('active'));
        _chapterLinksMap.forEach(link => link.classList.remove('active')); // 假设 _chapterLinksMap 已被填充

        const chapterLink = _chapterLinksMap.get(chapterId); // 从缓存获取 🚀
        if (chapterLink) {
            chapterLink.classList.add('active');

            // 找到所属的系列并激活它 (利用章节上的 seriesId) ✨
            const seriesIdForChapter = chapterLink.dataset.seriesId;
            const seriesLink = _seriesLinksMap.get(seriesIdForChapter); // 从缓存获取 🚀
            if (seriesLink) {
                seriesLink.classList.add('active');
                _activeSeriesLink = seriesLink; // 更新_activeSeriesLink
            }
        } else {
            console.warn(`[Navigation] Chapter link with ID "${chapterId}" not found.`);
        }
    };

    // 加载章节内容到主显示区域 (与之前基本一致，但将不再由 series click 直接触发)
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

        const currentHash = window.location.hash.substring(1); // 移除 #

        let initialLoadType = 'series';
        let initialLoadId = allSeries[0]?.seriesId;

        if (currentHash.startsWith('series=')) {
            initialLoadType = 'series';
            initialLoadId = currentHash.substring('series='.length);
        } else if (currentHash) {
            initialLoadType = 'chapter';
            initialLoadId = currentHash;
        }

        if (initialLoadType === 'series') {
            const selectedSeries = allSeries.find(s => s.seriesId === initialLoadId) || allSeries[0];
            if (selectedSeries) {
                setActiveSeries(selectedSeries.seriesId); // 统一调用 setActiveSeries
                history.replaceState({ type: 'series', id: selectedSeries.seriesId }, '', `#series=${selectedSeries.seriesId}`);
            }
        } else if (initialLoadType === 'chapter') {
            const selectedChapter = allChapters.find(c => c.id === initialLoadId);
            if (selectedChapter) {
                loadChapterContent(selectedChapter.id, selectedChapter.audio);
                // ❗ 不再在这里直接调用 setActiveSeries，让 main.js 在 chapterLoaded 后统一调用 setActiveChapter
                history.replaceState({ type: 'chapter', id: selectedChapter.id }, '', `#${selectedChapter.id}`);
            } else { // 如果章节ID无效，回到默认系列
                const defaultSeries = allSeries[0];
                if (defaultSeries) {
                    setActiveSeries(defaultSeries.seriesId); // 统一调用 setActiveSeries
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
                    setActiveSeries(selectedSeries.seriesId); // 统一调用 setActiveSeries
                }
            } else if (state && state.type === 'chapter') {
                const selectedChapter = allChapters.find(c => c.id === state.id);
                if (selectedChapter) {
                    loadChapterContent(selectedChapter.id, selectedChapter.audio);
                    // ❗ 不再在这里直接调用 setActiveSeries，让 main.js 在 chapterLoaded 后统一调用 setActiveChapter
                }
            } else { // 应对无状态或无效状态（例如首次加载）
                 const defaultSeries = allSeries[0];
                 if (defaultSeries) {
                    setActiveSeries(defaultSeries.seriesId); // 统一调用 setActiveSeries
                 }
            }
        });
    };

    return {
        init: init,
        loadChapterContent: loadChapterContent,
        setActiveChapter: setActiveChapter // 暴露新的统一激活函数 ✨
    };
})();
