"use strict";

/*
  TODO:
  confirm mobile support
  always use textContent instead of innerText
  animate flying butterflies or something?
  verify that the final cell can actually complete
  verify that completing the final cell shows the win screen

*/

class App {
  constructor() {
    this.disableSaves = false;

    this.storageKey = 'KBToT';
    this.firstLoad = false;
    this.loadFromStorage();
    this.enableConfetti = false;
    this.confettiPieces = [];

    this.rows = 13;
    this.memobn = {'1,1': 1}; //memoization storage for getBellNum
    this.cellList = [];
    this.tickPeriod = 1000;
    this.minLuck = -1.2;
    this.favicons = ['./favicon.png', './faviconAlert.png'];
    this.updateForLuck = true;

    this.initCells();

    this.initUI();


    this.draw();

    const tickInterval = 1000 / 30;
    const workFraction = 0.5; //TODO: tune this value
    this.tickWorkTime = tickInterval * workFraction;

    setInterval(() => this.tick(), tickInterval);
    setInterval(() => this.saveToStorage(), 5000);

    if (this.firstLoad) {
      this.showModal('helpContainer');
    }
  }

  //get the number in the bell triangle at row n and column k
  //recursive so if you try and calculate a very large number it may exceed the
  //call stack except if you call values from low to high and fill up the 
  //memoization buffer first
  getBellNum(n, k) {
    const m = this.memobn[`${n},${k}`];
    if (m !== undefined) {return m;}

    if (k === 1) {
      const val = this.getBellNum(n - 1, n - 1);
      this.memobn[`${n},${k}`] = val;
      return val;
    }

    const val = this.getBellNum(n, k - 1) + this.getBellNum(n - 1, k - 1);
    this.memobn[`${n},${k}`] = val;
    return val;
  }

  getHarmonic(n) {
    let result;
    //if n is small, calculate directly, otherwise, use approximation
    if (n < 60) {
      result = 0;
      for (let i = 1; i <= n; i++) {
        result += 1 / i;
      }
    } else {
      const gamma = 0.5772156649 //euler-mascheroni constant
      result = (Math.log(n) + gamma);
    }
    return result;
  }

  getExpectedTries(n) {
    //https://brilliant.org/wiki/coupon-collector-problem/
    return Math.round(this.getHarmonic(n) * n);
  }

  getExpectedRemainingTries(n, m) {
    //via help from Microsoft Copilot
    return Math.round(this.getHarmonic(n - m) * n);
  }

  getStdDev(n) {
    //https://brilliant.org/wiki/coupon-collector-problem/
    let variance;
    if (n < 60) {
      variance = 0;
      for (let i = 1; i <= n; i++) {
        variance += 1 / (i * i);
      }
      variance *= n * n;
      variance -= n * this.getHarmonic(n);
    } else {
      const gamma = 0.5772156649 //euler-mascheroni constant
      variance = (Math.PI * Math.PI * n * n / 6) - n * (Math.log(n) + gamma) - 1/2;
    }
    return Math.sqrt(variance);
  }

  calcLuck(cell) {
    if (cell.cnt === 1) {return 0;}
    return -(cell.att - cell.exp)/cell.std;
  }

  calcExpTime(cell, restart) {
    const expectedRemainingTries = this.getExpectedRemainingTries(cell.cnt, restart ? 0 : cell.fnd);
    const expectedRemainingTime = expectedRemainingTries * this.getTickPeriod();
    return expectedRemainingTime;
  }

  timeToObj(t) {
    const result = {};

    result.y = Math.floor(t / (365 * 24 * 60 * 60));
    t = t % (365 * 24 * 60 * 60);
    result.d = Math.floor(t / (24 * 60 * 60));
    t = t % (24 * 60 * 60);
    result.h = Math.floor(t / (60 * 60));
    t = t % (60 * 60);
    result.m = Math.floor(t / 60);
    t = t % 60;
    result.s = t;

    return result;
  }  

  remainingToStr(ms, full) {
    if (ms === Infinity) {
      return 'Infinity';
    }

    const timeObj = this.timeToObj(ms / 1000);

    if (full) {
      return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}:${timeObj.s.toFixed(1).padStart(4,0)}`;
    }

    //if (timeObj.y > 0 || timeObj.d > 0 || timeObj.h > 0) {
      //return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}`;
      return `${timeObj.y}:${timeObj.d.toString().padStart(3,0)}:${timeObj.h.toString().padStart(2,0)}:${timeObj.m.toString().padStart(2,0)}:${Math.ceil(timeObj.s).toString().padStart(2,0)}`;
    //} else {
      //return `${timeObj.m.toString().padStart(2,0)}:${timeObj.s.toFixed(1).padStart(4,0)}`;
    //  return `${timeObj.m.toString().padStart(2,0)}:${Math.ceil(timeObj.s).toString().padStart(2,0)}`;
    //}

  }  

  initCells() {
    this.totalCount = 0;
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        let cell;
        if (this.state.cells[`${row},${col}`] === undefined) {
          const count = this.getBellNum(row, col);
          cell = {
            cnt: count, //count
            att: 0, //attempts
            fnd: 0, //found
            cmp: 0, //complete
            run: 0, //running
            exp: this.getExpectedTries(count), //expected tries
            std: this.getStdDev(count), //stddev of expected tries
            lck: 0, //luck
            upd: 1  //updated
          };
          this.state.cells[`${row},${col}`] = cell;
        } else {
          cell = this.state.cells[`${row},${col}`];
        }

        this.totalCount += cell.cnt;
        cell.upd = 1;

        this.cellList.push(cell);
      }
    }
  }

  createElement(parentElement, type, id, classList, text) {
    const e = document.createElement(type);

    if (id !== undefined && id !== '') {
      e.id = id;
      this.UI[id] = e;
    }

    if (classList !== undefined && classList.length > 0) {
      classList.split(',').forEach( className => {
        e.classList.add(className);
      });
    }

    if (text !== undefined) {
      if (typeof text === 'string' && text.length > 0) {
        e.textContent = text;
      } else if (typeof text === 'number') {
        e.textContent = text;
      }
    }

    if (parentElement !== undefined) {
      parentElement.appendChild(e);
    }

    return e;
  }

  initUI() {
    this.UI = {};

    const staticIDs = 'cellsContainer,resetButton,resetContainer,resetYes,resetNo,imexContainer,imexShow,imexImport,imexExport,imexClose,imexText,infoPlayTime,infoNext,infoTimeRemaining,infoProgress,infoLuckTick,linkIcon,helpButton,helpContainer,helpClose,winContainer,winClose'.split(',');
    staticIDs.forEach( id => {
      this.UI[id] = document.getElementById(id);
    });

    this.UI.resetButton.onclick = () => this.showModal('resetContainer');
    this.UI.resetYes.onclick = () => this.reset();
    this.UI.resetNo.onclick = () => this.closeModal('resetContainer');
    this.UI.imexShow.onclick = () => this.showModal('imexContainer');
    this.UI.imexClose.onclick = () => this.closeModal('imexContainer');
    this.UI.imexImport.onclick = () => this.import();
    this.UI.imexExport.onclick = () => this.export();
    this.UI.helpButton.onclick = () => this.showModal('helpContainer');
    this.UI.helpClose.onclick = () => this.closeModal('helpContainer');
    this.UI.winClose.onclick = () => {
      this.enableConfetti = false;
      this.closeModal('winContainer');
    };

    for (let row = 1; row <= this.rows; row++) {
      const rowE = this.createElement(this.UI.cellsContainer, 'div', '', 'row');
      for (let col = 1; col <= row; col++) {
        const cellInfo = this.state.cells[`${row},${col}`];
        const cellC = this.createElement(rowE, 'div', `cell_${row},${col}`, 'cellTop,cellEmpty');
        if (cellInfo.run === 1) {
          cellC.classList.add(cellInfo.cnt % 2 === 0 ? 'cellEven' : 'cellOdd');
        }
        if (col === row) {
          cellC.classList.add('cellRowEnd');
        }
        if (row === 1) {
          cellC.classList.add('cellRowTop');
        }
        if (row === this.rows) {
          if (col === 1) {
            cellC.classList.add('cellRowBotStart');
          }
          if (col === row) {
            cellC.classList.add('cellRowBotEnd');
          }
        }
        const progressClasses = cellInfo.cnt % 2 === 0 ? 'cellProgress,cellProgressEven' : 'cellProgress,cellProgressOdd';
        const cellP = this.createElement(cellC, 'div', `progress_${row},${col}`, progressClasses);
        const cellFGC = this.createElement(cellC, 'div', '', 'cellFGContainer');
        const cellS = this.createElement(cellFGC, 'div', `symbol_${row},${col}`, 'cellFG,cellSymbol', '');
        const cellN = this.createElement(cellFGC, 'div', `num_${row},${col}`, 'cellFG,bellNum', cellInfo.cnt);
        if (row === 1) {
          cellN.style.borderRadius = '7px 0px 0px 0px';
        }
        const cellE = this.createElement(cellFGC, 'div', `exp_${row},${col}`, 'cellFG,cellExp', '');
        const cellI = this.createElement(cellFGC, 'div', `info_${row},${col}`, 'cellFG,cellInfo', '');
        const cellL = this.createElement(cellFGC, 'div', `luck_${row},${col}`, 'cellFG,cellLuck', '');
        const cellT = this.createElement(cellFGC, 'div', `time_${row},${col}`, 'cellFG,cellTime', '');
        if (row === this.rows && col === 1) {
          cellT.style.borderRadius = '0px 0px 0px 7px';
        }
        cellC.onclick = () => this.clickCell(row, col);
      }
    }
  }

  loadFromStorage() {
    const rawState = localStorage.getItem(this.storageKey);

    this.state = {
      savedTicks: 0,
      cells: {},
      totalLuck: 0
    };

    if (rawState !== null) {
      const loadedState = JSON.parse(rawState);
      this.state = {...this.state, ...loadedState};
    } else {
      this.state.gameStart = (new Date()).getTime();
      this.state.lastTick = this.state.gameStart;
      this.firstLoad = true;
    }

    this.saveToStorage();
  }

  saveToStorage() {
    if (this.disableSaves) {return;}

    const saveString = JSON.stringify(this.state);
    localStorage.setItem(this.storageKey, saveString);
  }

  reset() {
    this.disableSaves = true;
    localStorage.removeItem(this.storageKey);
    window.location.reload();
  }

  genExportStr() {
    this.saveToStorage();

    const saveString = localStorage.getItem(this.storageKey);
    const compressArray = LZString.compressToUint8Array(saveString);
    const exportChars = 'kristenbell'.split``;
    let exportArray = new Array(compressArray.length * 8);
    for (let i = 0; i < compressArray.length; i++) {
      const val = compressArray[i];
      for (let b = 7; b >= 0; b--) {
        const bit = (val & (1 << b)) >> b;
        const cif = (i * 8 + (7 - b)) 
        const ci = cif % exportChars.length;
        const c = (bit === 1) ? exportChars[ci].toUpperCase() : exportChars[ci];
        exportArray[cif] = c;
      }
    }

    return exportArray.join``;

  }

  decodeExportStr(str) {
    const arraySize = Math.round(str.length / 8);
    const compressArray = new Uint8Array(arraySize);
    
    for (let i = 0; i < arraySize; i++) {
      let val = 0;
      for (let b = 7; b >=0; b--) {
        const cif = i * 8 + (7 - b);
        const c = str[cif];
        const bit = c === c.toUpperCase() ? 1 : 0;
        val = val | (bit << b);
      }
      compressArray[i] = val;
    }

    const saveString = LZString.decompressFromUint8Array(compressArray);
    return saveString;    
  }

  export() {
    this.UI.imexText.value = this.genExportStr();
  }

  import() {
    const importString = this.UI.imexText.value.trim();
    if (importString.length % 8 !== 0) {
      console.error("Corrupted import string. Must be multiple of 8 characters long.");
      return;
    }
    const decodedStr = this.decodeExportStr(importString);
    let state;
    try {
      state = JSON.parse(decodedStr);
    } catch (error) {
      console.error("Corrupted import string. JSON.parse check failed.");
      return;
    }

    this.disableSaves = true;
    localStorage.setItem(this.storageKey, decodedStr);
    window.location.reload();  
  }

  draw() {
    let minTimeRemaining = Infinity;
    let totalTimeRemaining = 0;
    let completeCount = 0;
    let incompleteClickable = false;
    for (let row = 1; row <= this.rows; row++) {
      for (let col = 1; col <= row; col++) {
        const RC = `${row},${col}`;
        const cell = this.state.cells[RC]
        completeCount += cell.cmp === 1 ? cell.cnt : cell.fnd;
        const expTime = cell.run === 1 ? this.calcExpTime(cell) : this.calcExpTime(cell, true);
        totalTimeRemaining += cell.cmp === 0 ? expTime : 0;
        if (cell.run === 1 && cell.cmp === 0) {
          minTimeRemaining = Math.min(minTimeRemaining, expTime);
        }
        const clickable = this.isCellClickable(row, col);
        const cellE = this.UI[`cell_${RC}`];
        if (clickable) {
          cellE.style.cursor = 'default';
          cellE.classList.add(cell.cnt % 2 === 0 ? 'cellEven' : 'cellOdd');
        } else {
          cellE.style.cursor = 'not-allowed';
        }

        incompleteClickable = incompleteClickable || (cell.cmp === 0 && clickable);

        //only do remaining cell specific DOM actions if this cell has been updated
        if (cell.upd === 0 && !this.updateForLuck) {continue;}
        cell.upd = 0;

        this.UI[`info_${RC}`].textContent = `${cell.att} : ${cell.cnt - cell.fnd}`;
        this.UI[`exp_${RC}`].textContent = cell.exp.toFixed(0);
        const percent = 100 * cell.fnd / cell.cnt;
        this.UI[`progress_${RC}`].style.width = `${percent}%`;

        let baseLuck;
        baseLuck = this.calcLuck(cell);

        if (baseLuck < this.minLuck) {
          this.UI[`luck_${RC}`].textContent = `${this.minLuck.toFixed(1)} (${baseLuck.toFixed(1)})`;
        } else {
          this.UI[`luck_${RC}`].textContent = `${baseLuck.toFixed(1)}`
        }

        this.UI[`symbol_${RC}`].style.display = baseLuck < 0 ? 'block' : 'none';
          
        this.UI[`time_${RC}`].textContent = `${this.remainingToStr(expTime)}`;

      }
    }

    if (this.state.cells[`${this.rows},${this.rows}`].cmp === 1 && this.state.endTime === undefined) {
      this.state.endTime = (new Date()).getTime();
      const playTime = this.state.endTime - this.state.gameStart;
      this.UI.winPlayTime.innerText = this.remainingToStr(playTime, true);
      this.showModal('winContainer');
      this.enableConfetti = true;
      this.saveToStorage();
    }

    this.updateForLuck = false;
    
    const curTime = (new Date()).getTime();
    this.UI.infoPlayTime.textContent = this.remainingToStr(curTime - this.state.gameStart, true);
    const minTimeRemainingStr = this.remainingToStr(minTimeRemaining);
    this.UI.infoNext.textContent = minTimeRemainingStr;
    this.UI.infoTimeRemaining.textContent = this.remainingToStr(totalTimeRemaining);
    this.UI.infoLuckTick.textContent = `${this.state.totalLuck.toFixed(1)} / ${this.tickPeriod.toFixed(3)} ms`;

    
    const percent = 100 * completeCount / this.totalCount;
    this.UI.infoProgress.style.width = `${percent}%`;

    const icon = this.favicons[+incompleteClickable];
    if (this.UI.linkIcon.href !== icon) {
      this.UI.linkIcon.href = icon;
    }

    document.title = `Kristen Bell's Triangle of Transcendence - ${minTimeRemainingStr}`;

    window.requestAnimationFrame(() => this.draw());
  }

  processTick() {
    this.cellList.forEach( cell => {
      if (cell.run === 0) {return;}

      cell.upd = 1;
      const rndVal = Math.random();
      const thresh = (cell.cnt - cell.fnd) / cell.cnt;
      cell.att += 1;
      if (rndVal <= thresh) {
        cell.fnd += 1;
      }

      if (cell.fnd >= cell.cnt) {
        cell.cmp = 1;
        cell.run = 0;
        this.state.totalLuck -= cell.lck * cell.cnt;
        cell.lck = Math.max(this.minLuck, this.calcLuck(cell));
        this.state.totalLuck += cell.lck * cell.cnt;
        this.updateForLuck = true;
      }
    });
  }

  getTickPeriod() {
    /*
      f(0) = 1000
      f(max) = 5.2937
      the function is linear with respect to the luckPow power of total luck
    */
    
    const basePeriod = 1000;
    const minPeriod = 5.2937; //targets 30 days for final cell 
    const totalCountPre = 163254884; //total count including everything but the last cell
    const targetLuck = 0.75; //equation calibrated for this luck value on all completed cells
    const maxLuck = totalCountPre * targetLuck;
    const baseLuck = 0;
    const slope = (minPeriod - basePeriod) / (maxLuck - baseLuck);
    const luckPow = 0.05385; //with this value, the total run time, if everything is at luck of 0.75 is 5 years
    const invPowMaxLuck = Math.pow(maxLuck, 1 - luckPow);
    const boundTotalLuck = Math.max(0, this.state.totalLuck);
    const calcPeriod = basePeriod + slope * Math.pow(boundTotalLuck, luckPow) * invPowMaxLuck; 
    return Math.max(1, calcPeriod);
  }

  tick() {
    this.tickPeriod = this.getTickPeriod();
    let curTime = (new Date()).getTime();
    const sleepTime = curTime - this.state.lastTick;
    let missingTicks = this.state.savedTicks + sleepTime / this.tickPeriod;
    const stopTime = curTime + this.tickWorkTime;
    const maxTicksPerCycle = 100; //TODO: tune this value

    if (this.enableConfetti) {
      const rect = this.UI.winContainer.getBoundingClientRect();
      const xl = rect.left + window.scrollX;
      const xr = rect.right + window.scrollX;
      const yt = rect.top + window.scrollY;
      const yb = rect.bottom + window.scrollY;
      this.createConfetti(xl, yt); 
      this.createConfetti(xl, yb); 
      this.createConfetti(xr, yt); 
      this.createConfetti(xr, yb); 
    }

    //try and process as many ticks as possible without taking too long
    while (missingTicks >= 1 && curTime < stopTime) {
      //process maxTicksPerCycle since the overhead of checking after each tick
      //  is probably a lot vs the expense of just processing a tick
      for (let i = 0; i < maxTicksPerCycle; i++) {
        this.processTick();
        missingTicks -= 1;
        if (missingTicks < 1) {
          break;
        }
      }
      curTime = (new Date()).getTime();
    }
    
    this.state.lastTick = curTime;
    this.state.savedTicks = missingTicks;
  }

  showModal(id) {
    document.querySelector('body').classList.add('blur2px');
    this.UI[id].showModal();
  }

  closeModal(id) {
    this.UI[id].close();
    document.querySelector('body').classList.remove('blur2px');
  }

  startCell(cellInfo) {
    cellInfo.att = 0;
    cellInfo.fnd = 0;
    cellInfo.run = 1;
  }

  isCellClickable(row, col) {
    const cellInfo = this.state.cells[`${row},${col}`];
    if (cellInfo.run !== 0) {return false;}

    if (row === 1 && col === 1) {return true;}

    const depRow = col === 1 ? row - 1 : row;
    const depCol = col === 1 ? row - 1 : col - 1;
    const depCellInfo = this.state.cells[`${depRow},${depCol}`];
    return depCellInfo.cmp === 1;
  }

  clickCell(row, col) {
    if (this.isCellClickable(row, col)) {
      const cellInfo = this.state.cells[`${row},${col}`];
      this.startCell(cellInfo);
    }
  }

  createConfetti(x, y) {
    const confetti = document.createElement('div');
    confetti.classList.add('confetti');
    this.UI.winContainer.appendChild(confetti);

    const angle = 2 * Math.PI * Math.random();
    const distance = 100;
    const dx = distance * Math.cos(angle);
    const dy = distance * Math.sin(angle);
    const h = Math.random() * 360;
    confetti.style.backgroundColor = `hsl(${h}, 100%, 50%)`;

    const animation = confetti.animate([
      {
        transform: `translate(${x}px, ${y}px)`,
        opacity: 1
      },
      {
        transform: `translate(${x + dx}px, ${y + dy}px)`,
        opacity: 0
      }
    ], {
      duration: 1000 + Math.random() * 1000,
      easing: 'cubic-bezier(0, .9, .57, 1)',
      delay: Math.random() * 200
    });

    animation.onfinish = () => {
      confetti.remove();
    };
  }
}

const app = new App();



/*
Below is pieroxy's LZString and license
*/

/*
MIT License

Copyright (c) 2013 pieroxy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});

