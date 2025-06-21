// js/main.js (最终的、健壮的、产品级完整版本)

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    let navData = [];
    let audioPlayer = null;

    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) throw new Error(`无法加载导航数据: ${response.statusText}`);
        navData = await response.json();
        console.log('[main.js] 导航数据加载成功。', navData);
    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        contentArea.innerHTML = `<div style="color: red; padding: 20px;">抱歉，导航菜单加载失败。请检查文件或网络连接。</div>`;
        return;
    }

    // --- 事件监听器 ---

    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        console.log(`[main.js] 系列 '${seriesId}' 被选中，准备显示概览。`);

        // 【最终修正】安全地调用 cleanup 方法
        if (window.EnglishSite?.Glossary?.cleanup) EnglishSite.Glossary.cleanup();
        if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();

        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.style.display = 'none';
        }

        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">';

        if (chapters && chapters.length > 0) {
            chapters.forEach(chapter => {
                const thumbnailUrl = chapter.thumbnail || 'images/placeholders/default_thumb.jpg';
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}">
                            <img src="${thumbnailUrl}" loading="lazy" alt="${chapter.title}" class="chapter-thumbnail lazy-load" onerror="this.onerror=null;this.src='images/placeholders/default_thumb.jpg';">
                            <div class="chapter-info">
                                <h3>${chapter.title} ${chapter.audio ? '🎵' : ''}</h3>
                            </div>
                        </a>
                    </div>`;
            });
        } else {
            seriesContentHtml += '<p>该系列暂无章节。</p>';
        }
        seriesContentHtml += '</div>';
        contentArea.innerHTML = seriesContentHtml;

        // setupLazyLoading(); // Lazy loading can be added back if needed
        contentArea.addEventListener('click', handleOverviewChapterLinkClick);
    });

    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio, chapterData } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}`);

        // 【最终修正】安全地调用 cleanup 和 init 方法
        if (window.EnglishSite?.Glossary?.cleanup) EnglishSite.Glossary.cleanup();
        if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
        
        // 您提供的 glossary.js 是完整的，所以这个 init 会被成功调用，词汇表功能会出现
        if (window.EnglishSite?.Glossary?.init) EnglishSite.Glossary.init(contentArea, chapterId);

        if (window.EnglishSite?.Navigation?.setActiveChapter) EnglishSite.Navigation.setActiveChapter(chapterId);

        if (!audioPlayer) {
            audioPlayer = document.createElement('audio');
            audioPlayer.id = 'chapter-audio';
            audioPlayer.controls = true;
            contentArea.insertBefore(audioPlayer, contentArea.firstChild);
        }
        
        if (hasAudio) {
            audioPlayer.style.display = 'block';
            audioPlayer.src = `audio/${chapterId}.mp3`;
            audioPlayer.load();

            // 【最终修正】安全地初始化音频同步
            // 如果 audio-sync.js 未完成，音频播放器仍会出现，但字幕同步功能不会启用，也不会报错
            if (window.EnglishSite?.AudioSync?.init) {
                try {
                    const srtResponse = await fetch(`srt/${chapterId}.srt`);
                    if (!srtResponse.ok) throw new Error('SRT file not found');
                    const srtText = await srtResponse.text();
                    EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
                } catch (e) {
                    console.error('[main.js] 加载或解析 SRT/音频失败:', e);
                    if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
                }
            }
        } else {
            audioPlayer.style.display = 'none';
        }
    });

    document.addEventListener('chapterLoadError', (event) => {
        console.error(`[main.js] 章节加载遇到错误`, event.detail);
        if (window.EnglishSite?.Glossary?.cleanup) EnglishSite.Glossary.cleanup();
        if (window.EnglishSite?.AudioSync?.cleanup) EnglishSite.AudioSync.cleanup();
    });

    const handleChapterNavigation = (chapterId) => {
        if (window.EnglishSite?.Navigation?.navigateToChapter) {
            EnglishSite.Navigation.navigateToChapter(chapterId);
        }
    };

    document.addEventListener('initialChapterLoad', (e) => handleChapterNavigation(e.detail.chapterId));
    document.addEventListener('popstateChapterLoad', (e) => handleChapterNavigation(e.detail.chapterId));

    // --- 核心初始化 ---
    if (window.EnglishSite?.Navigation?.init) {
        EnglishSite.Navigation.init(navContainer, navData);
    } else {
        console.error("致命错误: Navigation 模块未能加载！");
        contentArea.innerHTML = `<div style="color: red; padding: 20px;">致命错误: 导航模块未能加载！</div>`;
    }

    // --- 辅助函数 ---
    const handleOverviewChapterLinkClick = (event) => {
        const link = event.target.closest('.overview-chapter-link');
        if (link) {
            event.preventDefault();
            handleChapterNavigation(link.dataset.chapterId);
        }
    };
});
