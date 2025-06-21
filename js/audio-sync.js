// js/audio-sync.js

window.EnglishSite = window.EnglishSite || {};

EnglishSite.AudioSync = (() => {
    const DEBUG = false;

    let _contentArea = null;
    let _audioPlayer = null;
    let _srtData = [];
    let _timeIndex = [];
    let _currentIndex = -1;
    let _previousHighlightedElement = null;
    let _textClickHandler = null;
    let _lastScrollTime = 0;

    // SRT 解析函数
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
        const [hh, mm, ssMs] = timeString.split(':');
        const [ss, ms] = ssMs.split(',');
        return (+hh) * 3600 + (+mm) * 60 + (+ss) + (+ms) / 1000;
    };

    const init = (contentArea, srtText, audioPlayer) => {
        cleanup();

        _contentArea = contentArea;
        _audioPlayer = audioPlayer;
        _srtData = parseSrt(srtText);
        _currentIndex = -1;
        _previousHighlightedElement = null;
        _timeIndex = _srtData.map((cue, i) => ({
            start: cue.startTime,
            end: cue.endTime,
            index: i
        }));

        _audioPlayer.addEventListener('timeupdate', handleTimeUpdate);
        _audioPlayer.addEventListener('ended', handleAudioEnded);

        _textClickHandler = handleTextClick;
        _contentArea.addEventListener('click', _textClickHandler);

        if (DEBUG) console.log('[AudioSync] 初始化成功，加载', _srtData.length, '条字幕');
    };

    const handleTextClick = (event) => {
        const target = event.target.closest('[data-sentence-id]');
        if (!target) return;

        let id = target.dataset.sentenceId;
        if (id.startsWith('s')) id = id.slice(1);

        const index = _srtData.findIndex(c => c.id === id);
        if (index === -1) return;

        if (_currentIndex === index && !_audioPlayer.paused) return;

        const cue = _srtData[index];
        _audioPlayer.currentTime = cue.startTime;
        _audioPlayer.play();
        updateHighlight(index);
        _currentIndex = index;
    };

    const handleTimeUpdate = () => {
        const currentTime = _audioPlayer.currentTime;

        if (_currentIndex !== -1) {
            const cue = _srtData[_currentIndex];
            if (currentTime >= cue.startTime && currentTime < cue.endTime) return;
        }

        const index = findCueIndex(currentTime);
        if (index !== -1 && index !== _currentIndex) {
            updateHighlight(index);
            _currentIndex = index;
        } else if (index === -1 && _previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
            _currentIndex = -1;
        }
    };

    const findCueIndex = (time) => {
        let left = 0, right = _timeIndex.length - 1;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const { start, end, index } = _timeIndex[mid];
            if (time >= start && time < end) return index;
            if (time < start) right = mid - 1;
            else left = mid + 1;
        }
        return -1;
    };

    const updateHighlight = (index) => {
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }

        const cue = _srtData[index];
        const el = _contentArea.querySelector(`[data-sentence-id="s${cue.id}"], [data-sentence-id="${cue.id}"]`);
        if (el) {
            el.classList.add('highlighted-current');
            _previousHighlightedElement = el;
            scrollToView(el);
        }
    };

    const removeHighlight = (el) => {
        el.classList.remove('highlighted-current');
    };

    const scrollToView = (el) => {
        const now = Date.now();
        if (now - _lastScrollTime < 300) return;
        _lastScrollTime = now;

        el.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    };

    const handleAudioEnded = () => {
        if (_previousHighlightedElement) {
            removeHighlight(_previousHighlightedElement);
        }
        _currentIndex = -1;
    };

    const cleanup = () => {
        if (_audioPlayer) {
            _audioPlayer.removeEventListener('timeupdate', handleTimeUpdate);
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
        _timeIndex = [];
        _currentIndex = -1;
        _previousHighlightedElement = null;
        _textClickHandler = null;
        _lastScrollTime = 0;
    };

    return {
        init,
        cleanup
    };
})();