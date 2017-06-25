(function () {
  function ready() {
    if(!document.getElementById('marctar-pomodoro-extension-overlay')) {
      var overlay = document.createElement('div'), p, img = document.createElement('img');
      var lines = ["Offline!", "Git to work!"];
      overlay.id = 'marctar-pomodoro-extension-overlay';
      overlay.style.position = 'fixed';
      overlay.style.left = 0;
      overlay.style.top = 0;
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.zIndex = 9000001;
      overlay.style.backgroundImage = '-webkit-linear-gradient(bottom, #ccc 0%, #fff 75%)';
      overlay.style.padding = '5em 1em 1em';
      overlay.style.textAlign = 'center';
      overlay.style.color = '#000';
      overlay.style.font = 'normal normal normal 16px/1 sans-serif';
      img.src = chrome.extension.getURL('icons/offline_full.png');
      img.style.marginBottom = '1em';
      overlay.appendChild(img);
      for(var i in lines) {
        p = document.createElement('p');
        p.innerText = lines[i];
        p.style.margin = '0 0 .5em 0';
        overlay.appendChild(p);}
      document.body.appendChild(overlay);}}
  if(typeof document === 'undefined') {
    window.addEventListener("DOMContentLoaded", ready);
  } else {ready();}})();
