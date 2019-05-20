// ==UserScript==
// @name         搬砖价差排行
// @namespace    https://www.hbg.com/
// @version      0.1
// @description  根据不同交易所之间的价格对比，筛选合适的板砖交易的
// @author       You
// @match        https://jsoncode.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// @require      https://cdn.bootcss.com/jquery/3.3.1/jquery.min.js
// @require      https://cdn.bootcss.com/vue/2.5.22/vue.min.js
// @require      https://cdn.bootcss.com/pako/1.0.10/pako.min.js
// ==/UserScript==

;(function() {
  'use strict'
  //   需要把以下域名加入代理列表
  // api.huobi.br.com
  // okexcomreal.bafang.com
  // webws.gateio.live
  // www.bitfinex.com

  var sckey1 = ''
  var sckey2 = ''
  var style = document.createElement('style')
  style.innerHTML = `
      #my-panel{width:100%}
      table{width:100%}
      table thead th {cursor:pointer;text-align:left;}
    `
  document.head.appendChild(style)
  var div = document.createElement('div')
  div.id = 'my-panel'
  //   document.body.innerHTML = ''
  document.body.appendChild(div)
  document.getElementById('my-panel').innerHTML = `
        <div style="width:100%">
          <table>
          <thead>
            <tr>
              <th @click="sortBy('assetPair')">交易对</th>
  
              <th @click="sortBy('huobi')">huobi</th>
              <th @click="sortBy('binance')">binance</th>
              <th @click="sortBy('gateio')">gateio</th>
              <th @click="sortBy('bitcoinvn')">bitcoinvn</th>
              <th @click="sortBy('spread')">spread</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sortList">
              <td v-text="item.symbol"></td>
  
              <td v-text="item.huobi_price"></td>
              <td v-text="item.binance_price"></td>
              <td v-text="item.gateio_price"></td>
              <td v-text="item.bitcoinvn_price"></td>
              <td v-text="item.spread"></td>
            </tr>
          </tbody>
          </table>
        </div>
      `
  var app = new Vue({
    el: '#my-panel',
    data: {
      socketMap: {},
      dataMap: {},
      allData: {},
      sortList: [],
      sortType: 'spread',
      usableMap: {},
      sendWXMsgTime: {},
      huobi_btc_usdt_listener: {
        time: new Date().getTime(),
        price: 0
      }
    },
    mounted: function() {
      var vm = this
      // vm.ajax(
      //   'https://www.hbg.com/-/x/pro/v1/settings/chains?r=' + btoa('' + new Date().getTime()).replace(/=/g, ''),
      //   'GET'
      // ).then(function(data) {
      //   var chains = JSON.parse(data.response).data
      //   chains.forEach(function(item) {
      //     var key = item['display-name'].toLowerCase()
      //     vm.usableMap[key] = 1
      //     vm.usableMap[key.replace(/\d+/gi, '')] = 1
      //   })
      // })
      vm.ajax('http://localhost:8888', 'GET').then(function(data) {
        data = data.response.split(',')
        console.log(data)
        sckey1 = data[0]
        sckey2 = data[1]

        vm.get_huobi()
        vm.get_binance()
        // vm.get_ajax_bitfinex()
        // vm.get_okex()
        vm.get_gateio()
        vm.get_bitcoinvn()
      })
    },
    methods: {
      setSpread: function(item) {
        var vm = this
        var list = []
        for (const i in item) {
          if (i !== 'spread' && i !== 'symbol') {
            var num = item[i]
            if (!isNaN(num)) {
              list.push(num)
            }
          }
        }
        var spread = 0
        if (list.length > 1) {
          var min = list.min()
          var max = list.max()
          spread = ((Math.abs(max - min) / min) * 100).toFixed(2) * 1
        }
        return spread
      },
      sortBy: function(type) {
        var vm = this
        vm.sortType = type || vm.sortType
        vm.sortList = Object.values(vm.allData)
          .sort(function(v1, v2) {
            if (vm.sortType === 'assetPair') {
              // var len1 = Object.keys(v1).length
              // var len2 = Object.keys(v2).length
              // return len1 < len2 ? 1 : -1
              return !v1.symbol || !v2.symbol ? 1 : v1.symbol.localeCompare(v2.symbol)
            } else if (vm.sortType === 'huobi') {
              return v1.huobi_price != undefined ? -1 : 1
            } else if (vm.sortType === 'bitfinex') {
              return v1.bitfinex_price != undefined ? -1 : 1
            } else if (vm.sortType === 'gateio') {
              return v1.gateio_price != undefined ? -1 : 1
            } else if (vm.sortType === 'okex') {
              return v1.okex_price != undefined ? -1 : 1
            } else if (vm.sortType === 'binance') {
              return v1.binance_price != undefined ? -1 : 1
            } else if (vm.sortType === 'bitcoinvn') {
              return v1.bitcoinvn_price != undefined ? -1 : 1
            } else if (vm.sortType === 'spread') {
              return v1.spread > v2.spread ? -1 : 1
            }
            return 1
          })
          .filter(function(item) {
            return true || Object.keys(item).length - 2 > 1 || item.bitcoinvn_price !== undefined
          })
        var arr = vm.sortList.filter(function(item) {
          return item.spread > 10
        })
        // if (arr.length > 0) {
        //   vm.sendMsg({
        //     msg: arr
        //       .map(function(item) {
        //         return item.symbol + '@' + item.spread
        //       })
        //       .join(','),
        //     symbol: arr
        //       .map(function(item) {
        //         return item.symbol
        //       })
        //       .sort(function(v1, v2) {
        //         return v1.localeCompare(v2)
        //       })
        //       .join('-')
        //   })
        // }
      },
      ajax: function(url, method, headers) {
        return new Promise(function(success) {
          GM_xmlhttpRequest({
            method: method.toUpperCase(),
            url: url,
            headers: formatHeaders(headers),
            onload: function(response) {
              success(response)
            }
          })
        })
      },
      socket: function(url, sendMsg, pingMsg, back) {
        var vm = this
        try {
          if (!vm.socketMap[url]) {
            var ws = new WebSocket(url)
            ws.onopen = function() {
              sendMsg.forEach(function(item) {
                if (item) {
                  ws.send(JSON.stringify(item))
                }
              })
              if (pingMsg) {
                vm.socketMap[url + 'timer'] = setInterval(function() {
                  ws.send(pingMsg)
                }, 5000)
              }
            }

            ws.onmessage = function(evt) {
              back(evt.data)
            }

            ws.onclose = function() {
              vm.socketMap[url] = null
              clearInterval(vm.socketMap[url + 'timer'])
              vm.socket(url, sendMsg, pingMsg, back)
            }
            vm.socketMap[url] = ws
          } else {
            vm.socketMap[url].send(sendMsg)
            if (pingMsg) {
              vm.socketMap[url + 'timer'] = setInterval(function() {
                vm.socketMap[url].send(pingMsg)
              }, 5000)
            }
          }
        } catch (error) {}
      },
      sendMsg: function(opt) {
        var vm = this
        //没过100秒同步一次最新数据
        if (!vm.sendWXMsgTime[opt.symbol] || new Date().getTime() - vm.sendWXMsgTime[opt.symbol] > 1e5) {
          console.log('消息同步')
          vm.sendWXMsgTime[opt.symbol] = new Date().getTime()
          vm.ajax(
            'https://sc.ftqq.com/' + sckey1 + '.send?text=' + opt.msg + 'percent@请确认是可以Withdraw@deposit',
            'GET'
          ).then(function(d) {
            console.log(d.response)
          })
          vm.ajax(
            'https://sc.ftqq.com/' + sckey2 + '.send?text=' + opt.msg + 'percent@请确认是可以Withdraw@deposit',
            'GET'
          ).then(function(d) {})
        }
      },
      get_bitcoinvn: function(transactionPair) {
        var vm = this
        var url = 'wss://www.bitcoinvn.cloud/socket/v2'
        vm.socket(
          url,
          [
            { event: 'subscribe', channel: 'sub_market_quotation' }
            // { symbol: transactionPair, event: 'subscribe', channel: 'sub_depth', limit: 200 },
            // { symbol: transactionPair, event: 'subscribe', channel: 'sub_trades' }
          ],
          null,
          function(data) {
            data = JSON.parse(data)
            if (!vm.dataMap.bitcoinvn) {
              vm.dataMap.bitcoinvn = {}
            }
            if (data.data) {
              var btc_usdt = data.data.btc_usdt.split(',')[1] * 1
              var eth_usdt = data.data.eth_usdt.split(',')[1] * 1
              var usdt_vnd = data.data.usdt_vnd.split(',')[1] * 1

              for (const item in data.data) {
                if (data.data.hasOwnProperty(item)) {
                  const str = data.data[item]
                  var element = str.split(',')
                  var close = element[1] * 1
                  var usdtPrice = close
                  if (item.indexOf('_btc') > -1) {
                    if (item !== 'btc_usdt') {
                      usdtPrice = (close * btc_usdt).toFixed(8) * 1
                    }
                  } else if (item.indexOf('_vnd') > -1) {
                    if (item !== 'usdt_vnd') {
                      usdtPrice = (close / usdt_vnd).toFixed(8) * 1
                    }
                  } else if (item.indexOf('_eth') > -1) {
                    usdtPrice = (close * eth_usdt).toFixed(8) * 1
                  }
                  if (!vm.allData[item]) {
                    vm.allData[item] = {}
                  }
                  vm.allData[item] = Object.assign({}, vm.allData[item], {
                    bitcoinvn_price: usdtPrice,
                    symbol: item
                  })
                  vm.allData[item].spread = vm.setSpread(vm.allData[item])
                  vm.dataMap.bitcoinvn[item] = {
                    vol: element[0] * 1,
                    close: close,
                    high: element[2] * 1,
                    low: element[3] * 1,
                    change: element[4] * 1,
                    symbol: item
                  }
                }
              }

              vm.sortBy()
              vm.$forceUpdate()
            }
          }
        )
      },
      get_binance: function(transactionPair) {
        var vm = this
        console.log('get binance data')
        /** 
     * 
       获取币安排除的货币对
       JSON.stringify($('.accountInfo-lists >li.ng-scope').map(function(index,item){
        return {
          symbol:$(this).find('.items>.coin').text().trim().toLowerCase(),
          hide:$(this).find('.action>.disabled').length>0
        }
      }),null,4)

      */
        var ignorList = {
          '0': { symbol: 'mda', hide: false },
          '1': { symbol: 'iota', hide: true },
          '2': { symbol: 'ltc', hide: false },
          '3': { symbol: 'bcx', hide: true },
          '4': { symbol: 'usdt', hide: false },
          '5': { symbol: 'bnb', hide: false },
          '6': { symbol: 'bcd', hide: false },
          '7': { symbol: 'btc', hide: false },
          '8': { symbol: 'sbtc', hide: true },
          '9': { symbol: 'neo', hide: false },
          '10': { symbol: 'eth', hide: false },
          '11': { symbol: 'qtum', hide: false },
          '12': { symbol: 'eos', hide: false },
          '13': { symbol: 'snt', hide: false },
          '14': { symbol: 'bnt', hide: false },
          '15': { symbol: 'gas', hide: false },
          '16': { symbol: 'btm', hide: true },
          '17': { symbol: 'hcc', hide: true },
          '18': { symbol: 'oax', hide: false },
          '19': { symbol: 'dnt', hide: false },
          '20': { symbol: 'mco', hide: false },
          '21': { symbol: 'icn', hide: true },
          '22': { symbol: 'zrx', hide: false },
          '23': { symbol: 'omg', hide: false },
          '24': { symbol: 'wtc', hide: false },
          '25': { symbol: 'lrc', hide: true },
          '26': { symbol: 'llt', hide: true },
          '27': { symbol: 'yoyo', hide: true },
          '28': { symbol: 'trx', hide: false },
          '29': { symbol: 'strat', hide: false },
          '30': { symbol: 'sngls', hide: false },
          '31': { symbol: 'bqx', hide: false },
          '32': { symbol: 'knc', hide: false },
          '33': { symbol: 'snm', hide: false },
          '34': { symbol: 'fun', hide: false },
          '35': { symbol: 'link', hide: false },
          '36': { symbol: 'xvg', hide: true },
          '37': { symbol: 'ctr', hide: true },
          '38': { symbol: 'salt', hide: false },
          '39': { symbol: 'sub', hide: false },
          '40': { symbol: 'etc', hide: false },
          '41': { symbol: 'mtl', hide: false },
          '42': { symbol: 'mth', hide: false },
          '43': { symbol: 'eng', hide: false },
          '44': { symbol: 'ast', hide: false },
          '45': { symbol: 'dash', hide: false },
          '46': { symbol: 'btg', hide: false },
          '47': { symbol: 'evx', hide: false },
          '48': { symbol: 'req', hide: false },
          '49': { symbol: 'vib', hide: false },
          '50': { symbol: 'powr', hide: false },
          '51': { symbol: 'ark', hide: false },
          '52': { symbol: 'xrp', hide: false },
          '53': { symbol: 'mod', hide: false },
          '54': { symbol: 'enj', hide: false },
          '55': { symbol: 'storj', hide: false },
          '56': { symbol: 'kmd', hide: false },
          '57': { symbol: 'rcn', hide: false },
          '58': { symbol: 'nuls', hide: false },
          '59': { symbol: 'rdn', hide: false },
          '60': { symbol: 'xmr', hide: false },
          '61': { symbol: 'dlt', hide: false },
          '62': { symbol: 'amb', hide: false },
          '63': { symbol: 'bat', hide: false },
          '64': { symbol: 'zec', hide: false },
          '65': { symbol: 'bcpt', hide: false },
          '66': { symbol: 'arn', hide: false },
          '67': { symbol: 'gvt', hide: false },
          '68': { symbol: 'cdt', hide: false },
          '69': { symbol: 'gxs', hide: true },
          '70': { symbol: 'poe', hide: false },
          '71': { symbol: 'qsp', hide: false },
          '72': { symbol: 'bts', hide: true },
          '73': { symbol: 'xzc', hide: false },
          '74': { symbol: 'lsk', hide: false },
          '75': { symbol: 'tnt', hide: false },
          '76': { symbol: 'fuel', hide: false },
          '77': { symbol: 'mana', hide: false },
          '78': { symbol: 'dgd', hide: false },
          '79': { symbol: 'adx', hide: false },
          '80': { symbol: 'ada', hide: false },
          '81': { symbol: 'ppt', hide: false },
          '82': { symbol: 'cmt', hide: true },
          '83': { symbol: 'xlm', hide: true },
          '84': { symbol: 'cnd', hide: false },
          '85': { symbol: 'lend', hide: false },
          '86': { symbol: 'wabi', hide: false },
          '87': { symbol: 'waves', hide: false },
          '88': { symbol: 'tnb', hide: false },
          '89': { symbol: 'gto', hide: false },
          '90': { symbol: 'icx', hide: false },
          '91': { symbol: 'ost', hide: false },
          '92': { symbol: 'elf', hide: false },
          '93': { symbol: 'aion', hide: false },
          '94': { symbol: 'zil', hide: true },
          '95': { symbol: 'bchsv', hide: false },
          '96': { symbol: 'iotx', hide: false },
          '97': { symbol: 'hot', hide: false },
          '98': { symbol: 'xem', hide: false },
          '99': { symbol: 'ren', hide: false },
          '100': { symbol: 'agi', hide: false },
          '101': { symbol: 'rlc', hide: false },
          '102': { symbol: 'dock', hide: false },
          '103': { symbol: 'wpr', hide: false },
          '104': { symbol: 'usds', hide: false },
          '105': { symbol: 'sc', hide: false },
          '106': { symbol: 'vtho', hide: false },
          '107': { symbol: 'npxs', hide: false },
          '108': { symbol: 'cvc', hide: false },
          '109': { symbol: 'grs', hide: false },
          '110': { symbol: 'tfuel', hide: true },
          '111': { symbol: 'steem', hide: false },
          '112': { symbol: 'phx', hide: false },
          '113': { symbol: 'rep', hide: false },
          '114': { symbol: 'loom', hide: false },
          '115': { symbol: 'matic', hide: false },
          '116': { symbol: 'nas', hide: true },
          '117': { symbol: 'ae', hide: true },
          '118': { symbol: 'go', hide: false },
          '119': { symbol: 'data', hide: false },
          '120': { symbol: 'zen', hide: false },
          '121': { symbol: 'meetone', hide: true },
          '122': { symbol: 'blz', hide: false },
          '123': { symbol: 'rvn', hide: false },
          '124': { symbol: 'theta', hide: false },
          '125': { symbol: 'nebl', hide: false },
          '126': { symbol: 'mft', hide: false },
          '127': { symbol: 'ncash', hide: false },
          '128': { symbol: 'usdc', hide: false },
          '129': { symbol: 'vibe', hide: false },
          '130': { symbol: 'dent', hide: false },
          '131': { symbol: 'ont', hide: false },
          '132': { symbol: 'bchabc', hide: false },
          '133': { symbol: 'ardr', hide: false },
          '134': { symbol: 'storm', hide: false },
          '135': { symbol: 'cbm', hide: true },
          '136': { symbol: 'qkc', hide: false },
          '137': { symbol: 'chat', hide: true },
          '138': { symbol: 'vet', hide: false },
          '139': { symbol: 'wan', hide: false },
          '140': { symbol: 'btt', hide: false },
          '141': { symbol: 'nxs', hide: false },
          '142': { symbol: 'ins', hide: false },
          '143': { symbol: 'poly', hide: false },
          '144': { symbol: 'qlc', hide: false },
          '145': { symbol: 'fet', hide: false },
          '146': { symbol: 'etf', hide: true },
          '147': { symbol: 'eon', hide: true },
          '148': { symbol: 'iost', hide: false },
          '149': { symbol: 'ong', hide: false },
          '150': { symbol: 'key', hide: false },
          '151': { symbol: 'gnt', hide: false },
          '152': { symbol: 'cloak', hide: false },
          '153': { symbol: 'celr', hide: false },
          '154': { symbol: 'nano', hide: false },
          '155': { symbol: 'hc', hide: false },
          '156': { symbol: 'tusd', hide: false },
          '157': { symbol: 'atom', hide: false },
          '158': { symbol: 'add', hide: true },
          '159': { symbol: 'via', hide: false },
          '160': { symbol: 'pax', hide: false },
          '161': { symbol: 'sky', hide: false },
          '162': { symbol: 'brd', hide: false },
          '163': { symbol: 'atd', hide: true },
          '164': { symbol: 'sys', hide: false },
          '165': { symbol: 'dcr', hide: true },
          '166': { symbol: 'eop', hide: true },
          '167': { symbol: 'poa', hide: false },
          '168': { symbol: 'mith', hide: false },
          '169': { symbol: 'lun', hide: false },
          '170': { symbol: 'iq', hide: true },
          '171': { symbol: 'edo', hide: false },
          '172': { symbol: 'wings', hide: false },
          '173': { symbol: 'nav', hide: true },
          '174': { symbol: 'trig', hide: true },
          '175': { symbol: 'appc', hide: false },
          '176': { symbol: 'pivx', hide: true },
          length: 177,
          prevObject: {
            '0': { symbol: 'mda', hide: false },
            '1': { symbol: 'iota', hide: true },
            '2': { symbol: 'ltc', hide: false },
            '3': { symbol: 'bcx', hide: true },
            '4': { symbol: 'usdt', hide: false },
            '5': { symbol: 'bnb', hide: false },
            '6': { symbol: 'bcd', hide: false },
            '7': { symbol: 'btc', hide: false },
            '8': { symbol: 'sbtc', hide: true },
            '9': { symbol: 'neo', hide: false },
            '10': { symbol: 'eth', hide: false },
            '11': { symbol: 'qtum', hide: false },
            '12': { symbol: 'eos', hide: false },
            '13': { symbol: 'snt', hide: false },
            '14': { symbol: 'bnt', hide: false },
            '15': { symbol: 'gas', hide: false },
            '16': { symbol: 'btm', hide: true },
            '17': { symbol: 'hcc', hide: true },
            '18': { symbol: 'oax', hide: false },
            '19': { symbol: 'dnt', hide: false },
            '20': { symbol: 'mco', hide: false },
            '21': { symbol: 'icn', hide: true },
            '22': { symbol: 'zrx', hide: false },
            '23': { symbol: 'omg', hide: false },
            '24': { symbol: 'wtc', hide: false },
            '25': { symbol: 'lrc', hide: true },
            '26': { symbol: 'llt', hide: true },
            '27': { symbol: 'yoyo', hide: true },
            '28': { symbol: 'trx', hide: false },
            '29': { symbol: 'strat', hide: false },
            '30': { symbol: 'sngls', hide: false },
            '31': { symbol: 'bqx', hide: false },
            '32': { symbol: 'knc', hide: false },
            '33': { symbol: 'snm', hide: false },
            '34': { symbol: 'fun', hide: false },
            '35': { symbol: 'link', hide: false },
            '36': { symbol: 'xvg', hide: true },
            '37': { symbol: 'ctr', hide: true },
            '38': { symbol: 'salt', hide: false },
            '39': { symbol: 'sub', hide: false },
            '40': { symbol: 'etc', hide: false },
            '41': { symbol: 'mtl', hide: false },
            '42': { symbol: 'mth', hide: false },
            '43': { symbol: 'eng', hide: false },
            '44': { symbol: 'ast', hide: false },
            '45': { symbol: 'dash', hide: false },
            '46': { symbol: 'btg', hide: false },
            '47': { symbol: 'evx', hide: false },
            '48': { symbol: 'req', hide: false },
            '49': { symbol: 'vib', hide: false },
            '50': { symbol: 'powr', hide: false },
            '51': { symbol: 'ark', hide: false },
            '52': { symbol: 'xrp', hide: false },
            '53': { symbol: 'mod', hide: false },
            '54': { symbol: 'enj', hide: false },
            '55': { symbol: 'storj', hide: false },
            '56': { symbol: 'kmd', hide: false },
            '57': { symbol: 'rcn', hide: false },
            '58': { symbol: 'nuls', hide: false },
            '59': { symbol: 'rdn', hide: false },
            '60': { symbol: 'xmr', hide: false },
            '61': { symbol: 'dlt', hide: false },
            '62': { symbol: 'amb', hide: false },
            '63': { symbol: 'bat', hide: false },
            '64': { symbol: 'zec', hide: false },
            '65': { symbol: 'bcpt', hide: false },
            '66': { symbol: 'arn', hide: false },
            '67': { symbol: 'gvt', hide: false },
            '68': { symbol: 'cdt', hide: false },
            '69': { symbol: 'gxs', hide: true },
            '70': { symbol: 'poe', hide: false },
            '71': { symbol: 'qsp', hide: false },
            '72': { symbol: 'bts', hide: true },
            '73': { symbol: 'xzc', hide: false },
            '74': { symbol: 'lsk', hide: false },
            '75': { symbol: 'tnt', hide: false },
            '76': { symbol: 'fuel', hide: false },
            '77': { symbol: 'mana', hide: false },
            '78': { symbol: 'dgd', hide: false },
            '79': { symbol: 'adx', hide: false },
            '80': { symbol: 'ada', hide: false },
            '81': { symbol: 'ppt', hide: false },
            '82': { symbol: 'cmt', hide: true },
            '83': { symbol: 'xlm', hide: true },
            '84': { symbol: 'cnd', hide: false },
            '85': { symbol: 'lend', hide: false },
            '86': { symbol: 'wabi', hide: false },
            '87': { symbol: 'waves', hide: false },
            '88': { symbol: 'tnb', hide: false },
            '89': { symbol: 'gto', hide: false },
            '90': { symbol: 'icx', hide: false },
            '91': { symbol: 'ost', hide: false },
            '92': { symbol: 'elf', hide: false },
            '93': { symbol: 'aion', hide: false },
            '94': { symbol: 'zil', hide: true },
            '95': { symbol: 'bchsv', hide: false },
            '96': { symbol: 'iotx', hide: false },
            '97': { symbol: 'hot', hide: false },
            '98': { symbol: 'xem', hide: false },
            '99': { symbol: 'ren', hide: false },
            '100': { symbol: 'agi', hide: false },
            '101': { symbol: 'rlc', hide: false },
            '102': { symbol: 'dock', hide: false },
            '103': { symbol: 'wpr', hide: false },
            '104': { symbol: 'usds', hide: false },
            '105': { symbol: 'sc', hide: false },
            '106': { symbol: 'vtho', hide: false },
            '107': { symbol: 'npxs', hide: false },
            '108': { symbol: 'cvc', hide: false },
            '109': { symbol: 'grs', hide: false },
            '110': { symbol: 'tfuel', hide: true },
            '111': { symbol: 'steem', hide: false },
            '112': { symbol: 'phx', hide: false },
            '113': { symbol: 'rep', hide: false },
            '114': { symbol: 'loom', hide: false },
            '115': { symbol: 'matic', hide: false },
            '116': { symbol: 'nas', hide: true },
            '117': { symbol: 'ae', hide: true },
            '118': { symbol: 'go', hide: false },
            '119': { symbol: 'data', hide: false },
            '120': { symbol: 'zen', hide: false },
            '121': { symbol: 'meetone', hide: true },
            '122': { symbol: 'blz', hide: false },
            '123': { symbol: 'rvn', hide: false },
            '124': { symbol: 'theta', hide: false },
            '125': { symbol: 'nebl', hide: false },
            '126': { symbol: 'mft', hide: false },
            '127': { symbol: 'ncash', hide: false },
            '128': { symbol: 'usdc', hide: false },
            '129': { symbol: 'vibe', hide: false },
            '130': { symbol: 'dent', hide: false },
            '131': { symbol: 'ont', hide: false },
            '132': { symbol: 'bchabc', hide: false },
            '133': { symbol: 'ardr', hide: false },
            '134': { symbol: 'storm', hide: false },
            '135': { symbol: 'cbm', hide: true },
            '136': { symbol: 'qkc', hide: false },
            '137': { symbol: 'chat', hide: true },
            '138': { symbol: 'vet', hide: false },
            '139': { symbol: 'wan', hide: false },
            '140': { symbol: 'btt', hide: false },
            '141': { symbol: 'nxs', hide: false },
            '142': { symbol: 'ins', hide: false },
            '143': { symbol: 'poly', hide: false },
            '144': { symbol: 'qlc', hide: false },
            '145': { symbol: 'fet', hide: false },
            '146': { symbol: 'etf', hide: true },
            '147': { symbol: 'eon', hide: true },
            '148': { symbol: 'iost', hide: false },
            '149': { symbol: 'ong', hide: false },
            '150': { symbol: 'key', hide: false },
            '151': { symbol: 'gnt', hide: false },
            '152': { symbol: 'cloak', hide: false },
            '153': { symbol: 'celr', hide: false },
            '154': { symbol: 'nano', hide: false },
            '155': { symbol: 'hc', hide: false },
            '156': { symbol: 'tusd', hide: false },
            '157': { symbol: 'atom', hide: false },
            '158': { symbol: 'add', hide: true },
            '159': { symbol: 'via', hide: false },
            '160': { symbol: 'pax', hide: false },
            '161': { symbol: 'sky', hide: false },
            '162': { symbol: 'brd', hide: false },
            '163': { symbol: 'atd', hide: true },
            '164': { symbol: 'sys', hide: false },
            '165': { symbol: 'dcr', hide: true },
            '166': { symbol: 'eop', hide: true },
            '167': { symbol: 'poa', hide: false },
            '168': { symbol: 'mith', hide: false },
            '169': { symbol: 'lun', hide: false },
            '170': { symbol: 'iq', hide: true },
            '171': { symbol: 'edo', hide: false },
            '172': { symbol: 'wings', hide: false },
            '173': { symbol: 'nav', hide: true },
            '174': { symbol: 'trig', hide: true },
            '175': { symbol: 'appc', hide: false },
            '176': { symbol: 'pivx', hide: true },
            length: 177,
            prevObject: {
              '0': { jQuery110208807891931635987: 159 },
              '1': { jQuery110208807891931635987: 167 },
              '2': { jQuery110208807891931635987: 175 },
              '3': { jQuery110208807891931635987: 183 },
              '4': { jQuery110208807891931635987: 191 },
              '5': { jQuery110208807891931635987: 199 },
              '6': { jQuery110208807891931635987: 207 },
              '7': { jQuery110208807891931635987: 215 },
              '8': { jQuery110208807891931635987: 223 },
              '9': { jQuery110208807891931635987: 231 },
              '10': { jQuery110208807891931635987: 239 },
              '11': { jQuery110208807891931635987: 247 },
              '12': { jQuery110208807891931635987: 255 },
              '13': { jQuery110208807891931635987: 263 },
              '14': { jQuery110208807891931635987: 271 },
              '15': { jQuery110208807891931635987: 279 },
              '16': { jQuery110208807891931635987: 287 },
              '17': { jQuery110208807891931635987: 295 },
              '18': { jQuery110208807891931635987: 303 },
              '19': { jQuery110208807891931635987: 311 },
              '20': { jQuery110208807891931635987: 319 },
              '21': { jQuery110208807891931635987: 327 },
              '22': { jQuery110208807891931635987: 335 },
              '23': { jQuery110208807891931635987: 343 },
              '24': { jQuery110208807891931635987: 351 },
              '25': { jQuery110208807891931635987: 359 },
              '26': { jQuery110208807891931635987: 367 },
              '27': { jQuery110208807891931635987: 375 },
              '28': { jQuery110208807891931635987: 383 },
              '29': { jQuery110208807891931635987: 391 },
              '30': { jQuery110208807891931635987: 399 },
              '31': { jQuery110208807891931635987: 407 },
              '32': { jQuery110208807891931635987: 415 },
              '33': { jQuery110208807891931635987: 423 },
              '34': { jQuery110208807891931635987: 431 },
              '35': { jQuery110208807891931635987: 439 },
              '36': { jQuery110208807891931635987: 447 },
              '37': { jQuery110208807891931635987: 455 },
              '38': { jQuery110208807891931635987: 463 },
              '39': { jQuery110208807891931635987: 471 },
              '40': { jQuery110208807891931635987: 479 },
              '41': { jQuery110208807891931635987: 487 },
              '42': { jQuery110208807891931635987: 495 },
              '43': { jQuery110208807891931635987: 503 },
              '44': { jQuery110208807891931635987: 511 },
              '45': { jQuery110208807891931635987: 519 },
              '46': { jQuery110208807891931635987: 527 },
              '47': { jQuery110208807891931635987: 535 },
              '48': { jQuery110208807891931635987: 543 },
              '49': { jQuery110208807891931635987: 551 },
              '50': { jQuery110208807891931635987: 559 },
              '51': { jQuery110208807891931635987: 567 },
              '52': { jQuery110208807891931635987: 575 },
              '53': { jQuery110208807891931635987: 583 },
              '54': { jQuery110208807891931635987: 591 },
              '55': { jQuery110208807891931635987: 599 },
              '56': { jQuery110208807891931635987: 607 },
              '57': { jQuery110208807891931635987: 615 },
              '58': { jQuery110208807891931635987: 623 },
              '59': { jQuery110208807891931635987: 631 },
              '60': { jQuery110208807891931635987: 639 },
              '61': { jQuery110208807891931635987: 647 },
              '62': { jQuery110208807891931635987: 655 },
              '63': { jQuery110208807891931635987: 663 },
              '64': { jQuery110208807891931635987: 671 },
              '65': { jQuery110208807891931635987: 679 },
              '66': { jQuery110208807891931635987: 687 },
              '67': { jQuery110208807891931635987: 695 },
              '68': { jQuery110208807891931635987: 703 },
              '69': { jQuery110208807891931635987: 711 },
              '70': { jQuery110208807891931635987: 719 },
              '71': { jQuery110208807891931635987: 727 },
              '72': { jQuery110208807891931635987: 735 },
              '73': { jQuery110208807891931635987: 743 },
              '74': { jQuery110208807891931635987: 751 },
              '75': { jQuery110208807891931635987: 759 },
              '76': { jQuery110208807891931635987: 767 },
              '77': { jQuery110208807891931635987: 775 },
              '78': { jQuery110208807891931635987: 783 },
              '79': { jQuery110208807891931635987: 791 },
              '80': { jQuery110208807891931635987: 799 },
              '81': { jQuery110208807891931635987: 807 },
              '82': { jQuery110208807891931635987: 815 },
              '83': { jQuery110208807891931635987: 823 },
              '84': { jQuery110208807891931635987: 831 },
              '85': { jQuery110208807891931635987: 839 },
              '86': { jQuery110208807891931635987: 847 },
              '87': { jQuery110208807891931635987: 855 },
              '88': { jQuery110208807891931635987: 863 },
              '89': { jQuery110208807891931635987: 871 },
              '90': { jQuery110208807891931635987: 879 },
              '91': { jQuery110208807891931635987: 887 },
              '92': { jQuery110208807891931635987: 895 },
              '93': { jQuery110208807891931635987: 903 },
              '94': { jQuery110208807891931635987: 911 },
              '95': { jQuery110208807891931635987: 919 },
              '96': { jQuery110208807891931635987: 927 },
              '97': { jQuery110208807891931635987: 935 },
              '98': { jQuery110208807891931635987: 943 },
              '99': { jQuery110208807891931635987: 951 },
              '100': { jQuery110208807891931635987: 959 },
              '101': { jQuery110208807891931635987: 967 },
              '102': { jQuery110208807891931635987: 975 },
              '103': { jQuery110208807891931635987: 983 },
              '104': { jQuery110208807891931635987: 991 },
              '105': { jQuery110208807891931635987: 999 },
              '106': { jQuery110208807891931635987: 1007 },
              '107': { jQuery110208807891931635987: 1015 },
              '108': { jQuery110208807891931635987: 1023 },
              '109': { jQuery110208807891931635987: 1031 },
              '110': { jQuery110208807891931635987: 1039 },
              '111': { jQuery110208807891931635987: 1047 },
              '112': { jQuery110208807891931635987: 1055 },
              '113': { jQuery110208807891931635987: 1063 },
              '114': { jQuery110208807891931635987: 1071 },
              '115': { jQuery110208807891931635987: 1079 },
              '116': { jQuery110208807891931635987: 1087 },
              '117': { jQuery110208807891931635987: 1095 },
              '118': { jQuery110208807891931635987: 1103 },
              '119': { jQuery110208807891931635987: 1111 },
              '120': { jQuery110208807891931635987: 1119 },
              '121': { jQuery110208807891931635987: 1127 },
              '122': { jQuery110208807891931635987: 1135 },
              '123': { jQuery110208807891931635987: 1143 },
              '124': { jQuery110208807891931635987: 1151 },
              '125': { jQuery110208807891931635987: 1159 },
              '126': { jQuery110208807891931635987: 1167 },
              '127': { jQuery110208807891931635987: 1175 },
              '128': { jQuery110208807891931635987: 1183 },
              '129': { jQuery110208807891931635987: 1191 },
              '130': { jQuery110208807891931635987: 1199 },
              '131': { jQuery110208807891931635987: 1207 },
              '132': { jQuery110208807891931635987: 1215 },
              '133': { jQuery110208807891931635987: 1223 },
              '134': { jQuery110208807891931635987: 1231 },
              '135': { jQuery110208807891931635987: 1239 },
              '136': { jQuery110208807891931635987: 1247 },
              '137': { jQuery110208807891931635987: 1255 },
              '138': { jQuery110208807891931635987: 1263 },
              '139': { jQuery110208807891931635987: 1271 },
              '140': { jQuery110208807891931635987: 1279 },
              '141': { jQuery110208807891931635987: 1287 },
              '142': { jQuery110208807891931635987: 1295 },
              '143': { jQuery110208807891931635987: 1303 },
              '144': { jQuery110208807891931635987: 1311 },
              '145': { jQuery110208807891931635987: 1319 },
              '146': { jQuery110208807891931635987: 1327 },
              '147': { jQuery110208807891931635987: 1335 },
              '148': { jQuery110208807891931635987: 1343 },
              '149': { jQuery110208807891931635987: 1351 },
              '150': { jQuery110208807891931635987: 1359 },
              '151': { jQuery110208807891931635987: 1367 },
              '152': { jQuery110208807891931635987: 1375 },
              '153': { jQuery110208807891931635987: 1383 },
              '154': { jQuery110208807891931635987: 1391 },
              '155': { jQuery110208807891931635987: 1399 },
              '156': { jQuery110208807891931635987: 1407 },
              '157': { jQuery110208807891931635987: 1415 },
              '158': { jQuery110208807891931635987: 1423 },
              '159': { jQuery110208807891931635987: 1431 },
              '160': { jQuery110208807891931635987: 1439 },
              '161': { jQuery110208807891931635987: 1447 },
              '162': { jQuery110208807891931635987: 1455 },
              '163': { jQuery110208807891931635987: 1463 },
              '164': { jQuery110208807891931635987: 1471 },
              '165': { jQuery110208807891931635987: 1479 },
              '166': { jQuery110208807891931635987: 1487 },
              '167': { jQuery110208807891931635987: 1495 },
              '168': { jQuery110208807891931635987: 1503 },
              '169': { jQuery110208807891931635987: 1511 },
              '170': { jQuery110208807891931635987: 1519 },
              '171': { jQuery110208807891931635987: 1527 },
              '172': { jQuery110208807891931635987: 1535 },
              '173': { jQuery110208807891931635987: 1543 },
              '174': { jQuery110208807891931635987: 1551 },
              '175': { jQuery110208807891931635987: 1559 },
              '176': { jQuery110208807891931635987: 1567 },
              length: 177,
              prevObject: {
                '0': {
                  location: {
                    href: 'https://www.binance.com/userCenter/balances.html',
                    ancestorOrigins: {},
                    origin: 'https://www.binance.com',
                    protocol: 'https:',
                    host: 'www.binance.com',
                    hostname: 'www.binance.com',
                    port: '',
                    pathname: '/userCenter/balances.html',
                    search: '',
                    hash: ''
                  },
                  jQuery110208807891931635987: 1,
                  _reactListenersID480654554368837: 0
                },
                context: {
                  location: {
                    href: 'https://www.binance.com/userCenter/balances.html',
                    ancestorOrigins: {},
                    origin: 'https://www.binance.com',
                    protocol: 'https:',
                    host: 'www.binance.com',
                    hostname: 'www.binance.com',
                    port: '',
                    pathname: '/userCenter/balances.html',
                    search: '',
                    hash: ''
                  },
                  jQuery110208807891931635987: 1,
                  _reactListenersID480654554368837: 0
                },
                length: 1
              },
              context: {
                location: {
                  href: 'https://www.binance.com/userCenter/balances.html',
                  ancestorOrigins: {},
                  origin: 'https://www.binance.com',
                  protocol: 'https:',
                  host: 'www.binance.com',
                  hostname: 'www.binance.com',
                  port: '',
                  pathname: '/userCenter/balances.html',
                  search: '',
                  hash: ''
                },
                jQuery110208807891931635987: 1,
                _reactListenersID480654554368837: 0
              },
              selector: '.accountInfo-lists >li.ng-scope'
            },
            context: {
              location: {
                href: 'https://www.binance.com/userCenter/balances.html',
                ancestorOrigins: {},
                origin: 'https://www.binance.com',
                protocol: 'https:',
                host: 'www.binance.com',
                hostname: 'www.binance.com',
                port: '',
                pathname: '/userCenter/balances.html',
                search: '',
                hash: ''
              },
              jQuery110208807891931635987: 1,
              _reactListenersID480654554368837: 0
            }
          },
          context: {
            location: {
              href: 'https://www.binance.com/userCenter/balances.html',
              ancestorOrigins: {},
              origin: 'https://www.binance.com',
              protocol: 'https:',
              host: 'www.binance.com',
              hostname: 'www.binance.com',
              port: '',
              pathname: '/userCenter/balances.html',
              search: '',
              hash: ''
            },
            jQuery110208807891931635987: 1,
            _reactListenersID480654554368837: 0
          }
        }
        var ignorMap = {}
        for (const key in ignorList) {
          if (ignorList.hasOwnProperty(key)) {
            const element = ignorList[key]
            if (!element.hide) {
              ignorMap[element.symbol] = 1
            }
          }
        }
        var url = 'wss://stream.binance.com:9443/stream?streams=!miniTicker@arr@3000ms'
        vm.socket(
          url,
          [
            // { event: 'subscribe', channel: 'sub_market_quotation' }
            // { symbol: transactionPair, event: 'subscribe', channel: 'sub_depth', limit: 200 },
            // { symbol: transactionPair, event: 'subscribe', channel: 'sub_trades' }
          ],
          null,
          function(data) {
            data = data.toLowerCase()
            data = JSON.parse(data)
            if (!vm.dataMap.binance) {
              vm.dataMap.binance = {}
            }
            if (data.data && Array.isArray(data.data)) {
              var markets = ['usdt', 'bnb', 'btc', 'eth', 'tusd', 'usdc', 'usds', 'pax', 'xrp']
              data.data.forEach(function(item) {
                var index = -1
                markets.forEach(function(m, idx) {
                  if (new RegExp(m + '$').test(item.s)) {
                    index = idx
                  }
                })
                var current = markets[index]
                if (current === undefined) {
                  return
                }
                item.s = item.s.replace(current, '_' + current)
                if (ignorMap[item.s.split('_')[0]] === undefined) {
                  return
                }
                vm.dataMap.binance[item.s] = {
                  vol: item.v * 1,
                  close: item.c * 1,
                  high: item.h * 1,
                  low: item.l * 1,
                  open: item.o * 1,
                  change: item.v * 1,
                  quantity: item.q * 1,
                  symbol: item.s
                }
              })

              for (const item in vm.dataMap.binance) {
                if (vm.dataMap.binance.hasOwnProperty(item)) {
                  if (vm.allData[item] === undefined) {
                    vm.allData[item] = {}
                  }
                  var element = vm.dataMap.binance[item]
                  if (item.indexOf('_usdt') > -1) {
                    element.usdtPrice = element.close
                    vm.allData[item].binance_price = element.usdtPrice
                    vm.allData[item].symbol = item
                    vm.dataMap.binance[item] = element
                  } else if (item.indexOf('_btc') > -1) {
                    if (vm.dataMap.binance.btc_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.btc_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_eth') > -1) {
                    if (vm.dataMap.binance.eth_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.eth_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_bnb') > -1) {
                    if (vm.dataMap.binance.bnb_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.bnb_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_xrp') > -1) {
                    if (vm.dataMap.binance.xrp_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.xrp_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_usdc') > -1) {
                    if (vm.dataMap.binance.usdc_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.usdc_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_usds') > -1) {
                    if (vm.dataMap.binance.usds_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.usds_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_tusd') > -1) {
                    if (vm.dataMap.binance.tusd_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.tusd_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  } else if (item.indexOf('_pax') > -1) {
                    if (vm.dataMap.binance.pax_usdt) {
                      element.usdtPrice = (element.close * vm.dataMap.binance.pax_usdt.close).toFixed(8) * 1
                      vm.allData[item].binance_price = element.usdtPrice
                      vm.allData[item].symbol = item
                      vm.dataMap.binance[item] = element
                    }
                  }
                }
              }
              vm.sortBy()
              vm.$forceUpdate()
            }
          }
        )
      },
      get_huobi: function(transactionPair) {
        var vm = this

        var url = 'wss://api.huobi.br.com/ws'
        var markets = ['usdt', 'husd', 'btc', 'eth', 'ht']

        /*
     JSON.stringify([].slice.call($$('#table_list .body_list ')).map(function(item){
      return {
        symbol:item.querySelector('dd.uppercase').innerText.trim().toLowerCase(),
        hide:item.querySelectorAll('.action_group>.action_btn.disabled').length>0
      }
    }).filter(function(item){
      return !item.hide
    }),null,4)
     */
        var ignorList = [
          { symbol: 'usdt', hide: false },
          { symbol: 'husd', hide: false },
          { symbol: 'btc', hide: false },
          { symbol: 'eth', hide: false },
          { symbol: 'eos', hide: false },
          { symbol: 'ht', hide: false },
          { symbol: 'gusd', hide: false },
          { symbol: 'tusd', hide: false },
          { symbol: 'pax', hide: false },
          { symbol: 'usdc', hide: false },
          { symbol: 'xrp', hide: false },
          { symbol: 'bch', hide: false },
          { symbol: 'ltc', hide: false },
          { symbol: 'xmr', hide: false },
          { symbol: 'etc', hide: false },
          { symbol: 'ada', hide: false },
          { symbol: 'dash', hide: false },
          { symbol: 'zec', hide: false },
          { symbol: 'iota', hide: false },
          { symbol: 'neo', hide: false },
          { symbol: 'trx', hide: false },
          { symbol: 'qtum', hide: false },
          { symbol: 'xem', hide: false },
          { symbol: 'omg', hide: false },
          { symbol: 'hc', hide: false },
          { symbol: 'lsk', hide: false },
          { symbol: 'dcr', hide: false },
          { symbol: 'btg', hide: false },
          { symbol: 'steem', hide: false },
          { symbol: 'bts', hide: false },
          { symbol: 'waves', hide: false },
          { symbol: 'snt', hide: false },
          { symbol: 'salt', hide: false },
          { symbol: 'gnt', hide: false },
          { symbol: 'cmt', hide: false },
          { symbol: 'btm', hide: false },
          { symbol: 'pay', hide: false },
          { symbol: 'knc', hide: false },
          { symbol: 'powr', hide: false },
          { symbol: 'bat', hide: false },
          { symbol: 'dgd', hide: false },
          { symbol: 'vet', hide: false },
          { symbol: 'qash', hide: false },
          { symbol: 'xzc', hide: false },
          { symbol: 'zrx', hide: false },
          { symbol: 'gas', hide: false },
          { symbol: 'mana', hide: false },
          { symbol: 'eng', hide: false },
          { symbol: 'cvc', hide: false },
          { symbol: 'mco', hide: false },
          { symbol: 'mtl', hide: false },
          { symbol: 'rdn', hide: false },
          { symbol: 'storj', hide: false },
          { symbol: 'chat', hide: false },
          { symbol: 'link', hide: false },
          { symbol: 'srn', hide: false },
          { symbol: 'act', hide: false },
          { symbol: 'tnb', hide: false },
          { symbol: 'qsp', hide: false },
          { symbol: 'req', hide: false },
          { symbol: 'phx', hide: false },
          { symbol: 'appc', hide: false },
          { symbol: 'rcn', hide: false },
          { symbol: 'smt', hide: false },
          { symbol: 'tnt', hide: false },
          { symbol: 'ost', hide: false },
          { symbol: 'itc', hide: false },
          { symbol: 'lun', hide: false },
          { symbol: 'gnx', hide: false },
          { symbol: 'ast', hide: false },
          { symbol: 'evx', hide: false },
          { symbol: 'mds', hide: false },
          { symbol: 'snc', hide: false },
          { symbol: 'propy', hide: false },
          { symbol: 'eko', hide: false },
          { symbol: 'nas', hide: false },
          { symbol: 'wax', hide: false },
          { symbol: 'wicc', hide: false },
          { symbol: 'topc', hide: false },
          { symbol: 'swftc', hide: false },
          { symbol: 'dbc', hide: false },
          { symbol: 'elf', hide: false },
          { symbol: 'aidoc', hide: false },
          { symbol: 'qun', hide: false },
          { symbol: 'iost', hide: false },
          { symbol: 'yee', hide: false },
          { symbol: 'dat', hide: false },
          { symbol: 'theta', hide: false },
          { symbol: 'let', hide: false },
          { symbol: 'dta', hide: false },
          { symbol: 'utk', hide: false },
          { symbol: 'meet', hide: false },
          { symbol: 'soc', hide: false },
          { symbol: 'ruff', hide: false },
          { symbol: 'ocn', hide: false },
          { symbol: 'ela', hide: false },
          { symbol: 'zla', hide: false },
          { symbol: 'stk', hide: false },
          { symbol: 'wpr', hide: false },
          { symbol: 'mtn', hide: false },
          { symbol: 'mtx', hide: false },
          { symbol: 'edu', hide: false },
          { symbol: 'blz', hide: false },
          { symbol: 'abt', hide: false },
          { symbol: 'ctxc', hide: false },
          { symbol: 'ont', hide: false },
          { symbol: 'bft', hide: false },
          { symbol: 'wan', hide: false },
          { symbol: 'kan', hide: false },
          { symbol: 'lba', hide: false },
          { symbol: 'poly', hide: false },
          { symbol: 'pai', hide: false },
          { symbol: 'wtc', hide: false },
          { symbol: 'box', hide: false },
          { symbol: 'gxc', hide: false },
          { symbol: 'bix', hide: false },
          { symbol: 'xlm', hide: false },
          { symbol: 'xvg', hide: false },
          { symbol: 'hit', hide: false },
          { symbol: 'ncash', hide: false },
          { symbol: 'egcc', hide: false },
          { symbol: 'she', hide: false },
          { symbol: 'mex', hide: false },
          { symbol: 'iic', hide: false },
          { symbol: 'gsc', hide: false },
          { symbol: 'uc', hide: false },
          { symbol: 'uip', hide: false },
          { symbol: 'cnn', hide: false },
          { symbol: 'aac', hide: false },
          { symbol: 'uuu', hide: false },
          { symbol: 'lxt', hide: false },
          { symbol: 'but', hide: false },
          { symbol: '18c', hide: false },
          { symbol: 'datx', hide: false },
          { symbol: 'portal', hide: false },
          { symbol: 'gtc', hide: false },
          { symbol: 'hot', hide: false },
          { symbol: 'man', hide: false },
          { symbol: 'get', hide: false },
          { symbol: 'pc', hide: false },
          { symbol: 'ren', hide: false },
          { symbol: 'bkbt', hide: false },
          { symbol: 'seele', hide: false },
          { symbol: 'fti', hide: false },
          { symbol: 'ekt', hide: false },
          { symbol: 'xmx', hide: false },
          { symbol: 'ycc', hide: false },
          { symbol: 'fair', hide: false },
          { symbol: 'ssp', hide: false },
          { symbol: 'lym', hide: false },
          { symbol: 'zjlt', hide: false },
          { symbol: 'pnt', hide: false },
          { symbol: 'idt', hide: false },
          { symbol: 'dac', hide: false },
          { symbol: 'bcv', hide: false },
          { symbol: 'tos', hide: false },
          { symbol: 'musk', hide: false },
          { symbol: 'add', hide: false },
          { symbol: 'mt', hide: false },
          { symbol: 'kcash', hide: false },
          { symbol: 'ncc', hide: false },
          { symbol: 'rccc', hide: false },
          { symbol: 'hpt', hide: false },
          { symbol: 'cvcoin', hide: false },
          { symbol: 'rte', hide: false },
          { symbol: 'trio', hide: false },
          { symbol: 'grs', hide: false },
          { symbol: 'ardr', hide: false },
          { symbol: 'nano', hide: false },
          { symbol: 'zen', hide: false },
          { symbol: 'rbtc', hide: false },
          { symbol: 'bsv', hide: false },
          { symbol: 'mxc', hide: false },
          { symbol: 'xtz', hide: false },
          { symbol: 'nuls', hide: false },
          { symbol: 'cova', hide: false },
          { symbol: 'lamb', hide: false },
          { symbol: 'cvnt', hide: false },
          { symbol: 'dock', hide: false },
          { symbol: 'btt', hide: false },
          { symbol: 'sc', hide: false },
          { symbol: 'kmd', hide: false },
          { symbol: 'loom', hide: false },
          { symbol: 'nexo', hide: false },
          { symbol: 'etn', hide: false },
          { symbol: 'npxs', hide: false },
          { symbol: 'top', hide: false },
          { symbol: 'doge', hide: false },
          { symbol: 'iris', hide: false },
          { symbol: 'ugas', hide: false },
          { symbol: 'atom', hide: false },
          { symbol: 'tt', hide: false },
          { symbol: 'new', hide: false }
        ]
        ignorList.forEach(function(item) {
          if (!item.hide) {
            vm.usableMap[item.symbol] = 1
          }
        })
        vm.socket(
          url,
          [
            //   实时价格
            { sub: 'market.overview' }
            //   指定货币对的订单本
            // {
            //   sub: 'market.ontbtc.depth.step0',
            //   symbol: transactionPair.replace('_', ''),
            //   pick: ['bids.29', 'asks.29'],
            //   step: 'step0'
            // }
          ],

          JSON.stringify({ pong: new Date().getTime() }),
          function(data) {
            let reader = new FileReader()
            reader.onload = function() {
              var result = JSON.parse(pako.inflate(reader.result, { to: 'string' }))
              if (result.data) {
                if (!vm.dataMap.huobi) {
                  vm.dataMap.huobi = {}
                }
                result.data.forEach(function(item) {
                  var index = -1
                  markets.forEach(function(m, idx) {
                    if (new RegExp(m + '$').test(item.symbol)) {
                      index = idx
                    }
                  })
                  var current = markets[index]
                  if (current === undefined) {
                    return
                  }
                  item.symbol = item.symbol.replace(current, '_' + current)
                  if (vm.usableMap[current.split('_')] === undefined) {
                    return
                  }
                  if (markets.indexOf(item.symbol.split('_')[1]) > -1) {
                    if (vm.dataMap.huobi[item.symbol] === undefined) {
                      vm.dataMap.huobi[item.symbol] = item
                    } else {
                      vm.dataMap.huobi[item.symbol] = Object.assign({}, vm.dataMap.huobi[item.symbol], item)
                    }
                  }
                })
                // 转换成usdt价格
                var btc_usdt = vm.dataMap.huobi.btc_usdt.close * 1
                if (btc_usdt <= 7000 || btc_usdt >= 8300) {
                  if (
                    new Date().getTime() - vm.huobi_btc_usdt_listener.time > 5 * 60 * 1000 ||
                    Math.abs(vm.huobi_btc_usdt_listener.price - btc_usdt) > 30
                  ) {
                    vm.huobi_btc_usdt_listener.time = new Date().getTime()
                    vm.huobi_btc_usdt_listener.price = btc_usdt
                    vm.ajax(
                      'https://sc.ftqq.com/' + sckey1 + '.send?text=btc' + btc_usdt + '波动较大@请及时关注',
                      'GET'
                    ).then(function(d) {})
                    vm.ajax(
                      'https://sc.ftqq.com/' + sckey2 + '.send?text=btc' + btc_usdt + '波动较大@请及时关注',
                      'GET'
                    ).then(function(d) {})
                  }
                }
                var usdt_husd = vm.dataMap.huobi.usdt_husd.close
                var eth_usdt = vm.dataMap.huobi.eth_usdt.close
                var ht_usdt = vm.dataMap.huobi.ht_usdt.close
                for (const item in vm.dataMap.huobi) {
                  if (vm.dataMap.huobi.hasOwnProperty(item)) {
                    const element = vm.dataMap.huobi[item]
                    if (item.indexOf('_usdt') > -1) {
                      element.usdtPrice = element.close
                    } else if (item.indexOf('_btc') > -1) {
                      element.usdtPrice = (element.close * btc_usdt).toFixed(8) * 1
                    } else if (item.indexOf('_husd') > -1) {
                      if (item === 'usdt_husd') {
                        element.usdtPrice = element.close
                      } else {
                        element.usdtPrice = (element.close * usdt_husd).toFixed(8) * 1
                      }
                    } else if (item.indexOf('_eth') > -1) {
                      element.usdtPrice = (element.close * eth_usdt).toFixed(8) * 1
                    } else if (item.indexOf('_ht') > -1) {
                      element.usdtPrice = (element.close * ht_usdt).toFixed(8) * 1
                    }
                    if (!vm.allData[item]) {
                      vm.allData[item] = {}
                    }
                    vm.allData[item] = Object.assign({}, vm.allData[item], {
                      huobi_price: element.usdtPrice,
                      symbol: item
                    })
                    vm.allData[item].spread = vm.setSpread(vm.allData[item])
                    vm.dataMap.huobi[item] = Object.assign({}, vm.dataMap.huobi[item], element)
                  }
                }
              }
              vm.sortBy()
              vm.$forceUpdate()
            }
            reader.readAsBinaryString(data)
          }
        )
      },
      get_okex: function(transactionPair) {
        var vm = this
        var url = 'wss://okexcomreal.bafang.com:10441/websocket'
        var markets = ['usdt', 'btc', 'eth', 'okb']
        vm.socket(
          url,
          [
            //   实时价格
            { event: 'addChannel', parameters: { binary: '1', type: 'all_ticker_3s' } }
          ],
          'ping',
          function(data) {
            let reader = new FileReader()
            reader.onload = function() {
              var result = JSON.parse(pako.inflateRaw(reader.result, { to: 'string' }))
              if (result.data && Array.isArray(result.data)) {
                if (!vm.dataMap.okex) {
                  vm.dataMap.okex = {}
                }
                result.data.forEach(function(item) {
                  // 排除期货价格
                  if (!/^f-/.test(item.id)) {
                    item.id = item.id.replace('t-', '')
                    if (markets.indexOf(item.id.split('_')[1]) > -1) {
                      var obj = {
                        high: item.h * 1,
                        low: item.l * 1,
                        open: item.o * 1,
                        close: item.p * 1,
                        vol: item.v * 1,
                        symbol: item.id
                      }
                      if (vm.dataMap.okex[item.id] === undefined) {
                        vm.dataMap.okex[item.id] = obj
                      } else {
                        vm.dataMap.okex[item.id] = Object.assign({}, vm.dataMap.okex[item.id], obj)
                      }
                    }
                  }
                })
                // 转换成usdt价格
                if (vm.dataMap.okex.btc_usdt && vm.dataMap.okex.eth_usdt && vm.dataMap.okex.okb_usdt) {
                  var btc_usdt = vm.dataMap.okex.btc_usdt.close
                  var eth_usdt = vm.dataMap.okex.eth_usdt.close
                  var okb_usdt = vm.dataMap.okex.okb_usdt.close
                  for (const item in vm.dataMap.okex) {
                    if (vm.dataMap.okex.hasOwnProperty(item)) {
                      const element = vm.dataMap.okex[item]
                      if (item.indexOf('_usdt') > -1) {
                        element.usdtPrice = element.close
                      } else if (item.indexOf('_btc') > -1) {
                        if (item === 'btc_usdt') {
                          element.usdtPrice = element.close
                        } else {
                          element.usdtPrice = (element.close * btc_usdt).toFixed(8) * 1
                        }
                      } else if (item.indexOf('_eth') > -1) {
                        element.usdtPrice = (element.close * eth_usdt).toFixed(8) * 1
                      } else if (item.indexOf('_okb') > -1) {
                        element.usdtPrice = (element.close * okb_usdt).toFixed(8) * 1
                      }
                      if (!vm.allData[item]) {
                        vm.allData[item] = {}
                      }
                      vm.allData[item] = Object.assign({}, vm.allData[item], {
                        okex_price: element.usdtPrice,
                        symbol: item
                      })
                      vm.allData[item].spread = vm.setSpread(vm.allData[item])
                      vm.dataMap.okex[item] = Object.assign({}, vm.dataMap.okex[item], element)
                    }
                  }
                }
              }
            }
            reader.readAsBinaryString(data)
          }
        )
      },
      get_ajax_bitfinex: function() {
        var vm = this
        vm.ajax(
          'https://api-pub.bitfinex.com/v2/tickers?symbols=ALL',
          'GET',
          `
        Accept: */*
        bfx-flags: 14336
        Content-Type: application/json;charset=UTF-8
        DNT: 1
        Origin: https://www.bitfinex.com
        Referer: https://www.bitfinex.com/
        User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36
        `
        ).then(function(data) {
          var markets = ['usd', 'btc', 'eth', 'usdt']
          var ignor = ['eur', 'jpy', 'gbp', 'xlm', 'dai'].join('|')
          var reg = new RegExp('(' + ignor + ')$', 'i')
          JSON.parse(data.response).forEach(function(item) {
            item[0] = item[0].toLowerCase()
            if (/ust$/.test(item[0])) {
              item[0] = item[0].replace(/ust$/i, 'usdt')
            }
            //   过滤掉期货价格
            if (/^t/.test(item[0]) && !reg.test(item[0])) {
              item[0] = item[0].replace(/^t/, '')
              if (item[0].indexOf('ust') > -1) {
                item[0] = item[0].replace(/^ust/i, 'usdt')
              }
              if (!vm.dataMap.bitfinex) {
                vm.dataMap.bitfinex = {}
              }
              var index = -1
              markets.forEach(function(m, idx) {
                if (new RegExp(m + '$', 'i').test(item[0])) {
                  index = idx
                }
              })
              var current = markets[index]
              if (current === undefined) {
                return
              }
              item[0] = item[0].replace(new RegExp(current + '$'), '_' + current)
              item = {
                symbol: item[0],
                change: item[6],
                changeAmount: item[5],
                close: item[7],
                low: item[10],
                high: item[9]
              }
              if (vm.dataMap.bitfinex[item.symbol]) {
                vm.dataMap.bitfinex[item.symbol] = Object.assign({}, vm.dataMap.bitfinex[item.symbol], item)
              } else {
                vm.dataMap.bitfinex[item.symbol] = item
              }
            }
          })
          // 转换成usdt价格
          var btc_usdt = vm.dataMap.bitfinex.btc_usdt.close
          var eth_usdt = vm.dataMap.bitfinex.eth_usdt.close
          var usdt_usd = vm.dataMap.bitfinex.usdt_usd.close
          for (const item in vm.dataMap.bitfinex) {
            if (vm.dataMap.bitfinex.hasOwnProperty(item)) {
              const element = vm.dataMap.bitfinex[item]
              if (item.indexOf('_usdt') > -1) {
                element.usdtPrice = element.close
              } else if (item.indexOf('_btc') > -1) {
                if (item === 'btc_usdt') {
                  element.usdtPrice = element.close
                } else {
                  element.usdtPrice = (element.close * btc_usdt).toFixed(8) * 1
                }
              } else if (item.indexOf('_eth') > -1) {
                element.usdtPrice = (element.close * eth_usdt).toFixed(8) * 1
              } else if (item.indexOf('_usd') > -1) {
                element.usdtPrice = (element.close / usdt_usd).toFixed(8) * 1
              }
              if (!vm.allData[item]) {
                vm.allData[item] = {}
              }
              vm.allData[item] = Object.assign({}, vm.allData[item], {
                bitfinex_price: element.usdtPrice,
                symbol: item
              })
              vm.allData[item].spread = vm.setSpread(vm.allData[item])
              vm.dataMap.bitfinex[item] = Object.assign({}, vm.dataMap.bitfinex[item], element)
            }
          }
          setTimeout(function() {
            vm.get_ajax_bitfinex()
          }, 10000)
          vm.sortBy()
          vm.$forceUpdate()
        })
      },
      get_gateio: function(transactionPair) {
        var vm = this
        var url = 'wss://webws.gateio.live/v3/?v=' + ~Date()
        var markets = ['usdt', 'btc', 'eth', 'okb']
        vm.socket(
          url,
          [
            //   实时价格
            {
              id: 1295080,
              method: 'price.subscribe',
              params: [
                'BTC_USDT',
                'BCH_USDT',
                'ETH_USDT',
                'ETC_USDT',
                'QTUM_USDT',
                'LTC_USDT',
                'DASH_USDT',
                'ZEC_USDT',
                'BTM_USDT',
                'EOS_USDT',
                'REQ_USDT',
                'SNT_USDT',
                'OMG_USDT',
                'PAY_USDT',
                'CVC_USDT',
                'ZRX_USDT',
                'TNT_USDT',
                'XMR_USDT',
                'XRP_USDT',
                'DOGE_USDT',
                'BAT_USDT',
                'PST_USDT',
                'BTG_USDT',
                'DPY_USDT',
                'LRC_USDT',
                'STORJ_USDT',
                'RDN_USDT',
                'STX_USDT',
                'KNC_USDT',
                'LINK_USDT',
                'CDT_USDT',
                'AE_USDT',
                'RLC_USDT',
                'RCN_USDT',
                'TRX_USDT',
                'KICK_USDT',
                'VET_USDT',
                'MCO_USDT',
                'FUN_USDT',
                'DATA_USDT',
                'ZSC_USDT',
                'MDA_USDT',
                'XTZ_USDT',
                'GNT_USDT',
                'GEM_USDT',
                'RFR_USDT',
                'DADI_USDT',
                'ABT_USDT',
                'OST_USDT',
                'XLM_USDT',
                'MOBI_USDT',
                'OCN_USDT',
                'ZPT_USDT',
                'COFI_USDT',
                'JNT_USDT',
                'BLZ_USDT',
                'GXS_USDT',
                'MTN_USDT',
                'RUFF_USDT',
                'TNC_USDT',
                'ZIL_USDT',
                'BTO_USDT',
                'THETA_USDT',
                'DDD_USDT',
                'MKR_USDT',
                'DAI_USDT',
                'SMT_USDT',
                'MDT_USDT',
                'MANA_USDT',
                'LUN_USDT',
                'SALT_USDT',
                'FUEL_USDT',
                'ELF_USDT',
                'DRGN_USDT',
                'GTC_USDT',
                'QLC_USDT',
                'DBC_USDT',
                'BNTY_USDT',
                'LEND_USDT',
                'ICX_USDT',
                'BTF_USDT',
                'ADA_USDT',
                'LSK_USDT',
                'WAVES_USDT',
                'BIFI_USDT',
                'MDS_USDT',
                'DGD_USDT',
                'QASH_USDT',
                'POWR_USDT',
                'FIL_USDT',
                'BCD_USDT',
                'SBTC_USDT',
                'GOD_USDT',
                'BCX_USDT',
                'QSP_USDT',
                'INK_USDT',
                'MED_USDT',
                'BOT_USDT',
                'QBT_USDT',
                'TSL_USDT',
                'GNX_USDT',
                'NEO_USDT',
                'GAS_USDT',
                'IOTA_USDT',
                'NAS_USDT',
                'OAX_USDT',
                'BCDN_USDT',
                'SNET_USDT',
                'BTS_USDT',
                'GT_USDT',
                'ATOM_USDT',
                'XEM_USDT',
                'BU_USDT',
                'BCHSV_USDT',
                'DCR_USDT',
                'BCN_USDT',
                'XMC_USDT',
                'PPS_USDT',
                'ATP_USDT',
                'BOE_USDT',
                'NBOT_USDT',
                'MEDX_USDT',
                'GRIN_USDT',
                'BEAM_USDT',
                'BTT_USDT',
                'TFUEL_USDT',
                'CELR_USDT',
                'CS_USDT',
                'MAN_USDT',
                'REM_USDT',
                'LYM_USDT',
                'ONG_USDT',
                'ONT_USDT',
                'BFT_USDT',
                'IHT_USDT',
                'SENC_USDT',
                'TOMO_USDT',
                'ELEC_USDT',
                'HAV_USDT',
                'SWTH_USDT',
                'NKN_USDT',
                'SOUL_USDT',
                'LRN_USDT',
                'EOSDAC_USDT',
                'DOCK_USDT',
                'GSE_USDT',
                'RATING_USDT',
                'HSC_USDT',
                'HIT_USDT',
                'DX_USDT',
                'CNNS_USDT',
                'DREP_USDT',
                'MBL_USDT',
                'BKC_USDT',
                'BXC_USDT',
                'PAX_USDT',
                'USDC_USDT',
                'TUSD_USDT',
                'HC_USDT',
                'GARD_USDT',
                'FTI_USDT',
                'SOP_USDT',
                'LEMO_USDT',
                'QKC_USDT',
                'IOTX_USDT',
                'RED_USDT',
                'LBA_USDT',
                'OPEN_USDT',
                'MITH_USDT',
                'SKM_USDT',
                'XVG_USDT',
                'NANO_USDT',
                'HT_USDT',
                'BNB_USDT',
                'MET_USDT',
                'TCT_USDT',
                'MXC_USDT'
              ]
            },
            {
              id: 6204231,
              method: 'price.subscribe',
              params: [
                'USDT_CNYX',
                'BTC_CNYX',
                'ETH_CNYX',
                'EOS_CNYX',
                'BCH_CNYX',
                'XRP_CNYX',
                'DOGE_CNYX',
                'TIPS_CNYX',
                'BCHSV_CNYX',
                'PAX_CNYX',
                'USDC_CNYX',
                'TUSD_CNYX'
              ]
            },
            {
              id: 2353522,
              method: 'price.subscribe',
              params: [
                'AE_BTC',
                'XTZ_BTC',
                'LEDU_BTC',
                'XLM_BTC',
                'MOBI_BTC',
                'OCN_BTC',
                'ZPT_BTC',
                'JNT_BTC',
                'GXS_BTC',
                'RUFF_BTC',
                'TNC_BTC',
                'DDD_BTC',
                'MDT_BTC',
                'GTC_BTC',
                'QLC_BTC',
                'DBC_BTC',
                'BTF_BTC',
                'ADA_BTC',
                'LSK_BTC',
                'WAVES_BTC',
                'BIFI_BTC',
                'QASH_BTC',
                'POWR_BTC',
                'BCD_BTC',
                'SBTC_BTC',
                'GOD_BTC',
                'BCX_BTC',
                'INK_BTC',
                'NEO_BTC',
                'GAS_BTC',
                'IOTA_BTC',
                'NAS_BTC',
                'ETH_BTC',
                'ETC_BTC',
                'ZEC_BTC',
                'DASH_BTC',
                'LTC_BTC',
                'BCH_BTC',
                'BTG_BTC',
                'QTUM_BTC',
                'XRP_BTC',
                'DOGE_BTC',
                'XMR_BTC',
                'ZRX_BTC',
                'OAX_BTC',
                'LRC_BTC',
                'SNT_BTC',
                'BTM_BTC',
                'OMG_BTC',
                'PAY_BTC',
                'BAT_BTC',
                'STORJ_BTC',
                'EOS_BTC',
                'BTS_BTC',
                'GT_BTC',
                'ATOM_BTC',
                'XEM_BTC',
                'BU_BTC',
                'BCHSV_BTC',
                'DCR_BTC',
                'BCN_BTC',
                'XMC_BTC',
                'GRIN_BTC',
                'BEAM_BTC',
                'LYM_BTC',
                'HC_BTC',
                'XVG_BTC',
                'NANO_BTC',
                'MXC_BTC'
              ]
            },
            {
              id: 6664251,
              method: 'price.subscribe',
              params: [
                'AE_ETH',
                'CDT_ETH',
                'RDN_ETH',
                'STX_ETH',
                'KNC_ETH',
                'LINK_ETH',
                'REQ_ETH',
                'RCN_ETH',
                'TRX_ETH',
                'ARN_ETH',
                'KICK_ETH',
                'BNT_ETH',
                'VET_ETH',
                'MCO_ETH',
                'FUN_ETH',
                'DATA_ETH',
                'RLC_ETH',
                'ZSC_ETH',
                'WINGS_ETH',
                'MDA_ETH',
                'XTZ_ETH',
                'GNT_ETH',
                'GEM_ETH',
                'RFR_ETH',
                'DADI_ETH',
                'ABT_ETH',
                'LEDU_ETH',
                'OST_ETH',
                'XLM_ETH',
                'MOBI_ETH',
                'OCN_ETH',
                'ZPT_ETH',
                'COFI_ETH',
                'JNT_ETH',
                'BLZ_ETH',
                'MTN_ETH',
                'RUFF_ETH',
                'TNC_ETH',
                'ZIL_ETH',
                'BTO_ETH',
                'THETA_ETH',
                'DDD_ETH',
                'MKR_ETH',
                'SMT_ETH',
                'MDT_ETH',
                'MANA_ETH',
                'LUN_ETH',
                'SALT_ETH',
                'FUEL_ETH',
                'ELF_ETH',
                'DRGN_ETH',
                'GTC_ETH',
                'QLC_ETH',
                'DBC_ETH',
                'BNTY_ETH',
                'LEND_ETH',
                'ICX_ETH',
                'MDS_ETH',
                'DGD_ETH',
                'QASH_ETH',
                'POWR_ETH',
                'QSP_ETH',
                'INK_ETH',
                'MED_ETH',
                'BOT_ETH',
                'QBT_ETH',
                'GNX_ETH',
                'NAS_ETH',
                'ETC_ETH',
                'QTUM_ETH',
                'ZRX_ETH',
                'DNT_ETH',
                'DPY_ETH',
                'OAX_ETH',
                'REP_ETH',
                'LRC_ETH',
                'PST_ETH',
                'BCDN_ETH',
                'TNT_ETH',
                'SNT_ETH',
                'BTM_ETH',
                'SNET_ETH',
                'OMG_ETH',
                'PAY_ETH',
                'BAT_ETH',
                'CVC_ETH',
                'STORJ_ETH',
                'EOS_ETH',
                'TIPS_ETH',
                'XEM_ETH',
                'BU_ETH',
                'ATP_ETH',
                'BOE_ETH',
                'NBOT_ETH',
                'PLY_ETH',
                'MEDX_ETH',
                'GRIN_ETH',
                'BEAM_ETH',
                'VTHO_ETH',
                'BTT_ETH',
                'TFUEL_ETH',
                'CELR_ETH',
                'CS_ETH',
                'MAN_ETH',
                'REM_ETH',
                'LYM_ETH',
                'INSTAR_ETH',
                'ONG_ETH',
                'ONT_ETH',
                'BFT_ETH',
                'IHT_ETH',
                'SENC_ETH',
                'TOMO_ETH',
                'ELEC_ETH',
                'SHIP_ETH',
                'TFD_ETH',
                'HAV_ETH',
                'HUR_ETH',
                'LST_ETH',
                'SWTH_ETH',
                'NKN_ETH',
                'SOUL_ETH',
                'LRN_ETH',
                'EOSDAC_ETH',
                'ADD_ETH',
                'IQ_ETH',
                'MEETONE_ETH',
                'DOCK_ETH',
                'GSE_ETH',
                'RATING_ETH',
                'HSC_ETH',
                'HIT_ETH',
                'DX_ETH',
                'CNNS_ETH',
                'DREP_ETH',
                'BXC_ETH',
                'HC_ETH',
                'GARD_ETH',
                'FTI_ETH',
                'SOP_ETH',
                'LEMO_ETH',
                'EON_ETH',
                'NPXS_ETH',
                'QKC_ETH',
                'IOTX_ETH',
                'RED_ETH',
                'LBA_ETH',
                'OPEN_ETH',
                'MITH_ETH',
                'SKM_ETH',
                'NBAI_ETH',
                'UPP_ETH',
                'ATMI_ETH',
                'TMT_ETH',
                'BBK_ETH',
                'EDR_ETH',
                'MET_ETH',
                'TCT_ETH',
                'MXC_ETH'
              ]
            }
          ],
          '{"id":1295080,"method":"server.ping","params":[]}',
          function(data) {
            data = JSON.parse(data)
            if (data.params) {
              data = data.params
              var symbol = data[0].toLowerCase()
              var item = {
                symbol: data[0].toLowerCase(),
                close: data[1].price * 1
              }
              if (!vm.dataMap.gateio) {
                vm.dataMap.gateio = {}
              }
              if (vm.dataMap.gateio[symbol]) {
                vm.dataMap.gateio[symbol] = Object.assign({}, vm.dataMap.gateio[symbol], item)
              } else {
                vm.dataMap.gateio[symbol] = item
              }
              if (vm.dataMap.gateio.btc_usdt && vm.dataMap.gateio.eth_usdt && vm.dataMap.gateio.usdt_cnyx) {
                var btc_usdt = vm.dataMap.gateio.btc_usdt.close
                var eth_usdt = vm.dataMap.gateio.eth_usdt.close
                var usdt_cnyx = vm.dataMap.gateio.usdt_cnyx.close
                for (const item in vm.dataMap.gateio) {
                  if (vm.dataMap.gateio.hasOwnProperty(item)) {
                    const element = vm.dataMap.gateio[item]
                    if (item.indexOf('_usdt') > -1) {
                      element.usdtPrice = element.close
                    } else if (item.indexOf('_btc') > -1) {
                      if (item === 'btc_usdt') {
                        element.usdtPrice = element.close
                      } else {
                        element.usdtPrice = (element.close * btc_usdt).toFixed(8) * 1
                      }
                    } else if (item.indexOf('_eth') > -1) {
                      element.usdtPrice = (element.close * eth_usdt).toFixed(8) * 1
                    } else if (item.indexOf('_cnyx') > -1) {
                      if (item === 'btc_usdt') {
                        element.usdtPrice = element.close
                      } else {
                        element.usdtPrice = (element.close / usdt_cnyx).toFixed(8) * 1
                      }
                    }
                    if (!vm.allData[item]) {
                      vm.allData[item] = {}
                    }
                    vm.allData[item] = Object.assign({}, vm.allData[item], {
                      gateio_price: element.usdtPrice,
                      symbol: item
                    })
                    vm.allData[item].spread = vm.setSpread(vm.allData[item])
                    vm.dataMap.gateio[item] = Object.assign({}, vm.dataMap.gateio[item], element)
                  }
                }
              }
              vm.sortBy()
              vm.$forceUpdate()
            }
          }
        )
      }
    }
  })

  function formatHeaders(str) {
    var obj = {}
    if (str && str.trim()) {
      var list = str
        .trim()
        .split(/\n/g)
        .filter(function(item) {
          return item.trim() !== ''
        })
        .map(function(item) {
          var v = item.trim().match(/(^\S+)\s*:\s*([\S\s]+$)/)
          obj[v[1]] = v[2]
        })
    }
    return obj
  }
  if (Array.prototype.min === undefined) {
    Array.prototype.min = function() {
      var min = this[0]
      var len = this.length
      for (var i = 1; i < len; i++) {
        if (this[i] < min) {
          min = this[i]
        }
      }
      return min
    }
    //最大值
    Array.prototype.max = function() {
      var max = this[0]
      var len = this.length
      for (var i = 1; i < len; i++) {
        if (this[i] > max) {
          max = this[i]
        }
      }
      return max
    }
  }

  String.prototype.myFixed = function(precision, isTrimEndZero) {
    return (this * 1).myFixed(precision, isTrimEndZero)
  }
  Number.prototype.toFixedNo = function(fixed, opt) {
    var obj = {
      rounding: false, // rounding 默认false,禁止四舍五入
      wipeZero: true //自动抹零 0.00100 => 0.001
    }
    if (opt && typeof opt == 'object') {
      obj = Object.assign({}, obj, opt)
    }
    var tmpStr = '0'.repeat(60)
    var num = this
    // 如果fixed不是数字，直接返回
    if (isNaN(fixed) || isNaN(num)) {
      return num.toString()
    } else {
      // 默认保留小数
      if (obj.rounding) {
        return Number(num).toFixed(fixed)
      }

      var numStr = num.toString()

      // 判断是否带小数点 .123/123.123/123.
      var dotPosition = numStr.indexOf('.')
      var ePosition = numStr.indexOf('e')

      if (ePosition > 0) {
        //1e10,1e-10
        var subPosition = numStr.indexOf('-')
        // 1e-10
        if (subPosition > 1) {
          // 4.800000000000001e-7
          var first = numStr.split('e')[0]
          var last = numStr.split('-')[1]
          var subDot = first.indexOf('.')
          if (fixed == 0) {
            return '0'
          }
          // 4.800000000000001
          if (subDot > -1) {
            // 4
            var subFirst = first.split('.')[0]
            // 800000000000001
            var subLast = first.split('.')[1]

            // 0000004
            subFirst = tmpStr + subFirst
            // 0000004800000000000001
            subFirst = subFirst.substr(0 - Number(last), Number(last)) + subLast
            // 0.000000480
            subFirst = '0.' + subFirst.substr(0, fixed)
            return subFirst
          } else {
            // 1e-8
            // 00000001
            var newLast = (tmpStr + first).substr(0 - Number(last), Number(last))
            newLast = (newLast + tmpStr).substr(0, fixed)
            newLast = '0.' + newLast
            return newLast
          }
        } else {
          // 4.800000000000001e+7
          // 4.800000000000001
          first = numStr.split('e')[0]

          // 7
          last = numStr.split('+')[1]
          subDot = first.indexOf('.')
          if (subDot > -1) {
            // 4.800000000000001
            // 4
            subFirst = first.split('.')[0]
            // 800000000000001
            subLast = first.split('.')[0]
            var newFirst = subFirst + (subLast + tmpStr).substr(0, last)
            newLast = (subLast + tmpStr).substr(last, fixed)
            if (fixed == 0) {
              return newFirst
            }
            return newFirst + '.' + newLast
          } else {
            //123e+10
            newFirst = first + tmpStr.substr(0, last)
            newLast = tmpStr.substr(0, fixed)
            if (fixed == 0) {
              return newFirst
            }

            return newFirst + '.' + newLast
          }
        }
      } else if (dotPosition > -1) {
        // .123
        if (dotPosition == 0) {
          if (fixed == 0) {
            return '0'
          }
          numStr = ('0' + numStr + tmpStr).substr(0, fixed)
          return numStr
        } else if (dotPosition == numStr.length - 1) {
          // 123.
          if (fixed == 0) {
            return numStr.substr('.')[0]
          }
          numStr = (numStr + tmpStr).substr(0, fixed)
          return numStr
        } else {
          //123.123
          first = numStr.split('.')[0]
          last = numStr.split('.')[1]
          if (fixed == 0) {
            return first
          }
          return first + '.' + (last + tmpStr).substr(0, fixed)
        }
      } else {
        if (fixed == 0) {
          return numStr
        }
        return numStr + '.' + tmpStr.substr(0, fixed)
      }
    }
  }
  Number.prototype.myFixed = function(precision, isTrimEndZero) {
    var count = precision || 0
    var isTrim = isTrimEndZero || false
    var numStr = this.toString()
    if (isNaN(numStr)) {
      return numStr
    }
    var backStrNum = numStr
    // var zeroStr = '0'.repeat(60);
    // 判断是否有科学计数法e
    if (has(numStr, 'e')) {
      // 判断是e后面是-还是+
      // 获取e 前面的数字
      var digital = numStr.split('e')[0]
      // 获取幂次数
      var power = numStr.split(/e[-\+]*/)[1]
      //判断数字中是否有小数点
      if (has(digital, '.')) {
        power = power * 1 - 1
        digital = digital.replace('.', '')
      }
      if (has(numStr, '-')) {
        // 可能出现的小数
        // 1e-8,1.1e-8,4.1000000001e-7,11.1e-10
        // 在数字前拼接0占位符
        var newStr = '0'.repeat(power) + digital
        if (count <= newStr.length) {
          if (precision === undefined) {
            backStrNum = newStr.substr(0, power + digital.length)
          } else {
            backStrNum = newStr.substr(0, count)
            // 处理四舍五入问题
            var lastNum = newStr.substr(count, 1)
            if (lastNum !== '' && lastNum > 4) {
              var backLast = backStrNum.substr(backStrNum.length - 1, backStrNum.length)
              if (backLast !== '0') {
                backLast = backLast * 1 + 1
                backStrNum = backStrNum.replace(/\d$/, backLast)
              }
            }
          }
        } else {
          backStrNum = newStr + '0'.repeat(count - newStr.length)
        }
        // 可能会截取到000+
        // if (backStrNum==='0'.repeat(backStrNum.length)) {
        //     backStrNum = '0';
        // }else{
        if (backStrNum === '') {
          backStrNum = '0'
        } else {
          backStrNum = '0.' + backStrNum
        }
        // }
      } else {
        // 1e+50,1e50,1.1e50
        backStrNum = digital + '0'.repeat(power)
        if (count > 0) {
          backStrNum += '.' + '0'.repeat(count)
        }
      }
    } else {
      if (has(numStr, '.')) {
        var Integer = numStr.split('.')[0]
        var Decimal = numStr.split('.')[1]
        if (count > 0) {
          if (Decimal.length <= count) {
            Decimal += '0'.repeat(count - Decimal.length)
          } else {
            if (Decimal.substr(count, 1) > 4) {
              Decimal = Decimal.substr(0, count - 1) + (Decimal.substr(count - 1, 1) * 1 + 1)
            } else {
              Decimal = Decimal.substr(0, count)
            }
          }
          backStrNum = Integer + '.' + Decimal
        } else {
          if (precision !== undefined) {
            if (Decimal.substr(0, 1) > 4) {
              backStrNum = Integer.substr(0, Integer.length - 1) + (Integer.substr(Integer.length - 1, 1) * 1 + 1)
            } else {
              backStrNum = Integer
            }
          } else {
            backStrNum = numStr
          }
        }
      } else {
        if (count > 0 && !isTrim) {
          backStrNum += '.' + '0'.repeat(count)
        }
      }
    }

    function has(str, tag) {
      return str.indexOf(tag) > -1
    }
    if (isTrim && has(backStrNum, '.')) {
      backStrNum = backStrNum.replace(/\.?0*$/, '')
    }
    return backStrNum
  }
  String.prototype.numFormat = function(precision, isTrimEndZero) {
    if (this.trim() === '' || isNaN(this)) {
      return this
    }
    var num = this.myFixed(precision, isTrimEndZero)
    // if (num.indexOf('.') > -1) {
    //     num = (num.split('.')[0] * 1).toLocaleString() + '.' + num.split('.')[1];
    // } else {
    //     num = (num * 1).toLocaleString();
    // }
    return num
  }
  Number.prototype.numFormat = function(precision, isTrimEndZero) {
    // 12345678901234.123456 只能显示到12345678901234.123
    return this.toString().numFormat(precision, isTrimEndZero)
  }
})()
