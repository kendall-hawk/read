// js/main.js (最终的、功能完整的版本)

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    let navData = [];
    let audioPlayer = null;

    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) throw new Error(`无法加载导航数据: ${response.statusText}`);
        navData = await response.json();
    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        contentArea.innerHTML = `<div style="color: red; padding: 20px;">抱歉，导航菜单加载失败。</div>`;
        return;
    }

    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        if (audioPlayer) audioPlayer.style.display = 'none';

        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">';

        if (chapters?.length) {
            chapters.forEach(chapter => {
                const thumbnailUrl = chapter.thumbnail || 'images/placeholders/default_thumb.jpg';
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}">
                            <img src="${thumbnailUrl}" loading="lazy" alt="${chapter.title}" class="chapter-thumbnail" onerror="this.onerror=null;this.src='images/placeholders/default_thumb.jpg';">
                            <div class="chapter-info"><h3>${chapter.title} ${chapter.audio ? '🎵' : ''}</h3></div>
                        </a>
                    </div>`;
            });
        }
        seriesContentHtml += '</div>';
        contentArea.innerHTML = seriesContentHtml;
        contentArea.addEventListener('click', handleOverviewChapterLinkClick);
    });

    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio } = event.detail;
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
            try {
                const srtResponse = await fetch(`srt/${chapterId}.srt`);
                if (!srtResponse.ok) throw new Error('SRT file not found');
                const srtText = await srtResponse.text();
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (e) {
                console.error('[main.js] SRT加载失败:', e);
            }
        } else {
            audioPlayer.style.display = 'none';
        }
    });

    document.addEventListener('chapterLoadError', (e) => {
        console.error(`[main.js] 章节加载错误`, e.detail);
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();
    });

    const handleChapterNavigation = (chapterId) => EnglishSite.Navigation.navigateToChapter(chapterId);
    document.addEventListener('initialChapterLoad', (e) => handleChapterNavigation(e.detail.chapterId));
    document.addEventListener('popstateChapterLoad', (e) => handleChapterNavigation(e.detail.chapterId));

    EnglishSite.Navigation.init(navContainer, navData);

    const handleOverviewChapterLinkClick = (event) => {
        const link = event.target.closest('.overview-chapter-link');
        if (link) {
            event.preventDefault();
            handleChapterNavigation(link.dataset.chapterId);
        }
    };
});
