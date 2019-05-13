// ==UserScript==
// @name         交易所价差
// @namespace    https://www.xx.com/
// @version      0.1
// @description  不同交易所之间的价格对比
// @author       jsoncode
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
  if (!document.getElementById('my-panel')) {
    var div = document.createElement('div')
    div.id = 'my-panel'
    div.className = 'my-panel'
    document.body.appendChild(div)
    div.innerHTML = `
         		<style>
  				.my-panel{font-size:14px;overflow:auto;position:fixed;z-index:5;left:0;top:50%;transform:translateY(-50%);width:100%;height:100%;background:#232C37;color:#fff;padding:2rem;}
  				.my-panel #msg-content,
  				.my-panel table{width:1000px;margin:0 auto;margin-top:2rem;}
  				.my-panel table th,
  				.my-panel table td{padding:.3rem;width:100px;text-align:left;}
  				.my-panel table td.green{color:#77DE78;}
  				.my-panel table td.red{color:#D5534F;}
  				.my-panel table td a{color:#fff;}
  				.my-panel table th[data-price_type]{cursor:pointer;}
         		</style>
         		<div id="msg-content">
  				Loading...
         		</div>
          `
  }
  var app = new Vue({
    el: '#my-panel',
    data: {
      socketMap: {},
      dataMap: {}
    },
    mounted: function() {
      var vm = this
      //   vm.get_bitcome()
      //   vm.get_bitcoinvn()
      //   vm.get_huobi()
      //   vm.get_okex()
    },
    methods: {
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
                ws.send(JSON.stringify(item))
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
        } catch (error) {
          console.log(error)
        }
      },
      get_bitcoinvn: function(rransactionPair) {
        var vm = this
        var url = 'wss://www.bitcoinvn.cloud/socket/v2'
        vm.socket(
          url,
          [
            { event: 'subscribe', channel: 'sub_market_quotation' }
            // { symbol: rransactionPair, event: 'subscribe', channel: 'sub_depth', limit: 200 },
            // { symbol: rransactionPair, event: 'subscribe', channel: 'sub_trades' }
          ],
          null,
          function(data) {
            var data = JSON.parse(data)
            if (!vm.dataMap.bitcoinvn) {
              vm.dataMap.bitcoinvn = {}
            }
            if (data.data) {
              for (const item in data.data) {
                if (data.data.hasOwnProperty(item)) {
                  const str = data.data[item]
                  var element = str.split(',')
                  vm.dataMap.bitcoinvn[item] = {
                    vol: element[0] * 1,
                    close: element[1] * 1,
                    high: element[2] * 1,
                    low: element[3] * 1,
                    change: element[4] * 1,
                    symbol: item
                  }
                }
              }

              var btc_usdt = vm.dataMap.bitcoinvn.btc_usdt.close
              var eth_usdt = vm.dataMap.bitcoinvn.eth_usdt.close
              var usdt_vnd = vm.dataMap.bitcoinvn.usdt_vnd.close
              for (const item in vm.dataMap.bitcoinvn) {
                if (vm.dataMap.bitcoinvn.hasOwnProperty(item)) {
                  const element = vm.dataMap.bitcoinvn[item]
                  if (item.indexOf('_usdt') > -1) {
                    element.usdtPrice = element.close
                  } else if (item.indexOf('_btc') > -1) {
                    if (item === 'btc_usdt') {
                      element.usdtPrice = element.close
                    } else {
                      element.usdtPrice = (element.close * btc_usdt).toFixed(8) * 1
                    }
                  } else if (item.indexOf('_vnd') > -1) {
                    if (item === 'usdt_vnd') {
                      element.usdtPrice = element.close
                    } else {
                      element.usdtPrice = (element.close / usdt_vnd).toFixed(8) * 1
                    }
                  } else if (item.indexOf('_eth') > -1) {
                    element.usdtPrice = (element.close * eth_usdt).toFixed(8) * 1
                  }
                  vm.dataMap.bitcoinvn[item] = Object.assign({}, vm.dataMap.bitcoinvn[item], element)
                }
              }

              console.log(vm.dataMap.bitcoinvn)
            }
          }
        )
      },

      get_bitcome: function(rransactionPair) {
        var vm = this
        var url = 'wss://www.bitcome.com/socket/v2'
        vm.socket(
          url,
          [
            { event: 'subscribe', channel: 'sub_market_quotation' }
            // { symbol: rransactionPair, event: 'subscribe', channel: 'sub_depth', limit: 200 },
            // { symbol: rransactionPair, event: 'subscribe', channel: 'sub_trades' }
          ],
          null,
          function(data) {
            var data = JSON.parse(data)
            if (!vm.dataMap.bitcome) {
              vm.dataMap.bitcome = {}
            }
            if (data.data) {
              for (const item in data.data) {
                if (data.data.hasOwnProperty(item)) {
                  const str = data.data[item]
                  var element = str.split(',')
                  vm.dataMap.bitcome[item] = {
                    vol: element[0] * 1,
                    close: element[1] * 1,
                    high: element[2] * 1,
                    low: element[3] * 1,
                    change: element[4] * 1,
                    symbol: item
                  }
                }
              }

              var btc_usdt = vm.dataMap.bitcome.btc_usdt.close
              var eth_usdt = vm.dataMap.bitcome.eth_usdt.close
              for (const item in vm.dataMap.bitcome) {
                if (vm.dataMap.bitcome.hasOwnProperty(item)) {
                  const element = vm.dataMap.bitcome[item]
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
                  }
                  vm.dataMap.bitcome[item] = Object.assign({}, vm.dataMap.bitcome[item], element)
                }
              }

              console.log(vm.dataMap.bitcome)
            }
          }
        )
      },
      get_huobi: function(rransactionPair) {
        var vm = this
        var url = 'wss://api.huobi.br.com/ws'
        var markets = ['usdt', 'husd', 'btc', 'eth', 'ht']
        vm.socket(
          url,
          [
            //   实时价格
            { sub: 'market.overview' }
            //   指定货币对的订单本
            // {
            //   sub: 'market.ontbtc.depth.step0',
            //   symbol: rransactionPair.replace('_', ''),
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
                  var index = 0
                  markets.forEach(function(m, idx) {
                    if (new RegExp(m + '$').test(item.symbol)) {
                      index = idx
                    }
                  })
                  var current = markets[index]
                  item.symbol = item.symbol.replace(current, '_' + current)
                  if (markets.indexOf(item.symbol.split('_')[1]) > -1) {
                    if (vm.dataMap.huobi[item.symbol] === undefined) {
                      vm.dataMap.huobi[item.symbol] = item
                    } else {
                      vm.dataMap.huobi[item.symbol] = Object.assign({}, vm.dataMap.huobi[item.symbol], item)
                    }
                  }
                })
                // 转换成usdt价格
                var btc_usdt = vm.dataMap.huobi.btc_usdt.close
                var usdt_husd = vm.dataMap.huobi.usdt_husd.close
                var eth_usdt = vm.dataMap.huobi.eth_usdt.close
                var ht_usdt = vm.dataMap.huobi.ht_usdt.close
                // console.log(btc_usdt, usdt_husd, eth_usdt, ht_usdt)
                for (const item in vm.dataMap.huobi) {
                  if (vm.dataMap.huobi.hasOwnProperty(item)) {
                    const element = vm.dataMap.huobi[item]
                    if (item.indexOf('_usdt') > -1) {
                      element.usdtPrice = element.close
                    } else if (item.indexOf('_btc') > -1) {
                      if (item === 'btc_usdt') {
                        element.usdtPrice = element.close
                      } else {
                        element.usdtPrice = (element.close * btc_usdt).toFixed(8) * 1
                      }
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
                    vm.dataMap.huobi[item] = Object.assign({}, vm.dataMap.huobi[item], element)
                  }
                }
              }
            }
            reader.readAsBinaryString(data)
          }
        )
      },
      get_okex: function(rransactionPair) {
        var vm = this
        var url = 'wss://okexcomreal.bafang.com:10441/websocket'
        // var url = 'wss://real.okex.com:10442/ws/v3'
        var markets = ['usdt', 'btc', 'eth', 'okb']
        vm.socket(
          url,
          [
            //   实时价格
            { event: 'addChannel', parameters: { binary: '1', type: 'all_ticker_3s' } }
            //   指定货币对的订单本
            // {
            //   sub: 'market.ontbtc.depth.step0',
            //   symbol: rransactionPair.replace('_', ''),
            //   pick: ['bids.29', 'asks.29'],
            //   step: 'step0'
            // }
          ],
          'ping',
          //   JSON.stringify({ event: 'ping' }),
          function(data) {
            let reader = new FileReader()
            reader.onload = function() {
              var result = JSON.parse(pako.inflateRaw(reader.result, { to: 'string' }))
              if (result.data && Array.isArray(result.data)) {
                if (!vm.dataMap.okex) {
                  vm.dataMap.okex = {}
                }
                // console.log(result.data)
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
                var btc_usdt = vm.dataMap.okex.btc_usdt.close
                var eth_usdt = vm.dataMap.okex.eth_usdt.close
                var okb_usdt = vm.dataMap.okex.okb_usdt.close
                // console.log(btc_usdt, usdt_husd, eth_usdt, ht_usdt)
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
                    vm.dataMap.okex[item] = Object.assign({}, vm.dataMap.okex[item], element)
                  }
                }
                console.log(vm.dataMap.okex)
              }
            }
            reader.readAsBinaryString(data)
          }
        )
      }
    }
  })
  
})()
