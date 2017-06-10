// This is adapted from matchu's [Strict Workflow](https://github.com/matchu/Strict-Workflow)
//  Constants
var PREFS = {siteList: ['marcpickett1.github.io', '127.0.0.1:4000', 'marcpickett.com', 'mail.google.com', 'hangouts.google.com', 'extensions'],
	     duration: 25 * 60}
var RING = new Audio("ding.ogg");
RING.load();
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
////////////////
function setIconText (timer) {
  chrome.browserAction.setIcon({path: 'icons/offline.png'});
  chrome.browserAction.setBadgeBackgroundColor({color: [0, 0, 0, 255]});
  if (timer.pomodoro.timesLeft <= 0) {chrome.browserAction.setBadgeBackgroundColor({color: [192, 0, 0, 255]});}
  chrome.browserAction.setBadgeText({text: ''});
  chrome.browserAction.setBadgeText({text: timer.pomodoro.timesLeft + ''});}
function onEnd (timer) {
  setIconText(timer);
  executeInAllBlockedTabs('block');}
function onStart (timer) {
  chrome.browserAction.setIcon({path: 'icons/online.png'});
  chrome.browserAction.setBadgeBackgroundColor({color: [192, 0, 0, 255]});
  executeInAllBlockedTabs('unblock');
  var tabViews = chrome.extension.getViews({type: 'tab'}), tab;
  for(var i in tabViews) {
    tab = tabViews[i];
    if(typeof tab.startCallbacks !== 'undefined') {tab.startCallbacks['online']();}}}
function onTick (timer) {chrome.browserAction.setBadgeText({text: formatTime(timer.timeRemaining)});}
function formatTime(tr) {if ((tr % 60) > 9) {return Math.floor(tr/60)+":"+ tr%60;} else {return Math.floor(tr/60)+":0" + tr%60;}}
// console.log('here3');
function Pomodoro() {
  this.running = false; this.timesLeft = 1; this.elapsed = 0
  this.marcnow = new Date().getTime() / 1000;
  this.start = function () {
    this.running = true;
    this.timesLeft--;
    this.currentTimer = new PomodoroTimer(this);
    this.currentTimer.start();}
  this.stop = function () {if(this.running) {this.currentTimer.stop();}}
  this.currentTimer = new PomodoroTimer(this);
}
function PomodoroTimer(pomodoro) {
  var tickInterval, tickInterval2 = setInterval(tick2, 1000), timer = this;
  this.pomodoro = pomodoro;
  this.timeRemaining = PREFS.duration;
  this.warnings = 1;
  this.start = function() {tickInterval = setInterval(tick, 1000); onStart(this); onTick(this);}
  this.stop = function() {this.timeRemaining = 0;}
  function tick() {
    timer.timeRemaining--;
    onTick(timer);
    if((timer.timeRemaining <= 60) && (this.warnings == 1)) {RING.play(); this.warnings=0;}
    if(timer.timeRemaining <= 0) {clearInterval(tickInterval); pomodoro.running = false; onEnd(timer); this.warnings=1;}}
  function tick2() {
    mynow = ((new Date().getTime() / 1000) - timer.pomodoro.marcnow)/(3600 * 12);
    while (timer.pomodoro.elapsed < mynow) {
      timer.pomodoro.elapsed++;
      timer.pomodoro.timesLeft++;
      if (!timer.pomodoro.running) {setIconText(timer);}}}}
//
var mainPomodoro = new Pomodoro();
executeInAllBlockedTabs('block');
chrome.browserAction.onClicked.addListener(function (tab) {
  if(!mainPomodoro.running) {mainPomodoro.start();}
  else {mainPomodoro.stop();}});
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if(!mainPomodoro.running) {executeInTabIfBlocked('block', tab);}});
