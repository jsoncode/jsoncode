// ==UserScript==
// @name         jsoncode的安全模式
// @namespace    test
// @version      0.1
// @description  提供一个安全环境访问互联网
// @author       jsoncode
// @match        http://**/*
// @match        https://**/*
// @require      https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM.getResourceUrl
// @grant        unsafeWindow
// @run-at       document-start ==/ document-end context-menu==
// ==/UserScript==

var q = jQuery.noConflict();
(function() {
    if (location.host == 'www.baidu.com') {
        baidu_setTitle();
        baidu_clearBody();
        addStyle();
        addHtml();
        // 搜索框
        var input = q('#search-input');
        // 关键词列表
        var inputList = q('#search-input-list');
        // 搜索按钮
        var searchBtn = q('#searchBtn');
        // 搜索结果
        var content = q('#content—result');
        // 搜索分页
        var pagination = q('#pagination');

        input.focus();
        input.on('keydown', function(e) {
            if (e.keyCode === 38 || e.keyCode === 40) {
                baidu_upAndDown(e);
                inputList.show();
            } else if (e.keyCode === 13) {
                baidu_search(input.val())
                inputList.hide();
            } else {
                var searchKeyword = q(this).val();
                baidu_getKeyWord(searchKeyword);
                inputList.show();
            }
        });

        searchBtn.click(function() {
            baidu_search(input.val());
        });

        q(document).click(function(e) {
            baidu_toggleList(e);
        });
        setTimeout(function() {
            console.clear();
            q('[href*="bdstatic"],[src*="bdstatic"]').remove();
        }, 1000);
    }


    function addStyle() {
        q('head').append('<link href="https://cdn.bootcss.com/twitter-bootstrap/4.1.3/css/bootstrap.min.css"  rel="stylesheet"/>');
        var style = `
            <style>
                a:visited{
                    color:#cc62f7;
                }
                body{
                    background-repeat: no-repeat;
                    background-size: cover;
                    background-position: center;
                    background-attachment: fixed;
                }
                .selfSearch{
                    position:fixed;
                    top:0;
                    left:0;
                    bottom:0;
                    right:0;
                    z-index:400;
                    background-image:linear-gradient(350deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 59%,rgba(0,0,0,.64) 100%)
                }
                .search-btn-wrap{
                    width:140px;
                }
                .selfSearch .search-btn-wrap button,
                .selfSearch .search-input-wrap input{
                    outline:0 !important;
                    box-shadow:none !important;
                    border-radius:0;
                    position:relative;
                    z-index:101;
                }
                .search-input-wrap{
                    position:relative;
                }
                .search-input{
                    border-color:blue;
                }
                .search-input-list{
                    border-top:0;
                    top:100%;
                    left:15px;
                    right:15px;
                    cursor:pointer;
                    position:absolute;
                    z-index:400;
                }

                .search-input-list .list-group-item{
                    border-radius:0;
                }
                .search-input-list .list-group-item.current,
                .search-input-list .list-group-item:hover{
                    background:#eee;
                }
                .selfSearch .scrollContent{
                    overflow:auto;
                    height:calc(100vh - 80px);
                }
                .selfSearch .content img{
                    max-width:100%;
                }
                .selfSearch .content .result.c-container em{
                    color:red;
                    font-style:normal
                }
                .selfSearch .fixedCover{
                    position:fixed;
                    left:0;
                    top:0;
                    right:0;
                    bottom:0;
                    z-index:100;
                    background-color:rgba(0,0,0,0.5);
                    opacity:0;
                    pointer-events:none;
                    transition-duration:.3s;
                }
                .selfSearch .search-input-wrap input:active + .fixedCover,
                .selfSearch .search-input-wrap input:focus + .fixedCover{
                    opacity:1;
                    pointer-events:all;
                }
                .result h3{
                    font-size:16px;
                }
                .result .c-abstract{
                    font-size:13px;
                }
                .result .f13{
                    font-size:12px;
                }
            </style>
            `;
        q('head').append(style);
    }

    function addHtml() {
        q('body').css({
            overflow: 'hidden'
        }).append(`
            <div class="selfSearch" id="searchapp">
                <div class="container">
                    <div class="row py-3">
                        <div class="col search-input-wrap">
                            <input class="form-control form-control-lg search-input" id="search-input">
                            <div class="fixedCover"></div>
                            <div class="search-input-list">
                                <ul class="list-group" id="search-input-list"></ul>
                            </div>
                        </div>
                        <div class="search-btn-wrap">
                            <button class="btn btn-primary btn-lg btn-block" type="button" id="searchBtn">搜索</button>
                        </div>
                    </div>
                </div>
                <div class="container-fluid scrollContent">
                    <div class="content">
                        <div id="content—result"></div>
                        <nav>
                            <ul class="pagination" id="pagination">

                            </ul>
                        </nav>
                    </div>
                </div>
            </div>
        `);
    }

    function baidu_setTitle(title) {
        document.title = title || '安全搜索-广告已过滤'
    }

    function baidu_clearBody() {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        getBg(function(img) {
            q('body').css({
                backgroundImage:`url(${img})`
            })
        });
    }

    function baidu_getKeyWord(keyword, back) {
        var callback = back || function() {};
        var t1 = new Date().getTime();
        var t2 = t1 + 210;
        inputList.show();
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://sp0.baidu.com/5a1Fazu8AA54nxGko9WTAnF6hhy/su?wd=${keyword}&json=1&p=3&sid=26524_1464_21098_26350_22160&req=2&bs=&csor=3&pwd=cs&cb=jQuery110208264721847970322_${t1}&_=${t2}`,
            onload: function(response) {
                var objStr = response.responseText.match(/(?<=[\w+])\(([\s\S]+)(?=\))/)[1].replace(/\\'/g, "'");
                var list = JSON.parse(objStr).s;
                list = list.concat(['视频', '图片', 'api'].map(function(item) {
                    return keyword + ' ' + item;
                }));
                var html = '';
                list.forEach(function(item, i) {
                    html += '<li class="list-group-item" data-index="' + i + '">' + item + '</li>';
                });
                inputList.html(html);
                callback()
            },
            onerror: function(reponse) {
                alert('error');
            }
        });
    }

    function baidu_search(value) {
        if (value === null || value === '') {
            return;
        }
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://www.baidu.com/s?ie=utf-8&mod=11&isbd=1&isid=10FCC76279E92878&ie=utf-8&f=8&rsv_bp=0&rsv_idx=1&tn=baidu&wd=${encodeURIComponent(value)}&rsv_pq=ab4cc49200041a6f&rsv_t=8dfcL6IoYXAYa2vQiTntndpQUwLw3pJRQXVhnn9xy30VSdRSNNnie3QwINA&rqlang=cn&rsv_enter=1&rsv_sug3=6&rsv_sug1=6&rsv_sug7=101&rsv_sid=26524_1464_21098_26350_22160&_ss=1&clist=&hsug=%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%B8%88&csor=2&pstg=5&_cr1=28874`,
            onload: function(response) {
                var str = response.responseText.replace(/(data-click|style|tpl)="[^"]+"|<style>[^<]+?<\/style>/gi, '');
                var dom = q(str);
                var list = dom.find('#content_left').children()
                var page = dom.find('#page a');
                var htmlList = [];
                list.each(function(i, item) {
                    // 过滤搜索结果中的广告，和无效结果
                    // if (q(item).hasClass('result')) {
                    htmlList.push(`<div class="col-lg-3 mb-3">
                            <div class="card" style="height:100%;">
                              <div class="card-body">${item.outerHTML}</div>
                            </div>
                        </div>`);
                    // }
                });
                var html = `<div class="container-fluid"><div class="row">${htmlList.join('')}</div></div>`;
                content.html(html);

                // var pageHtml = [];
                // page.each(function(i, item) {
                //     q(item).addClass('page-link').find('.fk').remove();
                //     pageHtml.push(`<li class="page-item">${item.outerHTML}</li>`);
                // });
                // pagination.html(pageHtml.join(''));
                inputList.hide();
                input.blur();
            },
            onerror: function(reponse) {
                alert('error');
                inputList.hide();
            }
        });
    }

    function baidu_upAndDown(e) {
        var keyCode = e.keyCode; //30上键，40下键
        inputList.show();
        e.preventDefault();
        var list = inputList.children();
        if (list.length) {
            var current = inputList.children('.current');
            if (current.length) {
                var index = current.data('index');
                // 上键
                if (keyCode === 38) {
                    if (index == 0) {
                        list.last().addClass('current').siblings().removeClass('current');
                    } else {
                        list.eq(index - 1).addClass('current').siblings().removeClass('current');
                    }
                } else {
                    // 下键
                    if (index >= list.length - 1) {
                        list.first().addClass('current').siblings().removeClass('current');
                    } else {
                        list.eq(index + 1).addClass('current').siblings().removeClass('current');
                    }
                }
            } else {
                list.first().addClass('current');
            }
            var value = inputList.children('.current').text();
            input.val(value);
        }
        return false;
    }

    function baidu_toggleList(e) {
        if (e.target.id === 'search-input' || e.target.id === 'search-input-list') {
            inputList.show();
        } else {
            if (e.target.closest('#search-input-list')) {
                q(e.target).addClass('current').siblings().removeClass('current');
                var value = q(e.target).text();
                input.val(value);
                baidu_search(value);
            }
            inputList.hide();
        }
    }

    function getBg(back) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://cn.bing.com/`,
            onload: function(response) {
                var img = 'https://cn.bing.com' + response.responseText.match(/#bgDiv\{[^\)]+\)/ig)[1].match(/url\(([^\)]+)?\)/)[1];
                back(img);
            },
            onerror: function(reponse) {}
        });
    }

})();
