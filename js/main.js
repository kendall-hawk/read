// js/main.js (集成了变速播放和点击跳转的最终版本)

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    const playerSection = document.getElementById('player-section');
    const audioPlayer = document.getElementById('chapter-audio');
    const speedControls = document.getElementById('speed-controls');
    
    let navData = [];

    speedControls.addEventListener('click', (e) => {
        if (e.target.classList.contains('speed-btn')) {
            const newSpeed = parseFloat(e.target.dataset.speed);
            audioPlayer.playbackRate = newSpeed;
            speedControls.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
        }
    });

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
        playerSection.style.display = 'none';

        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">';

        if (chapters?.length) {
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
        
        if (hasAudio) {
            playerSection.style.display = 'flex'; // Use flex to match CSS
            audioPlayer.src = `audio/${chapterId}.mp3`;
            // Reset speed to 1x and update button UI for new audio
            audioPlayer.playbackRate = 1.0;
            speedControls.querySelector('.active')?.classList.remove('active');
            speedControls.querySelector('[data-speed="1.0"]')?.classList.add('active');
            audioPlayer.load();

            try {
                const srtResponse = await fetch(`srt/${chapterId}.srt`);
                if (!srtResponse.ok) throw new Error('SRT file not found');
                const srtText = await srtResponse.text();
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (e) {
                console.error('[main.js] 加载或解析 SRT 文件失败:', e);
            }
        } else {
            playerSection.style.display = 'none';
        }
    });

    document.addEventListener('chapterLoadError', (event) => {
        console.error(`[main.js] 章节加载错误`, event.detail);
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();
        playerSection.style.display = 'none';
    });

    const handleChapterNavigation = (chapterId) => {
        EnglishSite.Navigation.navigateToChapter(chapterId);
    };

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
