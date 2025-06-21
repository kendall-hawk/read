// js/main.js

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');

    let navData = [];
    let audioPlayer = null;

    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) {
            throw new Error(`无法加载导航数据: ${response.statusText} (${response.status})`);
        }
        navData = await response.json();
        console.log('[main.js] 导航数据加载成功。');

        navData.forEach(series => {
            series.chapters.forEach(chapter => {
                chapter.seriesId = series.seriesId;
            });
        });

    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.textContent = '抱歉，导航菜单加载失败。请检查文件或网络连接。';
        navContainer.innerHTML = '';
        contentArea.innerHTML = '';
        contentArea.appendChild(errorDiv);
        return;
    }

    // 注册 seriesSelected 事件监听器
    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        console.log(`[main.js] 系列 '${seriesId}' 被选中，准备显示概览。`);

        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">';

        if (chapters && chapters.length > 0) {
            chapters.forEach(chapter => {
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}">
                            <img src="images/placeholders/default_thumb.jpg" 
                                 loading="lazy" 
                                 data-src="${chapter.thumbnail || 'images/placeholders/default_thumb.jpg'}" 
                                 alt="${chapter.title}" class="chapter-thumbnail lazy-load">
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

        setupLazyLoading();

        contentArea.removeEventListener('click', handleOverviewChapterLinkClick);
        contentArea.addEventListener('click', handleOverviewChapterLinkClick);
    });

    // 注册 chapterLoaded 事件监听器
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio, error } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        if (error) {
            EnglishSite.Glossary.cleanup();
            EnglishSite.AudioSync.cleanup();
            return;
        }

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
            const srtFilePath = `srt/${chapterId}.srt`;
            const audioFilePath = `audio/${chapterId}.mp3`;

            audioPlayer.style.display = 'block';
            audioPlayer.src = audioFilePath;
            audioPlayer.load();

            try {
                const srtResponse = await fetch(srtFilePath);
                if (!srtResponse.ok) throw new Error(`无法加载 SRT 文件`);
                const srtText = await srtResponse.text();
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (e) {
                console.error('[main.js] 加载或解析 SRT/音频失败:', e);
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.textContent = '抱歉，音频或字幕加载失败。';
                if(contentArea.firstChild) {
                    contentArea.insertBefore(errorDiv, contentArea.firstChild);
                } else {
                    contentArea.appendChild(errorDiv);
                }
            }
        } else {
            if (audioPlayer) {
                audioPlayer.style.display = 'none';
            }
            EnglishSite.AudioSync.cleanup();
        }
    });

    // 在所有监听器都准备好之后，再进行初始化
    EnglishSite.Navigation.init(navContainer, contentArea, navData);

    const handleOverviewChapterLinkClick = (event) => {
        let target = event.target;
        while (target && target !== contentArea) {
            if (target.classList.contains('overview-chapter-link')) {
                event.preventDefault();
                const chapterId = target.dataset.chapterId;
                EnglishSite.Navigation.navigateToChapter(chapterId);
                return;
            }
            target = target.parentNode;
        }
    };
    
    const setupLazyLoading = () => {
        const lazyImages = contentArea.querySelectorAll('img.lazy-load');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-load');
                        observer.unobserve(img);
                    }
                });
            }, { rootMargin: '0px 0px 50px 0px' });
            lazyImages.forEach(img => observer.observe(img));
        } else {
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
                img.classList.remove('lazy-load');
            });
        }
    };
});
