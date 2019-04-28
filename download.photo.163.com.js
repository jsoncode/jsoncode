/**
 * @auther Chris
 * @github github.com/jsoncode
 * 
 * 单线程全量下载 网易相册照片 工具
 * 会保留原有照片的exif信息（相机品牌，型号，光圈，曝光度，等信息）
 * 保存的目录结构为：/photo/相册id/相册id-照片id.jpg
 * 
 * 执行方法（小白专用，大神跳过）：
 * 
 * 1，安装nodejs:
 * 		node 官网：https://nodejs.org/
 * 		下载地址：https://nodejs.org/dist/v10.15.3/node-v10.15.3-x64.msi
 * 2，使用npm安装依赖包： piexifjs single-line-log
 * 		npm install -g cnpm --registry=https://registry.npm.taobao.org
 * 		cnpm install piexifjs
 * 		...
 * 3，配置cookies
 *  	只需要一个NTES_SESS
 *  	打开控制台，找到http://photo.163.com下的cookie，进行搜索NTES_SESS
 * 4，在cmd命令行执行：node download.photo.163.com.js 就可以开始下载了。
 */
// 需要的依赖包
const fs = require('fs');
const http = require('http');
const https = require('https');
const URL = require('url');
const zlib = require('zlib');
const piexif = require("piexifjs");
const slog = require('single-line-log').stdout;

// 需要配置的信息
var userInfo = {
	name:'',
	cookie_NTES_SESS:'',//
	photoDir:'./photo/',//你要保存相片的目录
};


// 照片需要的服务器地址
var urlType = {
	'0':'http://img1.ph.126.net',
	'1':'http://img1.bimg.126.net',
	'2':'http://img2.ph.126.net',
};




// 请求过程中缓存的cookie
var cookies = {};
// 照片总数
var allPhotoCount = 0;
// 已下载数量
var loadCount = 0;
// 相册总数
var photoGroupList = [];
// 某一个相册中的照片数量
var photoList = [];
// 下载进度
var pb = new ProgressBar('下载进度', 50);
// 打开首页
backAjax(`http://photo.163.com/${userInfo.name}/#m=0&p=1`,{
	headers:'Content-Encoding: gzip',
	success:function (data) {
		var jsFile = data.match(/<script type="text\/javascript">\s*UD\s*=[\s\S]+?albumUrl\s*:\s*['"]([^'"]+)?['"]/);
		if (jsFile) {
			jsFile = jsFile[1];
			getPhotoGroup(jsFile);
		}else{
			console.log('没有找到相册列表，可能你的配置链接错误');
		}
	},
	error:function(err){
		console.log('首页打开失败:'+err)
	},
})

function getPhotoGroup(jsFile){
	// 获取相册列表
	backAjax(jsFile,{
		headers:'Content-Encoding: gzip',
		success:function (data) {
			var result = data.match(/(['"][\s\S]+?['"]|\[[^\]]+\]);/g);
			if (result) {
				result = result.map(function(item){
					return item.replace(/var\s[\w\$]+\s*=\s*|;$/g,'');
				});
				var idList = result[0].replace(/'|;'/g,'').split(';');
				var list = JSON.parse(result[1].replace(/\'/g,'"').replace(/(\w+):([^,\]\}]+)/g,'"$1":$2'));
				photoGroupList = list.sort(function(v1,v2){return v1.t-v2.t>0?1:-1});
				allPhotoCount = eval(photoGroupList.map(function (item) {
					return item.count;
				}).join('+'));
				getOneGroup(0)
			}else{
				console.log('相册为空，没有要下载的照片')
			}
		},
		error:function(err){
			console.log('获取相册列表失败:'+err)
		},
	})
}
function getOneGroup(groupIndex){
	var oneGroup= photoGroupList[groupIndex];
	// 获取某一个相册的照片列表
	var data =[
		'callCount=1',
		'scriptSessionId=${scriptSessionId}187',
		'c0-scriptName=AlbumBean',
		'c0-methodName=getAlbumData',
		'c0-id=0',
		`c0-param0=string:${oneGroup.id}`,
		'c0-param1=string:',
		'c0-param2=string:',
		`c0-param3=number:${oneGroup.dmt}`,
		'c0-param4=boolean:false',
		'batchId=694780'
	].join('&');
	// 每次请求一个相册，就会得到一个ALBUMAPPID的cookie
	backAjax(`http://photo.163.com/photo/${userInfo.name}/dwr/call/plaincall/AlbumBean.getAlbumData.dwr?u=${userInfo.name}`,{
		method:'POST',
		headers:`
			Accept-Encoding: gzip, deflate
			Content-Length: ${data.length}
			Content-Type: text/plain
			Cookie: NTES_SESS=${userInfo.cookie_NTES_SESS}
			Host: photo.163.com
			Origin: http://photo.163.com
			Referer: http://photo.163.com/${userInfo.name}/
			User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36
		`,
		data:data,
		success:function (data,headers) {
			// dwr.engine._remoteHandleCallback('694780','0',"s1.ph.126.net/bxjmSf2dkYbu3u5ZSDXsbw==/29686815861856.js");
			var url = data.match(/['"]([^"']+)['"]\)/);
			if (url) {
				url = 'http://'+url[1];
				backAjax(url,{
					success:function (data) {
						var list = data.match(/(\[[^\]]+\])/);
						if (list) {
							list = list[0].replace(/\'/g,'"').replace(/(\w+):([^,\]\}]+)/g,'"$1":$2');
							photoList = JSON.parse(list).sort(function(v1,v2){return v1.t-v2.t>0?1:-1});
							downloadPhoto(groupIndex,0,0)
						}else{
							console.log('未请求到照片列表，可能cookie已失效')
						}
					},
					error:function(err){
						console.log('照片列表获取失败',err);
					},
				})
			}else{
				console.log('未获取到照片列表，可能cookie已失效')
			}
		},
		error:function (err) {
			console.log('获取相册详细信息 失败：',err)
		}
	})
}
function downloadPhoto(groupIndex,photoIndex,typeNum){
	var oneGroup = photoGroupList[groupIndex];
	var photo = photoList[photoIndex];
	typeNum= typeNum===undefined?0:typeNum;
	photoUrl = urlType[typeNum] + photo.ourl.replace(/^\w/,'');
	var photoName = oneGroup.id+'-'+photo.id+'-'+photo.ourl.replace(/[\w=-]+\//g,'');
	if (photo.t1===0) {
		// 没有exif信息
		backAjax(photoUrl,{
			success:function (data) {
				downloadImg(photoName,data);
				nextRequest();
			},
			error:function(err){
				console.log('图片下载失败 重新尝试',photo.id);
				if (typeNum<2) {
					typeNum++;
					downloadPhoto(groupIndex,photoIndex,typeNum);
				}else{
					nextRequest();
				}
			},
		});
	}else{
		// 原图
		// http://img1.ph.126.net/${ourl}
		// 获取exif信息
		var data = [
			'callCount=1',
			'scriptSessionId=${scriptSessionId}187',
			'c0-scriptName=PhotoBean',
			'c0-methodName=getPhotoExif',
			'c0-id=0',
			`c0-param0=string:${photo.id}`,
			'batchId=346923',
		].join('&');
		var exifUrl = `http://photo.163.com/photo/${userInfo.name}/dwr/call/plaincall/PhotoBean.getPhotoExif.dwr`;
		backAjax(exifUrl,{
			method:'POST',
			headers:`
				Accept: */*
				Accept-Encoding: gzip, deflate
				Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7,ja;q=0.6,und;q=0.5
				Connection: keep-alive
				Content-Length: 151
				Content-Type: text/plain
				Cookie: NTES_SESS=${userInfo.cookie_NTES_SESS};ALBUMAPPID=${cookies.ALBUMAPPID}
				DNT: 1
				Host: photo.163.com
				Origin: http://photo.163.com
				Referer: http://photo.163.com/${userInfo.name}/
				User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36
			`,
			data:data,
			success:function (data) {
				var exif = data.match(/(\{[^\}]+\})/);
				if (exif) {
					exif = exif[0].replace(/\'/g,'"').replace(/(\w+):([^,\]\}]+)/g,'"$1":$2');
					exif = JSON.parse(exif);
					exif.photoName = photoName;

					backAjax(photoUrl,{
						success:function (data) {
							writeInExifAndSave(data,exif);
							nextRequest();
						},
						error:function(err){
							console.log('图片下载失败 重新尝试',photo.id)
							if (typeNum<2) {
								typeNum++;
								downloadPhoto(groupIndex,photoIndex,typeNum);
							}else{
								nextRequest();
							}
						},
					})
				}
			},
			error:function (err) {
				console.log('exif信息获取失败',err)
			}
		})
	}


	function nextRequest(){
		if (photoIndex<photoList.length-1) {
			loadCount++;
			photoIndex++;
			downloadPhoto(groupIndex,photoIndex,0);
			pb.render({ completed: loadCount+1, total: allPhotoCount});
		}else{
			if (groupIndex<photoGroupList.length-1) {
				groupIndex++;
				console.log('继续下载下一个相册',photoGroupList.length,groupIndex);
				getOneGroup(groupIndex);
			}else{
				pb.render({ completed: allPhotoCount, total: allPhotoCount});
			}
		}
	}
}



function backAjax(url,options) {
    var urlObj = URL.parse(url);
    options = options||{};
    var opt = {
        hostname: urlObj.hostname,
        port: urlObj.port || urlObj.protocol==='https:'&&443 ||80,
        path: urlObj.path || '/',
        method: options.method || 'GET',
        headers: formatHeaders(options.headers),
        success: options.success,
        error: options.error,
    }
    var requestData = options.data||'';
    if (requestData) {
        // 提交数据时,必须设置length,否则服务器503
        opt.headers['Content-Length']=requestData.length;
    }
    var httpOrHttps = {
        http:http,
        https:https,
    }
    var requestObj = httpOrHttps[urlObj.protocol.replace(':','')];
    var req = requestObj.request(opt, function(response) {
        if (response.statusCode === 200) {
            var html = [];
            response.on('data', function(data) {
                html.push(data);
            });
            response.on('end', function() {
                if (response.headers['set-cookie']) {
                    // 保存cookie
                    response.headers['set-cookie'].forEach(function (item) {
                        var result = item.split(/;/)[0].split('=');
                        cookies[result[0]] = result[1];
                    });
                }
                if (response.headers['content-encoding']==='gzip') {
                    var buffer = Buffer.concat(html);
                    zlib.gunzip(buffer, function(err, decoded) {
                        var data = decoded.toString();
                        opt.success(data,response.headers);
                    })
                } else {
                    if (response.headers['content-type'].indexOf('image/')>-1) {
                        var buffer = Buffer.concat(html);
                        opt.success(buffer,response.headers);
                    }else{
                        opt.success(html.join(''),response.headers);
                    }
                }
            })
        } else {
            opt.error(JSON.stringify(response.headers));
        }
    });
    req.on('error', function(e) {
        opt.error(e.message);
    });
    req.write(requestData);
    req.end();
}

function formatCookies(){
	var obj = {
		mobileadbannercookiekey:'',
		NTES_SESS:'',//http only 
		S_INFO:'',
		P_INFO:'',
		NETEASE_AUTH_USERNAME:'',
		ALBUMAPPID:'',
		NETEASE_AUTH_SOURCE:'',
	};
}


function formatHeaders(str) {
    var obj = {};
    if (str && str.trim()) {
        var list = str.trim().split(/\n/g).map(function(item) {
            var v = item.trim().match(/(^\S+)\s*:\s*([\S\s]+$)/);
            obj[v[1]] = v[2];
        });
    }
    return obj;
}


function downloadImg(filename,data){
// 判断文件目录是否存在
	if (!fs.existsSync(userInfo.photoDir)) {
        fs.mkdirSync(userInfo.photoDir);
    }
    var result = filename.split('-')[0];

	if (!fs.existsSync(userInfo.photoDir+result)) {
        fs.mkdirSync(userInfo.photoDir+result);
    }
    var path = userInfo.photoDir+result+'/'+filename.replace(result+'-','');
	fs.writeFileSync(path, data);
}



function writeInExifAndSave(data,exifInfo){

	var data = data.toString("binary");
	var zeroth = {};
	var exif = {};
	var gps = {};

	zeroth[piexif.ImageIFD.Make] = exifInfo.make;//工具,相机品牌
	// zeroth[piexif.ImageIFD.XResolution] = [777, 1];
	// zeroth[piexif.ImageIFD.YResolution] = [777, 1];
	zeroth[piexif.ImageIFD.Software] = exifInfo.model;//软件版本号,型号
	zeroth[piexif.ImageIFD.Orientation] = exifInfo.orientation;//拍摄方向
	// 1999:99:99 99:99:99
	exif[piexif.ExifIFD.DateTimeOriginal] = exifInfo.dateTime.replace(/\//g,':');//创建时间
	// exif[piexif.ExifIFD.LensMake] = "SONY";
	// exif[piexif.ExifIFD.Sharpness] = 777;
	// exif[piexif.ExifIFD.LensSpecification] = [[1, 1], [1, 1], [1, 1], [1, 1]];
	exif[piexif.ExifIFD.ApertureValue] = exifInfo.apertureValue;//镜头光圈
	exif[piexif.ExifIFD.MaxApertureValue] = exifInfo.maxApertureValue;//最大光圈
	exif[piexif.ExifIFD.ISOSpeedRatings] = exifInfo.isoSpeedRatings*1;//感光度
	exif[piexif.ExifIFD.FocalLength] = exifInfo.focalLength;//焦距
	exif[piexif.ExifIFD.ExposureTime] = exifInfo.exposureTime;//曝光时间
	exif[piexif.ExifIFD.ExposureBiasValue] = exifInfo.exposureBiasValue;//曝光补偿

	// gps[piexif.GPSIFD.GPSVersionID] = [7, 7, 7, 7];
	// gps[piexif.GPSIFD.GPSDateStamp] = "1999:99:99 99:99:99";


	var exifObj = {"0th":zeroth, "Exif":exif, "GPS":gps};
	var exifbytes = piexif.dump(exifObj);

	var newData = piexif.insert(exifbytes, data);
	var newJpeg = Buffer.from(newData, "binary");
	downloadImg(exifInfo.photoName,newJpeg)
}


// 封装的 ProgressBar 工具
function ProgressBar(description, bar_length){
 // 两个基本参数(属性)
 this.description = description || 'Progress';    // 命令行开头的文字信息
 this.length = bar_length || 25;           // 进度条的长度(单位：字符)，默认设为 25

 // 刷新进度条图案、文字的方法
 this.render = function (opts){
  var percent = (opts.completed / opts.total).toFixed(4);  // 计算进度(子任务的 完成数 除以 总数)
  var cell_num = Math.floor(percent * this.length);       // 计算需要多少个 █ 符号来拼凑图案

  // 拼接黑色条
  var cell = '';
  for (var i=0;i<cell_num;i++) {
   cell += '█';
  }

  // 拼接灰色条
  var empty = '';
  for (var i=0;i<this.length-cell_num;i++) {
   empty += '░';
  }

  // 拼接最终文本
  var cmdText = this.description + ': ' + (100*percent).toFixed(2) + '% ' + cell + empty + ' ' + opts.completed + '/' + opts.total;
  
  // 在单行输出文本
  slog(cmdText);
 };
}