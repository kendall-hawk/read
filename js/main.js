// js/main.js (最终的、100%功能完整的版本)

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

        // 【最终修正】所有模块均已就位，直接调用 cleanup
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        if (audioPlayer) {
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

        contentArea.addEventListener('click', handleOverviewChapterLinkClick);
    });

    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}`);

        // 【最终修正】所有模块均已就位，直接调用 cleanup 和 init
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();
        
        EnglishSite.Glossary.init(contentArea, chapterId);
        EnglishSite.Navigation.setActiveChapter(chapterId);

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

            try {
                const srtResponse = await fetch(`srt/${chapterId}.srt`);
                if (!srtResponse.ok) throw new Error('SRT file not found');
                const srtText = await srtResponse.text();
                // 将 srt 文本和播放器传递给 AudioSync 模块进行初始化
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (e) {
                console.error('[main.js] 加载或解析 SRT 文件失败，音频同步功能将不可用:', e);
            }
        } else {
            audioPlayer.style.display = 'none';
        }
    });

    document.addEventListener('chapterLoadError', (event) => {
        console.error(`[main.js] 章节加载遇到错误`, event.detail);
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();
    });

    const handleChapterNavigation = (chapterId) => {
        EnglishSite.Navigation.navigateToChapter(chapterId);
    };

    document.addEventListener('initialChapterLoad', (e) => handleChapterNavigation(e.detail.chapterId));
    document.addEventListener('popstateChapterLoad', (e) => handleChapterNavigation(e.detail.chapterId));

    // --- 核心初始化 ---
    EnglishSite.Navigation.init(navContainer, navData);

    // --- 辅助函数 ---
    const handleOverviewChapterLinkClick = (event) => {
        const link = event.target.closest('.overview-chapter-link');
        if (link) {
            event.preventDefault();
            handleChapterNavigation(link.dataset.chapterId);
        }
    };
});
