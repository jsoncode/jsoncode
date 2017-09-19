if (/mobile/i.test(navigator.userAgent)) {
    document.documentElement.classList.remove('pc');
} else {
    document.documentElement.classList.add('pc');
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