const fs = require('fs');
const http = require('http');
const https = require('https');
const URL = require('url');
const zlib = require('zlib');
const piexif = require("piexifjs");


// 单线程全量下载网易相册照片，并保存原有照片的exif信息
//下面2个地方需要配置groupInfoCookie和userInfo.name
//直接在控制台执行命令：node download.photo.163.com.js 就可以执行了


// 相册列表页面 http://photo.163.com/xxx/#m=1&aid=xxx&p=1  接口AlbumBean.getAlbumData.dwr 的请求cookie，贴到这里
var groupInfoCookie = `xxxxxxxxxxxxxxxx`;
var userInfo = {
	name:'xxx',//把这里替换成你的网易账号名称 xxx@163.com
	photoDir:'./photo/'
};






var urlType = {
	'0':'http://img1.ph.126.net',
	'1':'http://img1.bimg.126.net',
	'2':'http://img2.ph.126.net',
};
var cookies = {};


// 打开首页
backAjax(`http://photo.163.com/${userInfo.name}/#m=0&p=1`,{
	headers:'Content-Encoding: gzip',
	success:function (data) {
		var jsFile = data.match(/<script type="text\/javascript">\s*UD\s*=[\s\S]+?albumUrl\s*:\s*['"]([^'"]+)?['"]/);
		if (jsFile) {
			jsFile = jsFile[1];
			// 获取相册列表
			backAjax(jsFile,{
				success:function (data) {
					var result = data.match(/(['"][\s\S]+?['"]|\[[^\]]+\]);/g);
					if (result) {
						result = result.map(function(item){
							return item.replace(/var\s[\w\$]+\s*=\s*|;$/g,'');
						});
						var idList = result[0].replace(/'|;'/g,'').split(';');
						var photoGroupList = JSON.parse(result[1].replace(/\'/g,'"').replace(/(\w+):([^,\]\}]+)/g,'"$1":$2'));

						photoGroupList = photoGroupList.sort(function(v1,v2){return v1.t-v2.t>0?1:-1});


						var allPhotoCount = photoGroupList.map(function (item) {
							return item.count;
						}).join('+');
						allPhotoCount = eval(allPhotoCount);
						console.log('相片总数：',allPhotoCount)
						var loadCount = 0;

						getOneGroup(0)

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
									Cookie: ${groupInfoCookie}
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
												var photoList = data.match(/(\[[^\]]+\])/);
												if (photoList) {
													photoList = photoList[0].replace(/\'/g,'"').replace(/(\w+):([^,\]\}]+)/g,'"$1":$2');
													photoList = JSON.parse(photoList).sort(function(v1,v2){return v1.t-v2.t>0?1:-1});
													downloadPhoto(0,0)
												}

												function downloadPhoto(photoIndex,typeNum){
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
																	downloadPhoto(photoIndex,typeNum);
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
																Cookie: ${groupInfoCookie.replace(/ALBUMAPPID=([^;]+);/,cookies.ALBUMAPPID).replace('; _gat=1','')}
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
																				downloadPhoto(photoIndex,typeNum);
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
															downloadPhoto(photoIndex,0);
															console.log('相册：',photoGroupList.length+1,'/',groupIndex+1,'本相册照片数量：',photoList.length,'/',photoIndex+1,' 总进度：'+(loadCount/allPhotoCount*100).toFixed(2)+'%')
														}else{
															if (groupIndex<photoGroupList.length-1) {
																groupIndex++;
																console.log('继续下载下一个相册',photoGroupList.length,groupIndex);
																getOneGroup(groupIndex);
															}else{
																console.log('全部下载完毕');
															}
														}
													}



												}
											},
											error:function(err){
												console.log('照片列表获取失败',err);
											},
										})
									}
								},
								error:function (err) {
									console.log('获取相册详细信息 失败：',err)
								}
							})
						}

					}
				},
				error:function(err){
					console.log('获取相册列表失败:'+err)
				},
			})
		}else{
			console.log('没有找到相册列表，可能你的配置链接错误');
		}
	},
	error:function(err){
		console.log('首页打开失败:'+err)
	},
})



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
	console.log(path,'保存成功 \n');
}
function writeInExifAndSave(data,exifInfo){
	var data = data.toString("binary");
	var zeroth = {};
	var exif = {};
	var gps = {};

	zeroth[piexif.ImageIFD.Make] = exifInfo.make;//工具,相机品牌
	zeroth[piexif.ImageIFD.XResolution] = [777, 1];
	zeroth[piexif.ImageIFD.YResolution] = [777, 1];
	zeroth[piexif.ImageIFD.Software] = exifInfo.model;//软件版本号,型号
	zeroth[piexif.ImageIFD.Orientation] = exifInfo.orientation;//拍摄方向

	exif[piexif.ExifIFD.DateTimeOriginal] = exifInfo.dateTime.replace(/\//g,':');//创建时间
	exif[piexif.ExifIFD.LensMake] = "LensMake";
	exif[piexif.ExifIFD.Sharpness] = 777;
	exif[piexif.ExifIFD.LensSpecification] = [[1, 1], [1, 1], [1, 1], [1, 1]];
	exif[piexif.ExifIFD.ApertureValue] = exifInfo.apertureValue;//镜头光圈
	exif[piexif.ExifIFD.MaxApertureValue] = exifInfo.maxApertureValue;//最大光圈
	exif[piexif.ExifIFD.ISOSpeedRatings] = exifInfo.isoSpeedRatings*1;//感光度
	exif[piexif.ExifIFD.FocalLength] = exifInfo.focalLength;//焦距
	exif[piexif.ExifIFD.ExposureTime] = exifInfo.exposureTime;//曝光时间
	exif[piexif.ExifIFD.ExposureBiasValue] = exifInfo.exposureBiasValue;//曝光补偿

	gps[piexif.GPSIFD.GPSVersionID] = [7, 7, 7, 7];
	gps[piexif.GPSIFD.GPSDateStamp] = "1999:99:99 99:99:99";


	var exifObj = {"0th":zeroth, "Exif":exif, "GPS":gps};
	var exifbytes = piexif.dump(exifObj);

	var newData = piexif.insert(exifbytes, data);
	var newJpeg = Buffer.from(newData, "binary");
	downloadImg(exifInfo.photoName,newJpeg)
}
