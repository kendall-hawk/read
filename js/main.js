// js/main.js

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    const glossaryPopup = document.getElementById('glossary-popup');

    let navData = [];

    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) {
            throw new Error(`无法加载导航数据: ${response.statusText} (${response.status})`);
        }
        navData = await response.json();
        console.log('[main.js] 导航数据加载成功。');

        // 将 seriesId 添加到每个 chapter 对象中，方便后续查找所属系列
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
        errorDiv.style.border = '1px solid red';
        errorDiv.style.margin = '20px auto';
        errorDiv.style.maxWidth = '600px';
        errorDiv.textContent = '抱歉，导航菜单加载失败。请检查文件或网络连接。';
        contentArea.innerHTML = '';
        contentArea.appendChild(errorDiv);
        return;
    }

    // 初始化导航菜单
    EnglishSite.Navigation.init(navContainer, contentArea, navData);

    // --- 新增：监听 seriesSelected 事件 ---
    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        console.log(`[main.js] 系列 '${seriesId}' 被选中。`);

        // 清理旧的模块状态（从章节详情页切换到系列概览页）
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        let seriesContentHtml = `<h2>${navData.find(s => s.seriesId === seriesId)?.series || '未知系列'}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">'; // 添加一个容器类

        if (chapters && chapters.length > 0) {
            chapters.forEach(chapter => {
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <h3><a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}" data-has-audio="${chapter.audio}">
                            ${chapter.name} ${chapter.audio ? '🎵' : ''}
                        </a></h3>
                        </div>
                `;
            });
        } else {
            seriesContentHtml += '<p>该系列暂无章节。</p>';
        }
        seriesContentHtml += '</div>';

        contentArea.innerHTML = seriesContentHtml;

        // 为新生成的章节链接添加点击事件监听器
        contentArea.querySelectorAll('.overview-chapter-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const chapterId = link.dataset.chapterId;
                const hasAudio = link.dataset.hasAudio === 'true'; // 注意数据属性是字符串
                // 调用 navigation.js 中暴露的 loadChapterContent 方法来加载单个章节
                EnglishSite.Navigation.loadChapterContent(chapterId, hasAudio);
                // 更新URL hash
                history.pushState({ type: 'chapter', id: chapterId }, '', `#${chapterId}`);
            });
        });
    });

    // 监听 'chapterLoaded' 自定义事件（当单个章节加载完成后触发）
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio, error } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        if (error) { // 如果 navigation.js 在加载章节时报告错误
            EnglishSite.Glossary.cleanup();
            EnglishSite.AudioSync.cleanup();
            // 错误信息已在 navigation.js 中设置到 contentArea
            return;
        }

        // 此时，内容区域已经由 navigation.js 填充为单个章节的HTML
        // 确保清理旧的模块状态（从系列概览页切换到章节详情页）
        EnglishSite.Glossary.cleanup(); // 确保清理上一个章节的状态
        EnglishSite.AudioSync.cleanup(); // 确保清理上一个章节的状态

        // 初始化词汇表功能，并传入当前章节ID和词汇弹出框DOM元素
        EnglishSite.Glossary.init(contentArea, glossaryPopup, chapterId);

        // 如果章节有音频，则加载 SRT 文件并初始化音频同步功能
        if (hasAudio) {
            const srtFilePath = `srt/${chapterId}.srt`;
            const audioFilePath = `audio/${chapterId}.mp3`;

            try {
                let audioPlayer = contentArea.querySelector('#chapter-audio');
                if (!audioPlayer) {
                    audioPlayer = document.createElement('audio');
                    audioPlayer.id = 'chapter-audio';
                    audioPlayer.controls = true;
                    const chapterTitle = contentArea.querySelector('.chapter-title');
                    if (chapterTitle) {
                        chapterTitle.insertAdjacentElement('afterend', audioPlayer);
                    } else {
                        contentArea.insertBefore(audioPlayer, contentArea.firstChild);
                    }
                }
                audioPlayer.src = audioFilePath;
                audioPlayer.load();

                const srtResponse = await fetch(srtFilePath);
                if (!srtResponse.ok) throw new Error(`无法加载 SRT 文件: ${srtResponse.statusText}`);
                const srtText = await srtResponse.text();

                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (error) {
                console.error('[main.js] 加载或解析 SRT/音频失败:', error);
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '10px';
                errorDiv.textContent = '抱歉，音频或字幕加载失败，请检查文件。';
                contentArea.prepend(errorDiv);
            }
        } else {
            const audioPlayer = contentArea.querySelector('#chapter-audio');
            if (audioPlayer) {
                audioPlayer.remove();
            }
            const audioControls = contentArea.querySelector('#audio-controls');
            if (audioControls) {
                audioControls.remove();
            }
        }
    });

    // 监听点击页面空白处隐藏词汇弹出框
    document.addEventListener('click', (event) => {
        if (glossaryPopup && glossaryPopup.style.display === 'block') {
            const isClickInsidePopup = glossaryPopup.contains(event.target);
            const isClickOnTerm = event.target.classList.contains('glossary-term');
            if (!isClickInsidePopup && !isClickOnTerm) {
                glossaryPopup.style.display = 'none';
            }
        }
    });
});
