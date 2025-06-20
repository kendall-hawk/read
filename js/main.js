// js/main.js

document.addEventListener('DOMContentLoaded', async () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    const glossaryPopup = document.getElementById('glossary-popup');

    let navData = [];

    // --- 步骤 1: 加载导航数据 ---
    try {
        const response = await fetch('data/navigation.json');
        if (!response.ok) {
            throw new Error(`无法加载导航数据: ${response.statusText} (${response.status})`);
        }
        navData = await response.json();
        console.log('[main.js] 导航数据加载成功。');

        // 为每个章节对象添加其所属系列的 seriesId，方便后续查找
        navData.forEach(series => {
            series.chapters.forEach(chapter => {
                chapter.seriesId = series.seriesId;
            });
        });

    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        // 如果导航数据加载失败，在内容区域显示错误信息并阻止后续初始化
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.margin = '20px auto';
        errorDiv.style.maxWidth = '600px';
        errorDiv.textContent = '抱歉，导航菜单加载失败。请检查文件或网络连接。';
        navContainer.innerHTML = ''; // 清空导航区域
        contentArea.innerHTML = ''; // 清空内容区域
        contentArea.appendChild(errorDiv);
        return; // 阻止后续代码执行
    }

    // --- 步骤 2: 初始化导航模块 ---
    // 将加载到的 navData 传递给 Navigation 模块进行初始化
    EnglishSite.Navigation.init(navContainer, contentArea, navData);

    // --- 步骤 3: 监听 'seriesSelected' 自定义事件 ---
    // 当 Navigation 模块发出系列被选中的事件时，处理系列概览页面的渲染
    document.addEventListener('seriesSelected', (event) => {
        const { seriesId, chapters } = event.detail;
        console.log(`[main.js] 系列 '${seriesId}' 被选中，准备显示概览。`);

        // 从章节详情页切换到系列概览页时，清理旧的模块状态
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        // 查找当前系列的完整名称
        const currentSeriesName = navData.find(s => s.seriesId === seriesId)?.series || '未知系列';
        let seriesContentHtml = `<h2>${currentSeriesName}</h2>`;
        seriesContentHtml += '<div class="chapter-list-overview">'; // 概览列表的容器

        if (chapters && chapters.length > 0) {
            chapters.forEach(chapter => {
                // 为每个章节生成包含缩略图、标题和音频图标的卡片链接
                seriesContentHtml += `
                    <div class="chapter-overview-item">
                        <a href="#${chapter.id}" class="overview-chapter-link" data-chapter-id="${chapter.id}" data-has-audio="${chapter.audio}">
                            <img src="${chapter.thumbnail || 'images/placeholders/default_thumb.jpg'}" alt="${chapter.name}" class="chapter-thumbnail">
                            <div class="chapter-info">
                                <h3>${chapter.name} ${chapter.audio ? '🎵' : ''}</h3>
                                </div>
                        </a>
                    </div>
                `;
            });
        } else {
            seriesContentHtml += '<p>该系列暂无章节。</p>';
        }
        seriesContentHtml += '</div>';

        contentArea.innerHTML = seriesContentHtml; // 将生成的HTML放入内容区域

        // 为新生成的章节链接添加点击事件监听器
        contentArea.querySelectorAll('.overview-chapter-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault(); // 阻止默认的链接跳转行为
                const chapterId = link.dataset.chapterId;
                const hasAudio = link.dataset.hasAudio === 'true'; // 数据属性值是字符串，需要转换为布尔值
                
                // 调用 Navigation 模块暴露的方法来加载单个章节的详细内容
                EnglishSite.Navigation.loadChapterContent(chapterId, hasAudio);
                
                // 更新浏览器URL，反映当前显示的是哪个章节
                history.pushState({ type: 'chapter', id: chapterId }, '', `#${chapterId}`);
            });
        });
    });

    // --- 步骤 4: 监听 'chapterLoaded' 自定义事件 ---
    // 当 Navigation 模块发出章节加载完成事件时，处理音频和词汇表功能
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio, error } = event.detail;
        console.log(`[main.js] 章节详情加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        if (error) { // 如果 Navigation 模块在加载章节时报告错误
            EnglishSite.Glossary.cleanup();
            EnglishSite.AudioSync.cleanup();
            // 错误信息已由 Navigation 模块设置到 contentArea，这里不再重复处理
            return;
        }

        // 清理旧的模块状态（无论是从另一个章节还是从系列概览页切换过来）
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

        // 初始化词汇表功能
        EnglishSite.Glossary.init(contentArea, glossaryPopup, chapterId);

        // 如果章节有音频，则加载 SRT 文件并初始化音频同步功能
        if (hasAudio) {
            const srtFilePath = `srt/${chapterId}.srt`;
            const audioFilePath = `audio/${chapterId}.mp3`;

            try {
                // 检查内容区域是否已存在音频播放器，如果没有则创建
                let audioPlayer = contentArea.querySelector('#chapter-audio');
                if (!audioPlayer) {
                    audioPlayer = document.createElement('audio');
                    audioPlayer.id = 'chapter-audio';
                    audioPlayer.controls = true;
                    // 将播放器插入到章节内容的最前面，通常在标题之后
                    const chapterTitle = contentArea.querySelector('.chapter-title');
                    if (chapterTitle) {
                        chapterTitle.insertAdjacentElement('afterend', audioPlayer);
                    } else {
                        contentArea.insertBefore(audioPlayer, contentArea.firstChild);
                    }
                }
                audioPlayer.src = audioFilePath; // 设置音频源
                audioPlayer.load(); // 加载音频

                // 异步加载 SRT 字幕文件
                const srtResponse = await fetch(srtFilePath);
                if (!srtResponse.ok) throw new Error(`无法加载 SRT 文件: ${srtResponse.statusText}`);
                const srtText = await srtResponse.text();

                // 初始化音频同步功能
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (error) {
                console.error('[main.js] 加载或解析 SRT/音频失败:', error);
                // 在UI上显示音频/字幕加载错误信息
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '10px';
                errorDiv.textContent = '抱歉，音频或字幕加载失败，请检查文件。';
                contentArea.prepend(errorDiv);
            }
        } else {
            // 如果章节没有音频，确保移除任何现有的音频播放器和控制UI
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

    // --- 步骤 5: 监听点击页面空白处隐藏词汇弹出框 ---
    // 这个全局监听器放在 main.js 中更合适
    document.addEventListener('click', (event) => {
        // 只有当词汇弹出框可见时才处理隐藏逻辑
        if (glossaryPopup && glossaryPopup.style.display === 'block') {
            const isClickInsidePopup = glossaryPopup.contains(event.target); // 判断点击是否在弹出框内部
            const isClickOnTerm = event.target.classList.contains('glossary-term'); // 判断点击是否在词汇术语上
            // 如果点击不在弹出框内，也不在任何词汇术语上，则隐藏弹出框
            if (!isClickInsidePopup && !isClickOnTerm) {
                glossaryPopup.style.display = 'none';
            }
        }
    });
});
