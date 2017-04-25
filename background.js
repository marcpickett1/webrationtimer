//  Constants
var PREFS = loadPrefs(), RING = new Audio("ding.ogg"), ringLoaded = false;
loadRingIfNecessary();

function defaultPrefs() {
  return {
    siteList: ['marcpickett1.github.io', '127.0.0.1', 'marcpickett.com'],
    duration: 25 * 60,
    shouldRing: true}}
function loadPrefs() {
  if(typeof localStorage['prefs'] !== 'undefined') {
    return JSON.parse(localStorage['prefs']);
  } else {return savePrefs(defaultPrefs());}}
function savePrefs(prefs) {
  localStorage['prefs'] = JSON.stringify(prefs);
  return prefs;
}
function setPrefs(prefs) {
  PREFS = savePrefs(prefs);
  loadRingIfNecessary();
  return prefs;
}
function loadRingIfNecessary () {
  // if(PREFS.shouldRing && !ringLoaded) {
  if(true && !ringLoaded) {
    RING.onload = function () {console.log('ring loaded'); ringLoaded = true;}
    RING.load();
  }}

var ICONS = {ACTION: {CURRENT: {}}, FULL: {},},
iconTypeS = ['offline', 'online'], iconType;
for(var i in iconTypeS) {
  iconType = iconTypeS[i];
  ICONS.ACTION.CURRENT[iconType] = "icons/" + iconType + ".png";
  ICONS.FULL[iconType] = "icons/" + iconType + "_full.png";
}

// Models
function Pomodoro(options) {
  this.running = false;
  this.onTimerEnd = function (timer) {this.running = false;}
  this.start = function () {
    var timerOptions = {};
    for(var key in options.timer) {timerOptions[key] = options.timer[key];}
    timerOptions.duration = options.getDuration();
    this.running = true;
    this.currentTimer = new Pomodoro.Timer(this, timerOptions);
    this.currentTimer.start();
  }
  this.restart = function () {if(this.currentTimer) {this.currentTimer.restart();}}
}

Pomodoro.Timer = function Timer(pomodoro, options) {
  var tickInterval, timer = this;
  this.pomodoro = pomodoro;
  this.timeRemaining = options.duration;
  this.start = function () {
    tickInterval = setInterval(tick, 1000);
    options.onStart(timer);
    options.onTick(timer);
  }
  this.restart = function() {
    this.timeRemaining = options.duration;
    options.onTick(timer);
  }
  this.timeRemainingString = function () {
    if ((this.timeRemaining % 60) > 9) {
      return Math.floor(this.timeRemaining / 60) + ":" + this.timeRemaining % 60;
    } else {
      return Math.floor(this.timeRemaining / 60) + ":0" + this.timeRemaining % 60;
    }
  }
  function tick() {
    timer.timeRemaining--;
    options.onTick(timer);
    if(timer.timeRemaining <= 0) {clearInterval(tickInterval); pomodoro.onTimerEnd(timer); options.onEnd(timer);}}}

// Views
function locationsMatch(location, listedPattern) {
  return domainsMatch(location.domain, listedPattern.domain) && pathsMatch(location.path, listedPattern.path);
}
function parseLocation(location) {
  var components = location.split('/');
  return {domain: components.shift(), path: components.join('/')};}
function pathsMatch(test, against) {return !against || test.substr(0, against.length) == against;}
function domainsMatch(test, against) {
  if(test === against) {return true;}
  else {
    var testFrom = test.length - against.length - 1;
    if(testFrom < 0) {return false;}
    else {return test.substr(testFrom) === '.' + against;}}}
function isLocationBlocked(location) {
  for(var k in PREFS.siteList) {
    listedPattern = parseLocation(PREFS.siteList[k]);
    if(locationsMatch(location, listedPattern)) {return false;}}
  return true;}
function executeInTabIfBlocked(action, tab) {
  var file = "content_scripts/" + action + ".js", location;
  location = tab.url.split('://');
  location = parseLocation(location[1]);
  if(isLocationBlocked(location)) {chrome.tabs.executeScript(tab.id, {file: file});}}
function executeInAllBlockedTabs(action) {
  var windows = chrome.windows.getAll({populate: true}, function (windows) {
    var tabs, tab, domain, listedDomain;
    for(var i in windows) {
      tabs = windows[i].tabs;
      for(var j in tabs) {executeInTabIfBlocked(action, tabs[j]);}}});}

//
var notification, mainPomodoro = new Pomodoro({
  // getDuration: function () { return PREFS.duration },
  getDuration: function () { return 25 * 60 },
  timer: {onEnd: function (timer) {
    chrome.browserAction.setIcon({path: ICONS.ACTION.CURRENT['offline']});
    chrome.browserAction.setBadgeText({text: ''});
    // if(PREFS.showNotifications) {
    if(false) {
      chrome.notifications.create("", {
        type: "basic",
        // title: chrome.i18n.getMessage("timer_end_notification_header"),
        // message: chrome.i18n.getMessage("timer_end_notification_body", "Time's up: You're now offline."),
        title: "Offline, yo",
        message: "Time's up: You're now offline.",
        priority: 2,
        iconUrl: ICONS.FULL['offline']
      }, function() {});
    }
    // if(PREFS.shouldRing) {console.log("playing ring", RING); RING.play();}
    if(true) {console.log("playing ring", RING); RING.play();}
  }, onStart: function (timer) {
    chrome.browserAction.setIcon({path: ICONS.ACTION.CURRENT['online']});
    chrome.browserAction.setBadgeBackgroundColor({color: [192, 0, 0, 255]});
    executeInAllBlockedTabs('unblock');
    if(notification) notification.cancel();
    var tabViews = chrome.extension.getViews({type: 'tab'}), tab;
    for(var i in tabViews) {
      tab = tabViews[i];
      if(typeof tab.startCallbacks !== 'undefined') {tab.startCallbacks['online']();}
    }}, onTick: function (timer) {chrome.browserAction.setBadgeText({text: timer.timeRemainingString()});}
  }});

chrome.browserAction.onClicked.addListener(function (tab) {
  if(!mainPomodoro.running) {mainPomodoro.start();}});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if(!mainPomodoro.running) {executeInTabIfBlocked('block', tab);}});

// Clicking the notification brings you back to Chrome, in whatever window you were last using.
chrome.notifications.onClicked.addListener(function (id) {
  chrome.windows.getLastFocused(function (window) {chrome.windows.update(window.id, {focused: true});});});
