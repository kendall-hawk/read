// js/audio-sync.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.AudioSync = (() => {
    let _contentArea = null;
    let _audioPlayer = null;
    let _srtData = [];
    let _currentIndex = -1; // 当前高亮的句子索引
    let _previousHighlightedElement = null; // 上一个高亮的DOM元素

    // SRT解析函数
    const parseSrt = (srtText) => {
        const lines = srtText.split(/\r?\n/);
        const cues = [];
        let currentCue = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                if (currentCue) {
                    cues.push(currentCue);
                    currentCue = null;
                }
            } else if (!isNaN(parseInt(line, 10)) && !currentCue) {
                currentCue = { id: line }; // Assuming first line of a cue is its ID
            } else if (line.includes('-->') && currentCue) {
                const parts = line.split('-->');
                currentCue.startTime = timeToSeconds(parts[0].trim());
                currentCue.endTime = timeToSeconds(parts[1].trim());
                currentCue.text = ''; // Initialize text
            } else if (currentCue) {
                currentCue.text += (currentCue.text ? '\n' : '') + line;
            }
        }
        if (currentCue) {
            cues.push(currentCue);
        }
        return cues;
    };

    const timeToSeconds = (timeString) => {
        const parts = timeString.split(':');
        const secondsParts = parts[2].split(',');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(secondsParts[0], 10);
        const milliseconds = parseInt(secondsParts[1], 10);
        return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
    };

    // 初始化音频同步
    const init = (contentArea, srtText, audioPlayer) => {
        cleanup(); // 先清理旧的状态，以防重新初始化

        _contentArea = contentArea;
        _audioPlayer = audioPlayer;
        _srtData = parseSrt(srtText);
        _currentIndex = -1;
        _previousHighlightedElement = null;

        // 绑定时间更新事件
        _audioPlayer.addEventListener('timeupdate', handleTimeUpdate);
        // 绑定播放结束事件
        _audioPlayer.addEventListener('ended', handleAudioEnded);

        console.log('[AudioSync] 初始化成功。SRT数据:', _srtData);
    };

    // 处理时间更新事件
    const handleTimeUpdate = () => {
        const currentTime = _audioPlayer.currentTime;

        // 找到当前时间对应的字幕
        for (let i = 0; i < _srtData.length; i++) {
            const cue = _srtData[i];
            if (currentTime >= cue.startTime && currentTime < cue.endTime) {
                if (i !== _currentIndex) { // 只有当句子发生变化时才更新高亮
                    updateHighlight(i);
                    _currentIndex = i;
                    break;
                }
            } else if (currentTime < cue.startTime && _currentIndex === i) {
                // 如果当前时间已经跳到下一个句子之前，且上一个句子还在高亮，则取消高亮
                removeHighlight(_previousHighlightedElement);
                _currentIndex = -1;
            }
        }
         // 如果当前时间超出所有字幕范围，且有高亮，则移除高亮
         if (currentTime > (_srtData[_srtData.length - 1]?.endTime || 0) && _previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
            _currentIndex = -1;
        }
    };

    // 更新高亮
    const updateHighlight = (newIndex) => {
        // 移除上一个高亮
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }

        const currentCue = _srtData[newIndex];
        // 查找与字幕ID匹配的DOM元素 (data-sentence-id)
        const targetElement = _contentArea.querySelector(`[data-sentence-id="${currentCue.id}"]`);

        if (targetElement) {
            targetElement.classList.add('highlighted'); // 添加高亮类
            _previousHighlightedElement = targetElement; // 更新上一个高亮元素

            // 滚动到视图中
            scrollToView(targetElement);
        } else {
            console.warn(`[AudioSync] 未找到 ID 为 "${currentCue.id}" 的句子元素。`);
        }
    };

    // 移除高亮
    const removeHighlight = (element) => {
        if (element) {
            element.classList.remove('highlighted');
        }
    };

    // 滚动到视图
    const scrollToView = (element) => {
        const rect = element.getBoundingClientRect();
        const contentRect = _contentArea.getBoundingClientRect();

        // 检查元素是否在可视区域内
        if (rect.top < contentRect.top || rect.bottom > contentRect.bottom) {
            // 计算滚动位置，使其尽量居中
            const scrollPosition = element.offsetTop - _contentArea.offsetTop - (_contentArea.clientHeight / 2) + (rect.height / 2);
            _contentArea.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
        }
    };

    // 音频播放结束处理
    const handleAudioEnded = () => {
        console.log('[AudioSync] 音频播放结束。');
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }
        _currentIndex = -1;
    };

    // 清理函数：移除事件监听器和高亮
    const cleanup = () => {
        if (_audioPlayer) {
            _audioPlayer.removeEventListener('timeupdate', handleTimeUpdate);
            _audioPlayer.removeEventListener('ended', handleAudioEnded);
            // 考虑是否要移除音频播放器本身，如果章节没有音频，main.js会移除它
        }
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }
        _contentArea = null;
        _audioPlayer = null;
        _srtData = [];
        _currentIndex = -1;
        _previousHighlightedElement = null;
        console.log('[AudioSync] 已清理。');
    };

    return {
        init: init,
        cleanup: cleanup
    };
})();
