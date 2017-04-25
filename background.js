//  Constants
var PREFS = loadPrefs(),
BADGE_BACKGROUND_COLORS = {online: [192, 0, 0, 255], offline: [0, 192, 0, 255]},
RING = new Audio("ding.ogg"), ringLoaded = false; loadRingIfNecessary();

function defaultPrefs() {
  return {
    siteList: ['marcpickett1.github.io', '127.0.0.1', 'marcpickett.com'],
    durations: {online: 25 * 60},
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
function loadRingIfNecessary() {
  if(PREFS.shouldRing && !ringLoaded) {
    RING.onload = function () {console.log('ring loaded'); ringLoaded = true;}
    RING.load();
  }}
var ICONS = {ACTION: {CURRENT: {}, PENDING: {}}, FULL: {},},
iconTypeS = ['offline', 'online'], iconType;
for(var i in iconTypeS) {
  iconType = iconTypeS[i];
  ICONS.ACTION.CURRENT[iconType] = "icons/" + iconType + ".png";
  ICONS.ACTION.PENDING[iconType] = "icons/" + iconType + "_pending.png";
  ICONS.FULL[iconType] = "icons/" + iconType + "_full.png";
}

// Models
function Pomodoro(options) {
  this.mostRecentMode = 'offline';
  this.nextMode = 'online';
  this.running = false;
  this.onTimerEnd = function (timer) {this.running = false;}
  this.start = function () {
    var mostRecentMode = this.mostRecentMode, timerOptions = {};
    this.mostRecentMode = this.nextMode;
    this.nextMode = mostRecentMode;
    for(var key in options.timer) {timerOptions[key] = options.timer[key];}
    timerOptions.type = this.mostRecentMode;
    timerOptions.duration = options.getDurations()[this.mostRecentMode];
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
  this.type = options.type;
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
    if(timer.timeRemaining <= 0) {
      clearInterval(tickInterval);
      pomodoro.onTimerEnd(timer);
      options.onEnd(timer);
    }}}

// Views
function locationsMatch(location, listedPattern) {
  return domainsMatch(location.domain, listedPattern.domain) && pathsMatch(location.path, listedPattern.path);
}
function parseLocation(location) {
  var components = location.split('/');
  return {domain: components.shift(), path: components.join('/')};
}
function pathsMatch(test, against) {
  return !against || test.substr(0, against.length) == against;
}
function domainsMatch(test, against) {
  if(test === against) {return true;}
  else {
    var testFrom = test.length - against.length - 1;
    if(testFrom < 0) {return false;}
    else {return test.substr(testFrom) === '.' + against;}
  }}
function isLocationBlocked(location) {
  for(var k in PREFS.siteList) {
    listedPattern = parseLocation(PREFS.siteList[k]);
    if(locationsMatch(location, listedPattern)) {
      return false;
    }}
  return true;
}
function executeInTabIfBlocked(action, tab) {
  var file = "content_scripts/" + action + ".js", location;
  location = tab.url.split('://');
  location = parseLocation(location[1]);
  if(isLocationBlocked(location)) {chrome.tabs.executeScript(tab.id, {file: file});}
}
function executeInAllBlockedTabs(action) {
  var windows = chrome.windows.getAll({populate: true}, function (windows) {
    var tabs, tab, domain, listedDomain;
    for(var i in windows) {
      tabs = windows[i].tabs;
      for(var j in tabs) {
        executeInTabIfBlocked(action, tabs[j]);
      }}});}
var notification, mainPomodoro = new Pomodoro({
  getDurations: function () { return PREFS.durations },
  timer: {
    onEnd: function (timer) {
      chrome.browserAction.setIcon({path: ICONS.ACTION.PENDING[timer.pomodoro.nextMode]});
      chrome.browserAction.setBadgeText({text: ''});
      if(PREFS.showNotifications) {
        var nextModeName = chrome.i18n.getMessage(timer.pomodoro.nextMode);
        chrome.notifications.create("", {
          type: "basic",
          title: chrome.i18n.getMessage("timer_end_notification_header"),
          message: chrome.i18n.getMessage("timer_end_notification_body", nextModeName),
          priority: 2,
          iconUrl: ICONS.FULL[timer.type]
        }, function() {});
      }
      if(PREFS.shouldRing) {console.log("playing ring", RING); RING.play();}
    },
    onStart: function (timer) {
      chrome.browserAction.setIcon({path: ICONS.ACTION.CURRENT[timer.type]});
      chrome.browserAction.setBadgeBackgroundColor({color: BADGE_BACKGROUND_COLORS[timer.type]});
      if(timer.type == 'work') {executeInAllBlockedTabs('unblock');}
      else {executeInAllBlockedTabs('block');}
      if(notification) notification.cancel();
      var tabViews = chrome.extension.getViews({type: 'tab'}), tab;
      for(var i in tabViews) {
        tab = tabViews[i];
        if(typeof tab.startCallbacks !== 'undefined') {tab.startCallbacks[timer.type]();}
      }
    },
    onTick: function (timer) {chrome.browserAction.setBadgeText({text: timer.timeRemainingString()});}
  }});

chrome.browserAction.onClicked.addListener(function (tab) {
  if(mainPomodoro.running) {
    if(PREFS.clickRestarts) {mainPomodoro.restart();}
  } else {mainPomodoro.start();}});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if(mainPomodoro.mostRecentMode !== 'work') {
    executeInTabIfBlocked('block', tab);
  }});

// Clicking the notification brings you back to Chrome, in whatever window you were last using.
chrome.notifications.onClicked.addListener(function (id) {
  chrome.windows.getLastFocused(function (window) {chrome.windows.update(window.id, {focused: true});});});
