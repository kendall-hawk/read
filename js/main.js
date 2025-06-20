// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    const glossaryPopup = document.getElementById('glossary-popup');

    // 导航数据：包含章节ID、名称、文件路径和是否有音频的标志
    const navData = [
        {
            series: '基础英语',
            chapters: [
                { id: 'chap1', name: '章节 1: 问候语', file: 'chap1.html', audio: true },
                { id: 'chap2', name: '章节 2: 自我介绍', file: 'chap2.html', audio: true }
            ]
        },
        {
            series: '进阶话题',
            chapters: [
                { id: 'chap3', name: '章节 3: 旅行计划 (无音频)', file: 'chap3.html', audio: false }
            ]
        }
    ];

    // 初始化导航菜单
    // navigation.js 将监听 'chapterLoaded' 事件，并触发它
    // main.js 作为这个事件的监听者，协调其他模块的初始化
    EnglishSite.Navigation.init(navContainer, contentArea, navData);

    // 监听 'chapterLoaded' 自定义事件，这个事件由 navigation.js 在章节加载完成后触发
    // 注意：我们将各个模块的初始化逻辑移动到这个监听器中，确保它们在章节内容可用时才被调用
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio } = event.detail;
        console.log(`[main.js] 章节加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        // 在加载新章节内容前，确保清理旧的模块状态
        // 词汇模块清理
        EnglishSite.Glossary.cleanup();
        // 音频同步模块清理
        EnglishSite.AudioSync.cleanup(); // 确保先清理，再根据新章节状态初始化

        // 初始化词汇表功能，并传入当前章节ID和词汇弹出框DOM元素
        EnglishSite.Glossary.init(contentArea, glossaryPopup, chapterId);

        // 如果章节有音频，则加载 SRT 文件并初始化音频同步功能
        if (hasAudio) {
            const srtFilePath = `srt/${chapterId}.srt`;
            const audioFilePath = `audio/${chapterId}.mp3`;

            try {
                // 在内容区域创建或获取音频播放器
                let audioPlayer = contentArea.querySelector('#chapter-audio');
                if (!audioPlayer) {
                    audioPlayer = document.createElement('audio');
                    audioPlayer.id = 'chapter-audio';
                    audioPlayer.controls = true;
                    // 将播放器插入到章节内容的最前面，紧随标题之后
                    const chapterTitle = contentArea.querySelector('.chapter-title');
                    if (chapterTitle) {
                        chapterTitle.insertAdjacentElement('afterend', audioPlayer);
                    } else {
                        contentArea.insertBefore(audioPlayer, contentArea.firstChild);
                    }
                }
                audioPlayer.src = audioFilePath;
                audioPlayer.load();

                // 加载 SRT 文件
                const srtResponse = await fetch(srtFilePath);
                if (!srtResponse.ok) throw new Error(`无法加载 SRT 文件: ${srtResponse.statusText}`);
                const srtText = await srtResponse.text();

                // 初始化音频同步功能，传入内容容器、SRT 文本和音频播放器DOM元素
                EnglishSite.AudioSync.init(contentArea, srtText, audioPlayer);
            } catch (error) {
                console.error('[main.js] 加载或解析 SRT/音频失败:', error);
                // 在UI上显示错误信息
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.style.marginTop = '10px';
                errorDiv.textContent = '抱歉，音频或字幕加载失败，请检查文件。';
                contentArea.prepend(errorDiv);
            }
        } else {
            // 如果章节没有音频，确保移除播放器和控制UI
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

    // 监听点击页面空白处隐藏词汇弹出框，这个监听器放在 main.js 更合适
    document.addEventListener('click', (event) => {
        // 只有当弹出框可见时才处理
        if (glossaryPopup && glossaryPopup.style.display === 'block') {
            const isClickInsidePopup = glossaryPopup.contains(event.target);
            const isClickOnTerm = event.target.classList.contains('glossary-term');
            // 如果点击不在弹出框内，也不在任何词汇单词上，则隐藏弹出框
            if (!isClickInsidePopup && !isClickOnTerm) {
                glossaryPopup.style.display = 'none';
            }
        }
    });
});

