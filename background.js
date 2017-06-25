// Adapted from matchu's [Strict Workflow](https://github.com/matchu/Strict-Workflow)
var MARCPREFS = {siteList: ['extensions', 'calendar.google.com', 'stackoverflow.com', 'stackexchange.com']};
var DURATION = 25, RATIONSPERDAY = 3, PREFS = loadPrefs(), RING = new Audio("ding.ogg");
////////////////
function loadPrefs() {
  if(typeof localStorage['prefs'] !== 'undefined') {return JSON.parse(localStorage['prefs']);}
  else {savePrefs(MARCPREFS); return MARCPREFS}}
function savePrefs(prefs) {localStorage['prefs'] = JSON.stringify(prefs); PREFS = prefs}
////////////////
function locationsMatch(location, listedPattern) {
  return domainsMatch(location.domain, listedPattern.domain) && pathsMatch(location.path, listedPattern.path);}
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
  var file = action + ".js", location;
  location = tab.url.split('://');
  location = parseLocation(location[1]);
  if(isLocationBlocked(location)) {chrome.tabs.executeScript(tab.id, {file: file});}}
function executeInAllBlockedTabs(action) {
  chrome.windows.getAll({populate: true}, function(windows) {
    var tabs, tab, domain, listedDomain;
    for(var i in windows) {
      tabs = windows[i].tabs;
      for(var j in tabs) {executeInTabIfBlocked(action, tabs[j]);}}});}
////////////////
function setIconText(timer) {
  chrome.browserAction.setIcon({path: 'icons/offline.png'});
  chrome.browserAction.setBadgeBackgroundColor({color: [0, 0, 0, 255]});
  if (timer.pomodoro.rationsLeft <= 0) {chrome.browserAction.setBadgeBackgroundColor({color: [192, 0, 0, 255]});}
  chrome.browserAction.setBadgeText({text: ''});
  chrome.browserAction.setBadgeText({text: timer.pomodoro.rationsLeft + ''});}
function onEnd(timer) {
  setIconText(timer);
  executeInAllBlockedTabs('block');}
function onStart(timer) {
  chrome.browserAction.setIcon({path: 'icons/online.png'});
  chrome.browserAction.setBadgeBackgroundColor({color: [192, 0, 0, 255]});
  executeInAllBlockedTabs('unblock');
  var tabViews = chrome.extension.getViews({type: 'tab'}), tab;
  for(var i in tabViews) {
    tab = tabViews[i];
    if(typeof tab.startCallbacks !== 'undefined') {tab.startCallbacks['online']();}}}
function onTick(timer) {chrome.browserAction.setBadgeText({text: formatTime(timer.timeRemaining)});}
function formatTime(tr) {if ((tr % 60) > 9) {return Math.floor(tr/60)+":"+ tr%60;} else {return Math.floor(tr/60)+":0" + tr%60;}}
////////////////
function Pomodoro() {
  this.running = false; this.rationsLeft = RATIONSPERDAY; this.elapsed = 0
  this.marcnow = new Date().getTime() / 1000;
  this.start = function() {
    this.running = true;
    if (this.rationsLeft <= 0) {this.currentTimer = new PTimer(this, 1);}
    else {
      this.rationsLeft--;
      this.currentTimer = new PTimer(this, DURATION);}
    this.currentTimer.start();}
  this.stop = function() {if (this.running) {this.currentTimer.stop();}}
  this.start(); this.stop();} // Bit of a hack here to get things started.
function PTimer(pomodoro, duration) {
  var tickInterval, tickInterval2 = setInterval(tick2, 1000), timer = this;
  this.pomodoro = pomodoro;
  this.timeRemaining = duration * 60;
  this.warnings = 1;
  this.start = function() {tickInterval = setInterval(tick, 1000); onStart(this); onTick(this);}
  this.stop = function() {this.timeRemaining = 0;}
  function tick() {
    timer.timeRemaining--;
    onTick(timer);
    if(timer.timeRemaining <= 60 && this.warnings == 1) {RING.play(); this.warnings=0;}
    if(timer.timeRemaining <= 0) {clearInterval(tickInterval); pomodoro.running = false; onEnd(timer); this.warnings=1;}}
  function tick2() {
    mynow = ((new Date().getTime() / 1000) - timer.pomodoro.marcnow)/(3600 * 24 / RATIONSPERDAY);
    while (timer.pomodoro.elapsed < mynow) {
      timer.pomodoro.elapsed++;
      timer.pomodoro.rationsLeft++;
      if (!timer.pomodoro.running) {setIconText(timer);}}}}
// console.log('Starting');
RING.load();
var mainPomodoro = new Pomodoro();
chrome.browserAction.onClicked.addListener(function(tab) {if(!mainPomodoro.running) {mainPomodoro.start();} else {mainPomodoro.stop();}});
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {if(!mainPomodoro.running) {executeInTabIfBlocked('block', tab);}});
