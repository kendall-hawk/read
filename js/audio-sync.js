// js/audio-sync.js (增加了点击跳转功能的完整版本)

window.EnglishSite = window.EnglishSite || {};

EnglishSite.AudioSync = (() => {
    let _contentArea = null;
    let _audioPlayer = null;
    let _srtData = [];
    let _currentIndex = -1;
    let _previousHighlightedElement = null;
    let _textClickHandler = null;

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
                currentCue = { id: line };
            } else if (line.includes('-->') && currentCue) {
                const parts = line.split('-->');
                currentCue.startTime = timeToSeconds(parts[0].trim());
                currentCue.endTime = timeToSeconds(parts[1].trim());
                currentCue.text = '';
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
        cleanup(); 

        _contentArea = contentArea;
        _audioPlayer = audioPlayer;
        _srtData = parseSrt(srtText);
        _currentIndex = -1;
        _previousHighlightedElement = null;

        _audioPlayer.addEventListener('timeupdate', handleTimeUpdateOptimized);
        _audioPlayer.addEventListener('ended', handleAudioEnded);

        _textClickHandler = (event) => handleTextClick(event);
        _contentArea.addEventListener('click', _textClickHandler);

        console.log('[AudioSync] 初始化成功，已启用点击跳转功能。SRT数据:', _srtData);
    };

    const handleTextClick = (event) => {
        const targetSentence = event.target.closest('[data-sentence-id]');
        if (!targetSentence) return;

        const sentenceId = targetSentence.dataset.sentenceId;
        const cue = _srtData.find(c => c.id === sentenceId);

        if (cue) {
            console.log(`[AudioSync] 跳转到句子 ${sentenceId}，时间: ${cue.startTime}`);
            _audioPlayer.currentTime = cue.startTime;
            if (_audioPlayer.paused) {
                _audioPlayer.play();
            }
            const cueIndex = _srtData.findIndex(c => c.id === sentenceId);
            if (cueIndex !== -1) {
                updateHighlight(cueIndex);
                _currentIndex = cueIndex;
            }
        }
    };

    const binarySearchForCue = (time) => {
        let low = 0;
        let high = _srtData.length - 1;
        let bestMatch = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const cue = _srtData[mid];
            if (time >= cue.startTime && time < cue.endTime) {
                return mid;
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
        return -1;
    };

    const handleTimeUpdateOptimized = () => {
        const currentTime = _audioPlayer.currentTime;
        let newIndex = -1;

        if (_currentIndex !== -1) {
            const currentCue = _srtData[_currentIndex];
            if (currentTime >= currentCue.startTime && currentTime < currentCue.endTime) {
                return;
            }
        }

        const nextIndex = _currentIndex + 1;
        if (nextIndex < _srtData.length) {
            const nextCue = _srtData[nextIndex];
            if (currentTime >= nextCue.startTime && currentTime < nextCue.endTime) {
                newIndex = nextIndex;
            }
        }
        
        if (newIndex === -1) {
            newIndex = binarySearchForCue(currentTime);
        }

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
        if (_contentArea && _textClickHandler) {
            _contentArea.removeEventListener('click', _textClickHandler);
        }
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }
        _contentArea = null;
        _audioPlayer = null;
        _srtData = [];
        _currentIndex = -1;
        _previousHighlightedElement = null;
        _textClickHandler = null;
        console.log('[AudioSync] 已清理。');
    };

    return {
        init: init,
        cleanup: cleanup
    };
})();
