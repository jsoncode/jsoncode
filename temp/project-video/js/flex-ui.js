if (/mobile/i.test(navigator.userAgent)) {
    document.documentElement.classList.remove('pc');
} else {
    document.documentElement.classList.add('pc');
}

function isPassive() {
    var supportsPassiveOption = false;
    try {
        addEventListener("test", null, Object.defineProperty({}, 'passive', {
            get: function() {
                supportsPassiveOption = true;
            }
        }));
    } catch (e) {}
    return supportsPassiveOption;
}

function alert(msg) {
    var body = document.body;
    var el = document.getElementById('myalert');
    var content = el.querySelector('.alert-content-text');
    var btn = el.querySelector('.btn');
    el.classList.add('show-cover');
    content.innerText = msg || '';
    if (el.dataset.shown == '') {
        btn.addEventListener('click', function() {
            el.dataset.shown = 'clicked';
            el.classList.remove('show-cover');
        }, false);
    }
}

new Vue({
    template: '#app',
    data: config,
    methods: {
        like: function() {
            var vm = this;
            if (this.readNum.clicked) {
                this.readNum.like--;
            } else {
                this.readNum.like++;
            }
            this.readNum.clicked = !this.readNum.clicked;

        },
        openAd: function(item) {
            var vm = this;
            location.href = item.link;
        }
    },
    created: function() {
        var vm = this;
        this.$mount('app');
    },
    mounted: function() {
        var vm = this;
        var video = document.querySelector('video');
        if (video && this.video.src != '') {
            video.addEventListener('timeupdate', function() {
                console.log('timeupdate', parseInt(video.currentTime));
                if (parseInt(video.currentTime) == vm.video.currentTime || vm.video.rate > 0 && parseInt(video.currentTime) % vm.video.rate == 0) {
                    video.pause(); //暂停播放
                    video.src = ''; //清空视频
                    alert('网速不好，请分享到1个微信群才可以继续观看。');
                }

            }, false);
        }
        var myScroll = new IScroll('#wrapper');
        document.addEventListener('touchmove', function(e) { e.preventDefault(); }, isPassive() ? {
            capture: false,
            passive: false
        } : false);
    }
});