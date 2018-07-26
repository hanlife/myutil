
function loadCss(url) {
	if (document.createStyleSheet) {
		document.createStyleSheet(url);
	} else {
		$("head").append($("<link rel='stylesheet' href='" + url + "' type='text/css' />"));
	}
}

function loadScript(url, callback) {
	$.ajax({
		dataType: "script",
		cache: true,
		url: url,
		success: callback
	});
}

function postParent(data) {
	if (window.parent.postMessage)
	{
		if (window.JSON) {
			window.parent.postMessage(window.JSON.stringify(data), "*");
		} else {
			loadScript("json3.min.js",function(){
				window.parent.postMessage(window.JSON.stringify(data), "*");
			});
		}
	}
}

function getArg(name) {
	var args = window.location.search.substring(1).split("&");
	for (var i = 0; i < args.length; ++i) {
		var arg = args[i];
		if (arg.indexOf(name + "=") == 0)
			return arg.substring(name.length + 1);
	}
	return "";
}

function getRedGreenButton() {
	if (getArg("noredgreen") == '1')
		return 0;
	return 1;
}

function webgl_support() {
	try {
		var canvas = document.createElement('canvas');
		return !!window.WebGLRenderingContext && (
			canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
	} catch (e) { return false; }
};

function nativeViewer(file) {
	var codebase = location.protocol + "//download.partcommunity.com/partserver/applets/partwebviewer/pwebdownloader.cab#Version=9,7,0,0";
	var basepath = "/partserver/applets/partwebviewer";
	var html = "";
	html = html + "<object classid='clsid:12545791-AC9A-44B2-8964-0DA216C4A4E5' id='cnsweb3d' width=100% height=100% codebase='" + codebase + "'>";
	html = html + "<param name='BasePath' value='/partserver/applets/partwebviewer/'>";
	html = html + "<param name='FileName' value='" + file + "'>";
	html = html + "<param name='RedGreenButton' value='" + getRedGreenButton() + "'>";
	html = html + "<param name='Start' value=1>";
	html = html + "</object>";
	return html;
}

function render2(data) {
	$("#working").hide();

	var doc = $(data);
	var webgl = "";

	var nb = doc.find("NB").text();
	var nn = doc.find("NN").text();
	var wkbno = doc.find("ORDERNO").text();

	// parse formats that we know...
	$.each(data.getElementsByTagName("CADFORMAT"), function (i, f) {
		var fmt = $(f).text();
		var file = $(f).parent().find("FILENAME").text();
		var error = $(f).parent().find("ERROR").text();
		if (error != '1') {
			if (fmt == 'PARTJAVA') {
				webgl = file;
			}
		}
	});

	if (webgl != "") {
		$.each(doc.find("MESSAGE"), function (idx, message) {
			$("<p/>").attr("class", "error").text($(message).text()).appendTo($("#messageBox"));
			$("#messageBox").show();
		});

		$("#applet").show();

		if (webgl_support()) {
			window.psol.components.Globals.setApiPath('/webcomponents/4.1.0/api/');
			// default viewer options
			var defaultOptions = {
				$container: $("#container1"),
				viewerBackendType: window.psol.components.WebViewer3D.ViewerBackends.WebGL,
				devicePixelRatio: window.devicePixelRatio,
				favoriteActions: ['actCut', 'actAnimate', 'actIsometric', 'actLine', 'actShadeLine'],
				radialMenuRadius: 100,
				leapMotionEnabled: false,
				webglViewerSettings: { ColorTL: '#FFFFFF', ColorTR: '#FFFFFF', ColorBL: '#FFFFFF', ColorBR: '#FFFFFF' }
			};
			var passedOptions = {};
			// allow to pass args...
			try {
				var arg = getArg("options");
				if (arg != "" ) {
					passedOptions = $.parseJSON(decodeURIComponent(arg));
					defaultOptions = $.extend({}, defaultOptions, passedOptions);
				}
			}
			catch (e) {
			}
			var viewer = new window.psol.components.WebViewer3D(defaultOptions);
			viewer.show().done(function () {
				viewer.loadByUrl(getArg("file").replace(/download.xml/, webgl)).done(function () {
					// warning this is a private access and could be broken in a future release
					viewer._props._viewerBackend.setShowLabels(false);
				});
				postParent({ reason: "previewLoaded", NB: nb, NN: nn, ORDERNO: wkbno });
			});
		}
		else {
			if ("ActiveXObject" in window) {
				$("#applet").html(nativeViewer(getArg("file").replace(/download.xml/, webgl)));
				postParent({ reason: "previewLoaded", NB: nb, NN: nn, ORDERNO: wkbno });
			}
			else {
				var viewerOptions = {
					enabledViewer: ['native3D'],
					viewer: {
						native3D: {
							RedGreenButton: getRedGreenButton(),
							ColorFadeIn: "#FFFFFF",
							ColorTL: "#FFFFFF",
							ColorTR: "#FFFFFF",
							ColorBL: "#FFFFFF",
							ColorBR: "#FFFFFF",
							ColorLabel: "#DCE4ED",
							ColorLabelText: "#FFFFFF",
							ColorHelpPanel: "#2265B7E9",
							Border: 1,
							BorderSize: 5,
							BorderAlpha: 1.0,
							Buttons: 1,
							ButtonSize: 24
						},
						canvas2D: {},
						animGIF: {}
					}
				};
				psol.viewer.setResourceBasePath('/api/js/v1/psol.viewer/');
				$.when(psol.viewer.createViewer(0, '#container1', viewerOptions)).done(function (viewer) {
					psol.viewer.getViewer(0).loadPreview({ type: 'file', path: getArg("file").replace(/download.xml/, webgl) });
					postParent({ reason: "previewLoaded", NB: nb, NN: nn, ORDERNO: wkbno });
				});
			}
		}
	} else {
		var errors = [];
		$.each(doc.find("MESSAGE"), function (idx, message) {
			errors.push($(message).text());
			$("<p/>").attr("class", "error").text($(message).text()).appendTo($("#error"));
		});
		$("#error").show();
		postParent({ reason: "previewFailed", NB: nb, NN: nn, ORDERNO: wkbno, errors: errors });
	}
}

function checkFile() {
	$.get(getArg("file"), { "_": $.now() }, function (data) {
		render2(data);
	}).fail(function () {
		window.setTimeout("checkFile();", 1000);
	});
}

$(document).ready(function () {
	postParent({ reason: "previewLoading" });
	// if we have webgl...
	if (webgl_support()) {
		// load webgl components...
		loadCss("/webcomponents/4.1.0/api/css/thirdparty.min.css");
		loadCss("/webcomponents/4.1.0/api/css/psol.components.min.css");
		loadScript("/webcomponents/4.1.0/api/js/thirdparty.min.js", function () {
			loadScript("/webcomponents/4.1.0/api/js/psol.components.min.js", function () {
				// start checking file...
				checkFile();
			});
		});
		// if we have active x (ie)
	} else if ("ActiveXObject" in window) {
		// no external deps...
		checkFile();
	} else {
		// else -> old style native3d viewer... (todo: remove some day)
		loadCss("/api/js/v1/psol.viewer/css/cnswebviewer2.css");
		loadScript("/api/js/v1/components/webViewer3D/viewer/webgl/js/psolwebglviewer.js", function () {
			loadScript("/api/js/v1/psol.viewer/psol.viewer.js", function () {
				// start checking file...
				checkFile();
			});
		});
	}
});
