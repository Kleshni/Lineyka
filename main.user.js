// ==UserScript==
// @name Lineyka
// @namespace {27d5a27a-83c4-4a6f-80e7-186c27684d25}
// @version 1.0
// @downloadURL https://raw.githubusercontent.com/Kleshni/Lineyka/master/main.user.js
// @updateURL https://raw.githubusercontent.com/Kleshni/Lineyka/master/main.meta.js
// @include /^https?:\/\/(www\.)?(2ch\.(hk|pm|re|tf|wf|yt|cm)|2-ch\.so)\.?\/\w+\/res\/\d+\.html([\?\#].*)?$/
// @name:ru Линейка
// @description Помогает не заблудиться в треде
// @icon https://raw.githubusercontent.com/Kleshni/Lineyka/master/icon.png
// @grant GM_getResourceText
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_deleteValue
// @resource UI https://raw.githubusercontent.com/Kleshni/Lineyka/master/UI.htm
// @resource HarkachUI https://raw.githubusercontent.com/Kleshni/Lineyka/master/Harkach-UI.htm
// ==/UserScript==

"use strict";

// Binary search

Array.prototype.findLastFit = function (checkCondition, thisArg) {
	var start = 0;
	var end = this.length - 1;
	var result = -1;

	while (end >= start) {
		var middle = Math.floor((start + end) / 2);
		var direction = checkCondition.call(thisArg, this[middle], middle, this);

		if (direction < 0) {
			result = middle;
			start = middle + 1;
		} else if (direction > 0) {
			end = middle - 1;
		} else {
			return middle;
		}
	}

	return result;
};

Array.prototype.insert = function (element, checkCondition, thisArg) {
	var index = this.findLastFit(checkCondition, thisArg) + 1;

	this.splice(index, 0, element);

	return index;
};

Array.prototype.delete = function (checkCondition, thisArg) {
	var index = this.findLastFit(checkCondition, thisArg);

	this.splice(index, 1);

	return index;
};

// Imageboard specific code

var HarkachThread = function () {
	// Load user interface

	document.body.insertAdjacentHTML("beforeend", GM_getResourceText("HarkachUI"));

	var watchCheckboxTemplateNode = document.querySelector("#Lineyka-Harkach-watch-checkbox-template");

	// Identify thread

	var threadNode = document.querySelector(".thread");

	this.boardID = "Harkach/" + location.pathname.match(/^\/([^\/]+)\//)[1];
	this.ID = threadNode.getAttribute("id").split("-")[1];

	// Define methods

	var posts = new Map();

	this.processPosts = function (appendPost, removePost) {
		var processPostNode = function (postNode) {
			var ID = postNode.getAttribute("data-num");
			var URL = location.href.replace(location.hash, "") + "#" + ID;
			var referenceIDs = new Set();

			var referenceIDNodes = postNode.querySelectorAll(".post-reply-link");

			for (var i = 0; i < referenceIDNodes.length; ++i) {
				referenceIDs.add(referenceIDNodes[i].getAttribute("data-num"));
			}

			var post = {
				"object": appendPost(ID, URL, referenceIDs),
				"node": postNode
			};

			if (postNode.classList.contains("hiclass")) {
				post.object.watched = true;
			}

			posts.set(ID, post);

			// Append watch checkbox

			var postDetailsNode = postNode.querySelector(".post-details");
			var watchCheckboxDocumentFragment = document.importNode(watchCheckboxTemplateNode.content, true)
			var watchCheckboxNode = watchCheckboxDocumentFragment.querySelector(".Lineyka-Harkach-watch-checkbox");

			postDetailsNode.insertBefore(watchCheckboxDocumentFragment, postDetailsNode.lastElementChild);

			if (post.object.watched) {
				watchCheckboxNode.setAttribute("checked", "checked");
			}

			watchCheckboxNode.addEventListener("change", function (event) {
				post.object.watched = this.checked;
			});
		};

		Array.prototype.forEach.call(threadNode.querySelectorAll(".post"), processPostNode);

		// Watch for new posts and post deletions

		new MutationObserver(function (mutations) {
			for (var i = 0; i < mutations.length; ++i) {
				for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
					var postNode = mutations[i].addedNodes[j].querySelector(".post");

					if (postNode !== null) {
						processPostNode(postNode);
					}
				}

				for (var j = 0; j < mutations[i].removedNodes.length; ++j) {
					var postNode = mutations[i].removedNodes[j].querySelector(".post");

					if (postNode !== null) {
						var postID = postNode.getAttribute("data-num");

						removePost(posts.get(postID).object);
						posts.delete(postID);
					}
				}
			}
		}).observe(threadNode, {childList: true});

		// Remove watch checkboxes from post previews

		new MutationObserver(function (mutations) {
			for (var i = 0; i < mutations.length; ++i) {
				for (var j = 0; j < mutations[i].addedNodes.length; ++j) {
					var node = mutations[i].addedNodes[j];

					if (node.classList.contains("post")) {
						var watchCheckboxLabelNode = node.querySelector(".Lineyka-Harkach-watch-checkbox-label");

						watchCheckboxLabelNode.parentNode.removeChild(watchCheckboxLabelNode);
					}
				}
			}
		}).observe(document.querySelector("#posts-form"), {childList: true});
	};

	// Find scroll position

	var orderedPosts = new Array();

	posts.set = function (key, value) {
		if (!this.has(key)) {
			orderedPosts.insert(value, function (element) {return element.object.ID - key;});
		}

		Map.prototype.set.call(this, key, value);
	};

	posts.delete = function (value) {
		if (this.has(key)) {
			orderedPosts.delete(function (element) {return element.object.ID - key;});
		}

		Map.prototype.delete.call(this, value);
	};

	posts.clear = function () {
		orderedPosts.splice(0, orderedPosts.length);
		Map.prototype.clear.call(this);
	};

	this.getPointedPostID = function () {
		var index = Math.min(orderedPosts.findLastFit(function (post, index) {
			return post.node.getBoundingClientRect().bottom;
		}) + 1, orderedPosts.length - 1);

		return index in orderedPosts ? orderedPosts[index].object.ID : undefined;
	};
};

// Determine imageboard

var thread = new HarkachThread();

// Load user interface

document.body.insertAdjacentHTML("beforeend", GM_getResourceText("UI"));

var panelNode = document.querySelector("#Lineyka-panel");
var lineTemplateNode = document.querySelector("#Lineyka-line-template");

// Process posts

var posts = new Map();
var orderedPosts = new Array();

var appendPost = function (ID, URL, referenceIDs) {
	var post = {
		"ID": ID,
		"URL": URL
	};

	posts.set(post.ID, post);

	var postNumber = orderedPosts.insert(post, function (element) {return element.ID - post.ID;}) + 1;

	// Append line

	var lineDocumentFragment = document.importNode(lineTemplateNode.content, true)
	var lineNode = lineDocumentFragment.querySelector(".line");

	panelNode.insertBefore(lineDocumentFragment, postNumber < orderedPosts.length ? orderedPosts[postNumber].lineNode : null);

	lineNode.setAttribute("href", post.URL);

	post.lineNode = lineNode;

	Object.defineProperty(post, "number", {
		"get": function () {
			return postNumber;
		},

		"set": function (value) {
			postNumber = value;
			lineNode.setAttribute("title", "№ " + post.ID + ", " + postNumber + " в треде");
		},

		"enumerable": true,
		"configurable": true
	});

	post.number = postNumber;

	// Connect post to references

	post.replyIDs = new Set();
	post.watcherIDs = new Set();

	var onWatcherIDsChanged = function () {
		if (this.size == 0) {
			lineNode.classList.remove("reply");
		} else {
			lineNode.classList.add("reply");
		}
	};

	post.watcherIDs.add = function (value) {
		Set.prototype.add.call(this, value);
		onWatcherIDsChanged.call(this);
	};

	post.watcherIDs.delete = function (value) {
		Set.prototype.delete.call(this, value);
		onWatcherIDsChanged.call(this);
	};

	post.watcherIDs.clear = function () {
		Set.prototype.clear.call(this);
		onWatcherIDsChanged.call(this);
	};

	referenceIDs.forEach(function (referenceID) {
		if (posts.has(referenceID)) {
			var reference = posts.get(referenceID);

			reference.replyIDs.add(post.ID);

			if (reference.watched) {
				post.watcherIDs.add(referenceID);
			}
		}
	}, post);

	// Define "watched" property

	var storageKey = "watched-posts/" + thread.boardID + "/" + thread.ID + "/" + post.ID;

	Object.defineProperty(post, "watched", {
		"get": function () {
			return GM_getValue(storageKey, false);
		},

		"set": function (value) {
			if (value) {
				GM_setValue(storageKey, true);
				lineNode.classList.add("watched");

				post.replyIDs.forEach(function (replyID) {
					posts.get(replyID).watcherIDs.add(post.ID);
				}, post);
			} else {
				GM_deleteValue(storageKey);
				lineNode.classList.remove("watched");

				post.replyIDs.forEach(function (replyID) {
					posts.get(replyID).watcherIDs.delete(post.ID);
				}, post);
			}
		},

		"enumerable": true,
		"configurable": true
	});

	post.watched = post.watched;

	return post;
};

var removePost = function (post) {
	posts.delete(post.ID);

	// Delete line

	post.lineNode.parentNode.removeChild(post.lineNode);

	var deletedIndex = orderedPosts.delete(function (element) {return element.ID - post.ID;});

	for (var i = deletedIndex; i < orderedPosts.length; ++i) {
		--orderedPosts[i].number;
	}

	// Disconnect from references

	post.replyIDs.forEach(function (replyID) {
		posts.get(replyID).watcherIDs.delete(post.ID);
	}, post);

	post.watcherIDs.forEach(function (watcherID) {
		posts.get(watcherID).replyIDs.delete(post.ID);
	}, post);
};

thread.processPosts(appendPost, removePost);

// Add post pointer

var previousPointedPost = undefined;

var movePostPointer = function (event) {
	var pointedPost = posts.get(thread.getPointedPostID());

	if (pointedPost !== previousPointedPost) {
		if (previousPointedPost !== undefined) {
			previousPointedPost.lineNode.classList.remove("pointed");
		}

		if (pointedPost !== undefined) {
			pointedPost.lineNode.classList.add("pointed");
		}

		previousPointedPost = pointedPost;
	}
};

window.addEventListener("resize", movePostPointer);
window.addEventListener("scroll", movePostPointer);

posts.set = function (key, value) {
	Map.prototype.set.call(this, key, value);
	movePostPointer.call(this);
};

posts.delete = function (value) {
	Map.prototype.delete.call(this, value);
	movePostPointer.call(this);
};

posts.clear = function () {
	Map.prototype.clear.call(this);
	movePostPointer.call(this);
};

movePostPointer();
