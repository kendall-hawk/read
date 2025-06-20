// js/main.js

document.addEventListener('DOMContentLoaded', async () => { // 注意这里添加了 async 关键字
    const navContainer = document.getElementById('main-nav');
    const contentArea = document.getElementById('content');
    const glossaryPopup = document.getElementById('glossary-popup');

    let navData = []; // 定义为空数组，稍后将从 JSON 文件中加载数据

    try {
        // 尝试从 data/navigation.json 文件加载导航数据
        const response = await fetch('data/navigation.json');
        if (!response.ok) {
            // 如果HTTP响应状态码不是2xx，则抛出错误
            throw new Error(`无法加载导航数据: ${response.statusText} (${response.status})`);
        }
        navData = await response.json(); // 解析JSON响应
        console.log('[main.js] 导航数据加载成功。');
    } catch (error) {
        console.error('[main.js] 加载导航数据失败:', error);
        // 在UI上显示错误信息，并阻止后续的初始化，因为没有导航数据无法继续
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.margin = '20px auto';
        errorDiv.style.maxWidth = '600px';
        errorDiv.textContent = '抱歉，导航菜单加载失败。请检查文件或网络连接。';
        contentArea.innerHTML = ''; // 清空内容区域
        contentArea.appendChild(errorDiv); // 显示错误信息
        return; // 阻止后续代码执行
    }

    // 初始化导航菜单，将加载到的 navData 传递进去
    EnglishSite.Navigation.init(navContainer, contentArea, navData);

    // 监听 'chapterLoaded' 自定义事件，这个事件由 navigation.js 在章节加载完成后触发
    document.addEventListener('chapterLoaded', async (event) => {
        const { chapterId, hasAudio } = event.detail;
        console.log(`[main.js] 章节加载完成: ${chapterId}, 是否有音频: ${hasAudio}`);

        // 在加载新章节内容前，确保清理旧的模块状态
        EnglishSite.Glossary.cleanup();
        EnglishSite.AudioSync.cleanup();

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
