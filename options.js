var options = [
	{
		"type": "checkbox",
		"default": false,
		"label": "Close Older Tabs",
		"id": "close-old-tabs"
	}
];

$(document).ready(function(){
	console.log("Prepping options page");
	prepStorage();
	loadActiveWindows();
});

function loadActiveWindows(){
	var $container = $("div#options > div#active-windows");
	var $availableTabs = $("div#options > div#active-tabs");
	var $moveButton = $("div#options > button#move-to-window");
	$container.empty();
	$availableTabs.empty();
	var $select = $("<select>");
	var selectTabs = [];
	chrome.windows.getCurrent(null, function(currentWindow){
	chrome.windows.getAll({populate: true}, function(windows){
		if(!windows) return;
		for(var i = 0; i < windows.length; i++){
			var win = windows[i];
			if(!win.tabs || win.type !== "normal") continue;
			for(var j = 0; j < win.tabs.length; j++){
				var winTab = win.tabs[j];
				if(win.id == currentWindow.id){
					selectTabs.push($("<label>").append($("<input type='checkbox'>").val(winTab.id)).append($("<span>").text((winTab.pinned? "(pinned) " : "") + winTab.url)));
					continue;
				}
				if(!winTab.active) continue;
				$select.append($("<option>").text(winTab.url).data("window", win.id));
			}
		}
		$select.append($("<option>").text("-- new window --").data("window", null));
		$select.appendTo($container);
		$availableTabs.append($("<input type='checkbox' id='select-all'>").change(function(){
			availableTabs($availableTabs).prop("checked",$(this).is(":checked")).trigger("change");
		}));
		$availableTabs.append(selectTabs);
		availableTabs($availableTabs).change(function(){
			var $checkedTabs = selectedTabs($availableTabs);
			$moveButton.prop("disabled", $checkedTabs.length == 0);
		}).trigger("change");
		$moveButton.click(function(){
			var tabIdsToMove = [];
			selectedTabs($availableTabs).each(function(i,item){
				tabIdsToMove.push(parseInt($(item).val()));
			});
			var moveToWindow = $container.find("option:selected").data("window");
			if(moveToWindow == null){
				chrome.windows.create({focused: true, type: "normal"}, function(createdWindow){
					console.log("window/" + currentWindow.id + "/tab/" + tabIdsToMove.join("+") + " moving to [created] window/" + createdWindow.id);
					chrome.tabs.move(tabIdsToMove, {windowId: createdWindow.id, index: -1});
					loadActiveWindows();
					chrome.tabs.query({windowId: createdWindow.id}, function(tabs){
						if(tabs && tabs.length > 0) chrome.tabs.remove(tabs[0].id);
					});
				});
			}
			else {
				console.log("window/" + currentWindow.id + "/tab/" + tabIdsToMove.join("+") + " moving to window/" + moveToWindow);
				chrome.tabs.move(tabIdsToMove, {windowId: moveToWindow, index: -1}, function(){
					loadActiveWindows();
				});
			}
		});
	});
	});
}

function availableTabs($container, checked){
	return $container.find("input[type='checkbox']:not([id='select-all'])" + (checked ? ":checked" : ""));
}
function selectedTabs($container){
	return availableTabs($container, true);
}

function prepStorage(){
	var $container = $("div#options > div#input-container");
	$.each(options, function(i, item){
		var $widget;
		if(item.type == "checkbox"){
			$widget = $("<label><input type='"+item.type+"'> "+item.label+"</label>")
			var $input = $widget.find("input");
			var opt = {};
			opt[item.id] = item.default;
			chrome.storage.sync.get(opt, function(items){
				console.log(items)
				if(items[item.id]) $input.prop('checked', true);
			});
			$input.change(function(){
				opt[item.id] = $input.is(":checked");
				chrome.storage.sync.set(opt, function(){
					console.log("settings saved");
				});
			});
		}
		$container.append($widget);
	});
}