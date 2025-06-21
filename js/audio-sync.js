// js/audio-sync.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.AudioSync = (() => {
    let _contentArea = null;
    let _audioPlayer = null;
    let _srtData = [];
    let _currentIndex = -1;
    let _previousHighlightedElement = null;

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

    const init = (contentArea, srtText, audioPlayer) => {
        cleanup();
        _contentArea = contentArea;
        _audioPlayer = audioPlayer;
        _srtData = parseSrt(srtText);
        _currentIndex = -1;
        _previousHighlightedElement = null;
        _audioPlayer.addEventListener('timeupdate', handleTimeUpdateOptimized); // ✨ 使用优化后的处理器
        _audioPlayer.addEventListener('ended', handleAudioEnded);
        console.log('[AudioSync] 初始化成功 (使用优化算法)。SRT数据:', _srtData);
    };

    // 🚀 新增：二分搜索函数，用于快速定位跳转后的字幕
    const binarySearchForCue = (time) => {
        let low = 0;
        let high = _srtData.length - 1;
        let bestMatch = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const cue = _srtData[mid];
            if (time >= cue.startTime && time < cue.endTime) {
                return mid; // 精确匹配
            } else if (time < cue.startTime) {
                high = mid - 1;
            } else {
                bestMatch = mid; 
                low = mid + 1;
            }
        }
        if (bestMatch !== -1) {
            const cue = _srtData[bestMatch];
            if (time >= cue.startTime && time < cue.endTime) {
                return bestMatch;
            }
        }
        return -1; // 未找到
    };

    // 🚀 优化后的时间更新处理器
    const handleTimeUpdateOptimized = () => {
        const currentTime = _audioPlayer.currentTime;
        let newIndex = -1;

        // 1. 快速路径检查：检查当前索引是否仍然有效 (最常见情况)
        if (_currentIndex !== -1) {
            const currentCue = _srtData[_currentIndex];
            if (currentTime >= currentCue.startTime && currentTime < currentCue.endTime) {
                return; // 还在当前句子，无需操作
            }
        }

        // 2. 检查下一个索引 (处理正常顺序播放)
        const nextIndex = _currentIndex + 1;
        if (nextIndex < _srtData.length) {
            const nextCue = _srtData[nextIndex];
            if (currentTime >= nextCue.startTime && currentTime < nextCue.endTime) {
                newIndex = nextIndex;
            }
        }
        
        // 3. 如果快速路径失败 (通常因为用户拖动进度条)，使用二分搜索
        if (newIndex === -1) {
            newIndex = binarySearchForCue(currentTime);
        }

        // 4. 更新高亮
        if (newIndex !== -1 && newIndex !== _currentIndex) {
            updateHighlight(newIndex);
            _currentIndex = newIndex;
        } else if (newIndex === -1 && _previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
            _currentIndex = -1;
        }
    };

    const updateHighlight = (newIndex) => {
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }
        const currentCue = _srtData[newIndex];
        const targetElement = _contentArea.querySelector(`[data-sentence-id="${currentCue.id}"]`);
        if (targetElement) {
            targetElement.classList.add('highlighted');
            _previousHighlightedElement = targetElement;
            scrollToView(targetElement);
        } else {
            console.warn(`[AudioSync] 未找到 ID 为 "${currentCue.id}" 的句子元素。`);
        }
    };

    const removeHighlight = (element) => {
        if (element) {
            element.classList.remove('highlighted');
        }
    };

    const scrollToView = (element) => {
        const rect = element.getBoundingClientRect();
        const contentRect = _contentArea.getBoundingClientRect();
        if (rect.top < contentRect.top || rect.bottom > contentRect.bottom) {
            const scrollPosition = element.offsetTop - _contentArea.offsetTop - (_contentArea.clientHeight / 2) + (rect.height / 2);
            _contentArea.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
        }
    };

    const handleAudioEnded = () => {
        console.log('[AudioSync] 音频播放结束。');
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }
        _currentIndex = -1;
    };

    const cleanup = () => {
        if (_audioPlayer) {
            _audioPlayer.removeEventListener('timeupdate', handleTimeUpdateOptimized);
            _audioPlayer.removeEventListener('ended', handleAudioEnded);
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
